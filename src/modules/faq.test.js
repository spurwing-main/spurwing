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
	let controller;

	beforeEach(() => {
		controller = new AbortController();
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
		controller.abort();
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

		initFaq(document, { signal: controller.signal });
		const item = document.querySelector('[data-accordion="item"]');
		const trigger = document.querySelector('[data-accordion="trigger"]');
		trigger.click();

		expect(item.classList.contains("is-open")).toBe(true);
		expect(item.dataset.accordionOpen).toBe("true");
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
	});

	it("initializes a generic accordion item appended after startup", async () => {
		document.body.innerHTML = '<section data-accordion="component"></section>';
		initFaq(document, { signal: controller.signal });

		const component = document.querySelector('[data-accordion="component"]');
		component.insertAdjacentHTML("beforeend", accordionItem("Loaded question"));
		await new Promise((resolve) => setTimeout(resolve));

		const item = document.querySelector('[data-accordion="item"]');
		const trigger = document.querySelector('[data-accordion="trigger"]');
		trigger.click();

		expect(item.dataset.accordionOpen).toBe("true");
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
	});

	describe.each([false, true])("with reduced motion set to %s", (reducedMotion) => {
		beforeEach(() => {
			window.matchMedia.mockReturnValue({ matches: reducedMotion });
			document.body.innerHTML = `
				<main data-faq-open-first>
					<section data-accordion="component">
						${accordionItem("First question")}
						${accordionItem("Second question")}
					</section>
				</main>
			`;
		});

		it("exposes the first answer on arrival and updates inert on every toggle", () => {
			initFaq(document, { signal: controller.signal });
			const triggers = document.querySelectorAll('[data-accordion="trigger"]');
			const answers = document.querySelectorAll('[data-accordion="content"]');

			expect(answers[0].inert).toBe(false);
			expect(answers[1].inert).toBe(true);

			triggers[1].click();
			expect(triggers[0].getAttribute("aria-expanded")).toBe("false");
			expect(answers[0].inert).toBe(true);
			expect(triggers[1].getAttribute("aria-expanded")).toBe("true");
			expect(answers[1].inert).toBe(false);

			triggers[1].click();
			expect(triggers[1].getAttribute("aria-expanded")).toBe("false");
			expect(answers[1].inert).toBe(true);
		});

		it("keeps the last requested answer accessible during rapid reversals and resize", async () => {
			initFaq(document, { signal: controller.signal });
			const triggers = document.querySelectorAll('[data-accordion="trigger"]');
			const answers = document.querySelectorAll('[data-accordion="content"]');

			triggers[1].click();
			triggers[1].click();
			triggers[0].click();
			triggers[1].click();
			window.dispatchEvent(new Event("resize"));
			await new Promise(requestAnimationFrame);

			expect(triggers[0].getAttribute("aria-expanded")).toBe("false");
			expect(answers[0].inert).toBe(true);
			expect(triggers[1].getAttribute("aria-expanded")).toBe("true");
			expect(answers[1].inert).toBe(false);
		});
	});

	it("associates triggers with their answers, including CMS items added later", async () => {
		document.body.innerHTML = `<section data-accordion="component">${accordionItem()}</section>`;
		const component = document.querySelector('[data-accordion="component"]');
		const firstAnswer = component.querySelector('[data-accordion="content"]');
		firstAnswer.id = "authored-answer";
		initFaq(document, { signal: controller.signal });
		component.insertAdjacentHTML("beforeend", accordionItem("Loaded question"));
		await new Promise((resolve) => setTimeout(resolve));

		const triggers = component.querySelectorAll('[data-accordion="trigger"]');
		const answers = component.querySelectorAll('[data-accordion="content"]');
		expect(firstAnswer.id).toBe("authored-answer");
		for (let index = 0; index < triggers.length; index += 1) {
			const panelId = triggers[index].getAttribute("aria-controls");
			expect(panelId).toBeTruthy();
			expect(document.getElementById(panelId)).toBe(answers[index]);
		}
	});

	it("keeps generated panel IDs unique while outgoing and incoming pages overlap", () => {
		document.body.innerHTML = `
			<main data-faq-open-first><section data-accordion="component">${accordionItem("Outgoing")}</section></main>
			<main><section data-accordion="component">${accordionItem("Incoming")}</section></main>
		`;
		const pages = document.querySelectorAll("main");
		initFaq(pages[0], { signal: controller.signal });
		initFaq(pages[1], { signal: controller.signal });
		const answers = document.querySelectorAll('[data-accordion="content"]');

		expect(answers[0].id).toBeTruthy();
		expect(answers[1].id).toBeTruthy();
		expect(answers[0].id).not.toBe(answers[1].id);
		expect(answers[0].inert).toBe(false);
		expect(answers[1].inert).toBe(true);
	});

	it("returns focus to the trigger before closing an answer that contains focus", () => {
		document.body.innerHTML = `<section data-accordion="component">${accordionItem()}</section>`;
		const answer = document.querySelector('[data-accordion="content"]');
		answer.innerHTML = '<a href="/contact">Contact us</a>';
		initFaq(document, { signal: controller.signal });
		const trigger = document.querySelector('[data-accordion="trigger"]');
		trigger.click();
		answer.querySelector("a").focus();
		expect(document.activeElement).toBe(answer.querySelector("a"));

		trigger.click();
		expect(document.activeElement).toBe(trigger);
		expect(answer.inert).toBe(true);
	});
});
