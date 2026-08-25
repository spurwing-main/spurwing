const config = {
	endpoint: "/dev/data",
	targetSelector: "[data-cms-count-target]",
	sourceAttr: "data-cms-count",
	okAttrPrefix: "data-cms-count-ok-",
	allOkAttr: "data-cms-count-ok",
	preloadEnabled: true,
};

const cssEscape = window.CSS?.escape || ((v) => v);

const preload = config.preloadEnabled ? startFetchText(config.endpoint) : null;

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
	const list = doc.querySelector(`[${config.sourceAttr}="${cssEscape(key)}"]`);
	return list ? list.children.length : null;
}

async function hydrateCounts() {
	const targets = [...document.querySelectorAll(config.targetSelector)];
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
			document.documentElement.setAttribute(config.allOkAttr, "1");
		}
	});
}

const run = () => {
	hydrateCounts().catch(() => {});
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", run, { once: true });
} else {
	run();
}
