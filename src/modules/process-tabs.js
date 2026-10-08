import { animate, inView } from "motion";

import { claimOnce, press } from "../dom.js";

/**
 * Process tabs: one step showing at a time, a tab per step underneath named by
 * the step's title, and one line under the tabs that fills over the step
 * showing before the next step comes up.
 *
 *   <section data-process-tabs>
 *     …<div data-process-step>…</div> × n (the Steps slot)
 *     <div role="tablist">
 *       <div data-process-tab><div>Discovery</div></div>
 *     </div>
 *     <div class="process-tabs_track"><div data-process-progress></div></div>
 *   </section>
 *
 * The Designer holds every step and one tab. This copies the tab once per step
 * and names it after the step's heading, so the tabs always match the steps in
 * the slot. Before it runs, and without JavaScript, every step reads in order
 * down the page.
 *
 * Steps are hidden with the `hidden` attribute, so a step's own class must not
 * set display. The active tab takes the `is-active` combo class the Designer
 * styles. The steps move on by themselves only while the section is on screen,
 * and stop for good once a visitor picks a tab. Whenever the step changes the
 * line fades out and starts again from empty, so it never jumps or runs back.
 * Reduced motion never moves them, and the line stays empty.
 */

const config = {
	step: 7, // seconds each step shows before the next
	ease: "linear",
	fade: 0.4, // seconds the line takes to fade out when the step changes
	fadeEase: "easeOut",
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

		// Each tab reads as its step's title; a step without one falls back to its number.
		const title = step.querySelector("h1, h2, h3, h4, h5, h6");
		const label = tab.firstElementChild;
		if (label) label.textContent = title?.textContent.trim() || String(index + 1).padStart(2, "0");

		const tabId = `process-tab-${key}-${index}`;
		const panelId = `process-step-${key}-${index}`;

		tab.id = tabId;
		tab.setAttribute("role", "tab");
		tab.setAttribute("aria-controls", panelId);
		step.id = panelId;
		step.setAttribute("role", "tabpanel");
		step.setAttribute("aria-labelledby", tabId);

		return tab;
	});

	let active = 0;
	let auto = !reduced;
	let onScreen = false;
	let filled = 0;
	let filling = null;
	let fading = null;

	const fill = section.querySelector("[data-process-progress]");

	// Motion counts and this writes the line. Animating the line itself let
	// Motion write its finished value back after the next step had redrawn it.
	const draw = (value) => {
		filled = value;
		if (fill) fill.style.transform = `scaleX(${value})`;
	};

	const stopFilling = () => {
		filling?.stop();
		filling = null;
	};

	// The line fills over one step, then the next step comes up. Off screen it
	// waits where it is and carries on from there.
	const play = () => {
		stopFilling();

		if (!auto || !onScreen || fading) return;

		const current = animate(filled, 1, {
			duration: config.step * (1 - filled),
			ease: config.ease,
			onUpdate: draw,
		});

		filling = current;

		// A stopped run can still settle; only the run that is current moves on.
		current.finished.then(() => {
			if (filling === current && auto && onScreen) show((active + 1) % steps.length);
		});
	};

	// A new step starts from an empty line. A line with anything in it fades
	// out first, then empties out of sight.
	const empty = () => {
		stopFilling();
		fading?.stop();
		fading = null;

		if (!fill || !filled || reduced) {
			draw(0);
			if (fill) fill.style.opacity = "";
			play();
			return;
		}

		const current = animate(Number(fill.style.opacity || 1), 0, {
			duration: config.fade,
			ease: config.fadeEase,
			onUpdate: (value) => {
				fill.style.opacity = String(value);
			},
		});

		fading = current;

		current.finished.then(() => {
			if (fading !== current) return;

			fading = null;
			draw(0);
			fill.style.opacity = "";
			play();
		});
	};

	const show = (index, { focus = false } = {}) => {
		active = index;

		steps.forEach((step, i) => {
			step.hidden = i !== index;
		});

		tabs.forEach((tab, i) => {
			const selected = i === index;

			tab.classList.toggle(config.activeClass, selected);
			tab.setAttribute("aria-selected", String(selected));
			tab.tabIndex = selected ? 0 : -1;
		});

		if (focus) tabs[index].focus();

		empty();
	};

	const choose = (index, options) => {
		auto = false;
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

		// A fade finishes on its own; only the filling waits.
		return () => {
			onScreen = false;
			stopFilling();
		};
	});

	signal?.addEventListener("abort", () => {
		stopFilling();
		fading?.stop();
		stopWatching();
	});
}
