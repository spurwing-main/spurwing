import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initFaq } from "./faq.js";

function card(question = "Question") {
	return `
		<details name="faq" data-accordion="item">
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
});
