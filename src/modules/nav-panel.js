import EmblaCarousel from "embla-carousel";
import { animate } from "motion";

// The Work and About dropdowns.
//
// Each nav item owns its own panel, so one piece of markup serves both
// breakpoints: above the desktop breakpoint the panel is a full-bleed surface
// under the bar, below it the same element is an in-flow accordion inside the
// open menu. Nothing in the nav is authored twice.
//
// The panels sit in the same place and overlap exactly, so moving from Work to
// About animates both heights to the incoming panel's and crossfades the
// contents. That reads as one surface growing rather than one panel leaving and
// another arriving — the same lesson as the cursor: once something is already on
// screen, never replay its entrance.
//
// The panel is positioned rather than promoted to the top layer. A popover would
// escape the nav's own transform, and `nav-auto-hide.js` translates the nav out
// of view on the way down, which would leave an open panel stranded mid-screen.
//
// State, the slider, the arrows and the staggered rows are all addressed by data
// attribute, so the Designer keeps ownership of how it looks. The two exceptions
// are noted where they are declared.

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

	// The nav's own vocabulary, borrowed rather than invented: the mobile menu
	// already brings its links in on this curve, over this distance, with this
	// much blur and this gap between them. The panel arriving the same way is
	// what makes it feel like part of the nav instead of a new component.
	rowsIn: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
	rowGap: 0.024,
	rowRise: 8,
	rowBlur: 1.25,
	scrimOpacity: 0.2,
	scrimFade: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
};

const css = `
.nav { --nav-panel-ease: cubic-bezier(0.16, 1, 0.3, 1); }
.nav_item-panel { display: block; overflow: hidden; height: 0; visibility: hidden; }
.nav_item-panel[${navPanelConfig.openAttr}],
.nav_item-panel[${navPanelConfig.leavingAttr}] { visibility: visible; }
/* One curve for every hover and state change in the panel, and it is the one
   the nav already uses for its mobile links. */
.nav_item .nav_item-chevron,
.nav_card,
.nav_card-arrow,
[data-nav-arrow] { transition: transform 420ms var(--nav-panel-ease), background-color 240ms var(--nav-panel-ease), color 240ms var(--nav-panel-ease); }
.nav_item[${navPanelConfig.openAttr}] .nav_item-chevron { transform: rotate(180deg); }
.nav_card:hover .nav_card-arrow { transform: translateX(4px); }
[data-nav-arrow]:not([aria-disabled="true"]):hover { background-color: var(--_color---grey-400); }

/* The arrows carry their disabled look here rather than as a second Designer
   class, because which one is disabled changes as the slider moves. */
[data-nav-arrow][aria-disabled="true"] {
	background-color: var(--_utils---white);
	box-shadow: inset 0 0 0 1px var(--_color---grey-400);
	color: var(--_color---grey-400);
	cursor: default;
}
[data-nav-arrow][hidden] { display: none; }

@media (min-width: 992px) {
	/* The panel is a full-bleed surface under the whole bar, so the bar has to
	   be what positions it. .nav is already fixed, and the two wrappers between
	   it and the panel are only positioned for the hover pill — which is put
	   back by centring it, rather than by measuring the panel's box in script. */
	.nav .nav_links { position: static; }
	.nav .nav_links .nav_link-bg { top: 50%; transform: translateY(-50%); }

	/* The pill keeps following the pointer as it always has. While a panel is
	   open it holds under that item instead, a step darker, so "open" reads
	   differently from "hovering". */
	.nav_links:has(.nav_item[${navPanelConfig.openAttr}]) { --bg-color: var(--_color---grey-400); }
	.nav_links:has(.nav_item[${navPanelConfig.openAttr}]):not(:has(.nav_link:hover)) .nav_item[${navPanelConfig.openAttr}] .nav_link { anchor-name: --navLinkBg; }
	.nav_links:has(.nav_item[${navPanelConfig.openAttr}]) .nav_link-bg { opacity: 1; visibility: visible; }
}

@media (max-width: 991px) {
	/* The mobile entrance stagger is written against the direct children of
	   .nav_links. Work and About now sit inside a wrapper, so their delays are
	   restated here by position rather than by element type. The rest of the
	   mobile layout is Webflow's, on the medium breakpoint. */
	.nav_links > :nth-child(2) .nav_link, .nav_links > a.nav_link:nth-child(2) { --stagger-delay: 0ms; }
	.nav_links > :nth-child(3) .nav_link, .nav_links > a.nav_link:nth-child(3) { --stagger-delay: 24ms; }
	.nav_links > :nth-child(4) .nav_link, .nav_links > a.nav_link:nth-child(4) { --stagger-delay: 48ms; }
	.nav_links > :nth-child(5) .nav_link, .nav_links > a.nav_link:nth-child(5) { --stagger-delay: 72ms; }
	.nav_links > :nth-child(6) .nav_link, .nav_links > a.nav_link:nth-child(6) { --stagger-delay: 96ms; }
	.nav_links > :nth-child(7) .nav_link, .nav_links > a.nav_link:nth-child(7) { --stagger-delay: 120ms; }
}
`;

