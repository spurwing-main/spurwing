// The sticky list on /approach marks whichever item sits nearest the middle of
// the viewport. Desktop only: below the breakpoint the list reads straight
// through and nothing is highlighted.

const stickConfig = {
	layoutSelector: ".stick_layout",
	itemSelector: ".stick_list-item",
	headingSelector: "h2, h3",
	activeClass: "is-active",
	fromWidth: 768,
};

export function initStick(root = document, { signal } = {}) {
	const layout = root.querySelector(stickConfig.layoutSelector);

	if (!layout) return;

	const items = [...layout.querySelectorAll(stickConfig.itemSelector)];

	if (!items.length) return;

	// The heading is what the reader's eye tracks, so it is what is measured.
	const headings = items.map((item) => item.querySelector(stickConfig.headingSelector) || item);
	const isDesktop = window.matchMedia(`(min-width: ${stickConfig.fromWidth}px)`);

	let activeIndex = -1;
	let observer = null;

	function setActive(index) {
		if (index === activeIndex) return;

		items[activeIndex]?.classList.remove(stickConfig.activeClass);
		items[index]?.classList.add(stickConfig.activeClass);
		activeIndex = index;
	}

	function activateNearestToMiddle() {
		const middle = window.innerHeight / 2;

		let nearest = 0;
		let shortest = Infinity;

		headings.forEach((heading, index) => {
			const distance = Math.abs(heading.getBoundingClientRect().top - middle);

			if (distance < shortest) {
				shortest = distance;
				nearest = index;
			}
		});

		setActive(nearest);
	}

	function enable() {
		if (observer) return;

		// The observer only wakes the module up as headings cross the middle
		// band; the measurement itself decides which one is nearest.
		observer = new IntersectionObserver(activateNearestToMiddle, {
			threshold: 0,
			rootMargin: "-50% 0px -50% 0px",
		});

		headings.forEach((heading) => observer.observe(heading));
		window.addEventListener("resize", activateNearestToMiddle, { signal });
		window.addEventListener("scroll", activateNearestToMiddle, { passive: true, signal });

		activateNearestToMiddle();
	}

	function disable() {
		observer?.disconnect();
		observer = null;

		window.removeEventListener("resize", activateNearestToMiddle);
		window.removeEventListener("scroll", activateNearestToMiddle);

		items.forEach((item) => item.classList.remove(stickConfig.activeClass));
		activeIndex = -1;
	}

	const sync = () => (isDesktop.matches ? enable() : disable());

	// A MediaQueryList is global, so without the signal every visit to this page
	// left another handler behind holding a detached section.
	isDesktop.addEventListener("change", sync, { signal });
	signal?.addEventListener("abort", disable);

	sync();
}
