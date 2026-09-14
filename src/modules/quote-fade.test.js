import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
		vi.stubGlobal("Swiper", vi.fn());
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

		expect(window.Swiper).toHaveBeenCalledTimes(1);

		const options = window.Swiper.mock.calls[0][1];

		expect(options.effect).toBe("fade");
		expect(options.autoplay.delay).toBe(5000);
		expect(options.allowTouchMove).toBe(false);
	});

	it("leaves a single quote as static markup", () => {
		document.body.innerHTML = quoteList(1);

		initQuoteFade();

		expect(window.Swiper).not.toHaveBeenCalled();
		expect(document.querySelector(".dc-quote").classList.contains("swiper")).toBe(false);
	});

	it("does not start twice on the same list", () => {
		document.body.innerHTML = quoteList(2);

		initQuoteFade();
		initQuoteFade();

		expect(window.Swiper).toHaveBeenCalledTimes(1);
	});

	it("drops autoplay and transition speed for reduced motion", () => {
		stubReducedMotion(true);
		document.body.innerHTML = quoteList(2);

		initQuoteFade();

		const options = window.Swiper.mock.calls[0][1];

		expect(options.autoplay).toBe(false);
		expect(options.speed).toBe(0);
	});

	it("does nothing when the page has no quote list", () => {
		initQuoteFade();

		expect(window.Swiper).not.toHaveBeenCalled();
	});
});
