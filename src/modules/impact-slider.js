import EmblaCarousel from "embla-carousel";

import { freezeAndDestroy, press, requireElement } from "../dom.js";
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

// A card an editor has not finished is skipped, not thrown on. This used to
// throw, and the throw landed before the list was cleared and the source
// hidden — so one empty paragraph in the Rich Text left the raw source on the
// page next to the Designer's placeholder slide, with no slider and no retry.
// An unfinished card should cost that card and nothing else.
function readCards(source) {
	const cards = [];

	for (const title of source.querySelectorAll("h3")) {
		const body = title.nextElementSibling;

		if (!isTag(body, "p")) continue;

		const after = body.nextElementSibling;
		const italic = isTag(after, "p") ? textOf(after.querySelector(":scope > em, :scope > i")) : "";
		const card = { title: textOf(title), body: textOf(body), italic };

		if (!card.title || !card.body) continue;

		cards.push(card);
	}

	return cards;
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

	const arrows = [...(arrowsWrap?.querySelectorAll(impactConfig.arrowSelector) ?? [])];

	// Missing arrows cost the arrows. Dragging still works, and throwing here
	// left real cards on the page with no slider at all.
	if (arrows.length < 2) return null;

	return { previous: arrows[0], next: arrows[1] };
}

function buildSection(section, signal) {
	const viewport = buildSlides(section);

	if (!viewport) return;

	const arrows = readArrows(section, viewport);

	const embla = EmblaCarousel(viewport, {
		loop: false,
		align: "end",
		containScroll: "trimSnaps",
		skipSnaps: true,
	});

	grabCursor(viewport, impactConfig.grabbingClass, signal);
	signal?.addEventListener("abort", () => freezeAndDestroy(embla, viewport.firstElementChild));

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
