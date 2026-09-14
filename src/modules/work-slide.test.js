import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initWorkSlide } from "./work-slide.js";

function section({ arrows = true } = {}) {
	const controls = arrows
		? `
			<div class="slider_arrows">
				<div class="slider_arrow" role="button" tabindex="0" data-work-slide="prev"></div>
				<div class="slider_arrow" role="button" tabindex="0" data-work-slide="next"></div>
			</div>
		`
		: "";

	return `
		<div class="section_work-slide">
			<div class="container">
				${controls}
				<div class="work-slide_swiper w-dyn-list">
					<div class="work-slide_list w-dyn-items">
						<div class="work-slide_item w-dyn-item"><a class="work-item_component"></a></div>
						<div class="work-slide_item w-dyn-item"><a class="work-item_component"></a></div>
					</div>
				</div>
				<div class="caps_dots"></div>
			</div>
		</div>
	`;
}

describe("initWorkSlide", () => {
	let instance;

	beforeEach(() => {
		instance = {
			slidePrev: vi.fn(),
			slideNext: vi.fn(),
			params: {},
			update: vi.fn(),
			destroyed: false,
			isEnd: false,
			isBeginning: false,
			activeIndex: 0,
		};

		vi.stubGlobal(
			"Swiper",
			vi.fn(function () {
				return instance;
			}),
		);
		vi.stubGlobal(
			"ResizeObserver",
			vi.fn(function () {
				return { observe() {}, disconnect() {} };
			}),
		);
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 300,
			bottom: 200,
			width: 300,
			height: 200,
		});
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("steps the slider from the previous and next controls", () => {
		document.body.innerHTML = section();

		initWorkSlide();

		document.querySelector('[data-work-slide="next"]').click();
		expect(instance.slideNext).toHaveBeenCalledTimes(1);

		document.querySelector('[data-work-slide="prev"]').click();
		expect(instance.slidePrev).toHaveBeenCalledTimes(1);
	});

	it("steps from the keyboard, because the controls are not native buttons", () => {
		document.body.innerHTML = section();

		initWorkSlide();

		const next = document.querySelector('[data-work-slide="next"]');

		next.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		next.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
		next.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a", bubbles: true }));

		expect(instance.slideNext).toHaveBeenCalledTimes(2);
	});

	it("starts a section that has no controls", () => {
		document.body.innerHTML = section({ arrows: false });

		expect(() => initWorkSlide()).not.toThrow();
		expect(window.Swiper).toHaveBeenCalledTimes(1);
	});

	it("does nothing when the page has no work slider", () => {
		initWorkSlide();

		expect(window.Swiper).not.toHaveBeenCalled();
	});
});
