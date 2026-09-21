import EmblaCarousel from "embla-carousel";

import { freezeAndDestroy, requireElement } from "../dom.js";
import { buildDots } from "./slider-controls.js";

const rightwayConfig = {
	sliderSelector: ".rightway_slider",
	layoutSelector: ".rightway_layout",
	containerSelector: ".rightway_grid",
	cardSelector: ".rightway_card",
	dotsSelector: ".rightway_dots.carousel-dots",
	dotClass: "carousel-dot",
	selectedDotClass: "is-selected",
	// The grid is the design below this width; above it, the slider is off.
	sliderUpTo: 991,
};

export function initRightway(root = document, { signal } = {}) {
	const slider = root.querySelector(rightwayConfig.sliderSelector);

	if (!slider) return;

	const layout = slider.closest(rightwayConfig.layoutSelector);

	if (!layout) {
		throw new Error(`missing rightway layout: expected "${rightwayConfig.layoutSelector}"`);
	}

	requireElement(slider, rightwayConfig.containerSelector, "rightway grid");
	requireElement(slider, rightwayConfig.cardSelector, "rightway card");

	const dotsNode = requireElement(layout, rightwayConfig.dotsSelector, "rightway dots");
	const isNarrow = window.matchMedia(`(max-width: ${rightwayConfig.sliderUpTo}px)`);

	let embla = null;
	let dots = null;

	function rebuildDots() {
		dots = buildDots(dotsNode, {
			count: embla.scrollSnapList().length,
			label: "Go to slide",
			dotClass: rightwayConfig.dotClass,
			selectedClass: rightwayConfig.selectedDotClass,
			onSelect: (index) => embla.scrollTo(index),
		});

		selectDot();
	}

	function selectDot() {
		dots?.select(embla.selectedScrollSnap());
	}

	function enable() {
		if (embla) return;

		embla = EmblaCarousel(slider, { loop: false, align: "start", containScroll: "trimSnaps" });
		// No .on("init"): Embla emits it after the explicit build below, so
		// listening for it only builds the dots twice.
		embla.on("reInit", rebuildDots).on("select", selectDot);

		rebuildDots();
	}

	function disable() {
		if (!embla) return;

		embla.destroy();
		embla = null;
		dots = null;
		dotsNode.innerHTML = "";
	}

	function sync() {
		if (isNarrow.matches) enable();
		else disable();
	}

	// Without the signal this outlives the page it was built for: the router
	// swaps the DOM but a MediaQueryList is global, so every visit added one.
	isNarrow.addEventListener("change", sync, { signal });
	// Not disable(). That one is for dropping back to the plain grid at a
	// breakpoint, where clearing the transform and the dots is the point. Leaving
	// the page is the opposite: the outgoing page is still on screen and opaque
	// while it fades, so the slides stay where the reader left them.
	signal?.addEventListener("abort", () => {
		if (embla) freezeAndDestroy(embla, slider.querySelector(rightwayConfig.containerSelector));

		embla = null;
	});

	sync();
}
