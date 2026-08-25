import EmblaCarousel from "https://cdn.jsdelivr.net/npm/embla-carousel@8.5.2/+esm";

const config = {
	rootSelector: ".section_impact",
	emblaSelector: ".embla",
	listSelector: ".impact_list",
	sourceSelector: '[data-card="source"]',
	arrowsWrapSelector: ".slider_arrows",
	arrowSelector: ".slider_arrow",
	slideSelector: ".embla__slide",
	cardAttr: "data-card",
	disabledClass: "is-disabled",
	grabbingClass: "is-grabbing",
};

function getRequired(scope, selector, label = selector) {
	const element = scope.querySelector(selector);

	if (!element) {
		throw new Error(`missing ${label}: expected "${selector}"`);
	}

	return element;
}

function cleanText(value) {
	return String(value ?? "")
		.replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
		.replace(/\u00A0/g, " ")
		.trim();
}

function getText(element) {
	return cleanText(element?.textContent);
}

function assertText(element, label) {
	const text = getText(element);

	if (!text) {
		throw new Error(`empty ${label}: expected text content`);
	}

	return text;
}

function isTag(element, tagName) {
	return element?.tagName === tagName.toUpperCase();
}

function getItalicText(element) {
	if (!element || !isTag(element, "p")) {
		return "";
	}

	const italic = element.querySelector(":scope > em, :scope > i");

	return getText(italic);
}

function getCardElements(h3, cardNumber) {
	const bodyEl = h3.nextElementSibling;

	if (!bodyEl) {
		throw new Error(`card ${cardNumber} missing body: expected a <p> directly after the h3`);
	}

	if (!isTag(bodyEl, "p")) {
		throw new Error(
			`card ${cardNumber} invalid body: expected <p> directly after h3, got <${bodyEl.tagName.toLowerCase()}>`,
		);
	}

	const optionalItalicEl = bodyEl.nextElementSibling;

	return {
		bodyEl,
		italic: getItalicText(optionalItalicEl),
	};
}

function parseCardsFromSource(source) {
	const h3s = [...source.querySelectorAll("h3")];

	return h3s.map((h3, index) => {
		const cardNumber = index + 1;
		const { bodyEl, italic } = getCardElements(h3, cardNumber);

		return {
			title: assertText(h3, `card ${cardNumber} title`),
			body: assertText(bodyEl, `card ${cardNumber} body`),
			italic,
		};
	});
}

function hideSection(root) {
	root.style.display = "none";
}

function buildSlides(root) {
	const source = getRequired(root, config.sourceSelector, "card source");
	const emblaViewport = getRequired(root, config.emblaSelector, "embla viewport");
	const list = getRequired(emblaViewport, config.listSelector, "impact list");
	const templateSlide = getRequired(list, config.slideSelector, "slide template");
	const cards = parseCardsFromSource(source);

	if (!cards.length) {
		hideSection(root);
		return null;
	}

	list.textContent = "";
	list.classList.add("embla__container");

	for (const card of cards) {
		const slide = templateSlide.cloneNode(true);
		slide.classList.add("embla__slide");

		const titleEl = slide.querySelector(`[${config.cardAttr}="1"]`);
		const bodyEl = slide.querySelector(`[${config.cardAttr}="2"]`);
		const italicEl = slide.querySelector(`[${config.cardAttr}="3"]`);

		if (!titleEl || !bodyEl || !italicEl) {
			throw new Error(
				`slide template missing card nodes: expected [${config.cardAttr}="1"], [${config.cardAttr}="2"], [${config.cardAttr}="3"]`,
			);
		}

		titleEl.textContent = card.title;
		bodyEl.textContent = card.body;

		if (card.italic) {
			italicEl.textContent = card.italic;
		} else {
			italicEl.remove();
		}

		list.appendChild(slide);
	}

	source.style.display = "none";

	return emblaViewport;
}

function wireGrabCursor(emblaViewport) {
	const setGrabbing = (isGrabbing) => {
		emblaViewport.classList.toggle(config.grabbingClass, isGrabbing);
	};

	const onPointerDown = (event) => {
		if (event.pointerType === "mouse" && event.button !== 0) return;

		emblaViewport.setPointerCapture?.(event.pointerId);
		setGrabbing(true);
	};

	const onPointerUp = () => {
		setGrabbing(false);
	};

	emblaViewport.addEventListener("pointerdown", onPointerDown, { passive: true });
	emblaViewport.addEventListener("pointerup", onPointerUp, { passive: true });
	emblaViewport.addEventListener("pointercancel", onPointerUp, { passive: true });
	emblaViewport.addEventListener("lostpointercapture", onPointerUp, { passive: true });
	window.addEventListener("blur", onPointerUp);
}

function setDisabled(button, isDisabled) {
	button.classList.toggle(config.disabledClass, isDisabled);
	button.style.pointerEvents = isDisabled ? "none" : "";
	button.style.opacity = isDisabled ? "0.4" : "";
	button.setAttribute("aria-disabled", String(isDisabled));
	button.setAttribute("tabindex", isDisabled ? "-1" : "0");
}

function getArrows(root, emblaViewport) {
	const arrowsWrap =
		root.querySelector(config.arrowsWrapSelector) ||
		emblaViewport.closest(".impact_layout")?.querySelector(config.arrowsWrapSelector);

	if (!arrowsWrap) {
		throw new Error(`missing arrows: expected "${config.arrowsWrapSelector}" near slider`);
	}

	const arrows = [...arrowsWrap.querySelectorAll(config.arrowSelector)];

	if (arrows.length < 2) {
		throw new Error(`missing arrows: expected 2 "${config.arrowSelector}" elements`);
	}

	return {
		prevBtn: arrows[0],
		nextBtn: arrows[1],
	};
}

function initOne(root) {
	const emblaViewport = buildSlides(root);

	if (!emblaViewport) {
		return;
	}

	const { prevBtn, nextBtn } = getArrows(root, emblaViewport);

	const embla = EmblaCarousel(emblaViewport, {
		loop: false,
		align: "end",
		containScroll: "trimSnaps",
		skipSnaps: true,
	});

	wireGrabCursor(emblaViewport);

	const syncArrows = () => {
		setDisabled(prevBtn, !embla.canScrollPrev());
		setDisabled(nextBtn, !embla.canScrollNext());
	};

	prevBtn.addEventListener("click", () => {
		if (embla.canScrollPrev()) {
			embla.scrollPrev();
		}
	});

	nextBtn.addEventListener("click", () => {
		if (embla.canScrollNext()) {
			embla.scrollNext();
		}
	});

	embla.on("select", syncArrows);
	embla.on("reInit", syncArrows);

	syncArrows();
}

document.addEventListener("DOMContentLoaded", () => {
	const roots = [...document.querySelectorAll(config.rootSelector)];

	if (!roots.length) {
		throw new Error(`impact slider init failed: no "${config.rootSelector}" found`);
	}

	roots.forEach(initOne);
});
