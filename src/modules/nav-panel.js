import { animate } from "motion";

// The Work and About dropdowns.
//
// One piece of markup serves both breakpoints: a full-bleed surface under the
// bar on desktop, an in-flow accordion inside the open menu below it.
//
// There is one piece of state — which item is open, or none — and one render
// that drives every panel from it. Events only set that and call render; nothing
// else writes to the DOM, and no animation callback changes state. render can
// run at any moment, including mid-animation: Motion retargets a running
// animation on the same value rather than restarting it, so interrupting a
// gesture is the ordinary case rather than something to detect and unpick.
//
// A closed panel is zero-height and clipped, so it is invisible by construction
// rather than by a visibility flag timed against the animation. That is what
// makes closing calm: there is no moment where the panel is hidden but still
// collapsing, and nothing to clean up when a close is interrupted.
//
// The featured work rail is the site's own slider: the panel holds a
// .section_work-slide, so work-slide.js finds and drives it like the one on the
// discovery pages, and this file does not touch it.
//
// Not a popover: the top layer escapes the nav's transform, and
// nav-auto-hide.js translates the nav away on the way down.

const navPanelConfig = {
	navSelector: ".nav",
	listSelector: ".nav_links",
	// Webflow refuses a custom attribute on these two divs — the write reports
	// success and reads back empty — so the wrapper and the panel are found by
	// the classes the Designer publishes. State below is still attributes.
	item: ".nav_item",
	panel: ".nav_item-panel",
	inner: ".nav_item-panel-inner",
	row: "[data-nav-stagger]",
	scrim: "[data-nav-scrim]",
	linkSelector: "a",
	openAttr: "data-nav-open",
	desktopQuery: "(min-width: 992px)",

	// Long enough that a pointer crossing Work on its way to Insights never
	// flashes the panel, short enough that a deliberate hover feels immediate.
	openDelay: 120,
	// Long enough to cross the gap from the link down into the panel.
	closeDelay: 180,

	// Three distinct gestures, not one with the sign flipped. Arriving has some
	// life in it. Morphing is a continuation of something already on screen, so
	// it is quicker and steadier. Leaving has no bounce at all: an overshoot on
	// the way out reads as the panel bouncing off the top of the page.
	arriveSpring: { type: "spring", visualDuration: 0.42, bounce: 0.2 },
	morphSpring: { type: "spring", visualDuration: 0.36, bounce: 0.12 },
	leaveSpring: { type: "spring", visualDuration: 0.34, bounce: 0 },

	// Borrowed from the mobile menu, which already brings its links in on this
	// curve, distance, blur and gap. Shared so the nav moves as one thing.
	rowIn: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
	rowOut: { duration: 0.16, ease: [0.4, 0, 1, 1] },
	rowStagger: 0.024,
	rowRise: 8,
	rowShift: 24,
	rowBlur: 1.25,

	scrimOpacity: 0.2,
	scrimIn: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
	scrimOut: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
};

