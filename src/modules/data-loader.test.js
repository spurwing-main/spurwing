import { afterEach, describe, expect, it, vi } from "vitest";

import { bootModules } from "../boot.js";
import { initDataLoader } from "./data-loader.js";

describe("initDataLoader", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		delete document.documentElement.dataset.cmsCountLoaderReady;
		vi.restoreAllMocks();
	});

	it("hydrates counts in the background without delaying later modules", async () => {
		document.body.innerHTML = '<span data-cms-count-target="work"></span>';
		vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
		const next = vi.fn();

		void bootModules([
			{ name: "data-loader", init: initDataLoader },
			{ name: "next", init: next },
		]);
		await Promise.resolve();

		expect(next).toHaveBeenCalledOnce();
	});

	it("does not request the same count document twice for repeated initialization", () => {
		document.body.innerHTML = '<span data-cms-count-target="work"></span>';
		const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));

		initDataLoader();
		initDataLoader();

		expect(fetch).toHaveBeenCalledOnce();
	});
});
