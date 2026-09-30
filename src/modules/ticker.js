import { animate, cancelFrame, frame } from "motion";

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
 * second, times data-ticker-hover while the pointer is over it. A drag holds
 * the strip under the finger; a flick carries on at the speed it was let go
 * and eases back into the drift, which is always leftwards again.
 *
 * The Designer holds the real items, laid out in a row, so the page paints the
 * strip exactly where it will sit once this takes over. This only adds copies
 * beside them and moves the track with a transform, so nothing already on
 * screen moves when it starts.
 */

const config = {
	velocity: 3,
	hover: 1,
	// How quickly a flick settles back into the drift. The component's "glide"
	// preset, at the release carry and settle time the site had, works out to
	// this time constant.
	settle: 0.286,
	// A release slower than this, in px/s, simply resumes the drift.
	flick: 2,
	// A pointer that stopped for this long before letting go was not flicking.
	still: 80,
	lead: { duration: 0.6, ease: "easeOut" },
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
	const sets = [];
	const lead = leader(track);
	let leading = 0;

	let x = 0;
	let period = 0;
	let speed = 0;
	let releasing = false;
	let hovered = false;
	let drag = null;
	let rem = 16;

	// One set's length, gap included, is how far the first copy sits from the
	// first original. Copies follow the originals to the right edge of the
	// screen, and lead them leftwards across whatever room the page leaves before
	// the track: the client strip starts at the text column, but the page, not
	// the strip, clips it, so on a wide screen that room is on show.
	const measure = () => {
		rem = parseFloat(getComputedStyle(document.documentElement).fontSize);

		const left = firstBox(originals[0]).getBoundingClientRect().left - x;

		if (!sets.length) sets.push(copy(originals, track));

		period = firstBox(sets[0][0]).getBoundingClientRect().left - x - left;

		if (period <= 0) return;

		while ((sets.length + 1) * period < window.innerWidth - left + period) sets.push(copy(originals, track));
		for (; leading * period < left + period; leading++) copy(originals, lead);

		x = wrap(x);
		paint();
	};

	// Copies on both sides make every position one set apart look the same, so
	// the strip can jump back a set whenever it has travelled one.
	const wrap = (value) => {
		if (period <= 0) return value;
		while (value <= -period) value += period;
		while (value > 0) value -= period;
		return value;
	};

	const paint = () => {
		track.style.transform = `translate3d(${x}px, 0, 0)`;
	};

	const drift = () => (still ? 0 : -velocity * rem * (hovered ? hoverFactor : 1));

	const tick = ({ delta }) => {
		if (drag || period <= 0) return;

		const dt = Math.min(delta, 64) / 1000;
		const base = drift();

		if (releasing) {
			speed = base + (speed - base) * Math.exp(-dt / config.settle);
			if (Math.abs(speed - base) < 1) releasing = false;
		} else {
			speed = base;
		}

		if (speed === 0) return;

		x = wrap(x + speed * dt);
		paint();
	};

	const start = () => frame.update(tick, true);
	const stop = () => cancelFrame(tick);

	measure();

	const resize = new ResizeObserver(measure);

	resize.observe(track);

	// The root font size follows the window width, and the drift is in rem.
	window.addEventListener("resize", measure, { signal });

	const view = new IntersectionObserver(([entry]) => {
		if (entry.isIntersecting) start();
		else stop();
	});

	view.observe(ticker);

	signal?.addEventListener("abort", () => {
		stop();
		resize.disconnect();
		view.disconnect();
	});

	ticker.addEventListener(
		"pointerenter",
		(event) => {
			if (event.pointerType === "mouse") hovered = true;
		},
		{ signal },
	);

	ticker.addEventListener("pointerleave", () => (hovered = false), { signal });

	ticker.addEventListener(
		"pointerdown",
		(event) => {
			if (event.button !== 0 || period <= 0) return;

			ticker.setPointerCapture(event.pointerId);
			ticker.style.cursor = "grabbing";
			releasing = false;
			drag = { from: event.clientX - x, last: event.clientX, at: event.timeStamp, velocity: 0 };
		},
		{ signal },
	);

	ticker.addEventListener(
		"pointermove",
		(event) => {
			if (!drag) return;

			const dt = (event.timeStamp - drag.at) / 1000;

			if (dt > 0) {
				const sample = (event.clientX - drag.last) / dt;
				drag.velocity = 0.65 * drag.velocity + 0.35 * sample;
			}

			drag.last = event.clientX;
			drag.at = event.timeStamp;

			x = wrap(event.clientX - drag.from);
			drag.from = event.clientX - x;
			paint();
		},
		{ signal },
	);

	const release = (event) => {
		if (!drag) return;

		const flung = event.timeStamp - drag.at < config.still ? drag.velocity : 0;

		ticker.style.cursor = "";
		drag = null;
		speed = flung;
		releasing = Math.abs(flung) >= config.flick;
	};

	ticker.addEventListener("pointerup", release, { signal });
	ticker.addEventListener("pointercancel", release, { signal });
}

// A copy of every original, hidden from assistive technology and the keyboard.
// Images copy whatever image-fade had marked them with, and it never watches an
// image already marked, so the copies drop the mark and get watched afresh.
function copy(originals, parent) {
	return originals.map((original) => {
		const clone = original.cloneNode(true);

		clone.setAttribute("aria-hidden", "true");
		clone.inert = true;

		for (const image of clone.querySelectorAll("img")) {
			image.removeAttribute("data-img");
			image.loading = "eager";
		}

		parent.append(clone);

		return clone;
	});
}

// The copies left of the originals. They sit outside the row, so adding them
// moves nothing, in a second row styled like the track and ending one gap short
// of it. The room they fill was empty before this ran, so they fade in rather
// than appear.
function leader(track) {
	const lead = track.cloneNode(false);
	const gap = getComputedStyle(track).columnGap;

	lead.removeAttribute("data-ticker-track");
	lead.setAttribute("aria-hidden", "true");
	lead.inert = true;
	Object.assign(lead.style, {
		position: "absolute",
		top: "0",
		right: "100%",
		width: "max-content",
		height: "100%",
		marginRight: gap === "normal" ? "0" : gap,
		transform: "none",
	});

	if (getComputedStyle(track).position === "static") track.style.position = "relative";

	track.append(lead);
	animate(lead, { opacity: [0, 1] }, config.lead);

	return lead;
}

// Collection Lists arrive wrapped in display:contents, which has no box to
// measure, so this finds the first element inside that has one.
function firstBox(element) {
	let current = element;

	while (current && !current.getClientRects().length) current = current.firstElementChild;

	return current ?? element;
}

function number(element, attribute, fallback) {
	const value = parseFloat(element.getAttribute(attribute));

	return Number.isFinite(value) ? value : fallback;
}