export function initNavPanel(root = document, { signal } = {}) {
	const nav = root.querySelector(navPanelConfig.navSelector);
	if (!nav) return;

	const items = [...nav.querySelectorAll(navPanelConfig.item)].filter((item) =>
		item.querySelector(navPanelConfig.panel),
	);
	if (!items.length) return;

	const list = nav.querySelector(navPanelConfig.listSelector);
	const order = list ? [...list.children] : items;
	const scrim = nav.querySelector(navPanelConfig.scrim);
	const reduceMotion =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const desktop =
		typeof window.matchMedia === "function"
			? window.matchMedia(navPanelConfig.desktopQuery)
			: { matches: true, addEventListener() {} };

	const panelOf = (item) => item.querySelector(navPanelConfig.panel);
	const innerOf = (item) => item.querySelector(navPanelConfig.inner);
	const linkOf = (item) => item.querySelector(navPanelConfig.linkSelector);
	const rowsOf = (item) => [...panelOf(item).querySelectorAll(navPanelConfig.row)];

	// The only state. `rendered` is last frame's, kept solely to tell an arrival
	// from a swap and to give the contents a direction to travel.
	let open = null;
	let rendered = null;
	let openTimer = 0;
	let closeTimer = 0;

	// The inner is never height-constrained, so its own box is the panel's
	// natural height whatever the panel is currently doing. Nothing has to be
	// measured mid-animation, and nothing has to be put back afterwards.
	const heightOf = (item) => innerOf(item)?.getBoundingClientRect().height ?? 0;

	function render() {
		const arriving = Boolean(open) && !rendered;
		const forward = rendered && open ? order.indexOf(open) > order.indexOf(rendered) : true;

		// One height for the whole gesture. During a swap the outgoing panel
		// holds the incoming one's height rather than collapsing, so the two
		// stacked panels read as a single surface resizing while its contents
		// trade places. Animating it to zero instead is what made a swap look
		// like a close and an open happening at once.
		const height = open ? heightOf(open) : 0;
		const timing = !open
			? navPanelConfig.leaveSpring
			: arriving
				? navPanelConfig.arriveSpring
				: navPanelConfig.morphSpring;

		items.forEach((item) => {
			const isOpen = item === open;
			// Only the two panels in play share the height. Anything else is
			// closed and stays closed.
			const inPlay = isOpen || item === rendered;

			item.toggleAttribute(navPanelConfig.openAttr, isOpen);
			panelOf(item).toggleAttribute(navPanelConfig.openAttr, isOpen);
			// Clipped to nothing is invisible but still tabbable, so a closed
			// panel's links have to be taken out of reach explicitly.
			panelOf(item).toggleAttribute("inert", !isOpen);
			linkOf(item)?.setAttribute("aria-expanded", isOpen ? "true" : "false");

			const to = inPlay ? height : 0;

			if (reduceMotion) panelOf(item).style.height = `${to}px`;
			else animate(panelOf(item), { height: `${to}px` }, timing);

			renderRows(item, { isOpen, arriving, forward });
		});

		if (scrim && desktop.matches) {
			const opacity = open ? navPanelConfig.scrimOpacity : 0;
			if (reduceMotion) scrim.style.opacity = String(opacity);
			else animate(scrim, { opacity }, open ? navPanelConfig.scrimIn : navPanelConfig.scrimOut);
		}

		rendered = open;
	}

	function renderRows(item, { isOpen, arriving, forward }) {
		if (reduceMotion) return;

		const step = forward ? navPanelConfig.rowShift : -navPanelConfig.rowShift;

		rowsOf(item).forEach((row, index) => {
			if (isOpen) {
				// Arriving at a closed nav: rise and stagger, like the mobile
				// links. Replacing another panel: slide across, together, so the
				// surface reads as one thing turning over.
				const from = arriving
					? { y: [navPanelConfig.rowRise, 0], x: 0 }
					: { x: [step, 0], y: 0 };

				animate(
					row,
					{
						opacity: [0, 1],
						scale: [0.985, 1],
						filter: [`blur(${navPanelConfig.rowBlur}px)`, "blur(0px)"],
						...from,
					},
					{
						...navPanelConfig.rowIn,
						delay: arriving ? index * navPanelConfig.rowStagger : 0,
					},
				);
				return;
			}

			// Leaving. No from-values: it goes from wherever it currently is,
			// which is the whole point when a gesture is interrupted.
			animate(
				row,
				{ opacity: 0, x: -step, y: 0, scale: 1, filter: `blur(${navPanelConfig.rowBlur}px)` },
				navPanelConfig.rowOut,
			);
		});
	}

	function setOpen(next) {
		if (open === next) return;
		open = next;
		render();
	}

	function queueOpen(item) {
		clearTimeout(closeTimer);
		clearTimeout(openTimer);
		// Something is already on screen: change it now. The intent delay is for
		// arriving at a closed nav, not for changing your mind about an open one.
		if (open) {
			setOpen(item);
			return;
		}
		openTimer = setTimeout(() => setOpen(item), navPanelConfig.openDelay);
	}

	function queueClose() {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
		closeTimer = setTimeout(() => setOpen(null), navPanelConfig.closeDelay);
	}

	function on(target, event, fn, options) {
		target.addEventListener(event, fn, { signal, ...options });
	}

	items.forEach((item) => {
		on(item, "pointerenter", () => {
			if (desktop.matches) queueOpen(item);
		});
		on(item, "pointerleave", () => {
			if (desktop.matches) queueClose();
		});

		// Below the breakpoint the row is the accordion control; the panel
		// carries its own links through to the pages.
		on(item, "click", (event) => {
			if (desktop.matches) return;
			if (event.target.closest(navPanelConfig.panel)) return;
			if (!event.target.closest(navPanelConfig.linkSelector)) return;
			event.preventDefault();
			setOpen(open === item ? null : item);
		});

		// Keyboard reaches the panel by focus, so it opens the same way.
		on(item, "focusin", () => {
			if (desktop.matches) queueOpen(item);
		});
		on(item, "focusout", () => {
			if (!desktop.matches) return;
			requestAnimationFrame(() => {
				if (!item.contains(document.activeElement)) queueClose();
			});
		});
	});

	on(document, "keydown", (event) => {
		if (event.key !== "Escape" || !open) return;
		const link = linkOf(open);
		setOpen(null);
		link?.focus();
	});

	// The nav hides itself on the way down; an open panel would be stranded.
	on(window, "scroll", () => setOpen(null), { passive: true });
	on(document, "spw:leave", () => setOpen(null));

	desktop.addEventListener?.("change", () => {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
		setOpen(null);
	});

	render();

	signal?.addEventListener("abort", () => {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
	});
}
