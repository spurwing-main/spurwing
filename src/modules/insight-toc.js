function qsa(root, selector) {
	return Array.from(root.querySelectorAll(selector));
}

export function initInsightToc(root = document) {
	/**
	 * Insights table-of-contents indicator.
	 *
	 * Finsweet marks the active TOC link with Webflow's `w--current` class. The
	 * indicator itself is the list's ::before pseudo-element, so this module
	 * only supplies its two runtime values:
	 *
	 *   --insights-toc-t  top of the active link within the list
	 *   --insights-toc-h  rendered height of the active link
	 *
	 * Finsweet briefly removes `w--current` while a user scrolls between
	 * sections. The first link is the initial fallback; after that, the last
	 * measured position and our persistent `data-insights-toc-current` state
	 * stay in place until another link becomes current. CSS should style the
	 * active link off that attribute, not off Finsweet's transient class.
	 */

	const LIST_SELECTOR = ".insights-item-sidebar_links";
	const LINK_SELECTOR = ".insights-item-sidebar_link";
	const CURRENT_SELECTOR = `${LINK_SELECTOR}.w--current`;

	function setupInsightsToc(list) {
		if (list.hasAttribute("data-insights-toc-ready")) return;
		list.setAttribute("data-insights-toc-ready", "");

		let lastActiveLink = null;

		function persistActiveLink(link) {
			qsa(list, LINK_SELECTOR).forEach((candidate) => {
				candidate.toggleAttribute("data-insights-toc-current", candidate === link);
			});
		}

		function positionIndicator(link) {
			if (!link?.isConnected || !list.contains(link)) return;

			const listRect = list.getBoundingClientRect();
			const linkRect = link.getBoundingClientRect();
			const top = linkRect.top - listRect.top - list.clientTop + list.scrollTop;

			list.style.setProperty("--insights-toc-t", `${top}px`);
			list.style.setProperty("--insights-toc-h", `${linkRect.height}px`);
			persistActiveLink(link);
			lastActiveLink = link;
		}

		function updateFromCurrent(records = []) {
			// Prefer the most recently changed element, if two links momentarily
			// carry w--current during a handover. Otherwise use the current link
			// already in the DOM.
			const changedCurrent = Array.from(records)
				.reverse()
				.map((record) => record.target)
				.find((target) => target.matches?.(CURRENT_SELECTOR));
			const current =
				changedCurrent ||
				list.querySelector(CURRENT_SELECTOR) ||
				lastActiveLink ||
				list.querySelector(LINK_SELECTOR);

			// Default to the first link, then preserve the earlier values during gaps.
			if (!current) return;
			positionIndicator(current);
		}

		const mutationObserver = new MutationObserver(updateFromCurrent);
		mutationObserver.observe(list, {
			subtree: true,
			attributes: true,
			attributeFilter: ["class"],
		});

		// Responsive reflow and late-loading fonts can change a multi-line
		// link's height. This does not change its current class.
		if (typeof ResizeObserver !== "undefined") {
			const resizeObserver = new ResizeObserver(() => {
				if (lastActiveLink?.isConnected) positionIndicator(lastActiveLink);
				else updateFromCurrent();
			});
			resizeObserver.observe(list);
			qsa(list, LINK_SELECTOR).forEach((link) => resizeObserver.observe(link));
		}

		updateFromCurrent();
	}
	qsa(root, LIST_SELECTOR).forEach(setupInsightsToc);
}
