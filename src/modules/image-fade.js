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
 * FAIL OPEN: the rule that hides a pending image is gated on
 * `html[data-img-ready]`, set here and nowhere else. No JavaScript, no hidden
 * images. It also does nothing in the Designer canvas or Editor.
 */

const ATTRIBUTE = "data-img";

/** The Designer canvas and the Editor must never hide an image from an editor. */
function isAuthoringSurface() {
	const classes = document.documentElement.classList;

	return classes.contains("wf-design-mode") || classes.contains("w-editor");
}

export function initImageFade(root = document, { signal } = {}) {
	if (isAuthoringSurface()) return;

	const waiting = [...root.querySelectorAll("img")].filter(
		(image) => !image.complete && !image.closest('[data-anim="off"]'),
	);

	if (!waiting.length) return;

	document.documentElement.setAttribute("data-img-ready", "");

	for (const image of waiting) {
		const arrive = () => image.setAttribute(ATTRIBUTE, "in");

		image.setAttribute(ATTRIBUTE, "wait");

		image.addEventListener(
			"load",
			() => {
				// `load` fires when the bytes are in; `decode` resolves when there is
				// a picture to draw. On a slow device those are far enough apart to
				// fade up an empty box, so the fade waits for the second one. A
				// rejected decode still arrives: a broken image must never stay
				// hidden.
				(image.decode?.() ?? Promise.resolve()).then(arrive, arrive);
			},
			{ once: true, signal },
		);

		image.addEventListener("error", arrive, { once: true, signal });

		// It can finish between the filter above and the listener above, and then
		// no event is ever coming.
		if (image.complete) arrive();
	}
}
