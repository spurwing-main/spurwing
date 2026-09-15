import { afterEach, describe, expect, it } from "vitest";

import { initMenuToggle } from "./menu-toggle.js";

function nav() {
	return `
		<div class="nav">
			<div class="nav_layout">
				<div class="nav_menu"></div>
				<div class="nav_menu-wrap"><span class="line"></span></div>
			</div>
		</div>
	`;
}

const openCount = () => document.querySelectorAll(".is-open").length;

describe("initMenuToggle", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("opens and closes every managed element from the trigger", () => {
		document.body.innerHTML = nav();

		initMenuToggle();

		document.querySelector(".nav_menu-wrap").click();
		expect(openCount()).toBe(3);

		document.querySelector(".nav_menu-wrap").click();
		expect(openCount()).toBe(0);
	});

	it("opens from a click on something inside the trigger", () => {
		document.body.innerHTML = nav();

		initMenuToggle();
		document.querySelector(".line").click();

		expect(openCount()).toBe(3);
	});

	it("closes itself when a navigation starts, before anything scrolls", () => {
		document.body.innerHTML = nav();

		initMenuToggle();
		document.querySelector(".nav_menu-wrap").click();
		expect(openCount()).toBe(3);

		document.dispatchEvent(new window.CustomEvent("spw:leave", { detail: {} }));

		expect(openCount()).toBe(0);
	});

	it("stops listening once its signal is aborted", () => {
		document.body.innerHTML = nav();

		const controller = new AbortController();

		initMenuToggle(document, { signal: controller.signal });
		controller.abort();
		document.querySelector(".nav_menu-wrap").click();

		expect(openCount()).toBe(0);
	});

	it("does nothing on a page with no nav", () => {
		expect(() => initMenuToggle()).not.toThrow();
	});
});
