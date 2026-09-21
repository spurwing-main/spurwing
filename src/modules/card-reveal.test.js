import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initCardReveal } from "./card-reveal.js";

// The CSS holds every card at opacity 0 and reads the two release attributes
// from different elements, so where each one lands is the whole behaviour.
function grid({ onScreen = true } = {}) {
	document.body.innerHTML = `
		<div class="work-list_list">
			<div class="work_list-item"><a class="work-item_component"></a></div>
			<div class="work_list-item"><a class="work-item_component"></a></div>
		</div>
	`;

	// jsdom gives every element a zero box, which reads as neither on nor off
	// screen, so each case says which it wants.
	const box = onScreen ? { top: 10, bottom: 300 } : { top: 5000, bottom: 5400 };

	for (const item of document.querySelectorAll(".work_list-item")) {
		item.getBoundingClientRect = () => box;
	}

	return [...document.querySelectorAll(".work_list-item")];
}

describe("initCardReveal", () => {
	// jsdom has neither matchMedia nor IntersectionObserver, and this module uses
	// both. The default observer here does nothing; the test that cares about
	// arrival replaces it with one that fires.
	beforeEach(() => {
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			},
		);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	// A card on screen at boot must ARRIVE, so it takes the reveal attribute like
	// any other. The opt-out means "show with no transition" and would rob it of
	// the animation entirely.
	it("reveals a card that is already on screen rather than opting it out", () => {
		const items = grid({ onScreen: true });

		initCardReveal();

		for (const item of items) {
			expect(item.hasAttribute("data-in-viewport")).toBe(true);
			expect(item.querySelector(".work-item_component").hasAttribute("data-reveal-disabled")).toBe(false);
		}
	});

	it("gives a screenful of cards a stagger so they arrive in sequence", () => {
		const items = grid({ onScreen: true });

		initCardReveal();

		const delays = items.map((item) => item.querySelector(".work-item_component").style.getPropertyValue("--stagger"));

		expect(delays).toEqual(["0ms", "70ms"]);
	});

	// The rule is .work_list-item[data-in-viewport] .work-item_component, so this
	// one belongs on the item and not on the card.
	it("marks a card that arrives later on the list item", () => {
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(callback) {
					this.callback = callback;
				}
				observe(element) {
					this.callback([{ isIntersecting: true, target: element }]);
				}
				unobserve() {}
				disconnect() {}
			},
		);

		const items = grid({ onScreen: false });

		initCardReveal();

		for (const item of items) {
			expect(item.hasAttribute("data-in-viewport")).toBe(true);
			expect(item.querySelector(".work-item_component").hasAttribute("data-in-viewport")).toBe(false);
		}
	});

	it("opts every card out under reduced motion, on the card", () => {
		vi.stubGlobal("matchMedia", () => ({ matches: true }));

		const items = grid();

		initCardReveal();

		for (const item of items) {
			expect(item.querySelector(".work-item_component").hasAttribute("data-reveal-disabled")).toBe(true);
		}
	});
});
