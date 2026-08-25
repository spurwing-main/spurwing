const motionUrl = "https://cdn.jsdelivr.net/npm/motion@12.34.0/+esm";
let animate;
let motionValue;
let springValue;
let styleEffect;

const config = {
	rootSel: ".cursor-root",
	itemSel: ".cursor-item",
	targetAttr: "data-cursor-target",
	anchorAttr: "data-cursor-anchor",
	textAttr: "data-cursor-text",
	defaultAnchor: "bottom-right",
	padding: 16,
	margin: 12,
	handoffDelay: 80,
	spring: { stiffness: 1800, damping: 80, mass: 0.1 },
	shellSpring: { type: "spring", visualDuration: 0.42, bounce: 0.22 },
	fxSpring: { type: "spring", visualDuration: 0.34, bounce: 0.18 },
	fadeOut: { duration: 0.14, ease: "easeOut" },
	fadeIn: { duration: 0.2, ease: "easeOut" },
};

const anchorOffsets = {
	center: [0, 0],
	"top-left": [-1, -1],
	"top-right": [1, -1],
	"bottom-left": [-1, 1],
	"bottom-right": [1, 1],
};

let pointer;

function loadDefaultMotion() {
	return import(motionUrl);
}

function resolveAnchor(el) {
	const key = (el.getAttribute(config.anchorAttr) || config.defaultAnchor).toLowerCase();
	return anchorOffsets[key] || anchorOffsets[config.defaultAnchor];
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function clampedPosition(ax, ay, el) {
	const w = el.offsetWidth;
	const h = el.offsetHeight;
	const p = config.padding;
	const m = config.margin;

	return {
		x: clamp(pointer.x.get() + ax * (w / 2 + m) - w / 2, p, innerWidth - p - w),
		y: clamp(pointer.y.get() + ay * (h / 2 + m) - h / 2, p, innerHeight - p - h),
	};
}

function createItem(el, queryRoot) {
	const sel = el.getAttribute(config.targetAttr);
	if (!sel) throw new Error(`${config.itemSel} missing ${config.targetAttr}`);
	queryRoot.querySelector(sel); // Validate the selector without requiring an initial match.

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
	const x = springValue(srcX, config.spring);
	const y = springValue(srcY, config.spring);
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

	let unsub = null;
	let currentText = defaultText;
	let textSwapId = 0;
	let hasShown = false;

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

		const attrText = target.getAttribute(config.textAttr);
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

	function animateShellToText(text, immediate = false) {
		const size = measureSize(text);
		const radius = Math.max(24, Math.ceil(size.height * 0.5 + 10));

		animate(
			visual,
			{
				width: size.width,
				height: size.height,
				borderRadius: radius,
				filter: immediate ? "blur(0px)" : ["blur(0px)", "blur(8px)", "blur(0px)"],
				scale: immediate ? 1 : [1, 1.035, 1],
			},
			immediate ? { duration: 0 } : config.shellSpring,
		);
	}

	function swapText(nextText, immediate = false) {
		if (immediate) {
			currentText = nextText;
			textEl.textContent = nextText;
			animateShellToText(nextText, true);
			return;
		}

		if (nextText === currentText) return;

		textSwapId += 1;
		const swapId = textSwapId;

		animateShellToText(nextText, false);

		animate(
			textEl,
			{
				opacity: [1, 0],
				y: [0, 4],
				filter: ["blur(0px)", "blur(10px)"],
			},
			config.fadeOut,
		).finished.then(() => {
			if (swapId !== textSwapId) return;
			currentText = nextText;
			textEl.textContent = nextText;

			animate(
				textEl,
				{
					opacity: [0, 1],
					y: [-4, 0],
					filter: ["blur(10px)", "blur(0px)"],
				},
				config.fadeIn,
			);
		});
	}

	function show(target) {
		const nextText = getTargetText(target);

		if (!hasShown) {
			swapText(nextText, true);
			hasShown = true;
		} else {
			swapText(nextText, false);
		}

		el.style.visibility = "visible";
		subscribe();
		jump();

		animate(
			visual,
			{
				opacity: 1,
				scale: [0.84, 1.04, 1],
				filter: ["blur(10px)", "blur(0px)"],
			},
			config.fxSpring,
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

export async function initCursor(root = document, loadMotion = loadDefaultMotion) {
	const cursorRoot = root.querySelector(config.rootSel);
	if (!cursorRoot) return;
	cursorRoot.cursor?.destroy();
	delete cursorRoot.cursor;

	const canUseCursor =
		typeof window.matchMedia !== "function" ||
		window.matchMedia("(hover: hover) and (pointer: fine)").matches;
	if (!canUseCursor) return;

	const itemElements = [...cursorRoot.querySelectorAll(config.itemSel)];
	if (!itemElements.length) return;

	({ animate, motionValue, springValue, styleEffect } = await loadMotion());
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
				}, config.handoffDelay);
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
