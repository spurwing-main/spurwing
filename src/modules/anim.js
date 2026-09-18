/**
 * Motion: the site's one reveal system.
 *
 * ATTRIBUTES DEFINE EVERYTHING. SET THEM IN THE DESIGNER.
 *
 *   <div data-anim-group>                    stagger container
 *     <p  data-anim="fade-up-sm">…           eyebrow, barely travels
 *     <h2 data-anim="shimmer">…              heading, the diagonal sweep
 *     <div data-anim="fade-up">…             copy
 *     <a  data-anim="settle">…               call-to-action link
 *   </div>
 *   <div data-anim="card">                   work or team card: sweep plus a rise
 *   <div data-anim="fade-up" data-anim-on="load">   plays on load, not on scroll
 *   <div data-anim="off">                    never animates
 *
 * No class name maps to a behaviour and nothing is implicit: if an element
 * animates, the attribute is on it and visible in the Designer. A group's
 * children reveal with no attribute of their own, which is the only way a
 * component instance root can animate, because instance roots cannot carry
 * custom attributes.
 *
 * THIS FILE DOES ALMOST NOTHING, deliberately:
 *   1. flips `data-anim-state="in"` when an element arrives,
 *   2. guards against anything that stays invisible forever.
 *
 * It never touches markup. Stagger, ordering, durations, distances, easing and
 * keyframes live in CSS, in the "Global — motion" embed. No class name,
 * duration or easing here.
 *
 * WHY KEYFRAMES AND NOT TRANSITIONS. The shimmer preset sweeps a mask across
 * the block. Safari has been unreliable transitioning `mask-position`, which is
 * why the reference build for this effect drives it with a tween library. A
 * paused keyframe released by `animation-play-state` never asks for that
 * interpolation, needs no library, and lets the sweep compose with a rise in a
 * single `--anim-names` list.
 *
 * WHY NOT SCROLL-DRIVEN. Exec-life ran this on `animation-timeline: view()`
 * first and measured every animated target with an INACTIVE view timeline: a
 * view timeline resolves against the nearest ancestor scroll container, and
 * `overflow: hidden/clip` makes an element one even when it never scrolls. A
 * mask clips by definition, so the shimmer would be the worst case. Do not
 * bring it back without measuring against the real clipping wrappers first.
 *
 * FAIL OPEN: the rule everything else bends to. This design hides content by
 * default, so every heading depends on JS to reveal it. Protections:
 *   - the hidden state is gated on `html[data-anim-ready]`, set only here.
 *     No JS, nothing hidden.
 *   - an unknown preset falls through to the CSS base preset, never sticking.
 *   - with no IntersectionObserver, everything reveals immediately.
 *   - `guard()` sets `html[data-anim-panic]` and disables every reveal when an
 *     already-revealed element is still invisible past its worst-case
 *     animation time.
 *   - it does nothing in the Designer canvas or Editor, so a client editing
 *     copy never sees hidden text.
 */

/**
 * Subtrees where a scroll reveal cannot work. Anything tagged inside one
 * reveals IMMEDIATELY and is never observed. Every selector is structural or a
 * framework hook, never a design class name.
 *
 *   .nav_item-panel: a closed dropdown is clipped to nothing and carries
 *     `content-visibility: hidden`, so its contents never intersect. Observed,
 *     the work rail inside it would open empty.
 *   .w-richtext: article body copy is content, not section furniture.
 *   [fs-list-element='list']: a Finsweet list re-renders its items on filter,
 *     and a re-rendered item has no observer on it.
 *   .swiper, .embla: a slide sits outside the viewport HORIZONTALLY and never
 *     intersects, however far the page is scrolled. Observed, it would stay
 *     hidden for good and a visitor would drag to an empty panel. This is why
 *     the capability slides on /approach and the quote slider beside them are
 *     not grouped: they can carry the attribute now and reveal on arrival
 *     instead. Both class names come from the carousel libraries, not the
 *     design system.
 *
 * Reveal, do not skip: a skipped element still matches the CSS hold rule,
 * with nothing left to release it.
 */
const EXCLUDE = ".nav_item-panel, .w-richtext, [fs-list-element='list'], .swiper, .embla";

/** Long enough to cover a slow bundle load. Short enough that a failure isn't felt. */
const GRACE_MS = 2500;

/** The longest a reveal can legitimately still be running: worst delay plus duration. */
const SETTLED_MS = 1500;

/** The Designer canvas and the Editor must never show hidden content. */
function isAuthoringSurface() {
	const classes = document.documentElement.classList;

	return classes.contains("wf-design-mode") || classes.contains("w-editor");
}

