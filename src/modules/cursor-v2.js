// Cursor v2 — not wired up. index.js still registers cursor.js; this file is
// the next version, kept whole so it can be swapped in when it is finished.
//
// What it changes: the button stays on screen between hover targets and
// springs from one text width to the next instead of replaying its entrance,
// the handoff grace is long enough to cross the gap between two cards, and the
// text swap crossfades two layers so the button is never empty mid-swap.
//
// Open: a halo shows around the pill. Not diagnosed. The shell carries
// backdrop-filter: blur(18px), an inset white ring and a drop shadow, and the
// animations leave filter: blur(0px) sitting on it, which forces its own
// compositing layer.

import { animate, motionValue, springValue, styleEffect } from "motion";

const cursorConfig = {
	rootSelector: ".cursor-root",
	itemSelector: ".cursor-item",
	targetAttr: "data-cursor-target",
	anchorAttr: "data-cursor-anchor",
	textAttr: "data-cursor-text",
	defaultAnchor: "bottom-right",
	padding: 16,
	margin: 12,
	// Long enough to cross the gap between two cards without the button
	// disappearing and coming back; short enough that leaving for good
	// still feels immediate.
	handoffDelay: 180,
	spring: { stiffness: 1800, damping: 80, mass: 0.1 },
	shellSpring: { type: "spring", visualDuration: 0.42, bounce: 0.22 },
	fxSpring: { type: "spring", visualDuration: 0.34, bounce: 0.18 },
	// The two halves of the swap overlap: the old words are still leaving
	// while the new ones arrive, so there is never a moment with an empty
	// button.
	textOut: { duration: 0.26, ease: [0.4, 0, 0.2, 1] },
	textIn: { duration: 0.3, delay: 0.05, ease: [0.2, 0.7, 0.2, 1] },
};

const anchorOffsets = {
	center: [0, 0],
	"top-left": [-1, -1],
	"top-right": [1, -1],
	"bottom-left": [-1, 1],
	"bottom-right": [1, 1],
};

let pointer;

