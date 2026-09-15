import EmblaCarousel from "embla-carousel";

import { requireElement } from "../dom.js";
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
		embla.on("init", rebuildDots).on("reInit", rebuildDots).on("select", selectDot);

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
	signal?.addEventListener("abort", disable);

	sync();
}
