import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const animate = vi.hoisted(() => vi.fn(() => ({ cancel() {}, finished: Promise.resolve() })));

vi.mock("motion", () => ({
	animate,
	motionValue: createMotionValue,
	springValue: (source) => createMotionValue(source.get()),
	styleEffect: () => () => {},
}));

import { initCursor } from "./cursor.js";

const createMotionValue = vi.hoisted(() => function createMotionValue(initialValue) {
	let value = initialValue;
	const listeners = new Set();

	return {
		get: () => value,
		set(nextValue) {
			value = nextValue;
			listeners.forEach((listener) => listener(nextValue));
		},
		jump(nextValue) {
			value = nextValue;
		},
		on(_event, listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		destroy() {
			listeners.clear();
		},
	};
});

function cursorMarkup() {
	return `
		<style>.cursor-root > .button { opacity: 0; }</style>
		<div class="cursor-root" aria-hidden="true">
			<div class="button"><div>View work</div></div>
		</div>
		<a class="card" data-cursor-text="View TYX"><span>TYX</span></a>
		<a class="card" data-cursor-text=""><span>Aethos</span></a>
		<p class="gap">Between cards</p>
	`;
}

const pill = () => document.querySelector(".cursor-root .button");
const words = () => document.querySelector(".cursor-root .button > div").textContent;
const enter = (selector) =>
	document.querySelector(selector).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
const pillAnimations = () =>
	animate.mock.calls.filter(([el]) => el === pill()).map(([, v]) => v);

function stubMedia({ pointer = true, reduce }) {
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query) => ({
			matches: query.includes("reduced-motion") ? reduce : pointer,
			addEventListener() {},
			removeEventListener() {},
		})),
	);
}

describe("initCursor", () => {
	let controller;

	beforeEach(() => {
		animate.mockClear();
		controller = new AbortController();
		stubMedia({ reduce: false });
	});

	afterEach(() => {
		controller.abort();
		document.body.innerHTML = "";
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("shows a target's own words, including a target added after startup", () => {
		document.body.innerHTML = cursorMarkup();
		initCursor(document, { signal: controller.signal });

		const late = document.createElement("a");
		late.setAttribute("data-cursor-text", "Read insight");
		late.innerHTML = "<span>Loaded later</span>";
		document.body.appendChild(late);

		late.firstElementChild.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));

		expect(words()).toBe("Read insight");
		expect(pillAnimations()).toContainEqual(expect.objectContaining({ opacity: [0, 1] }));
	});

	it("keeps the pill's own words for a target with an empty label", () => {
		document.body.innerHTML = cursorMarkup();
		initCursor(document, { signal: controller.signal });

		enter(".card:nth-of-type(2) span");

		expect(words()).toBe("View work");
	});

	it("stays on a card the pointer leaves and comes back to within the grace", () => {
		vi.useFakeTimers();
		document.body.innerHTML = cursorMarkup();
		initCursor(document, { signal: controller.signal });

		enter(".card span");
		enter(".gap");
		enter(".card span");
		vi.advanceTimersByTime(1000);

		expect(pillAnimations()).not.toContainEqual(expect.objectContaining({ opacity: 0 }));
	});

	it("leaves once the pointer has been off every target for the grace", () => {
		vi.useFakeTimers();
		document.body.innerHTML = cursorMarkup();
		initCursor(document, { signal: controller.signal });

		enter(".card span");
		enter(".gap");
		vi.advanceTimersByTime(1000);

		expect(pillAnimations()).toContainEqual(expect.objectContaining({ opacity: 0 }));
	});

	it("turns round from wherever its exit had got to when the pointer comes back", () => {
		vi.useFakeTimers();
		document.body.innerHTML = cursorMarkup();
		initCursor(document, { signal: controller.signal });

		enter(".card span");
		enter(".gap");
		vi.advanceTimersByTime(1000);
		pill().style.opacity = "0.4";
		animate.mockClear();
		enter(".card span");

		expect(pillAnimations()).toContainEqual({ opacity: 1, scale: 1 });
		expect(pillAnimations()).not.toContainEqual(expect.objectContaining({ opacity: [0, 1] }));
	});

	it("says nothing over a target that is switched off", () => {
		document.body.innerHTML = cursorMarkup();
		initCursor(document, { signal: controller.signal });

		document.querySelector(".card").setAttribute("aria-disabled", "true");
		enter(".card span");

		expect(animate).not.toHaveBeenCalled();
	});

	it("lets go when a click switches its target off under a still pointer", () => {
		vi.useFakeTimers();
		vi.stubGlobal("requestAnimationFrame", (run) => run());
		document.body.innerHTML = cursorMarkup();
		initCursor(document, { signal: controller.signal });

		const card = document.querySelector(".card");
		enter(".card span");
		card.setAttribute("aria-disabled", "true");
		card.click();
		vi.advanceTimersByTime(1000);

		expect(pillAnimations()).toContainEqual(expect.objectContaining({ opacity: 0 }));
	});

	it("lets go at once when a navigation starts", () => {
		document.body.innerHTML = cursorMarkup();
		initCursor(document, { signal: controller.signal });

		enter(".card span");
		document.dispatchEvent(new CustomEvent("spw:leave"));

		expect(pillAnimations()).toContainEqual(expect.objectContaining({ opacity: 0 }));
	});

	it("does not start on a device without hover and a fine pointer", () => {
		stubMedia({ pointer: false, reduce: false });
		document.body.innerHTML = cursorMarkup();

		initCursor(document, { signal: controller.signal });
		enter(".card span");

		expect(animate).not.toHaveBeenCalled();
	});

	it("only fades for a visitor who asked for less motion", () => {
		stubMedia({ reduce: true });
		document.body.innerHTML = cursorMarkup();
		initCursor(document, { signal: controller.signal });

		enter(".card span");
		enter(".card:nth-of-type(2) span");

		const moved = animate.mock.calls.flatMap(([, values]) => Object.keys(values));
		expect(words()).toBe("View work");
		expect(moved).not.toContain("scale");
		expect(moved).not.toContain("filter");
	});
});

