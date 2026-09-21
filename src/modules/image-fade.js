/**
 * Images fade in as they arrive.
 *
 * WHY THIS IS NOT A data-anim PRESET. Everything in anim.js is triggered by
 * scroll position: the reader reaches a block and it reveals. An image has a
 * second clock the page cannot predict — when its bytes land and decode — and
 * the two are unrelated. A block can sweep in perfectly and then, half a second
 * later, the picture inside it snaps from nothing to everything. That snap is
 * what this file removes, and it is why no attribute in the Designer controls
 * it: an image arriving is not a design decision, it is what images do.
 *
 * It composes with the reveal rather than competing: the sweep is a mask on the
 * block, this is opacity on the image, and they are different properties on
 * different elements.
 *
 * ALREADY IN CACHE MEANS ALREADY THERE. An image that has finished loading
 * before this runs is left alone. Marking it and fading it in would be
 * inventing a delay the reader did not have, which is the usual way this effect
 * goes wrong — every image on a second visit politely fading in for no reason.
 *
 * ANYTHING BUILT LATER COUNTS TOO. A Finsweet list re-renders its items after
 * this runs, so a one-off pass at boot misses every image in it — which is why
 * the work cards snapped in while the rest of the page faded. A mutation
 * observer catches what arrives afterwards.
 *
 * FAIL OPEN, PER IMAGE. The rule that hides a pending image is gated on
 * `html[data-img-ready]`, set here and nowhere else: no JavaScript, no hidden
 * images. But that gate is site-wide, and the real hazard is one image. Hiding
 * is instant and revealing is a promise, so anything that can break the promise
 * leaves that picture blank for good. Two things could:
 *
 *   - the page signal. These listeners used to carry it, and a soft navigation
 *     aborts the outgoing run's signal. Images the router had already inserted
 *     were marked by the outgoing run, lost their listeners on the abort, and
 *     were skipped by the incoming run as already watched. That is the blank
 *     image that came back on refresh. `once` already removes them, so they are
 *     no longer tied to a page at all — only the observer is.
 *   - `decode()` never settling, which WebKit has done for an image in a
 *     subtree it is not painting. The deadline below is the answer to that: an
 *     image that has loaded is shown whatever decode says.
 *
 * It also does nothing in the Designer canvas or Editor.
 */

const ATTRIBUTE = "data-img";

/** The longest the fade waits on a decode that may never answer. */
const DECODE_DEADLINE_MS = 1000;

/** The Designer canvas and the Editor must never hide an image from an editor. */
function isAuthoringSurface() {
	const classes = document.documentElement.classList;

	return classes.contains("wf-design-mode") || classes.contains("w-editor");
}

export function initImageFade(root = document, { signal } = {}) {
	if (isAuthoringSurface()) return;

	document.documentElement.setAttribute("data-img-ready", "");

	for (const image of root.querySelectorAll("img")) watch(image);

	// A Finsweet list replaces its items after this has run — the work list on
	// /work is one, and its cards were the ones snapping in. Those images are DOM
	// this module has never seen, so watching for them is the only way to catch
	// them. It also covers anything else built after boot.
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (node.nodeType !== 1) continue;

				if (node.tagName === "IMG") watch(node);
				else node.querySelectorAll?.("img").forEach((image) => watch(image));
			}
		}
	});

	observer.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });
	signal?.addEventListener("abort", () => observer.disconnect());
}

function watch(image) {
	// Already decoded, or already being watched. An image that finished before
	// this saw it is left alone: fading it in would invent a delay the reader did
	// not have.
	if (image.complete || image.hasAttribute(ATTRIBUTE)) return;
	if (image.closest('[data-anim="off"]')) return;

	const arrive = () => image.setAttribute(ATTRIBUTE, "in");

	image.setAttribute(ATTRIBUTE, "wait");

	// No signal on either listener. `once` removes them, and a page transition
	// must never take away the one thing that can un-hide an image.
	image.addEventListener(
		"load",
		() => {
			// `load` fires when the bytes are in; `decode` resolves when there is a
			// picture to draw. On a slow device those are far enough apart to fade up
			// an empty box, so the fade waits for the second one. A rejected decode
			// still arrives: a broken image must never stay hidden. Nor must one
			// whose decode never answers, so the wait is bounded.
			Promise.race([
				image.decode?.() ?? Promise.resolve(),
				new Promise((resolve) => setTimeout(resolve, DECODE_DEADLINE_MS)),
			]).then(arrive, arrive);
		},
		{ once: true },
	);

	image.addEventListener("error", arrive, { once: true });

	// It can finish between the check above and the listener above, and then no
	// event is ever coming.
	if (image.complete) arrive();
}
