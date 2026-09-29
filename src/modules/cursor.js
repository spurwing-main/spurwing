import { animate, motionValue, springValue, styleEffect } from "motion";

/**
 * A label that follows the pointer over anything carrying data-cursor-text.
 *
 *   <div class="cursor-root" aria-hidden="true">
 *     <div class="button is-no-hover"><div>View work</div></div>
 *   </div>
 *
 * One pill for the whole site. The root moves with the pointer; the pill
 * inside it grows in, resizes and cross-fades its words, so the two never fight
 * over one transform. The pill is the site's own button class.
 *
 * The pill shows for whichever target the pointer last entered, and changes
 * only when the pointer enters something else. A target's data-cursor-text is
 * its words; an empty value keeps the pill's own.
 *
 * The root sits in the header, which no page transition replaces, so like the
 * router this starts once for the whole visit, and lets go of its target when a
 * navigation starts.
 */

const config = {
	rootSelector: ".cursor-root",
	pillSelector: ".button",
	targetSelector: "[data-cursor-text]",
	// Below and right of the pointer, and never closer to the viewport edge.
	offset: 12,
	edge: 16,
	// Long enough to cross the gap between two cards at an ordinary pace. A
	// slower crossing only dips, because a pill on its way out turns round.
	grace: 120,
	// Close to locked: at a quick 1500px/s flick it trails by about 28px and
	// catches up within 35ms of the pointer stopping. The old 1800 / 80 was
	// damped so heavily it trailed by 72px and took over 200ms, which read as
	// detached.
	follow: { stiffness: 1210, damping: 17.6, mass: 0.1 },
	resize: { type: "spring", visualDuration: 0.42 },
	enter: { type: "spring", visualDuration: 0.34, bounce: 0.18 },
	// Everything leaving rides a spring with no bounce: it eases into rest
	// instead of stopping on a timer, and if the pointer comes back part way the
	// next spring starts from where this one had got to, at the speed it had.
	exit: { type: "spring", visualDuration: 0.34, bounce: 0 },
	wordsOut: { type: "spring", visualDuration: 0.2, bounce: 0 },
	fade: { duration: 0.2, ease: "easeOut" },
};

