import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// dist/bundle.js is what the live site actually runs — Webflow loads it from
// jsDelivr, pinned to a commit. A commit that changes src without rebuilding
// ships nothing, which has happened five times, each needing a follow-up build
// commit up to an hour later. This is the check that says so before the push
// rather than after.
describe("the committed bundle", () => {
	it("matches the current source", () => {
		const out = join(mkdtempSync(join(tmpdir(), "spw-build-")), "bundle.js");

		execFileSync("npx", ["esbuild", "src/index.js", "--bundle", "--format=esm", "--minify", `--outfile=${out}`]);

		expect(readFileSync(out, "utf8")).toBe(readFileSync("dist/bundle.js", "utf8"));
	});
}, 60000);
