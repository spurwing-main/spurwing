const cardRevealConfig = {
	// Cards reveal when these enter the viewport.
	itemSelectors: [".work_list-item", ".team_item"],

	// Each group stages its own delay. `columns: "measure"` reads the rendered
	// grid, because the team grid's column count comes from CSS. `appliesTo` is
	// the element that carries --stagger: ":self" for the item itself.
	staggerGroups: [
		{
			containerSelector: ".work-list_list",
			itemSelector: ":scope > .work_list-item",
			appliesTo: ".work-item_component",
			columns: 1,
		},
		{
			containerSelector: ".team_grid",
			itemSelector: ":scope > .team_item",
			appliesTo: ":self",
			columns: "measure",
		},
	],

	revealedAttr: "data-in-viewport",
	optOutAttr: "data-reveal-disabled",
	stepMs: 70,
	maxDelayMs: 260,
	threshold: 0.05,
	rootMargin: "0px 0px -5% 0px",
};

export function initCardReveal(root = document, { signal } = {}) {
	// No sentinel on documentElement: it would survive a page transition and stop
	// the next page's cards ever revealing. boot.js runs each module once a page.
	const cards = [...root.querySelectorAll(".work-item_component, .team_item")];

	if (!cards.length) return;

	// Opting every card out is what the CSS reads to show them immediately.
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		cards.forEach((card) => card.setAttribute(cardRevealConfig.optOutAttr, ""));
		return;
	}

	const optedOut = (element) => element.hasAttribute(cardRevealConfig.optOutAttr);

	// Items that share a top edge are one row, so counting them counts the grid's
	// columns without needing to know the CSS.
	function measureColumns(items) {
		if (items.length < 2) return 1;

		const topOfFirstRow = items[0].offsetTop;
		const inFirstRow = items.findIndex((item) => item.offsetTop !== topOfFirstRow);

		return inFirstRow === -1 ? items.length : Math.max(1, inFirstRow);
	}

	// Cards come in on a diagonal: later columns and later rows wait longer, up
	// to a ceiling so a long list does not trail off.
	function applyStagger() {
		for (const group of cardRevealConfig.staggerGroups) {
			for (const container of root.querySelectorAll(group.containerSelector)) {
				const items = [...container.querySelectorAll(group.itemSelector)].filter(
					(item) => !optedOut(item),
				);

				if (!items.length) continue;

				const columns = group.columns === "measure" ? measureColumns(items) : group.columns;

				items.forEach((item, index) => {
					const target = group.appliesTo === ":self" ? item : item.querySelector(group.appliesTo);

					// Skip, never throw: the reveal CSS holds every card at opacity 0
					// until this runs, so one malformed item used to take the whole
					// grid down with it.
					if (!target) return;

					const delay = Math.min(index * cardRevealConfig.stepMs, cardRevealConfig.maxDelayMs);

					target.style.setProperty("--stagger", `${delay}ms`);
				});
			}
		}
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;

				entry.target.setAttribute(cardRevealConfig.revealedAttr, "");
				observer.unobserve(entry.target);
			}
		},
		{ threshold: cardRevealConfig.threshold, rootMargin: cardRevealConfig.rootMargin },
	);

	applyStagger();

	for (const selector of cardRevealConfig.itemSelectors) {
		for (const item of root.querySelectorAll(selector)) {
			if (optedOut(item) || item.hasAttribute(cardRevealConfig.revealedAttr)) continue;

			observer.observe(item);
		}
	}

	let resizeFrame = 0;
	let lastWidth = window.innerWidth;

	// --stagger is the transition delay, so rewriting it restarts a reveal that is
	// already running and Safari resolves that by jumping to the end state. iOS
	// fires resize every time the address bar collapses on scroll, which is why
	// cards scrolled into view there sometimes appeared instantly. Only the column
	// count feeds the stagger, and that only moves with the width.
	window.addEventListener(
		"resize",
		() => {
			if (window.innerWidth === lastWidth) return;

			lastWidth = window.innerWidth;
			cancelAnimationFrame(resizeFrame);
			resizeFrame = requestAnimationFrame(applyStagger);
		},
		{ signal },
	);

	signal?.addEventListener("abort", () => {
		cancelAnimationFrame(resizeFrame);
		observer.disconnect();
	});
}
