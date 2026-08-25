import { afterEach, describe, expect, it } from "vitest";

import { initApproachHero } from "./approach-hero.js";

describe("initApproachHero", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("does not treat a shared progressive blur as an approach-page component", async () => {
		document.body.innerHTML = '<div class="progressive-blur" data-fade-out></div>';

		await initApproachHero();

		expect(document.querySelector(".progressive-blur").dataset.approachHeroReady).toBeUndefined();
	});
});
