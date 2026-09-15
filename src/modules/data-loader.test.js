import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bootModules, resetModules, restartModules } from "../boot.js";
import { initDataLoader } from "./data-loader.js";

describe("initDataLoader", () => {
	beforeEach(() => {
		resetModules();
	});

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

	it("requests the count document once per page, not once per boot call", async () => {
		document.body.innerHTML = '<span data-cms-count-target="work"></span>';
		const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
		const modules = [{ name: "data-loader", init: initDataLoader }];

		await bootModules(modules);
		await bootModules(modules);

		expect(fetch).toHaveBeenCalledOnce();
	});

	it("loads the counts again on the next page, because the markup is new", async () => {
		document.body.innerHTML = '<span data-cms-count-target="work"></span>';
		const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));

		await bootModules([{ name: "data-loader", init: initDataLoader }]);
		restartModules();

		expect(fetch).toHaveBeenCalledTimes(2);
	});
});
