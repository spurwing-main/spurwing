import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const embla = vi.hoisted(() => ({ create: vi.fn(), api: null, handlers: {} }));

vi.mock("embla-carousel", () => ({ default: embla.create }));

import { initWorkSlider } from "./work-slider.js";

function section(count) {
	const cards = Array.from({ length: count })
		.map((_, index) => `<div role="listitem"><a href="/work/${index}">Card ${index + 1}</a></div>`)
		.join("");

	return `
		<section data-work-slider>
			<div data-work-slider-viewport>
				<div class="w-dyn-list"><div role="list">${cards}</div></div>
			</div>
			<div><div data-work-slider-progress></div></div>
			<div data-work-slider-prev></div>
			<div data-work-slider-next></div>
		</section>
	`;
}

const $ = (selector) => document.querySelector(selector);

describe("initWorkSlider", () => {
	beforeEach(() => {
		embla.handlers = {};
		embla.api = {
			canScrollPrev: vi.fn(() => false),
			canScrollNext: vi.fn(() => true),
			scrollProgress: vi.fn(() => 0),
			slidesInView: vi.fn(() => [0, 1]),
			scrollPrev: vi.fn(),
			scrollNext: vi.fn(),
			scrollTo: vi.fn(),
			destroy: vi.fn(),
			on(name, handler) {
				embla.handlers[name] = handler;
				return embla.api;
			},
		};
		embla.create.mockReset();
		embla.create.mockImplementation(() => embla.api);
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("makes the Collection List's items the row, through the wrapper between", () => {
		document.body.innerHTML = section(3);

		initWorkSlider();

		const [viewport, options] = embla.create.mock.calls[0];

		expect(viewport).toBe($("[data-work-slider-viewport]"));
		expect(options.container).toBe($('[role="list"]'));
		expect($("[data-work-slider]").hasAttribute("data-work-slider-ready")).toBe(true);
	});

	it("sets each section up once, however often it runs", () => {
		document.body.innerHTML = section(3);

		initWorkSlider();
		initWorkSlider();

		expect(embla.create).toHaveBeenCalledOnce();
	});

	it("leaves a single card as it is", () => {
		document.body.innerHTML = section(1);

		initWorkSlider();

		expect(embla.create).not.toHaveBeenCalled();
		expect($("[data-work-slider]").hasAttribute("data-work-slider-ready")).toBe(false);
	});

	it("disables the arrow that has nowhere to go, and moves with the other", () => {
		document.body.innerHTML = section(3);

		initWorkSlider();

		expect($("[data-work-slider-prev]").getAttribute("aria-disabled")).toBe("true");
		expect($("[data-work-slider-prev]").getAttribute("tabindex")).toBe("-1");
		expect($("[data-work-slider-next]").getAttribute("aria-disabled")).toBe("false");

		$("[data-work-slider-next]").click();
		expect(embla.api.scrollNext).toHaveBeenCalledOnce();

		embla.api.canScrollPrev.mockReturnValue(true);
		embla.api.canScrollNext.mockReturnValue(false);
		embla.handlers.select();

		expect($("[data-work-slider-prev]").getAttribute("aria-disabled")).toBe("false");
		expect($("[data-work-slider-next]").getAttribute("aria-disabled")).toBe("true");
	});

	it("moves the bar with the row", () => {
		document.body.innerHTML = section(3);

		initWorkSlider();
		embla.api.scrollProgress.mockReturnValue(0.5);
		embla.handlers.scroll();

		expect($("[data-work-slider-progress]").style.getPropertyValue("--work-slider-progress")).toBe("0.5");
	});

	it("brings a card into view when the keyboard reaches it", () => {
		document.body.innerHTML = section(3);

		initWorkSlider();
		document.querySelectorAll('[role="listitem"] a')[2].focus();

		expect(embla.api.scrollTo).toHaveBeenCalledWith(2);
	});

	it("stops and lets the row scroll on its own again when the page goes", () => {
		document.body.innerHTML = section(3);
		const controller = new AbortController();

		initWorkSlider(document, { signal: controller.signal });
		controller.abort();

		expect(embla.api.destroy).toHaveBeenCalledOnce();
		expect($("[data-work-slider]").hasAttribute("data-work-slider-ready")).toBe(false);
	});
});