let styleEl = null;

function installStyles() {
	if (styleEl?.isConnected) return;
	styleEl = document.createElement("style");
	styleEl.dataset.spwNavPanel = "";
	styleEl.textContent = css;
	document.head.appendChild(styleEl);
}

export function initNavPanel(root = document, { signal } = {}) {
	const nav = root.querySelector(navPanelConfig.navSelector);
	if (!nav) return;

	const items = [...nav.querySelectorAll(navPanelConfig.item)].filter((item) =>
		item.querySelector(navPanelConfig.panel),
	);
	if (!items.length) return;

	installStyles();

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

	// Re-measured rather than hard-coded: the bar's height changes with the
	// breakpoint and with the container padding.

	let open = null;
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

	// Measured on every open rather than cached: a font that lands late, a CMS
	// item with a longer name, or a resize all change the answer.
	function naturalHeight(item) {
		const panel = panelOf(item);
		const previous = panel.style.height;
		panel.style.height = "auto";
		const height = panel.getBoundingClientRect().height;
		panel.style.height = previous;
		return height;
	}

	function setHeight(item, height, immediate) {
		const panel = panelOf(item);
		if (immediate || reduceMotion) {
			panel.style.height = `${height}px`;
			return;
		}
		animate(panel, { height: `${height}px` }, navPanelConfig.heightSpring);
	}

	// Opening from closed is the only time the contents arrive; swapping between
	// two open panels is a morph, and replaying an entrance there is exactly the
	// flash this whole module exists to avoid.
	// The page behind is dimmed while a panel is open, and the dim stays put
	// through a swap: re-fading it every time the panel changes size flickers.
	function setScrim(on) {
		if (!scrim || !desktop.matches) return;
		if (reduceMotion) {
			scrim.style.opacity = on ? String(navPanelConfig.scrimOpacity) : "0";
			return;
		}
		animate(scrim, { opacity: on ? navPanelConfig.scrimOpacity : 0 }, navPanelConfig.scrimFade);
	}

	function playRows(item) {
		if (reduceMotion) return;
		rowsOf(item).forEach((row, index) => {
			animate(
				row,
				{
					opacity: [0, 1],
					y: [navPanelConfig.rowRise, 0],
					scale: [0.985, 1],
					filter: [`blur(${navPanelConfig.rowBlur}px)`, "blur(0px)"],
				},
				{ ...navPanelConfig.rowsIn, delay: index * navPanelConfig.rowGap },
			);
		});
	}

	function show(item, immediate = false) {
		if (open === item) return;

		const previous = open;
		open = item;

		// The panel being replaced stays visible until its content has faded,
		// otherwise the crossfade has nothing to fade from.
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

		// Both panels animate to the same height while the contents trade
		// places, so the two surfaces read as one that grew or shrank.
		setHeight(previous, height, false);
		setHeight(item, height, false);

		const step = (order.indexOf(item) > order.indexOf(previous) ? 1 : -1) * navPanelConfig.shift;
		const leaving = innerOf(previous);
		const arriving = innerOf(item);

		if (leaving) {
			animate(leaving, { opacity: [1, 0], x: [0, -step] }, navPanelConfig.contentOut).finished.then(
				() => {
					setState(previous, navPanelConfig.leavingAttr, false);
					leaving.style.opacity = "";
					leaving.style.transform = "";
					if (open !== previous) setHeight(previous, 0, true);
				},
			);
		}
		if (arriving) animate(arriving, { opacity: [0, 1], x: [step, 0] }, navPanelConfig.contentIn);
	}

	function hide() {
		if (!open) return;
		const closing = open;
		open = null;

		setState(closing, navPanelConfig.openAttr, false);
		linkOf(closing)?.setAttribute("aria-expanded", "false");
		setHeight(closing, 0, false);
		setScrim(false);
	}

	function queueOpen(item) {
		clearTimeout(closeTimer);
		clearTimeout(openTimer);
		// Already showing something: swap straight away, so the morph is the
		// whole gesture rather than a close followed by an open.
		if (open) {
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

	// The featured work rail. Embla owns the dragging and the arrow state; the
	// panel is closed when this runs, so every open re-measures it.
	items.forEach((item) => {
		const sliderRoot = item.querySelector(navPanelConfig.slider);
		const track = sliderRoot?.firstElementChild;
		if (!track?.children.length) return;

		const embla = EmblaCarousel(sliderRoot, { align: "start", containScroll: "trimSnaps" });
		const arrows = [...item.querySelectorAll(navPanelConfig.arrow)];

		function syncArrows() {
			// Nothing to page through: the controls are noise, not decoration.
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

		// Below the breakpoint the row is the accordion control, and the panel
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

	// An open panel hangs off the nav, and the nav hides itself on the way
	// down, so a scroll closes it rather than leaving it stranded.
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
