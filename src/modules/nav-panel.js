import EmblaCarousel from "embla-carousel";
import { animate } from "motion";

// The Work and About dropdowns.
//
// One piece of markup serves both breakpoints: a full-bleed surface under the
// bar on desktop, an in-flow accordion inside the open menu below it.
//
// This file toggles attributes and animates height, which CSS cannot do while
// calc-size() is Chromium only. Every static rule is in the Nav Component's own
// CSS embed.
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
	slider: "[data-nav-slider]",
	arrow: "[data-nav-arrow]",
	stagger: "[data-nav-stagger]",
	scrim: "[data-nav-scrim]",
	linkSelector: "a",
	openAttr: "data-nav-open",
	leavingAttr: "data-nav-leaving",
	desktopQuery: "(min-width: 992px)",

	// Long enough that a pointer crossing Work on its way to Insights never
	// flashes the panel, short enough that a deliberate hover feels immediate.
	openDelay: 120,
	// Long enough to cross the gap from the link down into the panel.
	closeDelay: 180,

	heightSpring: { type: "spring", visualDuration: 0.42, bounce: 0.2 },
	contentOut: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
	contentIn: { duration: 0.26, delay: 0.04, ease: [0.2, 0.7, 0.2, 1] },
	shift: 24,

	// Borrowed from the mobile menu, which already brings its links in on this
	// curve, distance, blur and gap. Shared so the nav moves as one thing.
	rowsIn: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
	rowGap: 0.024,
	rowRise: 8,
	rowBlur: 1.25,
	// Closing is not the entrance reversed. The contents leave first and the
	// surface retracts after them, on a spring with no bounce — an overshoot on
	// the way out reads as a bounce off the top of the page.
	exitSpring: { type: "spring", visualDuration: 0.34, bounce: 0 },
	exitContent: { duration: 0.16, ease: [0.4, 0, 1, 1] },
	exitRise: 6,

	scrimOpacity: 0.2,
	scrimFade: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
	scrimFadeOut: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
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
	const reduceMotion =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const desktop =
		typeof window.matchMedia === "function"
			? window.matchMedia(navPanelConfig.desktopQuery)
			: { matches: true, addEventListener() {} };

	const sliders = new Map();

	let open = null;
	// A panel that is retracting but still on screen. It is still the thing the
	// reader can see, so opening another one morphs from it rather than racing
	// a second entrance against its exit.
	let closingItem = null;
	let openTimer = 0;
	let closeTimer = 0;

	const scrim = nav.querySelector(navPanelConfig.scrim);
	const panelOf = (item) => item.querySelector(navPanelConfig.panel);
	const rowsOf = (item) => [...panelOf(item).querySelectorAll(navPanelConfig.stagger)];
	const innerOf = (item) => item.querySelector(navPanelConfig.inner);
	const linkOf = (item) => item.querySelector(navPanelConfig.linkSelector);

	function setState(item, attribute, on) {
		item.toggleAttribute(attribute, on);
		panelOf(item).toggleAttribute(attribute, on);
	}

	// Never cached: a late font, a longer CMS name or a resize all change it.
	function naturalHeight(item) {
		const panel = panelOf(item);
		const previous = panel.style.height;
		panel.style.height = "auto";
		const height = panel.getBoundingClientRect().height;
		panel.style.height = previous;
		return height;
	}

	function setHeight(item, height, immediate, options = navPanelConfig.heightSpring) {
		const panel = panelOf(item);
		if (immediate || reduceMotion) {
			panel.style.height = `${height}px`;
			return null;
		}
		// Motion retargets a running animation on the same value rather than
		// restarting it, so an interrupted open or close keeps its velocity.
		return track(item, animate(panel, { height: `${height}px` }, options));
	}

	// Every animation started for an item, so an interruption can stop the last
	// gesture instead of letting two fight over the same properties.
	const running = new Map();

	function track(item, animation) {
		const list = running.get(item) || [];
		list.push(animation);
		running.set(item, list);
		return animation;
	}

	function stopRunning(item) {
		running.get(item)?.forEach((animation) => animation.stop?.());
		running.set(item, []);
	}

	// Held through a swap: re-fading on every size change flickers. It leaves a
	// little slower than it arrives, so the page comes back rather than snaps.
	function setScrim(on) {
		if (!scrim || !desktop.matches) return;
		if (reduceMotion) {
			scrim.style.opacity = on ? String(navPanelConfig.scrimOpacity) : "0";
			return;
		}
		animate(
			scrim,
			{ opacity: on ? navPanelConfig.scrimOpacity : 0 },
			on ? navPanelConfig.scrimFade : navPanelConfig.scrimFadeOut,
		);
	}

	// Only when opening from closed. A swap is a morph, and replaying an
	// entrance there is the flash this module exists to avoid.
	function playRows(item) {
		if (reduceMotion) return;
		rowsOf(item).forEach((row, index) => {
			const from = {
				opacity: [0, 1],
				y: [navPanelConfig.rowRise, 0],
				scale: [0.985, 1],
				filter: [`blur(${navPanelConfig.rowBlur}px)`, "blur(0px)"],
			};
			const timing = { ...navPanelConfig.rowsIn, delay: index * navPanelConfig.rowGap };

			track(item, animate(row, from, timing));
		});
	}

	function show(item, immediate = false) {
		if (open === item) return;

		const previous = open || closingItem;
		open = item;
		closingItem = null;

		// An interrupted close leaves the incoming panel mid-retract with a
		// faded inner; stop that before anything new starts on it.
		stopRunning(item);
		const inner = innerOf(item);
		if (inner) {
			inner.style.opacity = "";
			inner.style.transform = "";
		}
		setState(item, navPanelConfig.leavingAttr, false);

		// Kept visible until its content has faded, or the crossfade has nothing
		// to fade from.
		if (previous) setState(previous, navPanelConfig.leavingAttr, true);
		else setScrim(true);

		items.forEach((candidate) => {
			const isOpen = candidate === item;
			setState(candidate, navPanelConfig.openAttr, isOpen);
			linkOf(candidate)?.setAttribute("aria-expanded", isOpen ? "true" : "false");
		});

		// Embla cannot measure a panel that was display-none a frame ago.
		sliders.get(item)?.reInit();

		const height = naturalHeight(item);

		if (!previous || immediate || reduceMotion) {
			setHeight(item, height, immediate);
			if (!immediate) playRows(item);
			if (previous) {
				setHeight(previous, 0, true);
				setState(previous, navPanelConfig.leavingAttr, false);
			}
			return;
		}

		// Whatever the outgoing panel was still doing, this replaces it.
		stopRunning(previous);

		// Both to the same height while the contents trade places, so the two
		// surfaces read as one that grew or shrank.
		setHeight(previous, height, false);
		setHeight(item, height, false);

		const step = (order.indexOf(item) > order.indexOf(previous) ? 1 : -1) * navPanelConfig.shift;
		const leaving = innerOf(previous);
		const arriving = innerOf(item);

		if (leaving) {
			track(previous, animate(leaving, { opacity: 0, x: -step }, navPanelConfig.contentOut))
				.finished.then(() => {
					// Swapped back to before this finished: it is the open panel
					// now and owns its own styles.
					if (open === previous) return;
					setState(previous, navPanelConfig.leavingAttr, false);
					leaving.style.opacity = "";
					leaving.style.transform = "";
					setHeight(previous, 0, true);
				})
				.catch(() => {});
		}
		if (arriving) {
			track(item, animate(arriving, { opacity: [0, 1], x: [step, 0] }, navPanelConfig.contentIn));
		}
	}

	function hide() {
		if (!open) return;
		const closing = open;
		open = null;
		closingItem = closing;

		stopRunning(closing);
		linkOf(closing)?.setAttribute("aria-expanded", "false");
		setScrim(false);

		// The panel stays visible for its own exit. Dropping data-nav-open here
		// and nothing else is what made closing flash: the CSS hides it on that
		// attribute, so the height was animating on an invisible element.
		setState(closing, navPanelConfig.openAttr, false);
		setState(closing, navPanelConfig.leavingAttr, true);

		if (reduceMotion) {
			setHeight(closing, 0, true);
			setState(closing, navPanelConfig.leavingAttr, false);
			return;
		}

		// Contents leave first, the surface retracts after them.
		const inner = innerOf(closing);
		if (inner) {
			track(
				closing,
				animate(
					inner,
					{ opacity: 0, y: -navPanelConfig.exitRise },
					navPanelConfig.exitContent,
				),
			);
		}

		// Hidden only once it has actually finished retracting, and not at all if
		// it was reopened on the way down.
		setHeight(closing, 0, false, navPanelConfig.exitSpring)
			?.finished.then(() => {
				// Adopted by a later open, which owns the clean-up now.
				if (closingItem !== closing) return;
				closingItem = null;
				setState(closing, navPanelConfig.leavingAttr, false);
				if (!inner) return;
				inner.style.opacity = "";
				inner.style.transform = "";
			})
			.catch(() => {});
	}

	function queueOpen(item) {
		clearTimeout(closeTimer);
		clearTimeout(openTimer);
		// Something is on screen, open or still retracting: swap straight away,
		// so the morph is the whole gesture and there is no wait first.
		if (open || closingItem) {
			show(item);
			return;
		}
		openTimer = setTimeout(() => show(item), navPanelConfig.openDelay);
	}

	function queueClose() {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
		closeTimer = setTimeout(hide, navPanelConfig.closeDelay);
	}

	function on(target, event, fn, options) {
		target.addEventListener(event, fn, { signal, ...options });
	}

	// The featured work rail. The panel is closed when this runs, so show()
	// re-measures it on every open.
	items.forEach((item) => {
		const sliderRoot = item.querySelector(navPanelConfig.slider);
		const track = sliderRoot?.firstElementChild;
		if (!track?.children.length) return;

		const embla = EmblaCarousel(sliderRoot, { align: "start", containScroll: "trimSnaps" });
		const arrows = [...item.querySelectorAll(navPanelConfig.arrow)];

		function syncArrows() {
			// Nothing to page through: the controls are noise.
			const idle = !embla.canScrollPrev() && !embla.canScrollNext();
			arrows.forEach((arrow) => {
				const can =
					arrow.dataset.navArrow === "prev" ? embla.canScrollPrev() : embla.canScrollNext();
				arrow.setAttribute("aria-disabled", can ? "false" : "true");
				arrow.tabIndex = can ? 0 : -1;
				arrow.hidden = idle;
			});
		}

		arrows.forEach((arrow) => {
			function go() {
				if (arrow.getAttribute("aria-disabled") === "true") return;
				if (arrow.dataset.navArrow === "prev") embla.scrollPrev();
				else embla.scrollNext();
			}
			on(arrow, "click", go);
			on(arrow, "keydown", (event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				go();
			});
		});

		embla.on("select", syncArrows).on("reInit", syncArrows);
		syncArrows();
		sliders.set(item, embla);
	});

	items.forEach((item) => {
		linkOf(item)?.setAttribute("aria-expanded", "false");

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
			if (open === item) hide();
			else show(item);
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
		hide();
		link?.focus();
	});

	// The nav hides itself on the way down; an open panel would be stranded.
	on(window, "scroll", () => hide(), { passive: true });
	on(document, "spw:leave", () => hide());

	desktop.addEventListener?.("change", () => {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
		setScrim(false);
		items.forEach((item) => {
			setState(item, navPanelConfig.openAttr, false);
			setState(item, navPanelConfig.leavingAttr, false);
			panelOf(item).style.height = "";
			sliders.get(item)?.reInit();
		});
		open = null;
	});

	signal?.addEventListener("abort", () => {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
		sliders.forEach((embla) => embla.destroy());
		sliders.clear();
	});
}
