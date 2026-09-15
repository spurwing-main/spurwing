import { afterEach, describe, expect, it } from "vitest";

import { initApproachHero } from "./approach-hero.js";

describe("initApproachHero", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("does not treat a shared progressive blur as an approach-page component", async () => {
		document.body.innerHTML = '<div class="progressive-blur" data-fade-out></div>';

		await initApproachHero();

		// The module only claims a blur inside .section_caps; with no section it
		// must leave --fade alone rather than pin it to 1.
		expect(document.querySelector(".progressive-blur").style.getPropertyValue("--fade")).toBe("");
	});
});
