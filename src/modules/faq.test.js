import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initFaq } from "./faq.js";

function accordionItem(question = "Question") {
	return `
		<div data-accordion="item">
			<button data-accordion="trigger" type="button">${question}</button>
			<div data-accordion="content">Answer</div>
			<svg data-accordion="icon"><rect></rect><rect></rect></svg>
		</div>
	`;
}

function createGsap() {
	return {
		set: vi.fn(),
		timeline: vi.fn(() => ({
			kill: vi.fn(),
			to() {
				return this;
			},
		})),
	};
}

describe("initFaq", () => {
	beforeEach(() => {
		vi.stubGlobal("gsap", createGsap());
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({
				matches: false,
				addEventListener() {},
				removeEventListener() {},
			})),
		);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("initializes and toggles using only generic data-accordion markup", () => {
		document.body.innerHTML = `
			<section data-accordion="component">
				${accordionItem()}
			</section>
		`;

		initFaq(document);
		const item = document.querySelector('[data-accordion="item"]');
		const trigger = document.querySelector('[data-accordion="trigger"]');
		trigger.click();

		expect(item.classList.contains("is-open")).toBe(true);
		expect(item.dataset.accordionOpen).toBe("true");
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
	});

	it("initializes a generic accordion item appended after startup", async () => {
		document.body.innerHTML = '<section data-accordion="component"></section>';
		initFaq(document);

		const component = document.querySelector('[data-accordion="component"]');
		component.insertAdjacentHTML("beforeend", accordionItem("Loaded question"));
		await new Promise((resolve) => setTimeout(resolve));

		const item = document.querySelector('[data-accordion="item"]');
		const trigger = document.querySelector('[data-accordion="trigger"]');
		trigger.click();

		expect(item.dataset.accordionOpen).toBe("true");
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
	});
});
