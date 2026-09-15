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

	function setActive(index) {
		if (index === activeIndex) return;

		items[activeIndex]?.classList.remove(stickConfig.activeClass);
		items[index]?.classList.add(stickConfig.activeClass);
		activeIndex = index;
	}

	// One measurement, on every scroll. An IntersectionObserver used to sit
	// beside this watching the same headings, and decided nothing the
	// measurement had not already decided.
	function activateNearestToMiddle() {
		if (!isDesktop.matches) return;

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

	function clear() {
		items.forEach((item) => item.classList.remove(stickConfig.activeClass));
		activeIndex = -1;
	}

	window.addEventListener("resize", activateNearestToMiddle, { signal });
	window.addEventListener("scroll", activateNearestToMiddle, { passive: true, signal });

	// A MediaQueryList is global, so without the signal every visit to this page
	// left another handler behind holding a detached section.
	isDesktop.addEventListener(
		"change",
		() => (isDesktop.matches ? activateNearestToMiddle() : clear()),
		{ signal },
	);

	activateNearestToMiddle();
}
