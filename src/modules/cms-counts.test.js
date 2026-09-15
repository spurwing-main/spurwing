import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bootModules, resetModules, restartModules } from "../boot.js";
import { initCmsCounts } from "./cms-counts.js";

describe("initCmsCounts", () => {
	beforeEach(() => {
		resetModules();
	});

	afterEach(() => {
		document.body.innerHTML = "";
		document.documentElement.removeAttribute("data-cms-count-ok");
		vi.restoreAllMocks();
	});

	it("hydrates counts in the background without delaying later modules", async () => {
		document.body.innerHTML = '<span data-cms-count-target="work"></span>';
		vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
		const next = vi.fn();

		void bootModules([
			{ name: "cms-counts", init: initCmsCounts },
			{ name: "next", init: next },
		]);
		await Promise.resolve();

		expect(next).toHaveBeenCalledOnce();
	});

	it("requests the count document once per page, not once per boot call", async () => {
		document.body.innerHTML = '<span data-cms-count-target="work"></span>';
		const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
		const modules = [{ name: "cms-counts", init: initCmsCounts }];

		await bootModules(modules);
		await bootModules(modules);

		expect(fetch).toHaveBeenCalledOnce();
	});

	it("loads the counts again on the next page, because the markup is new", async () => {
		document.body.innerHTML = '<span data-cms-count-target="work"></span>';
		const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));

		await bootModules([{ name: "cms-counts", init: initCmsCounts }]);
		restartModules();

		expect(fetch).toHaveBeenCalledTimes(2);
	});
});
