import { requireElement } from "../dom.js";
import { buildDots, grabCursor } from "./slider-controls.js";

const workSlideConfig = {
	sectionSelector: ".section_work-slide",
	viewportSelector: ".work-slide_swiper",
	wrapperSelector: ".work-slide_list",
	slideSelector: ".work-slide_item",
	cardSelector: ".work-item_component",
	containerSelector: ".container",
	dotsSelector: ".caps_dots",
	arrowSelector: "[data-work-slide]",
	previousSelector: '[data-work-slide="prev"]',
	nextSelector: '[data-work-slide="next"]',
	dotClass: "caps_dot",
	selectedDotClass: "caps_dot--selected",
	disabledArrowClass: "swiper-button-disabled",
	grabbingClass: "is-grabbing",
	revealOptOutAttr: "data-reveal-disabled",
	gapVar: "--work-slide--gap",
	widthVar: "--work-slide-item-width",
	dragThreshold: 6,
	speed: 450,
};

export function initWorkSlide(root = document, { signal } = {}) {
	const sections = [...root.querySelectorAll(workSlideConfig.sectionSelector)];

	if (!sections.length) return;

	if (!window.Swiper) throw new Error("Swiper failed to load.");

	sections.forEach((section) => initSlider(section, signal));
}

// The CSS gap is authored in whatever unit suits the breakpoint, and Swiper
// wants a number of pixels. A throwaway element is the only honest way to ask
// the browser what the value resolves to in this section.
function toPixels(scope, value) {
	const length = String(value || "").trim();

	if (!length) return 0;

	const probe = document.createElement("div");

	probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${length}`;
	scope.append(probe);

	const width = probe.getBoundingClientRect().width;

	probe.remove();

	return width;
}

function initSlider(section, signal) {
	const viewport = requireElement(section, workSlideConfig.viewportSelector, "slider viewport");
	const wrapper = requireElement(section, workSlideConfig.wrapperSelector, "slider list");
	const dotsNode = requireElement(section, workSlideConfig.dotsSelector, "slider dots");
	const container = requireElement(section, workSlideConfig.containerSelector, "slider container");
	const slides = [...wrapper.querySelectorAll(workSlideConfig.slideSelector)];

	if (!slides.length) throw new Error(`no slides: expected "${workSlideConfig.slideSelector}"`);

	// One Swiper per viewport, whoever calls this.
	viewport.swiper?.destroy(true, true);

	wrapper.style.gap = "0px"; // Swiper spaces the slides itself, from spaceBetween

	slides.forEach((slide) => {
		// The site reveals work cards on scroll by watching .work_list-item, which
		// a slide is not, so an unclaimed card would sit at opacity 0 forever.
		// The reveal already ships an opt-out attribute; using it keeps the escape
		// hatch in one place instead of a CSS override.
		slide
			.querySelector(workSlideConfig.cardSelector)
			?.setAttribute(workSlideConfig.revealOptOutAttr, "");
	});

	// Every slide is as wide as the widest card, so the rhythm holds whatever the
	// cards contain. Two things have to be out of the way to read a card's
	// natural width: the variable this sets, and Swiper's own slide sizing — so
	// the classes come off for the measurement and go back on after it.
	function equaliseSlideWidth() {
		const hadSwiperClasses = wrapper.classList.contains("swiper-wrapper");

		if (hadSwiperClasses) {
			wrapper.classList.remove("swiper-wrapper");
			slides.forEach((slide) => slide.classList.remove("swiper-slide"));
		}

		section.style.setProperty(workSlideConfig.widthVar, "auto");

		const widest = Math.max(
			...slides.map((slide) => {
				const card = slide.querySelector(workSlideConfig.cardSelector) || slide;

				return card.getBoundingClientRect().width;
			}),
		);

		if (!widest) throw new Error("slide width measured as 0");

		section.style.setProperty(workSlideConfig.widthVar, `${widest}px`);

		if (hadSwiperClasses) {
			wrapper.classList.add("swiper-wrapper");
			slides.forEach((slide) => slide.classList.add("swiper-slide"));
		}
	}

	// The first and last slides line up with the page's text column while the
	// track itself runs full-bleed, so the offsets are the distance from the
	// viewport edge to the container's content box.
	function metrics() {
		const viewportBox = viewport.getBoundingClientRect();
		const containerBox = container.getBoundingClientRect();
		const styles = window.getComputedStyle(container);
		const left = containerBox.left + parseFloat(styles.paddingLeft || 0);
		const right = containerBox.right - parseFloat(styles.paddingRight || 0);

		return {
			before: Math.max(0, left - viewportBox.left),
			after: Math.max(0, viewportBox.right - right),
			gap: toPixels(section, window.getComputedStyle(section).getPropertyValue(workSlideConfig.gapVar)),
		};
	}

	equaliseSlideWidth();

	viewport.classList.add("swiper");
	wrapper.classList.add("swiper-wrapper");
	slides.forEach((slide) => slide.classList.add("swiper-slide"));

	const first = metrics();
	let dots = null;
	let updateFrame = 0;

	// The Designer marks optional controls with data-work-slide="prev" or "next".
	// Handing them to Swiper's own navigation module — rather than stepping the
	// slider by hand — is what gives them .swiper-button-disabled at each end,
	// the class the site's shared slider-arrows CSS already styles.
	const previous = section.querySelector(workSlideConfig.previousSelector);
	const next = section.querySelector(workSlideConfig.nextSelector);

	// Swiper reports activeIndex conservatively at the ends, where several
	// slides are on screen at once, so the dots follow the edge instead.
	const selectedIndex = (swiper) => {
		if (swiper.isEnd) return slides.length - 1;
		if (swiper.isBeginning) return 0;

		return swiper.activeIndex;
	};

	const swiper = new window.Swiper(viewport, {
		navigation:
			previous || next
				? { prevEl: previous, nextEl: next, disabledClass: workSlideConfig.disabledArrowClass }
				: false,
		slidesPerView: "auto",
		slidesPerGroup: 1,
		spaceBetween: first.gap,
		slidesOffsetBefore: first.before,
		slidesOffsetAfter: first.after,
		speed: workSlideConfig.speed,
		resistance: false,
		grabCursor: false,
		watchOverflow: true,
		threshold: workSlideConfig.dragThreshold,
		on: {
			init(instance) {
				dots = buildDots(dotsNode, {
					count: slides.length,
					label: "Go to selected work slide",
					dotClass: workSlideConfig.dotClass,
					selectedClass: workSlideConfig.selectedDotClass,
					onSelect: (index) => instance.slideTo(index),
				});

				dots.select(selectedIndex(instance));
			},
			slideChange: (instance) => dots?.select(selectedIndex(instance)),
			transitionEnd: (instance) => dots?.select(selectedIndex(instance)),
			fromEdge: (instance) => dots?.select(selectedIndex(instance)),
			resize: () => scheduleUpdate(),
		},
	});

	function scheduleUpdate() {
		cancelAnimationFrame(updateFrame);

		updateFrame = requestAnimationFrame(() => {
			if (swiper.destroyed) return;

			equaliseSlideWidth();

			const next = metrics();

			swiper.params.spaceBetween = next.gap;
			swiper.params.slidesOffsetBefore = next.before;
			swiper.params.slidesOffsetAfter = next.after;
			swiper.update();
			dots?.select(selectedIndex(swiper));
		});
	}

	grabCursor(viewport, workSlideConfig.grabbingClass, signal);
	keepLinksFromFiringOnDrag(viewport, signal);

	// The controls are divs with role="button", so Enter and Space do not
	// activate them by themselves. Swiper owns the click; this only forwards the
	// keys to it, and a disabled arrow stays inert because Swiper ignores it.
	section.querySelectorAll(workSlideConfig.arrowSelector).forEach((arrow) => {
		arrow.addEventListener(
			"keydown",
			(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;

				event.preventDefault();
				arrow.click();
			},
			{ signal },
		);
	});

	window.addEventListener("resize", scheduleUpdate, { signal });
	window.addEventListener("load", scheduleUpdate, { once: true, signal });

	const resizeObserver = new ResizeObserver(scheduleUpdate);

	resizeObserver.observe(viewport);
	resizeObserver.observe(container);

	signal?.addEventListener("abort", () => {
		cancelAnimationFrame(updateFrame);
		resizeObserver.disconnect();
		swiper.destroy(true, true);
	});
}

// Each slide is a link, and a drag that starts on one would otherwise follow it
// on release. Swallow the click when the pointer travelled.
function keepLinksFromFiringOnDrag(viewport, signal) {
	let start = null;
	let dragged = false;

	viewport.addEventListener(
		"pointerdown",
		(event) => {
			start = event.target.closest("a") ? { x: event.clientX, y: event.clientY } : null;
			dragged = false;
		},
		{ signal },
	);

	viewport.addEventListener(
		"pointermove",
		(event) => {
			if (!start) return;

			const moved =
				Math.abs(event.clientX - start.x) > workSlideConfig.dragThreshold ||
				Math.abs(event.clientY - start.y) > workSlideConfig.dragThreshold;

			if (moved) dragged = true;
		},
		{ signal },
	);

	viewport.addEventListener(
		"click",
		(event) => {
			if (dragged && event.target.closest("a")) event.preventDefault();
		},
		{ capture: true, signal },
	);

	const end = () => {
		start = null;
		setTimeout(() => {
			dragged = false;
		}, 0);
	};

	viewport.addEventListener("pointerup", end, { signal });
	viewport.addEventListener("pointercancel", end, { signal });
}
