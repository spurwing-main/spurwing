const quoteFadeConfig = {
	rootSelector: ".dc-quote",
	wrapperSelector: ".w-dyn-items",
	readyValue: "fade-v1",
	delay: 5000,
	speed: 600,
};

export function initQuoteFade(root = document) {
	const roots = Array.from(root.querySelectorAll(quoteFadeConfig.rootSelector));

	if (!roots.length) return;

	if (!window.Swiper) {
		throw new Error("Swiper failed to load.");
	}

	roots.forEach(initQuote);
}

function prefersReducedMotion() {
	if (typeof window.matchMedia !== "function") return false;

	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initQuote(quote) {
	if (quote.dataset.quoteFadeReady === quoteFadeConfig.readyValue) return;

	const wrapper = quote.querySelector(quoteFadeConfig.wrapperSelector);

	if (!wrapper) return;

	const slides = Array.from(wrapper.children);

	// A single testimonial is the normal case on most pages, and one slide is a
	// static quote rather than a carousel. Leaving the Collection List untouched
	// keeps its own markup and styling intact.
	if (slides.length < 2) return;

	quote.dataset.quoteFadeReady = quoteFadeConfig.readyValue;

	quote.classList.add("swiper");
	wrapper.classList.add("swiper-wrapper");

	slides.forEach(function (slide) {
		slide.classList.add("swiper-slide");
	});

	const reduced = prefersReducedMotion();

	new window.Swiper(quote, {
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
	});
}
