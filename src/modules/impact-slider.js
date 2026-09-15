import EmblaCarousel from "embla-carousel";

import { requireElement } from "../dom.js";
import { grabCursor } from "./slider-controls.js";

const impactConfig = {
	sectionSelector: ".section_impact",
	viewportSelector: ".embla",
	listSelector: ".impact_list",
	sourceSelector: '[data-card="source"]',
	slideSelector: ".embla__slide",
	arrowsSelector: ".slider_arrows",
	arrowSelector: ".slider_arrow",
	layoutSelector: ".impact_layout",
	slotAttr: "data-card",
	builtAttr: "data-impact-built",
	disabledClass: "is-disabled",
	grabbingClass: "is-grabbing",
};

export function initImpactSlider(root = document, { signal } = {}) {
	root.querySelectorAll(impactConfig.sectionSelector).forEach((section) => {
		// Building the slides consumes the markup they are built from: the Rich
		// Text source is hidden and the template slide is replaced by the real
		// ones. A second run would read its own output, so this is guarded at the
		// section rather than left to whoever calls the module.
		if (section.hasAttribute(impactConfig.builtAttr)) return;

		section.setAttribute(impactConfig.builtAttr, "");
		buildSection(section, signal);
	});
}

/* --- reading the cards out of the Rich Text -----------------------------
   An editor writes the impact cards as one Rich Text block: an <h3> title, a
   <p> body under it, and an optional italic line under that. Each triple
   becomes a slide, so the shapes below are what the Designer promises.
   ---------------------------------------------------------------------- */

function textOf(element) {
	return String(element?.textContent ?? "")
		.replace(/[\u200B-\u200D\uFEFF]/g, "")
		.replace(/\u00A0/g, " ")
		.trim();
}

function isTag(element, tagName) {
	return element?.tagName === tagName.toUpperCase();
}

function readCards(source) {
	return [...source.querySelectorAll("h3")].map((title, index) => {
		const position = index + 1;
		const body = title.nextElementSibling;

		if (!isTag(body, "p")) {
			throw new Error(`card ${position} invalid body: expected a <p> directly after the h3`);
		}

		const after = body.nextElementSibling;
		const italic = isTag(after, "p") ? textOf(after.querySelector(":scope > em, :scope > i")) : "";

		const card = { title: textOf(title), body: textOf(body), italic };

		if (!card.title) throw new Error(`card ${position} has no title`);
		if (!card.body) throw new Error(`card ${position} has no body`);

		return card;
	});
}

// Returns the Embla viewport, or null when the section has nothing to show and
// has hidden itself.
function buildSlides(section) {
	const source = requireElement(section, impactConfig.sourceSelector, "card source");
	const viewport = requireElement(section, impactConfig.viewportSelector, "embla viewport");
	const list = requireElement(viewport, impactConfig.listSelector, "impact list");
	const template = requireElement(list, impactConfig.slideSelector, "slide template");
	const cards = readCards(source);

	if (!cards.length) {
		section.style.display = "none";
		return null;
	}

	list.textContent = "";
	list.classList.add("embla__container");

	for (const card of cards) {
		const slide = template.cloneNode(true);

		slide.classList.add("embla__slide");

		const title = requireElement(slide, `[${impactConfig.slotAttr}="1"]`, "slide title");
		const body = requireElement(slide, `[${impactConfig.slotAttr}="2"]`, "slide body");
		const italic = requireElement(slide, `[${impactConfig.slotAttr}="3"]`, "slide italic");

		title.textContent = card.title;
		body.textContent = card.body;

		if (card.italic) italic.textContent = card.italic;
		else italic.remove();

		list.append(slide);
	}

	source.style.display = "none";

	return viewport;
}

/* --- the slider --------------------------------------------------------- */

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

	if (!arrowsWrap) {
		throw new Error(`missing arrows: expected "${impactConfig.arrowsSelector}" near the slider`);
	}

	const arrows = [...arrowsWrap.querySelectorAll(impactConfig.arrowSelector)];

	if (arrows.length < 2) {
		throw new Error(`missing arrows: expected 2 "${impactConfig.arrowSelector}" elements`);
	}

	return { previous: arrows[0], next: arrows[1] };
}

function buildSection(section, signal) {
	const viewport = buildSlides(section);

	if (!viewport) return;

	const { previous, next } = readArrows(section, viewport);

	const embla = EmblaCarousel(viewport, {
		loop: false,
		align: "end",
		containScroll: "trimSnaps",
		skipSnaps: true,
	});

	const syncArrows = () => {
		setDisabled(previous, !embla.canScrollPrev());
		setDisabled(next, !embla.canScrollNext());
	};

	previous.addEventListener("click", () => embla.scrollPrev(), { signal });
	next.addEventListener("click", () => embla.scrollNext(), { signal });

	grabCursor(viewport, impactConfig.grabbingClass, signal);

	embla.on("select", syncArrows).on("reInit", syncArrows);
	signal?.addEventListener("abort", () => embla.destroy());

	syncArrows();
}
