// The quote slider on /approach: three Swipers moving as one. The main one
// takes the drag and the arrows, and drives the meta and logo stacks through
// Swiper's controller, so a single gesture moves all three at different
// distances. Each slide carries its own background, which the root and the
// bottom bleed elements take on as it arrives.
//
// This ran as a 192-line embed on the page and pulled a second, different major
// version of Swiper from the CDN to do it. It uses the bundled Swiper now, the
// same one work-slide.js builds on.

import { claimOnce, keyActivates, requireElement } from "../dom.js";
import Swiper from "../swiper.js";

const approachSliderConfig = {
	rootSelector: ".g-slide_item",
	mainSelector: '[data-stack="main"]',
	logoSelector: '[data-stack="logo"]',
	metaSelector: '[data-stack="meta"]',
	nextSelector: "[data-swiper-next]",
	previousSelector: "[data-swiper-prev]",
	bottomBackgroundSelector: "[data-slide-bottom-bg]",
	swiperRootSelector: ".swiper",
	speedMs: 560,
	lightText: "#ffffff",
	darkText: "#111111",
};

// How far each stack travels for the same gesture. The main quote moves half a
// width, the logo further and out, the meta barely at all — which is what makes
// one drag read as depth rather than three things sliding together.
const creativeEffects = {
	main: {
		prev: { opacity: 1, translate: ["-50%", 0, -1] },
		next: { opacity: 1, translate: ["50%", 0, -1] },
	},
	logo: {
		prev: { opacity: 0, translate: ["-75%", 0, -1] },
		next: { opacity: 0, translate: ["75%", 0, -1] },
	},
	meta: {
		prev: { opacity: 1, translate: ["-10%", 0, -1] },
		next: { opacity: 1, translate: ["10%", 0, -1] },
	},
};

export function initApproachSlider(root = document, { signal } = {}) {
	const sliders = [...root.querySelectorAll(approachSliderConfig.rootSelector)];

	if (!sliders.length) return;


	sliders.forEach((slider) => {
		if (claimOnce(slider, "data-approach-slider-built")) initSlider(slider, signal);
	});
}

function initSlider(slider, signal) {
	const stacks = {
		main: swiperRootFor(slider, approachSliderConfig.mainSelector),
		meta: swiperRootFor(slider, approachSliderConfig.metaSelector),
		// The logo stack is optional: a slide set can be quotes alone.
		logo: slider.querySelector(approachSliderConfig.logoSelector)
			? swiperRootFor(slider, approachSliderConfig.logoSelector)
			: null,
	};

	const next = requireElement(slider, approachSliderConfig.nextSelector);
	const previous = requireElement(slider, approachSliderConfig.previousSelector);

	const shared = {
		slidesPerView: 1,
		loop: false,
		effect: "creative",
		// The arrows and the slides are already reachable and labelled in the
		// markup; Swiper's own a11y layer would name them a second time.
		a11y: { enabled: false },
		speed: approachSliderConfig.speedMs,
		// The theme follows the drag rather than the settled slide, which needs
		// per-slide progress on every frame.
		watchSlidesProgress: true,
	};

	const meta = new Swiper(stacks.meta, {
		...shared,
		allowTouchMove: false,
		creativeEffect: creativeEffects.meta,
	});

	const logo = stacks.logo
		? new Swiper(stacks.logo, {
				...shared,
				allowTouchMove: false,
				creativeEffect: creativeEffects.logo,
			})
		: null;

	const main = new Swiper(stacks.main, {
		...shared,
		allowTouchMove: true,
		simulateTouch: true,
		grabCursor: true,
		creativeEffect: creativeEffects.main,
		navigation: { nextEl: next, prevEl: previous },
	});

	main.controller.control = logo ? [meta, logo] : meta;

	// Swiper binds the click on these; without this they answered the mouse only.
	keyActivates(next, signal);
	keyActivates(previous, signal);

	const applyTheme = themeApplier(slider, main);

	slider.style.color = approachSliderConfig.darkText;
	applyTheme(main.activeIndex);

	// setTranslate fires through the whole gesture, so the colour crosses over
	// mid-drag rather than snapping when the slide lands.
	main.on("setTranslate", () => applyTheme(nearestIndex(main)));
	main.on("slideChange", () => applyTheme(main.activeIndex));

	signal?.addEventListener("abort", () => {
		[main, meta, logo].forEach((instance) => {
			// Not cleanStyles. Teardown runs while the outgoing page is still fully
			// on screen and the crossfade has not started, so stripping the inline
			// transforms snaps the slider back to its first slide in front of the
			// reader. The page is about to be removed; its styles do not need
			// tidying.
			if (instance && !instance.destroyed) instance.destroy(true, false);
		});
	});
}

function swiperRootFor(slider, selector) {
	const stack = requireElement(slider, selector);
	const swiperRoot = stack.closest(approachSliderConfig.swiperRootSelector);

	if (!swiperRoot) {
		throw new Error(`missing swiper root: "${selector}" is not inside "${approachSliderConfig.swiperRootSelector}"`);
	}

	return swiperRoot;
}

// Which slide is closest to settled, by the smallest absolute progress. Read
// every frame during a drag, so it stays a plain loop.
function nearestIndex(swiper) {
	let best = 0;
	let smallest = Infinity;

	swiper.slides.forEach((slide, index) => {
		const distance = Math.abs(slide.progress);

		if (Number.isFinite(distance) && distance < smallest) {
			smallest = distance;
			best = index;
		}
	});

	return best;
}

function themeApplier(slider, swiper) {
	const bottomBackgrounds = [...slider.querySelectorAll(approachSliderConfig.bottomBackgroundSelector)];
	let applied = -1;

	return function applyTheme(index) {
		if (index === applied) return;

		const slide = swiper.slides[index];

		if (!slide) return;

		const { themeColor, textColor } = slide.dataset;

		// Skip, never throw: one slide missing its colour in the CMS should not
		// take the whole slider down with it.
		if (!themeColor) return;

		slider.style.backgroundColor = themeColor;
		slider.style.color = textColor === "light" ? approachSliderConfig.lightText : approachSliderConfig.darkText;

		bottomBackgrounds.forEach((element) => {
			element.style.backgroundColor = themeColor;
		});

		applied = index;
	};
}
