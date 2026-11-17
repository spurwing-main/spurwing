import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forgetDataPage } from "../data-page.js";
import { initCmsCounts } from "./cms-counts.js";
import { initWorkTags } from "./work-tags.js";

const dataPage = `
	<div data-cms-count="work"><div></div><div></div></div>
	<div>
		<div data-work-slug="tyx-studios">
			<div data-work-service="Design"></div>
			<div data-work-service="Development"></div>
			<div data-work-service="Migration"></div>
		</div>
		<div data-work-slug="justeat">
			<div data-work-service="Design"></div>
			<div data-work-service="Development"></div>
		</div>
	</div>
`;

function card(slug, tag) {
	return `
		<div class="work-item_component">
			<a class="work-item_link" href="/work/${slug}">${slug}</a>
			<div class="work-item_title">
				<div class="work-item_name">${slug}</div>
				<div class="tagline-m w-variant-x">${tag}</div>
			</div>
		</div>
	`;
}

const tagsOf = (slug) =>
	[...document.querySelector(`[href="/work/${slug}"]`).parentElement.querySelectorAll(".tagline-m")].map(
		(tag) => tag.textContent,
	);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function serve(html) {
	return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(html, { status: 200 }));
}

describe("initWorkTags", () => {
	beforeEach(() => {
		forgetDataPage();
	});

	afterEach(() => {
		document.body.innerHTML = "";
		document.documentElement.removeAttribute("data-cms-count-ok");
		vi.restoreAllMocks();
	});

	it("adds the missing services after the card's own tag, in the case study's order", async () => {
		document.body.innerHTML = card("tyx-studios", "Development");
		serve(dataPage);

		initWorkTags(document);
		await settle();

		expect(tagsOf("tyx-studios")).toEqual(["Development", "Design", "Migration"]);
	});

	it("copies the card's own tag, so the added tags look the same", async () => {
		document.body.innerHTML = card("tyx-studios", "Design");
		serve(dataPage);

		initWorkTags(document);
		await settle();

		const added = document.querySelectorAll("[data-work-tag]");

		expect(added).toHaveLength(2);
		added.forEach((tag) => expect(tag.className).toBe("tagline-m w-variant-x"));
		expect(document.querySelector(".tagline-m").hasAttribute("data-work-tag")).toBe(false);
	});

	it("changes nothing when it runs again", async () => {
		document.body.innerHTML = card("tyx-studios", "Design");
		serve(dataPage);

		initWorkTags(document);
		await settle();
		const once = document.body.innerHTML;

		initWorkTags(document);
		await settle();
		document.querySelector(".work-item_component").removeAttribute("data-work-tags");
		initWorkTags(document);
		await settle();

		expect(document.body.innerHTML.replace(' data-work-tags=""', "")).toBe(
			once.replace(' data-work-tags=""', ""),
		);
		expect(tagsOf("tyx-studios")).toEqual(["Design", "Development", "Migration"]);
	});

	it("leaves a card it has no data for as it is", async () => {
		document.body.innerHTML = card("unknown", "Design");
		serve(dataPage);
		const before = document.body.innerHTML;

		initWorkTags(document);
		await settle();

		expect(document.body.innerHTML).toBe(before);
	});

	it("leaves every card with its one tag when the data cannot be fetched", async () => {
		document.body.innerHTML = card("tyx-studios", "Design");
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
		const before = document.body.innerHTML;

		initWorkTags(document);
		await settle();

		expect(document.body.innerHTML).toBe(before);
	});

	it("leaves every card with its one tag when the data page answers with an error", async () => {
		document.body.innerHTML = card("tyx-studios", "Design");
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
		const before = document.body.innerHTML;

		initWorkTags(document);
		await settle();

		expect(document.body.innerHTML).toBe(before);
	});

	it("shares one request with the counts", async () => {
		document.body.innerHTML = `${card("justeat", "Design")}<span data-cms-count-target="work"></span>`;
		const fetch = serve(dataPage);

		initCmsCounts(document);
		initWorkTags(document);
		await settle();

		expect(fetch).toHaveBeenCalledOnce();
		expect(document.querySelector("[data-cms-count-target]").textContent).toBe("2");
		expect(tagsOf("justeat")).toEqual(["Design", "Development"]);
	});

	it("fills cards a Finsweet list renders later", async () => {
		document.body.innerHTML = `<div fs-list-element="list">${card("tyx-studios", "Design")}</div>`;
		serve(dataPage);
		const controller = new AbortController();

		initWorkTags(document, { signal: controller.signal });
		await settle();

		document.querySelector('[fs-list-element="list"]').innerHTML = card("justeat", "Development");
		await settle();

		expect(tagsOf("justeat")).toEqual(["Development", "Design"]);
		controller.abort();
	});
});
