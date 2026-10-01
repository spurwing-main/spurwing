import { animate, cancelFrame, frame, hover, inView, motionValue, wrap } from "motion";

import { claimOnce } from "../dom.js";

/**
 * A strip that drifts sideways for ever and can be dragged.
 *
 *   <div data-ticker data-ticker-velocity="3" data-ticker-hover="0.5">
 *     <div data-ticker-track> …items… </div>
 *   </div>
 *
 * It replaces Webflow's Motion Ticker code component, and moves the way that
 * component was set up on this site: leftwards at data-ticker-velocity rem per
 * second, easing to data-ticker-hover times that while the pointer is over it.
 * A drag holds the strip under the finger; a flick carries on at the speed it
 * was let go and eases back into the drift, which is always leftwards again.
 *
 * The Designer holds the real items, laid out in a row, so the page paints the
 * strip exactly where it will sit once this takes over. One offset, a motion
 * value, says how far the strip has travelled, and the row moves by it with
 * `translate`. An item that leaves the left edge is moved on by one loop's
 * length, past the right edge, the way Motion's own Ticker does it, so the real
 * items are usually all the strip needs, and each is written to only when it
 * goes round. Copies are added only when one set is too short for the screen.
 */

const config = {
	velocity: 3,
	hover: 1,
	// The hover slow-down eases in and out rather than snapping.
	ease: { duration: 0.4, ease: "easeOut" },
	// How quickly a flick settles back into the drift. The component's "glide"
	// preset, at the release carry and settle time the site had, works out to
	// this time constant.
	settle: 0.286,
	// A release slower than this, in px/s, simply resumes the drift.
	flick: 2,
	// The pointer's speed at release is read over this last stretch of the drag,
	// and a pointer that stopped for longer than `still` was not flicking.
	window: 100,
	still: 80,
	// A stalled frame catches the strip up rather than freezing it, up to this.
	stall: 250,
	reveal: { duration: 0.6, ease: "easeOut" },
};

export function initTicker(root = document, { signal } = {}) {
	for (const ticker of root.querySelectorAll("[data-ticker]")) {
		if (!claimOnce(ticker, "data-ticker-claimed")) continue;

		const track = ticker.querySelector("[data-ticker-track]");

		if (track?.children.length) run(ticker, track, signal);
	}
}

