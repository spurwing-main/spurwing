const config = {
	endpoint: "/dev/data",
	targetSelector: "[data-cms-count-target]",
	sourceAttr: "data-cms-count",
	allOkAttr: "data-cms-count-ok",
	preloadEnabled: true,
};

function startFetchText(url) {
	const controller = new AbortController();
	const promise = fetch(url, {
		method: "GET",
		credentials: "same-origin",
		cache: "force-cache",
		headers: { Accept: "text/html" },
		signal: controller.signal,
	})
		.then((res) => (res.ok ? res.text() : null))
		.catch(() => null);

	return { promise, abort: () => controller.abort() };
}

function parseDoc(htmlText) {
	if (!htmlText) return null;
	const doc = new DOMParser().parseFromString(htmlText, "text/html");
	return doc?.documentElement ? doc : null;
}

function countDirectChildren(doc, key) {
	if (!doc || !key) return null;
	const cssEscape = window.CSS?.escape || ((value) => value);
	const list = doc.querySelector(`[${config.sourceAttr}="${cssEscape(key)}"]`);
	return list ? list.children.length : null;
}

async function hydrateCounts(root, preload) {
	const targets = [...root.querySelectorAll(config.targetSelector)];
	if (!targets.length) return;

	const htmlText = preload ? await preload.promise : await startFetchText(config.endpoint).promise;

	const doc = parseDoc(htmlText);
	if (!doc) return;

	requestAnimationFrame(() => {
		let didUpdate = false;

		for (const el of targets) {
			const key = (el.getAttribute("data-cms-count-target") || "").trim();
			const count = countDirectChildren(doc, key);

			if (count !== null) {
				el.textContent = String(count);
				didUpdate = true;
			}
		}

		if (didUpdate) {
			root.documentElement?.setAttribute(config.allOkAttr, "1");
		}
	});
}

export function initDataLoader(root = document) {
	const targets = root.querySelectorAll(config.targetSelector);
	if (!targets.length) return;

	// No sentinel on documentElement: it would survive a page transition and stop
	// the next page's counts ever loading. boot.js runs each module once a page,
	// and the response is served from the HTTP cache on a repeat visit.
	const preload = config.preloadEnabled ? startFetchText(config.endpoint) : null;
	hydrateCounts(root, preload).catch(() => {});
}
