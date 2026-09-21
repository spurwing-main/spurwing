import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initIslandReveal } from "./island-reveal.js";

// jsdom lays nothing out, so the height the module reads is stubbed. That is the
// only thing it decides on: zero means Webflow has not hydrated the component yet.
let shadowHeight = 0;

function island({ siblings = 0, shadow = true } = {}) {
	document.body.innerHTML = `<div class="wrap"><code-island></code-island>${'<p></p>'.repeat(siblings)}</div>`;

	const el = document.querySelector("code-island");

	if (shadow) el.attachShadow({ mode: "open" }).innerHTML = "<div><slot></slot></div>";

	return { el, wrap: document.querySelector(".wrap") };
}

const frame = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("initIslandReveal", () => {
	beforeEach(() => {
		shadowHeight = 0;
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({
			height: shadowHeight,
		}));
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
			setTimeout(fn, 0);
			return 1;
		});
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("holds the wrapper hidden while the component has nothing to show", async () => {
		const { wrap } = island();

		initIslandReveal();
		await frame();

		expect(wrap.style.opacity).toBe("0");
	});

	it("fades the wrapper in once the component renders", async () => {
		const { wrap } = island();

		initIslandReveal();
		shadowHeight = 400;
		await frame();
		await frame();

		expect(wrap.style.opacity).toBe("1");
		expect(wrap.style.transition).toContain("opacity");
	});

	it("leaves a component that is already on screen alone", async () => {
		shadowHeight = 400;

		const { wrap } = island();

		initIslandReveal();
		await frame();

		expect(wrap.style.opacity).toBe("");
	});

	it("leaves a wrapper that holds more than the component alone", async () => {
		const { wrap } = island({ siblings: 1 });

		initIslandReveal();
		await frame();

		expect(wrap.style.opacity).toBe("");
	});

	it("reveals anyway once the wait is up, so a failed component is not a blank gap", async () => {
		const { wrap } = island();
		const now = vi.spyOn(performance, "now");

		now.mockReturnValue(0);
		initIslandReveal();

		now.mockReturnValue(5000);
		await frame();
		await frame();

		expect(wrap.style.opacity).toBe("1");
	});

	// Stopping the wait must not leave the island hidden. The next run skips an
	// island that has rendered in the meantime, so an inline opacity 0 left here
	// is one nothing ever clears.
	it("stops checking once its signal is aborted, and hides nothing", async () => {
		const controller = new AbortController();
		const { wrap } = island();

		initIslandReveal(document, { signal: controller.signal });
		controller.abort();
		shadowHeight = 400;
		await frame();
		await frame();

		expect(wrap.style.opacity).toBe("");
		expect(wrap.style.transition).toBe("");
	});

	it("does nothing on a page with no code components", () => {
		document.body.innerHTML = "";

		expect(() => initIslandReveal()).not.toThrow();
	});
});
