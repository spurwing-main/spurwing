import EmblaCarousel from "embla-carousel";

import { claimOnce, freezeAndDestroy, press } from "../dom.js";
import { grabCursor } from "./slider-controls.js";

// The case study's "Impact stats" field is one bulleted list, one stat per
// bullet: a bold number, the label, and an optional italic note. The list is
// the slider: Embla moves the Rich Text's own <ul>, and the look of each slide
// is CSS on `.impact_rt li`, so nothing is copied, hidden or rebuilt here.
const impactConfig = {
	sectionSelector: ".section_impact",
	viewportSelector: ".embla",
	arrowsSelector: ".slider_arrows",
	arrowSelector: ".slider_arrow",
	layoutSelector: ".impact_layout",
	claimAttr: "data-impact-ready",
	grabbingClass: "is-grabbing",
};

export function initImpactSlider(root = document, { signal } = {}) {
	root.querySelectorAll(impactConfig.sectionSelector).forEach((section) => {
		// During a page transition both pages are in the DOM; claim each section
		// once so the outgoing one is not set up a second time.
		if (!claimOnce(section, impactConfig.claimAttr)) return;

		const viewport = section.querySelector(impactConfig.viewportSelector);
		const list = viewport?.querySelector("ul");

		// A case study with no stats has nothing to show.
		if (!list?.children.length) {
			section.style.display = "none";
			return;
		}

		buildSlider(section, viewport, list, signal);
	});
}

// One fact, one attribute. The look and the pointer-events belong to the CSS
// that already styles [aria-disabled] on the shared arrows.
function setDisabled(arrow, isDisabled) {
	arrow.setAttribute("aria-disabled", String(isDisabled));
	arrow.setAttribute("tabindex", isDisabled ? "-1" : "0");
}

function readArrows(section, viewport) {
	const arrowsWrap =
		section.querySelector(impactConfig.arrowsSelector) ||
		viewport.closest(impactConfig.layoutSelector)?.querySelector(impactConfig.arrowsSelector);

	const arrows = [...(arrowsWrap?.querySelectorAll(impactConfig.arrowSelector) ?? [])];

	// Missing arrows cost the arrows. Dragging still works.
	if (arrows.length < 2) return null;

	return { previous: arrows[0], next: arrows[1] };
}

function buildSlider(section, viewport, list, signal) {
	const arrows = readArrows(section, viewport);

	const embla = EmblaCarousel(viewport, {
		container: list,
		loop: false,
		align: "end",
		containScroll: "trimSnaps",
		skipSnaps: true,
	});

	grabCursor(viewport, impactConfig.grabbingClass, signal);
	signal?.addEventListener("abort", () => freezeAndDestroy(embla, list));

	if (!arrows) return;

	const syncArrows = () => {
		setDisabled(arrows.previous, !embla.canScrollPrev());
		setDisabled(arrows.next, !embla.canScrollNext());
	};

	// The arrows carry tabindex, so they answer the keyboard as well as the mouse.
	press(arrows.previous, () => embla.scrollPrev(), signal);
	press(arrows.next, () => embla.scrollNext(), signal);

	embla.on("select", syncArrows).on("reInit", syncArrows);

	syncArrows();
}
