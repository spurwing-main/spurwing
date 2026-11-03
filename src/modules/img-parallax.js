import { animate, scroll } from "motion";

import { claimOnce } from "../dom.js";

/**
 * Image parallax: an image drifts down through its section as the section
 * scrolls past, so it settles into place as the reader leaves.
 *
 *   <section data-img-parallax="section">
 *     <img data-img-parallax="img">
 *
 * The image starts 15% of its own height up, as the section's top reaches the
 * bottom of the screen, and ends at rest as the section's bottom leaves the
 * top. The image must be taller than its section for the travel not to show a
 * gap; the home team section's is 110% tall, anchored to the bottom. Scroll
 * drives the motion directly, on the compositor where the browser supports
 * scroll timelines. Reduced motion leaves the image where the Designer put it.
 */

const config = {
	from: "-15%",
	to: "0%",
	offset: ["start end", "end start"],
};

export function initImgParallax(root = document, { signal } = {}) {
	const sections = root.querySelectorAll('[data-img-parallax="section"]');

	if (!sections.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	for (const section of sections) {
		if (!claimOnce(section, "data-img-parallax-claimed")) continue;

		const image = section.querySelector('[data-img-parallax="img"]');

		if (!image) continue;

		const stop = scroll(animate(image, { y: [config.from, config.to] }, { ease: "linear" }), {
			target: section,
			offset: config.offset,
		});

		signal?.addEventListener("abort", () => {
			stop();
			image.style.transform = "";
		});
	}
}
