import { afterEach, describe, expect, it } from "vitest";

import { initInsightToc } from "./insight-toc.js";

function articleMarkup(headings = ["First section", "Second section"]) {
	return `
		<nav class="insights-item-sidebar_links">
			<a class="insights-item-sidebar_link" href="#intro">Intro</a>
			<div class="insights-item-sidebar_link-wrap">
				<a class="insights-item-sidebar_link" href="#">Text Link</a>
			</div>
		</nav>
		<div class="insights-item-main_body">
			<div class="rich-text is-insights-leadin"><h2>Lead in</h2></div>
			<div class="rich-text">
				<div id="intro">Intro copy</div>
				${headings.map((text) => `<h2>${text}</h2>`).join("")}
			</div>
		</div>
	`;
}

const links = () => [...document.querySelectorAll(".insights-item-sidebar_links a")];

describe("initInsightToc", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("gives every section an id and a link, leaving the lead-in alone", () => {
		document.body.innerHTML = articleMarkup();

		initInsightToc();

		expect([...document.querySelectorAll(".rich-text:not(.is-insights-leadin) h2")].map((h) => h.id)).toEqual([
			"first-section",
			"second-section",
		]);
		expect(document.querySelector(".is-insights-leadin h2").id).toBe("");
		expect(links().map((link) => link.getAttribute("href"))).toEqual([
			"#intro",
			"#first-section",
			"#second-section",
		]);
	});

	it("keeps the first of two matching headings on the clean id", () => {
		document.body.innerHTML = articleMarkup(["Same name", "Same name"]);

		initInsightToc();

		expect([...document.querySelectorAll(".rich-text:not(.is-insights-leadin) h2")].map((h) => h.id)).toEqual([
			"same-name",
			"same-name-2",
		]);
	});

	// Which link that is depends on geometry, which jsdom does not have. What
	// matters everywhere is that exactly one is marked: none leaves the indicator
	// homeless, several leave it in two places at once.
	it("marks exactly one link as the current section", () => {
		document.body.innerHTML = articleMarkup();

		initInsightToc();

		expect(document.querySelectorAll("[data-insights-toc-current]")).toHaveLength(1);
	});

	it("does nothing without a template item to clone", () => {
		document.body.innerHTML = articleMarkup();
		document.querySelector(".insights-item-sidebar_link-wrap").remove();

		initInsightToc();

		expect(links()).toHaveLength(1);
	});
});
