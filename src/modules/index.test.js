import { afterEach, describe, expect, it, vi } from "vitest";

import { bootModules } from "../boot.js";
import { modules } from "./index.js";

afterEach(() => {
	document.body.innerHTML = "";
	document.documentElement.removeAttribute("data-modules-ready");
	vi.restoreAllMocks();
});

describe("module registry", () => {
	it("exposes every migrated behavior through the project module interface", () => {
		expect(modules.map((module) => module.name)).toEqual([
			"data-loader",
			"rt-flow",
			"booking-details",
			"copy",
			"faq",
			"insight-toc",
			"team-switch",
			"stick",
			"work-archive",
			"work-slider",
			"caps",
			"rightway",
			"work-slide",
			"work-rail",
			"work-card-anim",
			"approach-hero",
			"cursor",
		]);

		for (const module of modules) {
			expect(module.init).toBeTypeOf("function");
		}
	});

	it("starts cleanly when the current page has none of the registered components", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await bootModules(modules);

		expect(error).not.toHaveBeenCalled();
		expect(document.documentElement.hasAttribute("data-modules-ready")).toBe(true);
	});
});
