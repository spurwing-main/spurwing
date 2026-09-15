import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { modules } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));

function moduleSources() {
	return readdirSync(here)
		.filter((name) => name.endsWith(".js") && !name.endsWith(".test.js") && name !== "index.js")
		.map((name) => ({ name, source: readFileSync(join(here, name), "utf8") }));
}

describe("module contract", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	// boot.js calls init(root, { signal }). Four modules once took their library
	// loader as the second positional argument instead, so each was handed the
	// options object where a function was expected and threw on every page. The
	// suite missed it: those modules return early on a page without their markup,
	// so they never reached the loader, and the fault only showed in a browser
	// console. Reading the signature is what catches it — running an empty page
	// does not.
	it.each(moduleSources())("$name takes its options as an object, not positionally", ({ source }) => {
		const signatures = [...source.matchAll(/export (?:async )?function (init[A-Z]\w*)\(([^)]*)\)/g)];

		for (const [, name, params] of signatures) {
			const second = params.split(",")[1]?.trim();

			if (!second) continue;

			expect(second.startsWith("{"), `${name} must take { signal, ... }, not "${second}"`).toBe(
				true,
			);
		}
	});

	it.each(modules.map((module) => [module.name, module.init]))(
		"%s stays quiet on a page it does not belong to",
		async (name, init) => {
			const controller = new AbortController();
			const error = vi.spyOn(console, "error").mockImplementation(() => {});

			await expect(
				Promise.resolve(init(document, { signal: controller.signal })),
			).resolves.not.toThrow();

			expect(error, `${name} logged an error on an empty page`).not.toHaveBeenCalled();
			expect(() => controller.abort()).not.toThrow();
		},
	);

	it("registers each module once, under a unique name", () => {
		const names = modules.map((module) => module.name);

		expect(new Set(names).size).toBe(names.length);
	});

	it("gives every module a callable init", () => {
		const notCallable = modules.filter((module) => typeof module.init !== "function");

		expect(notCallable.map((module) => module.name)).toEqual([]);
	});
});
