import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initImageFade } from "./image-fade.js";

function pending() {
	const image = document.createElement("img");

	// jsdom reports a fresh img as complete; a real browser does not until the
	// bytes are in, and that state is the whole subject of this file.
	Object.defineProperty(image, "complete", { value: false, configurable: true });

	return image;
}

describe("initImageFade", () => {
	beforeEach(() => vi.useFakeTimers());

	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = "";
		document.documentElement.removeAttribute("data-img-ready");
	});

	it("hides an image that has not loaded, then fades it in when it has", async () => {
		const image = pending();

		document.body.append(image);
		initImageFade();

		expect(image.getAttribute("data-img")).toBe("wait");

		image.dispatchEvent(new Event("load"));
		await vi.advanceTimersByTimeAsync(0);

		expect(image.getAttribute("data-img")).toBe("in");
	});

	// The browser decides when a lazy image is fetched, and it defers one in a
	// backgrounded tab or in a box that has collapsed to no height. No load and
	// no error is ever coming, so nothing would clear the mark.
	it("stops hiding an image whose load never arrives", async () => {
		const image = pending();

		document.body.append(image);
		initImageFade();

		expect(image.getAttribute("data-img")).toBe("wait");

		await vi.advanceTimersByTimeAsync(2000);

		expect(image.getAttribute("data-img")).toBe("in");
	});

	// A page transition aborts the run that marked the image.
	it("still reveals an image after its run is aborted", async () => {
		const controller = new AbortController();
		const image = pending();

		document.body.append(image);
		initImageFade(document, { signal: controller.signal });
		controller.abort();

		image.dispatchEvent(new Event("load"));
		await vi.advanceTimersByTimeAsync(0);

		expect(image.getAttribute("data-img")).toBe("in");
	});

	it("leaves an image that was already loaded alone", () => {
		const image = document.createElement("img");

		document.body.append(image);
		initImageFade();

		expect(image.hasAttribute("data-img")).toBe(false);
	});

	it("catches an image added after it ran", async () => {
		initImageFade();

		const image = pending();

		document.body.append(image);
		await vi.advanceTimersByTimeAsync(0);

		expect(image.getAttribute("data-img")).toBe("wait");
	});
});
