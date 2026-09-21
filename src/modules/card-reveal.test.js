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

	// The rule is .work-item_component[data-reveal-disabled]. On the list item it
	// matches nothing, and the card stays held at opacity 0 for good.
	it("opts a card that is already on screen out on the card itself", () => {
		const items = grid({ onScreen: true });

		initCardReveal();

		for (const item of items) {
			expect(item.querySelector(".work-item_component").hasAttribute("data-reveal-disabled")).toBe(true);
			expect(item.hasAttribute("data-reveal-disabled")).toBe(false);
		}
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
