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
	fillIn(targets).catch(() => {});
}

async function fillIn(targets) {
	const source = await fetchSource();

	if (!source) return;

	let filled = false;

	for (const target of targets) {
		const key = target.getAttribute(cmsCountsConfig.targetAttr).trim();
		const list = key && source.querySelector(`[${cmsCountsConfig.sourceAttr}="${cssEscape(key)}"]`);

		if (!list) continue;

		target.textContent = String(list.children.length);
		filled = true;
	}

	if (filled) document.documentElement.setAttribute(cmsCountsConfig.doneAttr, "1");
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
