import { afterEach, describe, expect, it, vi } from "vitest";

import { initBgVideo } from "./bg-video.js";

function setup({ reduce = false } = {}) {
	document.body.innerHTML = `<img class="next_call-bg"><video class="next_call-bg" data-bg-video preload="none" src="a.mp4"></video>`;
	const video = document.querySelector("video");
	video.play = vi.fn(() => Promise.resolve());
	video.pause = vi.fn();
	window.matchMedia = vi.fn(() => ({ matches: reduce }));
	const observed = [];
	let callback;
	window.IntersectionObserver = vi.fn(function (cb) {
		callback = cb;
		this.observe = (el) => observed.push(el);
		this.disconnect = vi.fn();
		disconnect = this.disconnect;
	});
	let disconnect;
	return { video, observed, fire: (isIntersecting) => callback([{ target: video, isIntersecting }]), disconnect: () => disconnect };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("bg-video", () => {
	it("mutes and loops the video, plays it near the screen and pauses it away from it", () => {
		const { video, observed, fire } = setup();
		initBgVideo(document, {});

		expect([video.muted, video.loop, video.playsInline]).toEqual([true, true, true]);
		expect(observed).toEqual([video]);
		fire(true);
		expect(video.play).toHaveBeenCalledTimes(1);
		fire(false);
		expect(video.pause).toHaveBeenCalledTimes(1);
	});

	it("never plays for a visitor who asks for less motion", () => {
		const { video } = setup({ reduce: true });
		initBgVideo(document, {});

		expect(window.IntersectionObserver).not.toHaveBeenCalled();
		expect(video.play).not.toHaveBeenCalled();
	});

	it("stops watching when the page goes", () => {
		const { disconnect } = setup();
		const controller = new AbortController();
		initBgVideo(document, { signal: controller.signal });
		controller.abort();

		expect(disconnect()).toHaveBeenCalled();
	});
});
