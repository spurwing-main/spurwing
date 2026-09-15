import EmblaCarousel from "embla-carousel";

import { buildDots } from "./slider-controls.js";

const capsConfig = {
	sliderSelector: ".embla",
	containerSelector: ".embla__container",
	slideSelector: ".embla__slide",
	dotsSelector: ".carousel-dots",
	dotClass: "carousel-dot",
	selectedDotClass: "is-selected",
	autoplayDelay: 4000,
	visibleThreshold: 0.3,
};

export function initCaps(root = document, { signal } = {}) {
	root.querySelectorAll(capsConfig.sliderSelector).forEach((slider) => {
		initSlider(slider, signal);
	});
}

function initSlider(slider, signal) {
	const container = slider.querySelector(capsConfig.containerSelector);
	const slides = slider.querySelectorAll(capsConfig.slideSelector);
	const dotsNode = slider.querySelector(capsConfig.dotsSelector);

	// Not a carousel instance: the "Capabilities slider" Component shows a single
	// image when its slot is empty, so most .embla roots have no slides. Skip
	// them; throwing here would abort the loop and kill every later slider.
	if (!container || !slides.length || !dotsNode) return;

	const embla = EmblaCarousel(slider, { loop: true, align: "start" });

	let dots = null;
	let autoplayTimer = null;
	let isVisible = false;

	function start() {
		if (autoplayTimer || !isVisible) return;

		autoplayTimer = window.setInterval(() => embla.scrollNext(), capsConfig.autoplayDelay);
	}

	function stop() {
		window.clearInterval(autoplayTimer);
		autoplayTimer = null;
	}

	function rebuildDots() {
		dots = buildDots(dotsNode, {
			count: embla.scrollSnapList().length,
			label: "Go to slide",
			dotClass: capsConfig.dotClass,
			selectedClass: capsConfig.selectedDotClass,
			onSelect(index) {
				embla.scrollTo(index);
				stop();
				start();
			},
		});

		selectDot();
	}

	function selectDot() {
		dots?.select(embla.selectedScrollSnap());
	}

	const observer = new IntersectionObserver(
		([entry]) => {
			isVisible = entry.isIntersecting;

			if (isVisible) start();
			else stop();
		},
		{ threshold: capsConfig.visibleThreshold },
	);

	slider.addEventListener("mouseenter", stop, { signal });
	slider.addEventListener("mouseleave", start, { signal });

	// No .on("init"): Embla emits it asynchronously, after the explicit call
	// below, so listening for it only builds the dots a second time.
	embla
		.on("reInit", rebuildDots)
		.on("select", selectDot)
		.on("pointerDown", stop)
		.on("pointerUp", start);

	rebuildDots();
	observer.observe(slider);

	// The router swaps the DOM but leaves this observer and the autoplay timer
	// watching a detached slider; each visit used to add another.
	signal?.addEventListener("abort", () => {
		observer.disconnect();
		stop();
		embla.destroy();
	});
}
