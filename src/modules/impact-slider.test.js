import { afterEach, describe, expect, it, vi } from "vitest";

const createEmbla = vi.hoisted(() =>
	vi.fn(() => {
		const api = {
			canScrollPrev: () => false,
			canScrollNext: () => false,
			on: () => api,
		};
		return api;
	}),
);

vi.mock("embla-carousel", () => ({ default: createEmbla }));

import { initImpactSlider } from "./impact-slider.js";

const section = (list) => `
	<section class="section_impact">
		<div class="embla">
			<div class="impact_rt w-richtext">${list}</div>
		</div>
		<div class="slider_arrows">
			<button class="slider_arrow"></button>
			<button class="slider_arrow"></button>
		</div>
	</section>
`;

describe("initImpactSlider", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		createEmbla.mockClear();
	});

	it("slides the stats list itself, once", () => {
		document.body.innerHTML = section(
			"<ul><li><strong>95%</strong> Increase in traffic <em>In two months.</em></li><li><strong>113%</strong> Booking clicks</li></ul>",
		);

		initImpactSlider(document);
		initImpactSlider(document);

		expect(createEmbla).toHaveBeenCalledOnce();
		const [viewport, options] = createEmbla.mock.calls[0];
		expect(viewport.classList.contains("embla")).toBe(true);
		expect(options.container).toBe(document.querySelector(".impact_rt ul"));
		// Nothing is copied: the two bullets are still the only slides.
		expect(document.querySelectorAll(".impact_rt li").length).toBe(2);
	});

	it("hides the section when the case study has no stats", () => {
		document.body.innerHTML = section("<p>‍</p>");

		initImpactSlider(document);

		expect(createEmbla).not.toHaveBeenCalled();
		expect(document.querySelector(".section_impact").style.display).toBe("none");
	});
});
