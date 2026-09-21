// Webflow has no count of a Collection's items, so a hidden page lists each
// Collection and this counts the children of the matching list. Every
// [data-cms-count-target="x"] gets the count of [data-cms-count="x"].

const cmsCountsConfig = {
	endpoint: "/dev/data",
	targetAttr: "data-cms-count-target",
	sourceAttr: "data-cms-count",
	doneAttr: "data-cms-count-ok",
};

export function initCmsCounts(root = document) {
	const targets = [...root.querySelectorAll(`[${cmsCountsConfig.targetAttr}]`)];

	if (!targets.length) return;

	// Deliberately not awaited: a page's counts must not hold up its other
	// modules. No sentinel either — one on documentElement would survive a page
	// transition and stop the next page's counts ever loading, and boot.js
	// already runs each module once a page.
	//
	// The flag is set whatever happens. A count is hidden until it is right, so
	// the flag is the only thing that can ever show it: leaving it unset on a
	// failure means a blank where a number should be, for the whole visit. A
	// stale number from the Designer is a smaller wrong than no number at all.
	fillIn(targets)
		.catch(() => {})
		.finally(() => document.documentElement.setAttribute(cmsCountsConfig.doneAttr, "1"));
}

async function fillIn(targets) {
	const source = await fetchSource();

	if (!source) return;

	for (const target of targets) {
		const key = target.getAttribute(cmsCountsConfig.targetAttr).trim();
		const list = key && source.querySelector(`[${cmsCountsConfig.sourceAttr}="${cssEscape(key)}"]`);

		if (!list) continue;

		target.textContent = String(list.children.length);
	}
}

async function fetchSource() {
	try {
		const response = await fetch(cmsCountsConfig.endpoint, {
			credentials: "same-origin",
			cache: "force-cache",
			headers: { Accept: "text/html" },
		});

		if (!response.ok) return null;

		return new DOMParser().parseFromString(await response.text(), "text/html");
	} catch {
		return null;
	}
}

function cssEscape(value) {
	return window.CSS?.escape ? window.CSS.escape(value) : value;
}
