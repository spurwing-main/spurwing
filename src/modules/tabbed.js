/**
 * The tabbed capabilities section: one stage at a time, one panel open in it.
 *
 * THE SPLIT. This file decides *which* panel is open and says so in one
 * attribute per item. It sets no styles, measures nothing, and knows no
 * duration. The rail width, the expansion, the label's writing mode and the
 * whole collapsed state live in the section's CSS embed, because the Style
 * panel cannot express a transition on a flex property or `display: contents`.
 * Everything the panel *can* express — the 89px rail, the 526px height, type,
 * colour, spacing — is on the classes themselves and editable in the Designer.
 *
 * FAIL OPEN. `data-tabbed-ready` is set here and nowhere else, and every rule
 * that collapses the section is gated on it. With no JavaScript, a blocked
 * bundle or a throw before that line, nothing is hidden: each stage, panel and
 * paragraph renders in normal flow. This is the third component on this site
 * where that gate is the only thing standing between a failure and a blank
 * section, so it goes on last and it goes on once.
 */

import { claimOnce, press } from "../dom.js";

const tabbedConfig = {
	sectionSelector: ".tcp",
	groupSelector: ".tcp_group",
	itemSelector: ".tcp_item",
	panelSelector: ".tcp_panel",
	copySelector: ".tcp_copy",
	stageSelector: ".tcp_stage",
	openAttr: "data-open",
	stageOpenAttr: "data-stage-open",
	currentAttr: "data-current",
	readyAttr: "data-tabbed-ready",
	builtAttr: "data-tabbed-built",
	// Long enough that the row has settled before the first panel opens, short
	// enough that it reads as part of arriving rather than an afterthought.
	introDelayMs: 300,
	introThreshold: 0.2,
};

export function initTabbed(root = document, { signal } = {}) {
	for (const section of root.querySelectorAll(tabbedConfig.sectionSelector)) {
		// Both pages are in the DOM during a transition, so the outgoing section
		// would otherwise be wired a second time.
		if (claimOnce(section, tabbedConfig.builtAttr)) build(section, signal);
	}
}

function build(section, signal) {
	const groups = [...section.querySelectorAll(tabbedConfig.groupSelector)];
	const stages = [...section.querySelectorAll(tabbedConfig.stageSelector)];

	if (!groups.length) return;

	const itemsOf = (group) => [...group.querySelectorAll(tabbedConfig.itemSelector)];

	/** Open one item in one group, and say so where the CSS and a reader can both see it. */
	function open(group, index) {
		itemsOf(group).forEach((item, i) => {
			const isOpen = i === index;

			item.toggleAttribute(tabbedConfig.openAttr, isOpen);
			item.querySelector(tabbedConfig.panelSelector)?.setAttribute("aria-expanded", String(isOpen));
		});
	}

	function showStage(index) {
		groups.forEach((group, i) => group.toggleAttribute(tabbedConfig.stageOpenAttr, i === index));
		stages.forEach((stage, i) => {
			stage.toggleAttribute(tabbedConfig.currentAttr, i === index);
			stage.setAttribute("aria-pressed", String(i === index));
		});
	}

	// An accordion, not a tab list: the panel is the control and the paragraph
	// below the row is the region it names. Ids are assigned here so the
	// Designer markup carries none, and they are unique per section instance.
	groups.forEach((group, g) => {
		const items = itemsOf(group);

		items.forEach((item, i) => {
			const panel = item.querySelector(tabbedConfig.panelSelector);
			const copy = item.querySelector(tabbedConfig.copySelector);

			if (!panel) return;

			const id = `tcp-${g}-${i}`;

			panel.id = `${id}-control`;

			if (copy) {
				copy.id = id;
				copy.setAttribute("role", "region");
				copy.setAttribute("aria-labelledby", panel.id);
				panel.setAttribute("aria-controls", id);
			}

			// press() carries the tabindex, the role and Enter/Space, so a div
			// styled as a control is reachable without a mouse.
			press(panel, () => open(group, i), signal);

			panel.addEventListener(
				"keydown",
				(event) => {
					const step = arrowStep(event.key);

					if (!step) return;

					event.preventDefault();
					items[(i + step + items.length) % items.length]
						?.querySelector(tabbedConfig.panelSelector)
						?.focus();
				},
				{ signal },
			);
		});
	});

	stages.forEach((stage, i) => press(stage, () => showStage(i), signal));

	// The state the page shipped with wins, so the Designer decides what opens.
	const opening = groups.map((group) => Math.max(0, itemsOf(group).findIndex(isOpen)));
	const stageOpening = Math.max(0, groups.findIndex((group) => group.hasAttribute(tabbedConfig.stageOpenAttr)));

	groups.forEach((group, i) => open(group, opening[i]));
	showStage(stageOpening);

	// Last, and only once the section is wired. See the note at the top.
	section.setAttribute(tabbedConfig.readyAttr, "");

	introduce(section, groups[stageOpening], opening[stageOpening], open, signal);
}

/**
 * The section introduces itself: the panels arrive closed and the first one
 * opens when the row is actually on screen, which shows the reader what the
 * panels do without a caption telling them. Reduced motion skips it and leaves
 * the shipped state alone.
 */
function introduce(section, group, index, open, signal) {
	if (!group) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	if (typeof IntersectionObserver !== "function") return;

	let timer = 0;

	for (const item of group.querySelectorAll(tabbedConfig.itemSelector)) {
		item.removeAttribute(tabbedConfig.openAttr);
	}

	const observer = new IntersectionObserver(
		(entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return;

			observer.disconnect();
			timer = window.setTimeout(() => open(group, index), tabbedConfig.introDelayMs);
		},
		{ threshold: tabbedConfig.introThreshold },
	);

	observer.observe(section);

	signal?.addEventListener("abort", () => {
		observer.disconnect();
		clearTimeout(timer);
	});
}

function isOpen(item) {
	return item.hasAttribute(tabbedConfig.openAttr);
}

function arrowStep(key) {
	if (key === "ArrowRight" || key === "ArrowDown") return 1;
	if (key === "ArrowLeft" || key === "ArrowUp") return -1;

	return 0;
}
