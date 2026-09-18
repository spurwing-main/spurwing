import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createSwiper = vi.hoisted(() => vi.fn());

vi.mock("../swiper.js", () => ({ default: createSwiper }));

import { initQuoteFade } from "./quote-fade.js";

function quoteList(count) {
	const items = Array.from({ length: count })
		.map((_, index) => `<div class="w-dyn-item">Quote ${index + 1}</div>`)
		.join("");

	return `
		<div class="dc-quote w-dyn-list">
			<div class="w-dyn-items">${items}</div>
		</div>
	`;
}

function stubReducedMotion(matches) {
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({
			matches,
			addEventListener() {},
			removeEventListener() {},
		})),
	);
}

describe("initQuoteFade", () => {
	beforeEach(() => {
		createSwiper.mockReset();
		stubReducedMotion(false);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("cross-fades a list of quotes and leaves the Collection List markup in place", () => {
		document.body.innerHTML = quoteList(3);

		initQuoteFade();

		const quote = document.querySelector(".dc-quote");
		const wrapper = quote.querySelector(".w-dyn-items");

		expect(quote.classList.contains("swiper")).toBe(true);
		expect(wrapper.classList.contains("swiper-wrapper")).toBe(true);
		expect(
			Array.from(wrapper.children).every((slide) => {
				return slide.classList.contains("w-dyn-item") && slide.classList.contains("swiper-slide");
			}),
		).toBe(true);

		expect(createSwiper).toHaveBeenCalledTimes(1);

		const options = createSwiper.mock.calls[0][1];

		expect(options.effect).toBe("fade");
		expect(options.autoplay.delay).toBe(5000);
		expect(options.allowTouchMove).toBe(false);
	});

	it("leaves a single quote as static markup", () => {
		document.body.innerHTML = quoteList(1);

		initQuoteFade();

		expect(createSwiper).not.toHaveBeenCalled();
		expect(document.querySelector(".dc-quote").classList.contains("swiper")).toBe(false);
	});

	it("does not start twice on the same list", () => {
		document.body.innerHTML = quoteList(2);

		initQuoteFade();
		initQuoteFade();

		expect(createSwiper).toHaveBeenCalledTimes(1);
	});

	it("drops autoplay and transition speed for reduced motion", () => {
		stubReducedMotion(true);
		document.body.innerHTML = quoteList(2);

		initQuoteFade();

		const options = createSwiper.mock.calls[0][1];

		expect(options.autoplay).toBe(false);
		expect(options.speed).toBe(0);
	});


	it("fills the progress rule as the autoplay runs and resets it on the change", () => {
		document.body.innerHTML = quoteList(3);

		initQuoteFade();

		const quote = document.querySelector(".dc-quote");
		const handlers = createSwiper.mock.calls[0][1].on;

		handlers.autoplayTimeLeft({}, 2500, 0.5);
		expect(quote.style.getPropertyValue("--quote-progress")).toBe("0.5");

		handlers.slideChangeTransitionStart();
		expect(quote.style.getPropertyValue("--quote-progress")).toBe("0");
	});

	it("reports no progress for reduced motion, because nothing advances", () => {
		stubReducedMotion(true);
		document.body.innerHTML = quoteList(2);

		initQuoteFade();

		expect(createSwiper.mock.calls[0][1].on).toEqual({});
	});

	it("does nothing when the page has no quote list", () => {
		initQuoteFade();

		expect(createSwiper).not.toHaveBeenCalled();
	});
});
