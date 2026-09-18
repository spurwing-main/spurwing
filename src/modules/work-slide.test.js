import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createSwiper = vi.hoisted(() => vi.fn());

vi.mock("../swiper.js", () => ({ default: createSwiper }));

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

		createSwiper.mockReset();
		createSwiper.mockImplementation(function () {
			return instance;
		});
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

	it("hands the controls to Swiper's navigation module, so they gain a disabled state", () => {
		document.body.innerHTML = section();

		initWorkSlide();

		const options = createSwiper.mock.calls[0][1];

		expect(options.navigation.prevEl).toBe(document.querySelector('[data-work-slide="prev"]'));
		expect(options.navigation.nextEl).toBe(document.querySelector('[data-work-slide="next"]'));
		expect(options.navigation.disabledClass).toBe("swiper-button-disabled");
	});

	it("steps from the keyboard, because the controls are not native buttons", () => {
		document.body.innerHTML = section();

		initWorkSlide();

		const next = document.querySelector('[data-work-slide="next"]');
		const clicked = vi.fn();

		next.addEventListener("click", clicked);

		next.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		next.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
		next.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a", bubbles: true }));

		expect(clicked).toHaveBeenCalledTimes(2);
	});

	it("opts each card out of the scroll reveal, which never observes a slide", () => {
		document.body.innerHTML = section();

		initWorkSlide();

		expect(
			Array.from(document.querySelectorAll(".work-item_component")).every((card) => {
				return card.hasAttribute("data-reveal-disabled");
			}),
		).toBe(true);
	});

	it("starts a section that has no controls, and asks Swiper for no navigation", () => {
		document.body.innerHTML = section({ arrows: false });

		expect(() => initWorkSlide()).not.toThrow();
		expect(createSwiper).toHaveBeenCalledTimes(1);
		expect(createSwiper.mock.calls[0][1].navigation).toBe(false);
	});

	it("does nothing when the page has no work slider", () => {
		initWorkSlide();

		expect(createSwiper).not.toHaveBeenCalled();
	});
});
