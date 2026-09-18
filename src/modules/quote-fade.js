import Swiper from "../swiper.js";

const quoteFadeConfig = {
	rootSelector: ".dc-quote",
	wrapperSelector: ".w-dyn-items",
	builtAttr: "data-quote-fade-built",
	progressVar: "--quote-progress",
	delay: 5000,
	speed: 600,
};

export function initQuoteFade(root = document, { signal } = {}) {
	const roots = Array.from(root.querySelectorAll(quoteFadeConfig.rootSelector));

	if (!roots.length) return;


	roots.forEach((quote) => initQuote(quote, signal));
}

function prefersReducedMotion() {
	if (typeof window.matchMedia !== "function") return false;

	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initQuote(quote, signal) {
	// Swiper takes the Collection List over in place, so a second run would put
	// a second slider on the same element.
	if (quote.hasAttribute(quoteFadeConfig.builtAttr)) return;

	const wrapper = quote.querySelector(quoteFadeConfig.wrapperSelector);

	if (!wrapper) return;

	const slides = Array.from(wrapper.children);

	// A single testimonial is the normal case on most pages, and one slide is a
	// static quote rather than a carousel. Leaving the Collection List untouched
	// keeps its own markup and styling intact.
	if (slides.length < 2) return;

	quote.setAttribute(quoteFadeConfig.builtAttr, "");
	quote.classList.add("swiper");
	wrapper.classList.add("swiper-wrapper");

	slides.forEach(function (slide) {
		slide.classList.add("swiper-slide");
	});

	const reduced = prefersReducedMotion();

	// The design draws a rule along the bottom of the card that fills as the
	// autoplay runs. Swiper reports the time left as 1 down to 0, so the filled
	// fraction is its complement; CSS turns the property into a width.
	function setProgress(filled) {
		quote.style.setProperty(quoteFadeConfig.progressVar, String(filled));
	}

	const swiper = new Swiper(quote, {
		slidesPerView: 1,
		loop: true,
		autoHeight: true,
		speed: reduced ? 0 : quoteFadeConfig.speed,
		effect: "fade",
		fadeEffect: { crossFade: true },
		// The quote is read, not browsed: dragging a cross-fade reads as a fault.
		allowTouchMove: false,
		a11y: { enabled: false },
		autoplay: reduced
			? false
			: {
					delay: quoteFadeConfig.delay,
					disableOnInteraction: false,
					pauseOnMouseEnter: true,
				},
		on: reduced
			? {}
			: {
					autoplayTimeLeft: function (instance, time, progress) {
						setProgress(1 - progress);
					},
					slideChangeTransitionStart: function () {
						setProgress(0);
					},
				},
	});

	// Swiper's autoplay is a timer loop with its own resize listener and
	// observer, and the quote markup is swapped out from under it on every
	// navigation. Without this each visit leaves one running against a detached
	// list for the rest of the session.
	signal?.addEventListener("abort", () => swiper.destroy(true, true));
}
