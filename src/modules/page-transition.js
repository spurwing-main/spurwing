/*
   Crossfades main + footer through a brief white hold. The nav is never touched.

   Two decisions worth knowing before changing anything:

   1. Not View Transitions. They rebuild the nav on every navigation and hide it
      behind a snapshot, so stability depends on the browser's snapshot timing.
      With two self-hosted webfonts on font-display:auto and no preload, the new
      document can reach first render — when the snapshot is taken — before the
      fonts apply. That is the "text changes" flash.

   2. Not Barba. Webflow code components (<code-island>) ship as declarative
      shadow DOM (<template shadowrootmode="open">). innerHTML, which is how
      Barba builds its container, silently drops those templates: the element
      upgrades with an empty shadow root and renders nothing, while
      el.shadowRoot still reads truthy. Only setHTMLUnsafe() attaches them.

   This file assumes every module cleans up with the signal boot.js hands it.
   That assumption is what keeps it short: no script-lifecycle compensation, no
   monkeypatching, no knowledge of any module's internal class names.
*/

const pageTransitionConfig = {
	swap: ["main.main-wrap", ".footer"], // in document order, inside `wrapper`
	wrapper: ".page-wrap",
	nav: ".nav",

	// A page can opt out of swapping from the Designer, for anything that turns
	// out to own its DOM and cannot be told to re-read it.
	noSwap: ["[data-pt-no-swap]"],

	fetchTimeout: 6000,
	cssTimeout: 4000,
	readyTimeout: 800, // ceiling on waiting for fonts and above-the-fold images
	fadeBudget: 1100, // must exceed --pt-out + --pt-hold + --pt-in
	prefetch: true,
	debug: false,
};

// The fade lives in CSS, not JavaScript. WebKit halves requestAnimationFrame to
// 30fps while iOS Low Power Mode is on, so a scripted fade visibly steps; a
// transition on opacity is run by the compositor. It also cannot stall
// half-finished in a backgrounded tab.
//
// Nothing paints the white hold: body is already white and the container has no
// background, so fading it out simply reveals it.
const STYLES = `
	:root {
		--pt-out: 240ms;
		--pt-hold: 200ms;
		--pt-in: 400ms;
	}

	[data-pt-container] { display: block; }

	[data-pt-container][data-pt-state="in"] { opacity: 0; }

	[data-pt-container][data-pt-state="out"] {
		opacity: 0;
		transition: opacity var(--pt-out) cubic-bezier(0.4, 0, 1, 1);
	}

	[data-pt-container][data-pt-state="on"] {
		opacity: 1;
		transition: opacity var(--pt-in) cubic-bezier(0, 0, 0.2, 1);
		transition-delay: calc(var(--pt-out) + var(--pt-hold));
	}

	html[data-pt="active"] { cursor: progress; }

	@media (prefers-reduced-motion: reduce) {
		[data-pt-container] { transition: none !important; }
	}
`;

// Which clicks the router may take, expressed without any DOM it owns, so the
// rules can be read and tested on their own. Returns a URL to route to, the
// string "self" for a same-page link, or null to leave the click alone.
const ASSET = /\.(pdf|zip|docx?|xlsx?|csv|txt|xml|json|jpe?g|png|gif|svg|webp|avif|mp4|webm|mp3)$/i;

export function routeTarget(link, event, here = location) {
	if (!link?.href) return null;

	// A modified click is the reader asking the browser for a new tab or a save.
	if (
		event &&
		(event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey)
	) {
		return null;
	}

	if (
		(link.target && link.target !== "_self") ||
		link.hasAttribute("download") ||
		link.closest("[data-pt-ignore]")
	) {
		return null;
	}

	let url;

	try {
		url = new URL(link.href, here.href);
	} catch {
		return null;
	}

	if (url.origin !== here.origin || !/^https?:$/.test(url.protocol)) return null;
	if (ASSET.test(url.pathname)) return null;

	// Same document: leave #anchors and the browser's smooth scroll alone.
	if (url.pathname === here.pathname && url.search === here.search) {
		return url.hash ? null : "self";
	}

	return url;
}

