// Webflow ships a code component as an empty shell. The server-rendered shadow
// root holds nothing but a hidden <slot>, so the images sit in the light DOM
// with display:none until the federated module downloads and hydrates. Measured
// on /approach: the page is on screen at 588ms, the ticker's module is not even
// requested until 1130ms, and content first has a height at ~734ms in a warm
// cache. So the hero media is a blank gap, then everything snaps in at once —
// and for a frame or two in between the items are in the DOM with no height,
// which is when an unlaid-out row can show.
//
// This holds the wrapper at zero opacity until the island has rendered
// something with a height, then fades it in. Nothing already on screen is
// hidden: an island that hydrated before this ran is left alone.

const islandRevealConfig = {
	selector: "code-island",
	revealMs: 400,
	// Reveal regardless after this, so a slow or failed component CDN leaves the
	// section late rather than permanently blank.
	waitMs: 2500,
};

export function initIslandReveal(root = document, { signal } = {}) {
	for (const island of root.querySelectorAll(islandRevealConfig.selector)) {
		const wrap = island.parentElement;

		// code-island is display:contents, so it has no box to fade. The wrapper
		// carries it, and only when the island is all the wrapper holds —
		// otherwise a heading beside it would fade out too.
		if (!wrap || wrap.children.length > 1) continue;
		if (hasRendered(island)) continue;

		wrap.style.opacity = "0";
		revealWhenRendered(island, wrap, signal);
	}
}

// True once the shadow root renders anything with a height. It reads false
// while only the hidden slot is there, and while the ticker's list exists but
// has not been laid out — both states we are waiting through. Cheap either way:
// Webflow's shell is four elements, and a hydrated one answers on the first
// with a box.
function hasRendered(island) {
	const shadow = island.shadowRoot;

	if (!shadow) return true;

	for (const element of shadow.querySelectorAll("*")) {
		if (element.getBoundingClientRect().height > 0) return true;
	}

	return false;
}

function revealWhenRendered(island, wrap, signal) {
	const deadline = performance.now() + islandRevealConfig.waitMs;
	let frame = 0;

	const check = () => {
		// Hiding is instant and revealing is a promise, so the promise has to
		// survive being cancelled. Returning here used to leave opacity 0 inline,
		// and the next run skips an island that has since rendered — nothing was
		// left to clear it.
		if (signal?.aborted) {
			wrap.style.opacity = "";
			return;
		}

		if (!hasRendered(island) && performance.now() < deadline) {
			frame = requestAnimationFrame(check);
			return;
		}

		wrap.style.transition = `opacity ${islandRevealConfig.revealMs}ms ease`;
		wrap.style.opacity = "1";

		wrap.addEventListener(
			"transitionend",
			() => {
				wrap.style.removeProperty("transition");
				wrap.style.removeProperty("opacity");
			},
			{ once: true, signal },
		);
	};

	frame = requestAnimationFrame(check);
	signal?.addEventListener("abort", () => cancelAnimationFrame(frame));
}