/** The time this module told each element to reveal, so the guard can tell late from stuck. */
const revealedAt = new WeakMap();

/**
 * Mark an element as arrived. `track: false` releases it without a timestamp,
 * so it stays out of the guard's sample — an excluded subtree can sit below
 * full opacity for reasons of its own, and the guard would read that as stuck.
 */
function release(element, { track = true } = {}) {
	if (track) revealedAt.set(element, performance.now());

	element.setAttribute("data-anim-state", "in");
}

/** On screen already, so it reveals now rather than waiting for a scroll. */
function onScreen(element) {
	const box = element.getBoundingClientRect();

	return box.bottom > 0 && box.top < (window.innerHeight || 0);
}

/**
 * Last line of defence, and it has to be careful about what it calls stuck.
 * An element not yet triggered is not stuck; it is waiting its turn, which is
 * the system working. The real stuck condition is narrower: already told to
 * reveal, past its worst-case window, still invisible. That only happens when
 * the CSS is absent, overridden, or gated the wrong way — which is exactly
 * what the panic switch is for.
 */
function guard() {
	const now = performance.now();

	const stuck = [...document.querySelectorAll('[data-anim-state="in"]')].some((element) => {
		const since = revealedAt.get(element);

		if (since === undefined || now - since < SETTLED_MS) return false;

		// A group is never animated itself, only its children are. Reading the
		// group's own opacity would always answer 1 and miss a whole section
		// stuck hidden.
		const subjects = element.hasAttribute("data-anim-group")
			? [...element.children].filter((child) => !child.hasAttribute("data-anim-group"))
			: [element];

		return subjects.some((subject) => Number(getComputedStyle(subject).opacity) < 0.9);
	});

	if (stuck) document.documentElement.setAttribute("data-anim-panic", "");
}

function startObserver(root) {
	// Groups are observed alongside individually tagged elements. A group's
	// children reveal without an attribute of their own, so there is nothing on
	// the child to flip: the CSS reads state off the group, and the group is
	// what gets watched.
	const targets = [
		...root.querySelectorAll(
			'[data-anim]:not([data-anim="off"]):not([data-anim-on="load"]),' +
				'[data-anim-group]:not([data-anim-on="load"])',
		),
	];

	targets.filter((element) => element.closest(EXCLUDE)).forEach((element) => release(element, { track: false }));

	const observable = targets.filter((element) => !element.closest(EXCLUDE));

	if (typeof IntersectionObserver !== "function") {
		observable.forEach((element) => release(element));
		return;
	}

	const below = observable.filter((element) => {
		if (!onScreen(element)) return true;

		release(element);
		return false;
	});

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				// An element can end up above the viewport without ever intersecting:
				// an anchor jump, a restored scroll position or a scrollIntoView all
				// move in one frame, and the observer only samples at frame
				// boundaries. There is nothing left to animate, but it must not stay
				// hidden.
				const passedAbove = entry.boundingClientRect.bottom < 0;

				if (!entry.isIntersecting && !passedAbove) continue;

				release(entry.target);
				observer.unobserve(entry.target);
			}
		},
		{ rootMargin: "0px 0px -10% 0px", threshold: 0 },
	);

	below.forEach((element) => observer.observe(element));
}

export function initAnim(root = document, { signal } = {}) {
	if (isAuthoringSurface()) return;

	// ORDER MATTERS. This is the whole fail-open guarantee. Arm the guard first,
	// so it is scheduled whatever happens next. `data-anim-ready`, the flag that
	// lets the CSS hide anything, goes on only once the observer is live: if
	// `startObserver` throws after the flag is set, the CSS holds every element
	// hidden and boot.js swallows the error. Taking the flag back off leaves the
	// page simply un-animated instead.
	const timer = setTimeout(guard, GRACE_MS);

	signal?.addEventListener("abort", () => clearTimeout(timer));

	// A page reveals the same way however the reader arrived; the only
	// difference is when. html[data-pt] is set for the length of a soft
	// navigation, so its absence is a cold load and the reveal can start now.
	// Mid-navigation it waits for spw:entered, because the incoming page is
	// still at opacity 0 at spw:page: start there and every reveal plays out
	// behind a transparent container and is over before anyone sees it.
	const coldLoad = !document.documentElement.hasAttribute("data-pt");

	try {
		document.documentElement.setAttribute("data-anim-ready", "");

		if (coldLoad) startObserver(root);
		else document.addEventListener("spw:entered", () => startObserver(root), { once: true, signal });
	} catch (error) {
		document.documentElement.removeAttribute("data-anim-ready");
		throw error;
	}
}
