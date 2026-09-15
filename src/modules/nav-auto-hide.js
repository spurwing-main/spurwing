const navAutoHideConfig = {
	navSelector: ".nav",
	hiddenClass: "is-hidden",
	lockSelectors: [".nav_layout.is-open"],
	showOnUpDelta: 14,
	keepVisibleOnFocus: true,
};

export function initNavAutoHide(root = document, { signal } = {}) {
	const nav = root.querySelector(navAutoHideConfig.navSelector);

	if (!nav) return;

	const lockSelector = navAutoHideConfig.lockSelectors.join(",");

	const state = {
		topThreshold: 0,
		lastY: clampY(window.scrollY || 0),
		lastDecisionY: clampY(window.scrollY || 0),
		focusInside: false,
		ticking: false,
		// Each run starts shown. A back navigation restores the scroll position
		// with one positive-delta jump, which used to leave the nav hidden until
		// the reader scrolled up — where a fresh load at the same position shows
		// it.
		isHidden: false,
	};

	function clampY(y) {
		return y < 0 ? 0 : y;
	}

	// Asked of the DOM rather than cached: the lock is a class another module
	// sets, and a stale answer here shows or hides the nav at the wrong moment.
	function lockedVisible() {
		if (lockSelector && nav.querySelector(lockSelector)) return true;

		return navAutoHideConfig.keepVisibleOnFocus && state.focusInside;
	}

	function show() {
		if (!state.isHidden) return;

		nav.classList.remove(navAutoHideConfig.hiddenClass);
		state.isHidden = false;
	}

	function hide() {
		if (lockedVisible() || state.isHidden) return;

		nav.classList.add(navAutoHideConfig.hiddenClass);
		state.isHidden = true;
	}

	function recomputeTopThreshold() {
		state.topThreshold = Math.ceil(nav.getBoundingClientRect().height || 0);
	}

	// Hide on the way down, show on the way up — but only after the reader has
	// gone back up far enough to mean it, so a short bounce does not flicker.
	function decide(rawY) {
		const y = clampY(rawY);

		if (y <= state.topThreshold || lockedVisible()) {
			state.lastY = y;
			state.lastDecisionY = y;
			show();
			return;
		}

		const delta = y - state.lastY;

		state.lastY = y;

		if (delta > 0) {
			state.lastDecisionY = y;
			hide();
			return;
		}

		if (state.lastDecisionY - y >= navAutoHideConfig.showOnUpDelta) {
			state.lastDecisionY = y;
			show();
		}
	}

	function onScroll() {
		if (state.ticking) return;

		state.ticking = true;

		window.requestAnimationFrame(function () {
			state.ticking = false;
			decide(window.scrollY || 0);
		});
	}

	nav.classList.remove(navAutoHideConfig.hiddenClass);

	recomputeTopThreshold();

	// The open mobile menu pins the nav visible, and it is a class on a child
	// rather than anything this module controls. Watched so the nav reappears
	// the moment the menu opens, rather than at the next scroll.
	const lockObserver = new MutationObserver(function () {
		if (lockedVisible()) show();
		else decide(window.scrollY || 0);
	});

	lockObserver.observe(nav, {
		subtree: true,
		attributes: true,
		attributeFilter: ["class", "aria-expanded"],
	});

	const resizeObserver = new ResizeObserver(function () {
		recomputeTopThreshold();
		decide(window.scrollY || 0);
	});

	resizeObserver.observe(nav);

	signal?.addEventListener("abort", function () {
		lockObserver.disconnect();
		resizeObserver.disconnect();
	});

	if (navAutoHideConfig.keepVisibleOnFocus) {
		nav.addEventListener(
			"focusin",
			function () {
				state.focusInside = true;
				show();
			},
			{ signal },
		);

		nav.addEventListener(
			"focusout",
			function () {
				window.requestAnimationFrame(function () {
					state.focusInside = nav.contains(document.activeElement);
					decide(window.scrollY || 0);
				});
			},
			{ signal },
		);
	}

	window.addEventListener("scroll", onScroll, { passive: true, signal });

	decide(state.lastY);
}
