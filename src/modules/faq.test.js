import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initFaq, open } from "./faq.js";

function card(question = "Question", attributes = "") {
	return `
		<details name="faq" data-accordion="item" class="faq-card" ${attributes}>
			<summary data-accordion="trigger"><h3>${question}</h3></summary>
			<div data-accordion="content">Answer</div>
		</details>
	`;
}

describe("initFaq", () => {
	let run;

	beforeEach(() => {
		run = new AbortController();
	});

	afterEach(() => {
		run.abort();
		document.body.innerHTML = "";
	});

	it("opens the first answer on a page that asks for it", () => {
		document.body.innerHTML = `
			<main data-faq-open-first>
				<section data-accordion="component">${card("First")}${card("Second")}</section>
			</main>
		`;
		initFaq(document, { signal: run.signal });
		const cards = document.querySelectorAll("details");

		expect(cards[0].open).toBe(true);
		expect(cards[1].open).toBe(false);
	});

	it("leaves every answer closed on a page that does not ask", () => {
		document.body.innerHTML = `<main><section data-accordion="component">${card()}</section></main>`;
		initFaq(document, { signal: run.signal });

		expect(document.querySelector("details").open).toBe(false);
	});

	it("reads the flag from its own page while the outgoing page is still in the DOM", () => {
		document.body.innerHTML = `
			<main data-faq-open-first><section data-accordion="component">${card("Outgoing")}</section></main>
			<main><section data-accordion="component">${card("Incoming")}</section></main>
		`;
		const pages = document.querySelectorAll("main");
		initFaq(pages[1], { signal: run.signal });

		expect(document.querySelectorAll("details")[1].open).toBe(false);
	});

	it("opens the first card of a Finsweet list, not one above it", () => {
		document.body.innerHTML = `
			<main data-faq-open-first>
				<section data-accordion="component">
					<div fs-list-element="list">${card("Listed")}</div>
				</section>
			</main>
		`;
		initFaq(document, { signal: run.signal });

		expect(document.querySelector("details").open).toBe(true);
	});

	it("opens a question on click, closing the one already open in its group", () => {
		document.body.innerHTML = `<main><section data-accordion="component">${card("First")}${card("Second")}</section></main>`;
		initFaq(document, { signal: run.signal });
		const [first, second] = document.querySelectorAll("details");
		const summaries = document.querySelectorAll("summary");

		summaries[0].click();
		expect(first.open).toBe(true);

		summaries[1].click();
		expect(second.open).toBe(true);
		expect(first.open).toBe(false);
		expect(first.getAttribute("name")).toBe("faq");
		expect(first.hasAttribute("data-closing")).toBe(false);

		summaries[1].click();
		expect(second.open).toBe(false);
	});

	it("brings every card in the same way, a turn after the one above it, whatever made it", () => {
		document.body.innerHTML = `
			<main><section data-accordion="component">
				<div class="ai-faq">
					<div data-ai-faq="ask"><div class="faq-card"></div></div>
					${card("Kept AI answer", 'data-ai-faq="answer"')}
				</div>
				<div data-anim-group><div class="w-dyn-item">${card("Written")}</div></div>
				<div class="faqs_extra">${card("Picked")}</div>
			</section></main>
		`;
		initFaq(document, { signal: run.signal });
		const units = [
			document.querySelector('[data-ai-faq="ask"] .faq-card'),
			document.querySelector('[data-ai-faq="answer"]'),
			document.querySelector(".w-dyn-item"),
			document.querySelector(".faqs_extra > .faq-card"),
		];

		expect(units.map((unit) => unit.getAttribute("data-anim"))).toEqual(["card", "card", "card", "card"]);
		expect(units.map((unit) => unit.style.getPropertyValue("--anim-i"))).toEqual(["0", "1", "2", "3"]);
		// The CMS card comes in as its list item, not twice.
		expect(document.querySelector(".w-dyn-item details").hasAttribute("data-anim")).toBe(false);
	});

	it("opens the first written answer, not an AI answer kept above it", () => {
		document.body.innerHTML = `
			<main data-faq-open-first><section data-accordion="component">
				${card("Kept", 'data-ai-faq="answer"')}${card("Written")}
			</section></main>
		`;
		initFaq(document, { signal: run.signal });
		const [kept, written] = document.querySelectorAll("details");

		expect(kept.open).toBe(false);
		expect(written.open).toBe(true);
	});

	it("leaves a card that is still being written open and out of its group", () => {
		document.body.innerHTML = `<main><section data-accordion="component">${card("Written")}${card("Asked", "aria-busy")}</section></main>`;
		initFaq(document, { signal: run.signal });
		const [written, asked] = document.querySelectorAll("details");

		open(asked);
		expect(asked.open).toBe(true);
		expect(asked.hasAttribute("name")).toBe(false);
		asked.querySelector("summary").click();
		expect(asked.open).toBe(true);

		document.querySelectorAll("summary")[0].click();
		expect(written.open).toBe(true);
		expect(asked.open).toBe(true);

		// Finished, it rejoins open, and the other slides shut.
		asked.removeAttribute("aria-busy");
		open(asked);
		expect(asked.getAttribute("name")).toBe("faq");
		expect(asked.open).toBe(true);
		expect(written.open).toBe(false);
	});
});
