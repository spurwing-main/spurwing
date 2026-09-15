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

describe("initImpactSlider", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		createEmbla.mockClear();
	});

	it("builds its slides once, because building consumes the markup", async () => {
		document.body.innerHTML = `
			<section class="section_impact">
				<div data-card="source"><h3>Title</h3><p>Body</p></div>
				<div class="embla">
					<div class="impact_list">
						<div class="embla__slide">
							<h3 data-card="1"></h3>
							<p data-card="2"></p>
							<em data-card="3"></em>
						</div>
					</div>
				</div>
				<div class="slider_arrows">
					<button class="slider_arrow"></button>
					<button class="slider_arrow"></button>
				</div>
			</section>
		`;

		initImpactSlider(document);
		initImpactSlider(document);

		expect(createEmbla).toHaveBeenCalledOnce();
		expect(document.querySelectorAll(".embla__slide").length).toBe(1);
	});
});