export function initPageTransition(root = document) {
	const html = root.documentElement;

	// setHTMLUnsafe is the whole reason the code components survive a swap, and
	// nothing can polyfill attaching a declarative shadow root. Without it, and
	// in the Designer, every link stays an ordinary navigation.
	if (typeof Element.prototype.setHTMLUnsafe !== "function") return;
	if (html.classList.contains("wf-design-mode")) return;
	if (html.classList.contains("w-editor")) return;

	const wrapper = root.querySelector(pageTransitionConfig.wrapper);

	if (!wrapper) return;

	const log = (...args) => pageTransitionConfig.debug && console.log("[pt]", ...args);
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

	let current = null;
	let shell = null;
	let announcer = null;
	let busy = false;

	/* --- the contract with the rest of the site ---------------------------
	   Two events on `document`, and nothing else. Both are dispatched
	   synchronously, so a listener has run before the router takes its next
	   step. That is load-bearing: the mobile menu closes itself on spw:leave,
	   which releases the body scroll lock before anything here scrolls.

	     spw:leave  a navigation started. Stop timers, close menus, tear down.
	     spw:page   the new page is in the DOM and laid out. Set yourself up.
	   -------------------------------------------------------------------- */
	const announce = (type, detail) =>
		document.dispatchEvent(new CustomEvent(type, { detail }));

	/* --- shell ----------------------------------------------------------- */

	// /discovery-call has no .nav and no .footer. Swapping into a different
	// shell would leave the wrong chrome on screen, so a mismatch is a full load.
	const shellOf = (doc) =>
		[...pageTransitionConfig.swap, pageTransitionConfig.nav]
			.map((selector) => (doc.querySelector(selector) ? 1 : 0))
			.join("");

	// One element around main + footer so a single opacity transition covers
	// both. Built at runtime, so the Designer and published markup are untouched
	// and the pages still work with JavaScript off.
	//
	// Called on the first navigation, never on load. Moving main takes every
	// <code-island> in it out of the document and puts it back, which runs
	// connectedCallback again. Do that while a component's first mount is still
	// in flight — which is exactly where DOMContentLoaded falls — and Webflow
	// mounts it twice, appending a second copy beside the first instead of
	// reconciling: the approach hero ran two tickers, 34ms apart, stacked. By
	// the time anyone clicks a link, every component has finished mounting and
	// the same move is harmless.
	function wrapCurrent() {
		const parts = pageTransitionConfig.swap
			.map((selector) => root.querySelector(selector))
			.filter(Boolean);

		if (!parts.length) return null;

		const container = document.createElement("div");

		container.setAttribute("data-pt-container", "");
		parts[0].before(container);
		container.append(...parts);

		return container;
	}

	const htmlOf = (doc) =>
		pageTransitionConfig.swap
			.map((selector) => doc.querySelector(selector)?.outerHTML || "")
			.join("");

	/* --- scroll ---------------------------------------------------------- */

	// The site sets html { scroll-behavior: smooth }, so an unguarded scrollTo
	// animates the whole page past the viewport mid-transition.
	function jumpTo(y) {
		const previous = html.style.scrollBehavior;

		html.style.scrollBehavior = "auto";

		const max = Math.max(0, document.scrollingElement.scrollHeight - window.innerHeight);

		window.scrollTo(0, Math.min(Math.max(0, y), max));
		html.style.scrollBehavior = previous;
	}

	const rememberScroll = () => {
		try {
			history.replaceState({ ...history.state, y: window.scrollY }, "");
		} catch {}
	};

	/* --- fetch ----------------------------------------------------------- */

	const cache = new Map();

	function load(url) {
		if (cache.has(url)) return cache.get(url);

		const abort = new AbortController();
		const timer = setTimeout(() => abort.abort(), pageTransitionConfig.fetchTimeout);
		const doc = fetch(url, { credentials: "same-origin", signal: abort.signal })
			.then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.text();
			})
			.then((text) => new DOMParser().parseFromString(text, "text/html"))
			.finally(() => clearTimeout(timer));

		cache.set(url, doc);
		doc.catch(() => cache.delete(url));

		return doc;
	}

	/* --- head ------------------------------------------------------------ */

	const META =
		'meta[name="description"],meta[name="robots"],link[rel="canonical"],meta[property^="og:"],meta[name^="twitter:"]';

	// Webflow serves a per-page optimised stylesheet, so the incoming page's CSS
	// has to arrive before the content is shown. A stylesheet that fails or times
	// out rejects on purpose: a full navigation beats fading up unstyled content.
	function syncHead(doc) {
		document.title = doc.title;
		document.head.querySelectorAll(META).forEach((node) => node.remove());
		doc.head
			.querySelectorAll(META)
			.forEach((node) => document.head.append(document.importNode(node, true)));

		const id = doc.documentElement.getAttribute("data-wf-page");

		if (id) html.setAttribute("data-wf-page", id);

		const have = new Set(
			[...document.querySelectorAll("link[rel=stylesheet][href]")].map((link) => link.href),
		);
		const waits = [];

		doc.head.querySelectorAll("link[rel=stylesheet][href]").forEach((incoming) => {
			if (have.has(incoming.href)) return;

			const link = Object.assign(document.createElement("link"), {
				rel: "stylesheet",
				href: incoming.href,
			});

			waits.push(
				new Promise((ok, fail) => {
					link.addEventListener("load", ok, { once: true });
					link.addEventListener("error", () => fail(new Error(`stylesheet failed: ${link.href}`)), {
						once: true,
					});
					setTimeout(
						() => fail(new Error(`stylesheet timed out: ${link.href}`)),
						pageTransitionConfig.cssTimeout,
					);
				}),
			);

			document.head.append(link);
			log("css", link.href);
		});

		return Promise.all(waits);
	}

	/* --- reveal readiness ------------------------------------------------- */

	const SKIP = /^(application\/(ld\+json|json)|text\/template|speculationrules)$/i;

	// setHTMLUnsafe inserts <script> inert, so each is recreated to make it run.
	// What is left in swapped content is Webflow's own and the analytics
	// vendors'; everything of ours is in this bundle.
	function runScripts(container) {
		let count = 0;

		container.querySelectorAll("script").forEach((old) => {
			if (SKIP.test(old.getAttribute("type") || "")) return;

			const script = document.createElement("script");

			for (const { name, value } of old.attributes) script.setAttribute(name, value);
			script.textContent = old.textContent;
			old.replaceWith(script);
			count += 1;
		});

		log("scripts", count);
	}

	// Held at opacity 0 until what changes late has settled: the stylesheet
	// (above), the webfonts, and any image that will be in view on arrival.
	// Without this the content fades up in a fallback font with images popping in.
	function whenPaintable(container, targetY) {
		const jobs = [];

		if (document.fonts?.status !== "loaded") jobs.push(document.fonts.ready);

		const top = container.getBoundingClientRect().top + window.scrollY;

		container.querySelectorAll("img").forEach((img) => {
			if (img.complete) return;

			const box = img.getBoundingClientRect();
			const y = box.top + window.scrollY - top;

			if (y > targetY + window.innerHeight * 1.2 || y + box.height < targetY) return;

			jobs.push(img.decode?.().catch(() => {}) ?? Promise.resolve());
		});

		if (!jobs.length) return Promise.resolve();

		log("waiting on", jobs.length);

		return Promise.race([
			Promise.all(jobs).catch(() => {}),
			new Promise((resolve) => setTimeout(resolve, pageTransitionConfig.readyTimeout)),
		]);
	}

	const frame = () =>
		Promise.race([
			new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
			new Promise((resolve) => setTimeout(resolve, 100)), // rAF never fires in a hidden tab
		]);

	/* --- the fade --------------------------------------------------------- */

	// Committing the end state is the invariant: however the transition ends, the
	// incoming page finishes at opacity 1 with nothing pending, so it can never
	// be left half-faded.
	function crossfade(from, to) {
		const commit = () => {
			to.removeAttribute("data-pt-state");
			from.setAttribute("data-pt-state", "out");
		};

		// A hidden page has its animation timeline frozen: the transition sits at
		// currentTime 0 and never emits transitionend. Nothing is on screen to
		// look at either, so cut.
		if (reduceMotion.matches || document.hidden) {
			commit();
			return Promise.resolve();
		}

		from.setAttribute("data-pt-state", "out");
		to.setAttribute("data-pt-state", "on");

		return new Promise((resolve) => {
			const done = (event) => {
				if (event && (event.target !== to || event.propertyName !== "opacity")) return;

				clearTimeout(guard);
				to.removeEventListener("transitionend", done);
				commit();
				resolve();
			};
			const guard = setTimeout(done, pageTransitionConfig.fadeBudget);

			to.addEventListener("transitionend", done);
		});
	}

	/* --- navigate --------------------------------------------------------- */

	async function go(url, { targetY = 0, push = true } = {}) {
		if (busy) return;

		busy = true;
		html.setAttribute("data-pt", "active");

		setActiveNav(new URL(url).pathname);
		// Synchronous, and before anything scrolls: this is where the mobile menu
		// closes itself and releases body { overflow: hidden }.
		announce("spw:leave", { url });

		try {
			const doc = await load(url);

			if (shellOf(doc) !== shell) {
				log("different shell — full load");
				location.href = url;
				return;
			}

			if (doc.querySelector(pageTransitionConfig.noSwap.join(","))) {
				log("incoming page opts out of swapping — full load");
				location.href = url;
				return;
			}

			await syncHead(doc);

			if (push) {
				rememberScroll();
				history.pushState({ y: targetY }, "", url);
			}

			current ??= wrapCurrent();

			// Freeze the outgoing page where the eye sees it. Taking it out of flow
			// hands the document height to the incoming page, so moving the scroll
			// underneath is invisible even from the very bottom of the footer.
			current.style.cssText =
				`position:fixed;top:${Math.round(current.getBoundingClientRect().top)}px;` +
				`left:0;right:0;z-index:2;pointer-events:none;`; // .nav is z-index 100

			// Insert BEFORE the outgoing container. Both are in the DOM during the
			// fade and a module calls root.querySelector, which returns the first
			// match in document order.
			const next = document.createElement("div");

			next.setAttribute("data-pt-container", "");
			next.setAttribute("data-pt-state", "in");
			wrapper.insertBefore(next, current);
			next.setHTMLUnsafe(htmlOf(doc));

			jumpTo(targetY);
			await whenPaintable(next, targetY);
			await frame();
			jumpTo(targetY); // again: the first jump could only clamp to the height
			//                  the page had before its images had size

			// Modules restart here, against the new DOM, each with a fresh signal.
			announce("spw:page", { container: next, url });
			runScripts(next);
			await frame();

			// Webflow's own modules. destroy()/ready() is here for w-form, which
			// appears in swapped content on / and /work-archive.
			try {
				window.Webflow?.destroy();
				window.Webflow?.ready();
			} catch (error) {
				log("Webflow re-init skipped", error);
			}

			// Finsweet Attributes binds its list and table of contents to the DOM
			// present when it loaded, so after a swap its filters point at elements
			// that are no longer on screen — the work archive filtered nothing.
			// restart() is destroy-then-load, and rebinds to the incoming page.
			// Every loaded module is restarted rather than a named list, so a module
			// added in the Designer later is covered without a release.
			try {
				const finsweet = window.FinsweetAttributes;

				for (const name of Object.keys(finsweet?.modules || {})) {
					finsweet.modules[name]?.restart?.();
				}
			} catch (error) {
				log("Finsweet restart skipped", error);
			}

			await crossfade(current, next);

			current.remove();
			current = next;

			rememberScroll();
			announcer.textContent = document.title;
			focusMain();
			// Plausible patches pushState and counts this itself; Hotjar does not.
			try {
				window.hj?.("stateChange", location.href);
			} catch {}
		} catch (error) {
			console.warn("[pt] falling back to a full load:", error);
			location.href = url;
		} finally {
			html.removeAttribute("data-pt");
			busy = false;
		}
	}

	/* --- nav active state -------------------------------------------------- */

	// The nav is outside the container, so these are the same DOM nodes all
	// session: same inline SVG logo, same layout box. Nothing is rebuilt, so
	// nothing can flash. The active pill is CSS anchor positioning keyed off
	// :has(.nav_link.w--current) with a transition on left/width, so retargeting
	// w--current is the whole job — the pill glides on the site's own easing.
	// Called before the fetch, so the nav answers the click, not the network.
	function setActiveNav(pathname) {
		document.querySelectorAll(`${pageTransitionConfig.nav} a[href]`).forEach((link) => {
			const on = new URL(link.href).pathname === pathname;

			link.classList.toggle("w--current", on);

			if (on) link.setAttribute("aria-current", "page");
			else link.removeAttribute("aria-current");
		});
	}

	function focusMain() {
		const main = document.querySelector("main");

		if (!main) return;

		main.setAttribute("tabindex", "-1");
		main.focus({ preventScroll: true });
		main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
	}

	/* --- links ------------------------------------------------------------- */

	function listen() {
		document.addEventListener("click", (event) => {
			const url = routeTarget(event.target.closest?.("a[href]"), event);

			if (!url) return;

			event.preventDefault();

			if (url === "self") {
				window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
				announce("spw:leave", { url: location.href });
				return;
			}

			go(url.href);
		});

		if (pageTransitionConfig.prefetch) {
			const warm = (event) => {
				const url = routeTarget(event.target.closest?.("a[href]"), null);

				if (url && url !== "self" && !cache.has(url.href)) load(url.href).catch(() => {});
			};

			["mouseover", "focusin", "touchstart"].forEach((type) =>
				document.addEventListener(type, warm, { passive: true }),
			);
		}

		window.addEventListener("popstate", (event) => {
			if (!busy) go(location.href, { push: false, targetY: event.state?.y || 0 });
		});

		// Not on every scroll stop: Safari throws after 100 replaceState calls in
		// 30 seconds, and the catch inside rememberScroll would swallow it, so
		// fast flicking used to silently lose scroll memory for the rest of the
		// window. Leaving the page is the only moment the value is needed.
		window.addEventListener("pagehide", rememberScroll);
		window.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") rememberScroll();
		});

		// A page restored from the back-forward cache returns with the DOM it had
		// when the reader left. Mid-transition that is a half-faded container, or
		// two. Reset to one clean container.
		window.addEventListener("pageshow", (event) => {
			if (!event.persisted) return;

			html.removeAttribute("data-pt");
			document.querySelectorAll("[data-pt-container]").forEach((container) => {
				if (container !== current) container.remove();
				else container.removeAttribute("data-pt-state");
			});
			busy = false;
		});
	}

	/* --- boot -------------------------------------------------------------- */

	const style = document.createElement("style");

	style.setAttribute("data-pt-style", "");
	style.textContent = STYLES;
	document.head.append(style);

	if (!pageTransitionConfig.swap.some((selector) => root.querySelector(selector))) {
		return log("nothing to swap here — leaving navigation alone");
	}

	shell = shellOf(document);

	announcer = document.createElement("p");
	announcer.setAttribute("aria-live", "polite");
	announcer.style.cssText =
		"position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
	document.body.append(announcer);

	if ("scrollRestoration" in history) history.scrollRestoration = "manual";

	// Taking scroll restoration off the browser means giving it back by hand.
	// rememberScroll() below overwrites the stored y with the current one, which
	// on a reload is 0, so the position has to be read first.
	const restored = history.state?.y;

	if (restored) jumpTo(restored);

	rememberScroll();
	listen();

	log("ready");
}
