import EmblaCarousel from "embla-carousel";

import { claimOnce, freezeAndDestroy, press } from "../dom.js";
import { grabCursor } from "./slider-controls.js";

/**
 * Work slider: the case-study cards in one row that drags, with a progress bar
 * and two arrows under it.
 *
 *   <section data-work-slider>
 *     <div data-work-slider-viewport>
 *       …<div role="list"> (the Collection List's items)
 *         <div role="listitem">…</div> × n
 *     <div><div data-work-slider-progress></div></div>
 *     <div data-work-slider-prev>…</div><div data-work-slider-next>…</div>
 *   </section>
 *
 * The row is the first `[role="list"]` in the viewport, so the Collection
 * List's own wrapper can sit between them. The section takes
 * `data-work-slider-ready` once the row is a slider; until then the CSS lets
 * the viewport scroll on its own, so every card can be reached without
 * JavaScript. The bar's fill is as wide as the share of the row on screen and
 * moves along it as the row scrolls, through `--work-slider-thumb` and
 * `--work-slider-progress` (both 0–1); the CSS turns those into a width and a
 * position. Tabbing to a card that is off screen brings it into view.
 */

const config = {
	readyAttr: "data-work-slider-ready",
	grabbingClass: "is-grabbing",
};

export function initWorkSlider(root = document, { signal } = {}) {
	for (const section of root.querySelectorAll("[data-work-slider]")) {
		if (!claimOnce(section, "data-work-slider-claimed")) continue;

		const viewport = section.querySelector("[data-work-slider-viewport]");
		const container = viewport?.querySelector('[role="list"]');

		if (!container || container.children.length < 2) continue;

		run(section, viewport, container, signal);
	}
}

function run(section, viewport, container, signal) {
	const slides = [...container.children];
	const fill = section.querySelector("[data-work-slider-progress]");
	const previous = section.querySelector("[data-work-slider-prev]");
	const next = section.querySelector("[data-work-slider-next]");

	const embla = EmblaCarousel(viewport, {
		container,
		align: "start",
		containScroll: "trimSnaps",
		skipSnaps: true,
	});

	section.setAttribute(config.readyAttr, "");
	grabCursor(viewport, config.grabbingClass, signal);

	const drawProgress = () => {
		if (!fill) return;

		const thumb = Math.min(1, viewport.clientWidth / Math.max(container.scrollWidth, 1));

		fill.style.setProperty("--work-slider-thumb", String(thumb));
		fill.style.setProperty("--work-slider-progress", String(Math.min(1, Math.max(0, embla.scrollProgress()))));
	};

	// One fact, one attribute: the CSS styles [aria-disabled] and the tab order
	// skips an arrow that has nowhere to go.
	const syncArrows = () => {
		for (const [arrow, canMove] of [
			[previous, embla.canScrollPrev()],
			[next, embla.canScrollNext()],
		]) {
			if (!arrow) continue;

			arrow.setAttribute("aria-disabled", String(!canMove));
			arrow.setAttribute("tabindex", canMove ? "0" : "-1");
		}
	};

	if (previous) press(previous, () => embla.scrollPrev(), signal);
	if (next) press(next, () => embla.scrollNext(), signal);

	section.addEventListener(
		"focusin",
		(event) => {
			const index = slides.findIndex((slide) => slide.contains(event.target));

			if (index !== -1 && !embla.slidesInView().includes(index)) embla.scrollTo(index);
		},
		{ signal },
	);

	embla
		.on("scroll", drawProgress)
		.on("select", syncArrows)
		.on("reInit", () => {
			drawProgress();
			syncArrows();
		});

	drawProgress();
	syncArrows();

	signal?.addEventListener("abort", () => {
		freezeAndDestroy(embla, container);
		section.removeAttribute(config.readyAttr);
	});
}
