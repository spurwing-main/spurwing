import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({
	animation: { id: "animation" },
	stop: vi.fn(),
	animate: vi.fn(),
	scroll: vi.fn(),
}));

vi.mock("motion", () => ({ animate: motion.animate, scroll: motion.scroll }));

import { initImgParallax } from "./img-parallax.js";

const section = `
	<section data-img-parallax="section">
		<img data-img-parallax="img" alt="">
	</section>
`;

const $ = (selector) => document.querySelector(selector);

function stubReducedMotion(matches) {
	vi.stubGlobal("matchMedia", vi.fn(() => ({ matches })));
}

describe("initImgParallax", () => {
	beforeEach(() => {
		motion.animate.mockReset().mockReturnValue(motion.animation);
		motion.scroll.mockReset().mockReturnValue(motion.stop);
		motion.stop.mockReset();
		stubReducedMotion(false);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
	});

	it("moves the image from 15% up to rest across the section's pass through the screen", () => {
		document.body.innerHTML = section;

		initImgParallax();

		expect(motion.animate).toHaveBeenCalledWith($("img"), { y: ["-15%", "0%"] }, { ease: "linear" });
		expect(motion.scroll).toHaveBeenCalledWith(motion.animation, {
			target: $("section"),
			offset: ["start end", "end start"],
		});
	});

	it("sets each section up once, however often it runs", () => {
		document.body.innerHTML = section;

		initImgParallax();
		initImgParallax();

		expect(motion.scroll).toHaveBeenCalledOnce();
	});

	it("leaves a section without its image alone", () => {
		document.body.innerHTML = '<section data-img-parallax="section"></section>';

		initImgParallax();

		expect(motion.scroll).not.toHaveBeenCalled();
	});

	it("keeps the image still for reduced motion", () => {
		stubReducedMotion(true);
		document.body.innerHTML = section;

		initImgParallax();

		expect(motion.scroll).not.toHaveBeenCalled();
	});

	it("stops and puts the image back when the page goes", () => {
		document.body.innerHTML = section;
		const controller = new AbortController();

		initImgParallax(document, { signal: controller.signal });
		$("img").style.transform = "translateY(-10%)";
		controller.abort();

		expect(motion.stop).toHaveBeenCalledOnce();
		expect($("img").style.transform).toBe("");
	});
});
