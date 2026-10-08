import { animate, inView } from "motion";

import { claimOnce, press } from "../dom.js";

/**
 * Process tabs: one step showing at a time, numbered tabs underneath, and a
 * line along the active tab that fills before the next step comes up.
 *
 *   <section data-process-tabs>
 *     …<div data-process-step>…</div> × n (the Steps slot)
 *     <div role="tablist">
 *       <div data-process-tab><div>01</div><div class="process-tabs_progress"></div></div>
 *     </div>
 *   </section>
 *
 * The Designer holds every step and one tab. This copies the tab once per step
 * and numbers it, so the tabs always match the steps in the slot. Before it
 * runs, and without JavaScript, every step reads in order down the page.
 *
 * Steps are hidden with the `hidden` attribute, so a step's own class must not
 * set display. The active tab takes the `is-active` combo class the Designer
 * styles. The steps move on by themselves only while the section is on screen,
 * and stop for good once a visitor picks a tab. Reduced motion never moves them.
 */

const config = {
	step: 7, // seconds each step shows before the next
	ease: "linear",
	activeClass: "is-active",
};

export function initProcessTabs(root = document, { signal } = {}) {
	for (const section of root.querySelectorAll("[data-process-tabs]")) {
		if (!claimOnce(section, "data-process-tabs-claimed")) continue;

		const steps = [...section.querySelectorAll("[data-process-step]")];
		const template = section.querySelector("[data-process-tab]");

		if (steps.length < 2 || !template) continue;

		run(section, steps, template, signal);
	}
}

function run(section, steps, template, signal) {
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const key = Math.random().toString(36).slice(2, 8);

	const tabs = steps.map((step, index) => {
		const tab = index === 0 ? template : template.cloneNode(true);

		if (index > 0) template.parentElement.append(tab);

		const number = tab.firstElementChild;
		if (number) number.textContent = String(index + 1).padStart(2, "0");

		const tabId = `process-tab-${key}-${index}`;
		const panelId = `process-step-${key}-${index}`;

		tab.id = tabId;
		tab.setAttribute("role", "tab");
		tab.setAttribute("aria-controls", panelId);
		step.id = panelId;
		step.setAttribute("role", "tabpanel");
		step.setAttribute("aria-labelledby", tabId);

		const title = step.querySelector("h1, h2, h3, h4, h5, h6");
		if (title) tab.setAttribute("aria-label", title.textContent.trim());

		return tab;
	});

	let active = 0;
	let auto = !reduced;
	let onScreen = false;
	let progress = null;

	const fill = (tab) => tab.querySelector(".process-tabs_progress");

	const stopProgress = () => {
		progress?.stop();
		progress = null;
	};

	const show = (index, { focus = false } = {}) => {
		// Stopping an animation writes its last value to the element, so the
		// old line has to stop before every line is emptied, not after.
		stopProgress();
		active = index;

		steps.forEach((step, i) => {
			step.hidden = i !== index;
		});

		tabs.forEach((tab, i) => {
			const selected = i === index;

			tab.classList.toggle(config.activeClass, selected);
			tab.setAttribute("aria-selected", String(selected));
			tab.tabIndex = selected ? 0 : -1;

			const line = fill(tab);
			if (line) line.style.transform = "scaleX(0)";
		});

		if (focus) tabs[index].focus();

		play();
	};

	// The line along the active tab fills over one step; when it is full the
	// next step comes up. Off screen it waits where it is.
	const play = () => {
		stopProgress();

		if (!auto || !onScreen) return;

		const line = fill(tabs[active]);
		const done = () => show((active + 1) % steps.length);

		const current = line
			? animate(line, { transform: ["scaleX(0)", "scaleX(1)"] }, { duration: config.step, ease: config.ease })
			: animate(0, 1, { duration: config.step, ease: config.ease });

		progress = current;

		// A stopped run can still settle; only the run that is current moves on.
		current.finished.then(() => {
			if (progress === current && auto && onScreen) done();
		});
	};

	const choose = (index, options) => {
		auto = false;
		stopProgress();
		show(index, options);
	};

	tabs.forEach((tab, index) => {
		press(tab, () => choose(index), signal);

		tab.addEventListener(
			"keydown",
			(event) => {
				const last = tabs.length - 1;
				const next = {
					ArrowRight: index === last ? 0 : index + 1,
					ArrowLeft: index === 0 ? last : index - 1,
					Home: 0,
					End: last,
				}[event.key];

				if (next === undefined) return;

				event.preventDefault();
				choose(next, { focus: true });
			},
			{ signal },
		);
	});

	show(0);

	const stopWatching = inView(section, () => {
		onScreen = true;
		play();

		return () => {
			onScreen = false;
			stopProgress();
		};
	});

	signal?.addEventListener("abort", () => {
		stopProgress();
		stopWatching();
	});
}