// How much a resize bounces, after the Dynamic Island as Emil Kowalski builds
// it: a change too small to notice gets the most, so it still reads as alive;
// a large one a little more when growing than when shrinking.
function bounceFor(from, to) {
	const change = Math.abs(to - from);
	if (change < 20) return 0.5;

	const step = (change / 100) * 0.3;
	return Math.min(Math.max(to > from ? 0.3 + step : 0.35 - step, 0.3), 0.35);
}

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export function initCursor(root = document, { signal } = {}) {
	const cursor = root.querySelector(config.rootSelector);
	// Only a pointer that can hover. Anyone else keeps their own pointer and
	// loses nothing: the cards are links.
	if (!cursor || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;

	const pill = cursor.querySelector(config.pillSelector);
	if (!pill) throw new Error(`${config.rootSelector} needs a ${config.pillSelector} pill`);

	const words = pill.firstElementChild;
	if (!words) throw new Error(`${config.rootSelector} pill needs a div for its words`);

	// A visitor who asked for less motion still gets the label, as a fade that
	// sits on the pointer: nothing trails, scales, blurs or bounces.
	const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

	const defaultText = words.textContent.trim();

	const srcX = motionValue(0);
	const srcY = motionValue(0);
	const x = calm ? srcX : springValue(srcX, config.follow);
	const y = calm ? srcY : springValue(srcY, config.follow);
	styleEffect(cursor, { x, y });

	let pointerX = 0;
	let pointerY = 0;
	// The width the pill is heading for, so it is placed for the label it is
	// about to show rather than the one it has mid-spring.
	let width = pill.offsetWidth;
	// The target the pill is showing for; null once it has let go.
	let target = null;
	let timer = 0;
	let leaving = null;

	function place() {
		const { offset, edge } = config;
		srcX.set(clamp(pointerX + offset, edge, innerWidth - edge - width));
		srcY.set(clamp(pointerY + offset, edge, innerHeight - edge - pill.offsetHeight));
	}

	function track(event) {
		pointerX = event.clientX;
		pointerY = event.clientY;
		place();
	}

	// Springs the pill to the width its words need, read by letting go of its
	// width for a moment: its padding is in the site's fluid rem, so a width
	// measured once goes stale as soon as the window is resized.
	function resize(immediate) {
		const from = pill.offsetWidth;
		const held = pill.style.width;
		pill.style.width = "";
		const to = pill.offsetWidth;
		pill.style.width = held;

		width = to;
		place();
		animate(pill, { width: to }, immediate || calm ? { duration: 0 } : { ...config.resize, bounce: bounceFor(from, to) });
		return { from, to };
	}

	function enter(label) {
		// Caught on its way out: turned round from wherever it had got to, rather
		// than snapped back to the start.
		if (getComputedStyle(pill).opacity !== "0") {
			if (label !== words.textContent) swap(label);
			else if (!calm) {
				resize(false);
				animate(words, { opacity: 1, scale: 1, filter: "blur(0px)" }, config.enter);
			}
			animate(pill, calm ? { opacity: 1 } : { opacity: 1, scale: 1 }, calm ? config.fade : config.enter);
			return;
		}

		words.textContent = label;
		resize(true);
		x.jump(srcX.get());
		y.jump(srcY.get());

		if (calm) {
			animate(pill, { opacity: [0, 1] }, config.fade);
			return;
		}

		// The pill grows in; the words, counter-scaled so they grow less, follow
		// out of a blur a beat behind.
		animate(pill, { opacity: [0, 1], scale: [0.84, 1] }, config.enter);
		animate(
			words,
			{ opacity: [0, 1], scale: [1.1, 1], filter: ["blur(5px)", "blur(0px)"] },
			{ ...config.enter, delay: 0.05 },
		);
	}

	function swap(label) {
		if (label === words.textContent) return;

		// The old words leave as a copy laid over the pill but outside it, so the
		// pill's clip never cuts them off. Outside the button they lose its type,
		// so they carry it with them, and they start from how they looked.
		leaving?.remove();
		const look = getComputedStyle(words);
		const copy = words.cloneNode(true);
		Object.assign(copy.style, {
			position: "absolute",
			left: "0",
			top: "0",
			width: `${pill.offsetWidth}px`,
			height: `${pill.offsetHeight}px`,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			whiteSpace: "nowrap",
			font: look.font,
			letterSpacing: look.letterSpacing,
			color: look.color,
			opacity: look.opacity,
			filter: look.filter,
		});
		cursor.appendChild(copy);
		leaving = copy;

		words.textContent = label;
		const { from, to } = resize(false);
		const gone = () => copy.remove();

		if (calm) {
			animate(copy, { opacity: 0 }, config.fade).finished.then(gone);
			animate(words, { opacity: [0, 1] }, config.fade);
			return;
		}

		// The old words go the way the pill is going: along to its new centre,
		// stretched or squeezed with it. The new ones ride the resize's spring.
		animate(
			copy,
			{ opacity: 0, filter: "blur(5px)", x: (to - from) / 2, scale: clamp(to / from, 0.85, 1.15) },
			config.wordsOut,
		).finished.then(gone);
		animate(
			words,
			{ opacity: [0, 1], scale: [0.9, 1], filter: ["blur(5px)", "blur(0px)"] },
			{ ...config.resize, bounce: bounceFor(from, to), delay: 0.05 },
		);
	}

	function exit() {
		if (calm) {
			animate(pill, { opacity: 0 }, config.fade);
			return;
		}

		// The words go first. The pill draws back into the pointer after them,
		// narrowing towards a dot as it shrinks, and is gone before it gets
		// there, so no faint dot is left hanging by the pointer.
		animate(words, { opacity: 0, scale: 0.9, filter: "blur(5px)" }, config.wordsOut);
		animate(pill, { width: pill.offsetHeight, scale: 0.6 }, config.exit);
		animate(pill, { opacity: 0 }, { ...config.wordsOut, delay: 0.05 });
	}

	function leave() {
		clearTimeout(timer);
		timer = 0;
		if (!target) return;

		target = null;
		exit();
	}

	// The whole state machine. Entering a target shows or swaps the pill and
	// cancels any pending exit, even for the target it was leaving. Entering
	// anything else starts the exit once, however many elements the pointer
	// crosses on the way.
	function hover(next) {
		if (!next) {
			if (target && !timer) timer = setTimeout(leave, config.grace);
			return;
		}

		clearTimeout(timer);
		timer = 0;
		if (next === target) return;

		const label = next.getAttribute("data-cursor-text").trim() || defaultText;
		if (target) swap(label);
		else enter(label);
		target = next;
	}

	// The signal is for tests; the site never stops the cursor.
	const on = (el, type, fn, opts) => el.addEventListener(type, fn, { signal, ...opts });

	on(window, "pointermove", track, { passive: true });
	// Every element the pointer enters reports here, so one listener covers
	// every target on every page, including ones a list builds later.
	on(
		document,
		"pointerover",
		(event) => {
			track(event);
			hover(event.target.closest?.(config.targetSelector) || null);
		},
		{ capture: true },
	);
	// Leaving the window enters nothing.
	on(document, "pointerout", (event) => event.relatedTarget || hover(null));
	on(window, "blur", leave);
	// A navigation started: what the pill was showing is leaving with the page.
	on(document, "spw:leave", leave);
}
