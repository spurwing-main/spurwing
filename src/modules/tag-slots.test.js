import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forgetDataPage } from "../data-page.js";
import { initCmsCounts } from "./cms-counts.js";
import { initTagSlots } from "./tag-slots.js";

const dataPage = `
	<div data-cms-count="work"><div></div><div></div></div>
	<div>
		<div data-tags-for="TYX Studios">
			<div data-tag="Design"></div>
			<div data-tag="Development"></div>
			<div data-tag="Migration"></div>
		</div>
		<div data-tags-for="Just Eat">
			<div data-tag="Design"></div>
			<div data-tag="Development"></div>
		</div>
	</div>
`;

// A tag row as the Work Item component renders it: the card's own tag, then
// the slot keyed by the case study's name.
function card(name, tag) {
	return `
		<div class="work-item_component" data-name="${name}">
			<div class="work-item_tags">
				<div class="tagline-m w-variant-x">${tag}</div>
				<div class="work-item_tags-more" data-tags-for="${name}"></div>
			</div>
		</div>
	`;
}

const tagsOf = (name) =>
	[...document.querySelector(`[data-name="${name}"] .work-item_tags`).querySelectorAll(".tagline-m")].map(
		(tag) => tag.textContent,
	);

const slotOf = (name) => document.querySelector(`[data-name="${name}"] [data-tags-for]`);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function serve(html) {
	return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(html, { status: 200 }));
}

describe("initTagSlots", () => {
	beforeEach(() => {
		forgetDataPage();
	});

	afterEach(() => {
		document.body.innerHTML = "";
		document.documentElement.removeAttribute("data-cms-count-ok");
		vi.restoreAllMocks();
	});

	it("adds the listed tags the row doesn't show, in the listed order, after the card's own tag", async () => {
		document.body.innerHTML = card("TYX Studios", "Development");
		serve(dataPage);

		initTagSlots(document);
		await settle();

		expect(tagsOf("TYX Studios")).toEqual(["Development", "Design", "Migration"]);
	});

	it("puts the added tags inside the slot, as copies of the tag before it", async () => {
		document.body.innerHTML = card("TYX Studios", "Design");
		serve(dataPage);

		initTagSlots(document);
		await settle();

		const added = [...slotOf("TYX Studios").children];

		expect(added.map((tag) => tag.textContent)).toEqual(["Development", "Migration"]);
		added.forEach((tag) => expect(tag.className).toBe("tagline-m w-variant-x"));
	});

	it("changes nothing when it runs again", async () => {
		document.body.innerHTML = card("TYX Studios", "Design");
		serve(dataPage);

		initTagSlots(document);
		await settle();
		const once = document.body.innerHTML;

		initTagSlots(document);
		await settle();

		expect(document.body.innerHTML).toBe(once);
	});

	it("leaves a slot it has no list for empty", async () => {
		document.body.innerHTML = card("Unknown", "Design");
		serve(dataPage);
		const before = document.body.innerHTML;

		initTagSlots(document);
		await settle();

		expect(document.body.innerHTML).toBe(before);
	});

	it("leaves a slot with no tag before it empty", async () => {
		document.body.innerHTML = `<div class="work-item_tags"><div data-tags-for="TYX Studios"></div></div>`;
		serve(dataPage);

		initTagSlots(document);
		await settle();

		expect(document.querySelector("[data-tags-for]").childElementCount).toBe(0);
	});

	it("leaves every card with its one tag when the data cannot be fetched", async () => {
		document.body.innerHTML = card("TYX Studios", "Design");
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
		const before = document.body.innerHTML;

		initTagSlots(document);
		await settle();

		expect(document.body.innerHTML).toBe(before);
	});

	it("leaves every card with its one tag when the data page answers with an error", async () => {
		document.body.innerHTML = card("TYX Studios", "Design");
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
		const before = document.body.innerHTML;

		initTagSlots(document);
		await settle();

		expect(document.body.innerHTML).toBe(before);
	});

	it("shares one request with the counts", async () => {
		document.body.innerHTML = `${card("Just Eat", "Design")}<span data-cms-count-target="work"></span>`;
		const fetch = serve(dataPage);

		initCmsCounts(document);
		initTagSlots(document);
		await settle();

		expect(fetch).toHaveBeenCalledOnce();
		expect(document.querySelector("[data-cms-count-target]").textContent).toBe("2");
		expect(tagsOf("Just Eat")).toEqual(["Design", "Development"]);
	});

	it("fills cards a Finsweet list renders later", async () => {
		document.body.innerHTML = `<div fs-list-element="list">${card("TYX Studios", "Design")}</div>`;
		serve(dataPage);
		const controller = new AbortController();

		initTagSlots(document, { signal: controller.signal });
		await settle();

		document.querySelector('[fs-list-element="list"]').innerHTML = card("Just Eat", "Development");
		await settle();

		expect(tagsOf("Just Eat")).toEqual(["Development", "Design"]);
		controller.abort();
	});
});
