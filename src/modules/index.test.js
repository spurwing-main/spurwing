import { readdirSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { bootModules } from "../boot.js";
import { modules } from "./index.js";

afterEach(() => {
	document.body.innerHTML = "";
	document.documentElement.removeAttribute("data-modules-ready");
	vi.restoreAllMocks();
});

describe("module registry", () => {
	// Read from the directory, not from a list. The old version compared the
	// registry with a hard-coded copy of itself, which passed if a module was
	// deleted from both and never noticed a module file that existed but was
	// never registered — a module nobody would have missed until the behaviour
	// was reported broken.
	// Two files in here are deliberately not modules: page-transition owns
	// navigation for the whole session and is started once by src/index.js rather
	// than restarted per page, and slider-controls is a helper the sliders share.
	// Anything else is a module and belongs in the registry.
	const notModules = new Set(["index", "page-transition", "slider-controls"]);

	it("registers every module file", () => {
		const files = readdirSync("src/modules")
			.filter((file) => file.endsWith(".js") && !file.endsWith(".test.js"))
			.map((file) => file.replace(/\.js$/, ""))
			.filter((name) => !notModules.has(name))
			.sort();

		expect(modules.map((module) => module.name).sort()).toEqual(files);
	});

	it("gives every module a name and a callable init", () => {
		for (const module of modules) {
			expect(typeof module.name).toBe("string");
			expect(module.name).not.toBe("");
			expect(typeof module.init).toBe("function");
		}
	});

	it("starts cleanly when the current page has none of the registered components", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await bootModules(modules);

		expect(error).not.toHaveBeenCalled();
		expect(document.documentElement.hasAttribute("data-modules-ready")).toBe(true);
	});
});
