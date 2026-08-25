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

vi.mock("https://cdn.jsdelivr.net/npm/embla-carousel@8.5.2/+esm", () => ({
	default: createEmbla,
}));

import { initWorkSlider } from "./work-slider.js";

describe("initWorkSlider", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		createEmbla.mockClear();
	});

	it("shares an in-flight initialization instead of wiring a slider twice", async () => {
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

		const loadEmbla = async () => ({ default: createEmbla });
		await expect(
			Promise.all([initWorkSlider(document, loadEmbla), initWorkSlider(document, loadEmbla)]),
		).resolves.toBeDefined();

		expect(createEmbla).toHaveBeenCalledOnce();
	});
});
