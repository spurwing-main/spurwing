import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({
	animate: vi.fn(() => ({ stop: vi.fn(), finished: Promise.resolve() })),
	inView: vi.fn(),
}));

vi.mock("motion", () => motion);

import { initClientLogos } from "./client-logos.js";

function logoRow(count) {
	const items = Array.from({ length: count })
		.map((_, index) => `<div class="w-dyn-item"><img alt="Logo ${index + 1}"></div>`)
		.join("");

	return `
		<div data-client-logos>
			<div class="w-dyn-list"><div class="w-dyn-items">${items}</div></div>
		</div>
	`;
}

function stubColumns(count) {
	const real = window.getComputedStyle;

	vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
		const style = real(element);

		if (!element.classList?.contains("w-dyn-items")) return style;

		return { ...style, gridTemplateColumns: Array.from({ length: count }, () => "120px").join(" ") };
	});
}

function stubReducedMotion(matches) {
	vi.stubGlobal("matchMedia", vi.fn(() => ({ matches })));
}

// Returns the callback the module gave inView, so a test can put the row on
// screen and take it off again.
function onScreen() {
	const enter = motion.inView.mock.calls.at(-1)[1];

	return enter();
}

const items = () => [...document.querySelectorAll(".w-dyn-item")];

describe("initClientLogos", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		motion.animate.mockClear();
		motion.inView.mockReset();
		motion.inView.mockReturnValue(() => {});
		stubReducedMotion(false);
		stubColumns(4);
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe() {}
				disconnect() {}
			},
		);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("gives logo n to column n mod columns and shows only the first row", () => {
		document.body.innerHTML = logoRow(8);

		initClientLogos();

		expect(items().map((item) => item.style.gridArea)).toEqual([
			"1 / 1",
			"1 / 2",
			"1 / 3",
			"1 / 4",
			"1 / 1",
			"1 / 2",
			"1 / 3",
			"1 / 4",
		]);
		expect(items().map((item) => item.style.opacity)).toEqual(["", "", "", "", "0", "0", "0", "0"]);
	});

	it("moves each column on to its next logo once the row is on screen", () => {
		document.body.innerHTML = logoRow(8);

		initClientLogos();
		vi.advanceTimersByTime(5000);
		expect(motion.animate).not.toHaveBeenCalled();

		onScreen();
		vi.advanceTimersByTime(5000);

		const moved = motion.animate.mock.calls.map(([element, , options]) => [items().indexOf(element), Math.round(options.delay * 10) / 10]);

		expect(moved).toEqual([
			[0, 0],
			[4, 0],
			[1, 0.2],
			[5, 0.2],
			[2, 0.4],
			[6, 0.4],
			[3, 0.6],
			[7, 0.6],
		]);
	});

	it("leaves a column with one logo still when the count does not divide evenly", () => {
		document.body.innerHTML = logoRow(6);

		initClientLogos();
		onScreen();
		vi.advanceTimersByTime(5000);

		const moved = motion.animate.mock.calls.map(([element]) => items().indexOf(element));

		expect(moved).toEqual([0, 4, 1, 5]);
	});

	it("does nothing to a row that fits in one line", () => {
		document.body.innerHTML = logoRow(4);

		initClientLogos();
		onScreen();
		vi.advanceTimersByTime(20000);

		expect(motion.animate).not.toHaveBeenCalled();
	});

	it("stops when the row leaves the screen", () => {
		document.body.innerHTML = logoRow(8);

		initClientLogos();
		const leave = onScreen();
		leave();
		vi.advanceTimersByTime(20000);

		expect(motion.animate).not.toHaveBeenCalled();
	});

	it("keeps the first row still for reduced motion", () => {
		stubReducedMotion(true);
		document.body.innerHTML = logoRow(8);

		initClientLogos();

		expect(items().every((item) => item.style.gridArea === "")).toBe(true);
		expect(motion.inView).not.toHaveBeenCalled();
	});

	it("stops its timer when the page is left", () => {
		document.body.innerHTML = logoRow(8);
		const controller = new AbortController();

		initClientLogos(document, { signal: controller.signal });
		onScreen();
		controller.abort();
		vi.advanceTimersByTime(20000);

		expect(motion.animate).not.toHaveBeenCalled();
	});

	it("does not start twice on the same row", () => {
		document.body.innerHTML = logoRow(8);

		initClientLogos();
		initClientLogos();

		expect(motion.inView).toHaveBeenCalledTimes(1);
	});
});
