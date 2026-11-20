import { afterEach, describe, expect, it, vi } from "vitest";

import { initAnim } from "./anim.js";

const box = (top) => ({ top, bottom: top + 100, left: 0, right: 300, width: 300, height: 100 });

describe("anim", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		document.documentElement.removeAttribute("data-anim-ready");
		document.body.innerHTML = "";
	});

	it("reveals a set together when its first member arrives", () => {
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				observe() {}
				unobserve() {}
			},
		);
		// A page with a width: at 0, everything reads as a carousel slide parked to the side.
		Object.defineProperty(document.documentElement, "clientWidth", { value: 1200, configurable: true });
		document.body.innerHTML = `
			<div data-anim-together>
				<div data-anim="card" id="first"></div>
				<div><div data-anim="card" id="later"></div></div>
			</div>
			<div data-anim="card" id="outside"></div>`;
		document.getElementById("first").getBoundingClientRect = () => box(100);
		document.getElementById("later").getBoundingClientRect = () => box(2000);
		document.getElementById("outside").getBoundingClientRect = () => box(3000);

		initAnim(document, { signal: new AbortController().signal });

		expect(document.getElementById("first").getAttribute("data-anim-state")).toBe("in");
		expect(document.getElementById("later").getAttribute("data-anim-state")).toBe("in");
		expect(document.getElementById("outside").hasAttribute("data-anim-state")).toBe(false);
	});
});
