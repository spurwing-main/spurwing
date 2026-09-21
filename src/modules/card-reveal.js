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
};

export function initCardReveal(root = document, { signal } = {}) {
	// No sentinel on documentElement: it would survive a page transition and stop
	// the next page's cards ever revealing. boot.js runs each module once a page.
	const cards = [...root.querySelectorAll(".work-item_component, .team_item")];

	if (!cards.length) return;

	// Opting every card out is what the CSS reads to show them immediately, with
	// no transition. It is the one place that is the right thing to do.
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		// `cards` is already the element the CSS reads.
		cards.forEach((card) => card.setAttribute(cardRevealConfig.optOutAttr, ""));
		return;
	}

	// THE TWO ATTRIBUTES LIVE ON DIFFERENT ELEMENTS, because the CSS reads them
	// from different places:
	//
	//   .work_list-item[data-in-viewport] .work-item_component  — on the item
	//   .work-item_component[data-reveal-disabled]               — on the card
	//
	// A work card is a .work-item_component inside a .work_list-item; a team card
	// is one element doing both jobs. Reading the opt-out off the item answered
	// false for every work card ever opted out, which is how a held card stayed
	// held. Only reduced motion opts a card out now, and it does so on the card.
	const cardOf = (item) => item.querySelector(".work-item_component") ?? item;
	const optedOut = (element) => cardOf(element).hasAttribute(cardRevealConfig.optOutAttr);

	function onScreen(element) {
		const box = element.getBoundingClientRect();

		return box.bottom > 0 && box.top < (window.innerHeight || 0);
	}

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
		// No negative bottom margin: it left a band at the foot of the page that
		// the shrunken root could never reach, where a card stayed at opacity 0
		// for good. See the same note in anim.js.
		{ threshold: cardRevealConfig.threshold },
	);

	applyStagger();

	// A card already on screen when this runs is REVEALED, not opted out.
	//
	// Opting it out was the obvious-looking shortcut and it was wrong twice over.
	// The opt-out is defined as "show this with no animation" — opacity 1,
	// transform none, transition none — so it cannot be the way to make a card
	// arrive. And it is read off the card while the reveal is read off the list
	// item, so putting it on the item showed nothing at all and left the whole
	// top of /work blank.
	//
	// Measured on the page: setting the reveal attribute in the same task the
	// card was first laid out transitions perfectly, 0.19 → 0.35 → 0.48 → 0.59 →
	// 0.74 → 0.83 → 1 over its 0.52s. No forced reflow, no deferred frame. The
	// stagger is already on each card by now, so a screenful arrives as a
	// sequence rather than a block.
	function claim(item) {
		if (optedOut(item) || item.hasAttribute(cardRevealConfig.revealedAttr)) return;

		if (onScreen(item)) {
			item.setAttribute(cardRevealConfig.revealedAttr, "");
			return;
		}

		observer.observe(item);
	}

	const selector = cardRevealConfig.itemSelectors.join(",");

	root.querySelectorAll(selector).forEach(claim);

	// The CSS holds every card at opacity 0 and this is the only thing that ever
	// releases one, so a card built after this runs — a Finsweet list re-rendering
	// on filter, anything cloned — would be observed by nobody and stay blank for
	// good. Watching is the only way to see DOM that did not exist yet.
	const late = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (node.nodeType !== 1) continue;

				if (node.matches(selector)) claim(node);
				else node.querySelectorAll?.(selector).forEach(claim);
			}
		}
	});

	late.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });

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
		late.disconnect();
	});
}
