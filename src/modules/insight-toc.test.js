import { afterEach, describe, expect, it } from "vitest";

import { initInsightToc } from "./insight-toc.js";

function tocMarkup(currentIndex = -1) {
	return `
		<nav class="insights-item-sidebar_links">
			<a class="insights-item-sidebar_link${currentIndex === 0 ? " w--current" : ""}">First</a>
			<a class="insights-item-sidebar_link${currentIndex === 1 ? " w--current" : ""}">Middle</a>
			<a class="insights-item-sidebar_link${currentIndex === 2 ? " w--current" : ""}">Last</a>
		</nav>
	`;
}

function activeLink() {
	return document.querySelector("[data-insights-toc-current]");
}

describe("initInsightToc", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("marks the first item active on load when Finsweet has no current item", () => {
		document.body.innerHTML = tocMarkup();

		initInsightToc();

		expect(activeLink()?.textContent).toBe("First");
	});

	it("keeps the first item active above its trigger point", async () => {
		document.body.innerHTML = tocMarkup(0);
		initInsightToc();
		const firstLink = document.querySelector(".insights-item-sidebar_link");

		firstLink.classList.remove("w--current");
		await Promise.resolve();

		expect(activeLink()?.textContent).toBe("First");
	});

	it("keeps the last item active below its trigger point", async () => {
		document.body.innerHTML = tocMarkup(2);
		initInsightToc();
		const lastLink = document.querySelector(".insights-item-sidebar_link:last-child");

		lastLink.classList.remove("w--current");
		await Promise.resolve();

		expect(activeLink()?.textContent).toBe("Last");
	});
});
