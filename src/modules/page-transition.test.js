import { afterEach, describe, expect, it } from "vitest";

import { routeTarget } from "./page-transition.js";

const here = new URL("https://spurwing.co.uk/about?ref=nav");

function link(html) {
	document.body.innerHTML = html;
	return document.querySelector("a");
}

const route = (html, event = null) => routeTarget(link(html), event, here);

describe("routeTarget", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("routes an ordinary link to another page on this site", () => {
		expect(route('<a href="https://spurwing.co.uk/work">Work</a>')?.pathname).toBe("/work");
	});

	it("treats a link back to this page as a scroll to the top", () => {
		expect(route('<a href="https://spurwing.co.uk/about?ref=nav">Top</a>')).toBe("self");
	});

	it("leaves an anchor on this page to the browser", () => {
		expect(route('<a href="https://spurwing.co.uk/about?ref=nav#faq">FAQ</a>')).toBeNull();
	});

	it("leaves another site alone", () => {
		expect(route('<a href="https://example.com/x">Out</a>')).toBeNull();
	});

	it("leaves mail and telephone links alone", () => {
		expect(route('<a href="mailto:hello@spurwing.co.uk">Mail</a>')).toBeNull();
		expect(route('<a href="tel:+441234567890">Call</a>')).toBeNull();
	});

	it("leaves a file alone, so the browser downloads or opens it", () => {
		expect(route('<a href="https://spurwing.co.uk/files/deck.pdf">Deck</a>')).toBeNull();
		expect(route('<a href="https://spurwing.co.uk/img/logo.svg">Logo</a>')).toBeNull();
	});

	it("leaves a download link alone", () => {
		expect(route('<a href="https://spurwing.co.uk/work" download>Save</a>')).toBeNull();
	});

	it("leaves a link that opens a new tab alone", () => {
		expect(route('<a href="https://spurwing.co.uk/work" target="_blank">New</a>')).toBeNull();
	});

	it("routes a link that explicitly targets this tab", () => {
		expect(route('<a href="https://spurwing.co.uk/work" target="_self">Here</a>')?.pathname).toBe(
			"/work",
		);
	});

	it("leaves anything inside an opted-out region alone", () => {
		document.body.innerHTML =
			'<div data-pt-ignore><a href="https://spurwing.co.uk/work">Work</a></div>';

		expect(routeTarget(document.querySelector("a"), null, here)).toBeNull();
	});

	it.each([
		["a new tab", { metaKey: true }],
		["ctrl-click", { ctrlKey: true }],
		["a new window", { shiftKey: true }],
		["a save", { altKey: true }],
		["a middle click", { button: 1 }],
		["a click something else already handled", { defaultPrevented: true }],
	])("leaves %s to the browser", (_name, event) => {
		const full = { defaultPrevented: false, button: 0, ...event };

		expect(route('<a href="https://spurwing.co.uk/work">Work</a>', full)).toBeNull();
	});

	it("routes a plain left click", () => {
		const event = { defaultPrevented: false, button: 0 };

		expect(route('<a href="https://spurwing.co.uk/work">Work</a>', event)?.pathname).toBe("/work");
	});

	it("ignores a click that did not land on a link", () => {
		expect(routeTarget(null, null, here)).toBeNull();
	});
});