function run(ticker, track, signal) {
	const velocity = number(ticker, "data-ticker-velocity", config.velocity);
	const hoverFactor = number(ticker, "data-ticker-hover", config.hover);
	const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const originals = [...track.children];
	const offset = motionValue(0);
	const factor = motionValue(1);

	let items = [];
	let period = 0;
	let rem = 16;
	let speed = 0;
	let releasing = false;
	let last = 0;
	let drag = null;
	let painted = false;

	// Where each item sits in the row, untouched, and how long one loop is. An
	// item is drawn somewhere in the stretch that starts just off the left edge
	// of the screen and runs one loop to the right, so a loop has to be at least
	// a screen plus an item long; anything shorter gets another set of copies.
	const measure = () => {
		rem = parseFloat(getComputedStyle(document.documentElement).fontSize);

		for (;;) {
			const placed = boxes(track).map((element) => {
				const shift = items.find((item) => item.element === element)?.shift ?? 0;
				const box = element.getBoundingClientRect();

				return { element, left: box.left - shift - offset.get(), width: box.width, shift };
			});

			if (placed.length < 1) return;

			const first = placed[0];
			const end = Math.max(...placed.map((item) => item.left + item.width));
			const gap = placed[1] ? placed[1].left - first.left - first.width : 0;
			const widest = Math.max(...placed.map((item) => item.width));

			items = placed;
			period = end - first.left + gap;

			if (period <= 0 || period >= window.innerWidth + widest + gap) break;

			copy(originals, track);
		}

		paint();
	};

	const paint = () => {
		if (period <= 0) return;

		const travelled = offset.get();
		const entering = [];

		track.style.translate = `${travelled}px 0`;

		for (const item of items) {
			// Whole loops only, so an item that needs no moving gets exactly 0, and
			// an item is written to only on the frame it goes round.
			const shift = -Math.floor((item.left + travelled + item.width) / period) * period;

			if (shift === item.shift) continue;

			// Before this ran, nothing sat left of the row. On a wide screen the
			// client strip shows that room, and the first paint fills it, so what
			// arrives there fades in rather than appearing.
			if (!painted && item.left + travelled + shift < window.innerWidth) entering.push(item.element);

			item.shift = shift;
			item.element.style.translate = `${shift}px 0`;
		}

		if (entering.length) animate(entering, { opacity: [0, 1] }, config.reveal);

		painted = true;
	};

	offset.on("change", () => frame.render(paint));

	const drift = () => (still ? 0 : -velocity * rem * factor.get());

	const tick = ({ timestamp }) => {
		const dt = last ? Math.min(timestamp - last, config.stall) / 1000 : 0;

		last = timestamp;

		if (drag || period <= 0 || dt === 0) return;

		const base = drift();

		if (releasing) {
			speed = base + (speed - base) * Math.exp(-dt / config.settle);
			if (Math.abs(speed - base) < 1) releasing = false;
		} else {
			speed = base;
		}

		if (speed !== 0) offset.set(wrap(-period, 0, offset.get() + speed * dt));
	};

	const start = () => {
		last = 0;
		frame.update(tick, true);

		return () => cancelFrame(tick);
	};

	measure();

	const resize = new ResizeObserver(() => measure());

	// The root font size follows the window width, and the strip does too, so
	// watching the strip catches the drift's rem changing as well.
	resize.observe(ticker);
	resize.observe(track);
	document.fonts?.ready.then(() => signal?.aborted || measure());

	const stopView = inView(ticker, start);
	const stopHover = hover(ticker, () => {
		animate(factor, hoverFactor, config.ease);

		return () => animate(factor, 1, config.ease);
	});

	signal?.addEventListener("abort", () => {
		cancelFrame(tick);
		stopView();
		stopHover();
		resize.disconnect();
		offset.destroy();
		factor.destroy();
	});

	ticker.addEventListener(
		"pointerdown",
		(event) => {
			if (!event.isPrimary || event.button !== 0 || period <= 0) return;

			ticker.setPointerCapture(event.pointerId);
			ticker.style.cursor = "grabbing";
			releasing = false;
			drag = { from: offset.get() - event.clientX, samples: [[event.timeStamp, event.clientX]] };
		},
		{ signal },
	);

	ticker.addEventListener(
		"pointermove",
		(event) => {
			if (!drag || !event.isPrimary) return;

			for (const sample of event.getCoalescedEvents?.() ?? [event]) {
				drag.samples.push([sample.timeStamp, sample.clientX]);
			}

			const newest = drag.samples.at(-1)[0];

			while (newest - drag.samples[0][0] > config.window) drag.samples.shift();

			offset.set(drag.from + event.clientX);
		},
		{ signal },
	);

	const release = (event) => {
		if (!drag || !event.isPrimary) return;

		const flung = event.type === "pointerup" ? flick(drag.samples, event.timeStamp) : 0;

		ticker.style.cursor = "";
		drag = null;
		speed = flung;
		releasing = Math.abs(flung) >= config.flick;
	};

	ticker.addEventListener("pointerup", release, { signal });
	ticker.addEventListener("pointercancel", release, { signal });
}

// The pointer's speed over the last stretch of the drag, in px/s: the distance
// between the oldest and newest samples kept, over the time between them. One
// pair of events is too noisy to trust, and how many arrive depends on the
// device.
function flick(samples, now) {
	const [newestAt, newestX] = samples.at(-1);
	const [oldestAt, oldestX] = samples[0];

	if (now - newestAt > config.still || newestAt <= oldestAt) return 0;

	return ((newestX - oldestX) / (newestAt - oldestAt)) * 1000;
}

// A copy of every original, hidden from assistive technology and the keyboard.
// Images copy whatever image-fade had marked them with, and it never watches an
// image already marked, so the copies drop the mark and get watched afresh.
function copy(originals, track) {
	for (const original of originals) {
		const clone = original.cloneNode(true);

		clone.setAttribute("aria-hidden", "true");
		clone.inert = true;

		for (const image of clone.querySelectorAll("img")) image.removeAttribute("data-img");

		// A copy is placed afresh, not where the item it came from had got to.
		for (const element of [clone, ...clone.querySelectorAll("[style]")]) {
			element.style.removeProperty("translate");
			element.style.removeProperty("opacity");
		}

		track.append(clone);
	}
}

// The items the strip moves: the elements in the row that have a box.
// Collection Lists arrive wrapped in display:contents, so this looks through
// those, and passes over anything not drawn at all, like a style embed.
function boxes(parent) {
	const found = [];

	for (const child of parent.children) {
		const display = getComputedStyle(child).display;

		if (display === "contents") found.push(...boxes(child));
		else if (display !== "none") found.push(child);
	}

	return found;
}

function number(element, attribute, fallback) {
	const value = parseFloat(element.getAttribute(attribute));

	return Number.isFinite(value) ? value : fallback;
}
