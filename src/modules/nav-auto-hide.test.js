import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initNavAutoHide } from "./nav-auto-hide.js";

const NAV_HEIGHT = 80;

function scrollTo(y) {
	window.scrollY = y;
	window.dispatchEvent(new window.Event("scroll"));
}

const hidden = () => document.querySelector(".nav").classList.contains("is-hidden");

describe("initNavAutoHide", () => {
	beforeEach(() => {
		window.scrollY = 0;
		vi.stubGlobal(
			"ResizeObserver",
			vi.fn(function () {
				return { observe() {}, disconnect() {} };
			}),
		);
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
			fn();
			return 1;
		});
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ height: NAV_HEIGHT });
		document.body.innerHTML = '<div class="nav"><div class="nav_layout"></div></div>';
	});

	afterEach(() => {
		document.body.innerHTML = "";
		window.scrollY = 0;
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("hides on the way down once past its own height", () => {
		initNavAutoHide();

		scrollTo(400);

		expect(hidden()).toBe(true);
	});

	it("stays put until the reader has gone back up far enough to mean it", () => {
		initNavAutoHide();

		scrollTo(400);
		scrollTo(395); // 5px, under the 14px threshold
		expect(hidden()).toBe(true);

		scrollTo(380);
		expect(hidden()).toBe(false);
	});

	it("shows again at the top of the page", () => {
		initNavAutoHide();

		scrollTo(400);
		expect(hidden()).toBe(true);

		scrollTo(0);
		expect(hidden()).toBe(false);
	});

	it("stays visible while the mobile menu is open", () => {
		initNavAutoHide();
		document.querySelector(".nav_layout").classList.add("is-open");

		scrollTo(400);

		expect(hidden()).toBe(false);
	});

	it("stops listening once its signal is aborted", () => {
		const controller = new AbortController();

		initNavAutoHide(document, { signal: controller.signal });
		controller.abort();

		scrollTo(400);

		expect(hidden()).toBe(false);
	});

	it("does nothing on a page with no nav", () => {
		document.body.innerHTML = "";

		expect(() => initNavAutoHide()).not.toThrow();
	});
});