function resolveAnchor(el) {
	const key = (el.getAttribute(cursorConfig.anchorAttr) || cursorConfig.defaultAnchor).toLowerCase();
	return anchorOffsets[key] || anchorOffsets[cursorConfig.defaultAnchor];
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function clampedPosition(ax, ay, el) {
	const w = el.offsetWidth;
	const h = el.offsetHeight;
	const p = cursorConfig.padding;
	const m = cursorConfig.margin;

	return {
		x: clamp(pointer.x.get() + ax * (w / 2 + m) - w / 2, p, innerWidth - p - w),
		y: clamp(pointer.y.get() + ay * (h / 2 + m) - h / 2, p, innerHeight - p - h),
	};
}

function createItem(el, root) {
	const sel = el.getAttribute(cursorConfig.targetAttr);
	if (!sel) throw new Error(`${cursorConfig.itemSelector} missing ${cursorConfig.targetAttr}`);
	root.querySelector(sel); // Validate the selector without requiring an initial match.

	const visual = el.querySelector(".cursor-item-visual");
	if (!visual) throw new Error(".cursor-item needs a .cursor-item-visual child");

	const content = visual.firstElementChild;
	if (!content) throw new Error(".cursor-item-visual needs one direct child");

	const textEl = content.querySelector("div");
	if (!textEl) throw new Error(".cursor-item visual needs a text div");

	const defaultText = textEl.textContent.trim();
	const [ax, ay] = resolveAnchor(el);

	const srcX = motionValue(0);
	const srcY = motionValue(0);
	const x = springValue(srcX, cursorConfig.spring);
	const y = springValue(srcY, cursorConfig.spring);
	const stopStyle = styleEffect(el, { x, y });

	el.style.visibility = "hidden";

	const measure = document.createElement("div");
	measure.style.position = "fixed";
	measure.style.left = "-9999px";
	measure.style.top = "-9999px";
	measure.style.visibility = "hidden";
	measure.style.pointerEvents = "none";
	measure.style.width = "max-content";
	measure.style.height = "max-content";

	const measureContent = content.cloneNode(true);
	measure.appendChild(measureContent);
	document.body.appendChild(measure);

	const measureTextEl = measureContent.querySelector("div");
	if (!measureTextEl) throw new Error("measure node missing text div");

	// The old words need to sit on top of the new ones while both animate.
	if (getComputedStyle(content).position === "static") content.style.position = "relative";

	let unsub = null;
	let currentText = defaultText;
	let outgoing = null;
	let visible = false;

	function clearOutgoing() {
		outgoing?.remove();
		outgoing = null;
	}

	function sync() {
		const pos = clampedPosition(ax, ay, el);
		srcX.set(pos.x);
		srcY.set(pos.y);
	}

	function jump() {
		const pos = clampedPosition(ax, ay, el);
		srcX.jump(pos.x);
		srcY.jump(pos.y);
		x.jump(pos.x);
		y.jump(pos.y);
	}

	function subscribe() {
		if (unsub) return;
		const unX = pointer.x.on("change", sync);
		const unY = pointer.y.on("change", sync);
		unsub = () => {
			unX();
			unY();
			unsub = null;
		};
	}

	function unsubscribe() {
		unsub?.();
	}

	function getTargetText(target) {
		if (!target) return defaultText;

		const attrText = target.getAttribute(cursorConfig.textAttr);
		if (typeof attrText !== "string") return defaultText;

		const cleanText = attrText.trim();
		if (!cleanText) return defaultText;

		return cleanText;
	}

	function measureSize(text) {
		measureTextEl.textContent = text;
		const rect = measureContent.getBoundingClientRect();

		return {
			width: Math.ceil(rect.width),
			height: Math.ceil(rect.height),
		};
	}

	// The background is the only thing that changes size. It springs from
	// whatever it currently is to the next text's width, so moving between
	// two targets reads as one button growing or shrinking rather than one
	// button leaving and another arriving.
	function resizeShellTo(text, immediate = false) {
		const size = measureSize(text);
		const radius = Math.max(24, Math.ceil(size.height * 0.5 + 10));

		animate(
			visual,
			{ width: size.width, height: size.height, borderRadius: radius },
			immediate ? { duration: 0 } : cursorConfig.shellSpring,
		);
	}

	function swapText(nextText, immediate = false) {
		if (immediate) {
			clearOutgoing();
			currentText = nextText;
			textEl.textContent = nextText;
			resizeShellTo(nextText, true);
			return;
		}

		if (nextText === currentText) return;

		resizeShellTo(nextText, false);

		// A copy of the old words is left behind, pinned to the centre so it
		// stays put while the background resizes around it. The live element
		// takes the new words straight away and fades up through it.
		clearOutgoing();
		outgoing = textEl.cloneNode(true);
		outgoing.style.position = "absolute";
		outgoing.style.top = `${textEl.offsetTop}px`;
		outgoing.style.left = "50%";
		outgoing.style.width = `${textEl.offsetWidth}px`;
		outgoing.style.marginLeft = `${-textEl.offsetWidth / 2}px`;
		outgoing.style.pointerEvents = "none";
		content.appendChild(outgoing);

		currentText = nextText;
		textEl.textContent = nextText;

		const leaving = outgoing;
		animate(
			leaving,
			{
				opacity: [1, 0],
				scale: [1, 0.94],
				filter: ["blur(0px)", "blur(6px)"],
			},
			cursorConfig.textOut,
		).finished.then(() => {
			if (leaving === outgoing) clearOutgoing();
			else leaving.remove();
		});

		// The words take a smaller step than the background.
		animate(
			textEl,
			{
				opacity: [0, 1],
				scale: [0.94, 1],
				filter: ["blur(6px)", "blur(0px)"],
			},
			cursorConfig.textIn,
		);
	}

	function show(target) {
		const nextText = getTargetText(target);

		el.style.visibility = "visible";
		subscribe();

		// Already on screen: change size and words in place. Replaying the
		// entrance here is what made moving between two cards look like a
		// flash rather than a morph.
		if (visible) {
			swapText(nextText, false);
			return;
		}

		visible = true;
		swapText(nextText, true);
		jump();

		animate(
			visual,
			{
				opacity: 1,
				scale: [0.84, 1.04, 1],
				filter: ["blur(10px)", "blur(0px)"],
			},
			cursorConfig.fxSpring,
		);

		animate(
			content,
			{
				scale: [0.98, 1],
			},
			{ duration: 0.22, ease: "easeOut" },
		);
	}

	function hide() {
		visible = false;

		animate(
			visual,
			{
				opacity: 0,
				scale: [1, 0.92, 0.88],
				filter: ["blur(0px)", "blur(12px)"],
			},
			{ duration: 0.22, ease: "easeOut" },
		);

		unsubscribe();
	}

	function destroy() {
		clearOutgoing();
		unsubscribe();
		stopStyle();
		srcX.destroy();
		srcY.destroy();
		x.destroy();
		y.destroy();
		measure.remove();
	}

	swapText(defaultText, true);

	return {
		show,
		hide,
		destroy,
		selector: sel,
	};
}

export async function initCursorV2(root = document, { signal } = {}) {
	const cursorRoot = root.querySelector(cursorConfig.rootSelector);
	if (!cursorRoot) return;
	cursorRoot.cursor?.destroy();
	delete cursorRoot.cursor;

	const canUseCursor =
		typeof window.matchMedia !== "function" ||
		window.matchMedia("(hover: hover) and (pointer: fine)").matches;
	if (!canUseCursor) return;

	const itemElements = [...cursorRoot.querySelectorAll(cursorConfig.itemSelector)];
	if (!itemElements.length) return;

	pointer = {
		x: motionValue(0),
		y: motionValue(0),
	};
	const items = itemElements.map((item) => createItem(item, root));

	function findMatch(node) {
		let el = node instanceof Element ? node : null;

		while (el) {
			for (const item of items) {
				if (el.matches(item.selector)) return { item, target: el };
			}
			el = el.parentElement;
		}

		return null;
	}

	let currentItem = null;
	let currentTarget = null;
	let timer = 0;
	const abort = new AbortController();

	// boot.js aborts the previous run before the next, so the window and
	// document listeners below go with it rather than waiting for the next
	// initCursor to tear them down.
	signal?.addEventListener("abort", () => abort.abort());

	function on(target, event, fn, opts = {}) {
		target.addEventListener(event, fn, { signal: abort.signal, ...opts });
	}

	function activate(match) {
		clearTimeout(timer);

		const nextItem = match?.item || null;
		const nextTarget = match?.target || null;

		if (currentItem === nextItem) {
			currentTarget = nextTarget;
			currentItem?.show(currentTarget);
			return;
		}

		currentItem?.hide();
		currentItem = nextItem;
		currentTarget = nextTarget;
		currentItem?.show(currentTarget);
	}

	on(
		window,
		"pointermove",
		(e) => {
			pointer.x.set(e.clientX);
			pointer.y.set(e.clientY);
		},
		{ passive: true },
	);

	on(
		document,
		"pointerover",
		(e) => {
			const to = findMatch(e.target);
			const from = findMatch(e.relatedTarget);

			if (!to) return;
			if (to.item !== from?.item || to.target !== from?.target) activate(to);
		},
		{ capture: true },
	);

	on(
		document,
		"pointerout",
		(e) => {
			const from = findMatch(e.target);
			if (!from) return;

			const to = findMatch(e.relatedTarget);

			if (to?.item === from.item) {
				if (to.target !== from.target) activate(to);
				return;
			}

			if (to) {
				activate(to);
				return;
			}

			if (currentItem === from.item) {
				timer = setTimeout(() => {
					if (currentItem !== from.item) return;
					currentItem.hide();
					currentItem = null;
					currentTarget = null;
				}, cursorConfig.handoffDelay);
			}
		},
		{ capture: true },
	);

	on(window, "blur", () => {
		currentItem?.hide();
		currentItem = null;
		currentTarget = null;
	});

	cursorRoot.cursor = {
		destroy() {
			abort.abort();
			clearTimeout(timer);
			items.forEach((item) => item.destroy());
		},
	};
}
