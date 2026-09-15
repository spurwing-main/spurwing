// Every module starts here, and starts again after each page transition.
//
// A module is handed a fresh AbortSignal on every run, and the signal from its
// previous run is aborted first. So listeners, observers and timers cannot
// stack up across a transition, and a module that only reads the DOM can ignore
// the signal entirely.
//
//   export function initThing(root = document, { signal } = {}) {
//     const el = root.querySelector(".thing");
//     if (!el) return;                       // not on this page: fine
//     window.addEventListener("resize", onResize, { signal });
//   }
//
// With no router installed this just runs once, on load.

const entries = new Map();
let pageId = 0;

// Returns whatever init returns, so bootModules keeps its single await per
// module: a module that hydrates in the background must not hold up the next.
function runEntry(entry, root) {
	// Already set up for this page. A module can be reached twice when the
	// router restarts everything and the page also boots normally.
	if (entry.ranAt === pageId) return;

	entry.ranAt = pageId;
	entry.controller?.abort();
	entry.controller = new AbortController();

	return entry.init(root, { signal: entry.controller.signal });
}

export async function bootModules(modules, root = document) {
	for (const module of modules) {
		if (!entries.has(module.name)) {
			entries.set(module.name, { ...module, ranAt: -1, controller: null });
		}

		try {
			await runEntry(entries.get(module.name), root);
		} catch (error) {
			console.error(`[site] ${module.name} did not start.`, error);
		}
	}

	root.documentElement?.setAttribute("data-modules-ready", "");
}

// Called by the router once the new page is in the DOM and laid out. Deliberately
// not awaited: the router cannot hold the fade open for a slow module.
export function restartModules(root = document) {
	pageId += 1;

	entries.forEach((entry, name) => {
		try {
			Promise.resolve(runEntry(entry, root)).catch((error) => {
				console.error(`[site] ${name} did not restart.`, error);
			});
		} catch (error) {
			console.error(`[site] ${name} did not restart.`, error);
		}
	});
}

// Test seam. Nothing in the browser needs to forget what has started.
export function resetModules() {
	entries.forEach((entry) => entry.controller?.abort());
	entries.clear();
	pageId = 0;
}
