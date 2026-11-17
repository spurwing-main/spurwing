// /dev/data is a hidden page of Collection Lists that the site reads as data:
// item counts (cms-counts.js) and each case study's services (tag-slots.js).
// It is requested and parsed once per page view, however many modules ask.
// Resolves to the parsed document, or null when it cannot be had.

const endpoint = "/dev/data";

let request = null;

export function loadDataPage() {
	request ??= fetchDataPage();

	return request;
}

// A new page is a new page view. This listener is added when the bundle loads,
// before src/index.js adds the one that restarts the modules, so it runs first.
export function forgetDataPage() {
	request = null;
}

document.addEventListener("spw:page", forgetDataPage);

async function fetchDataPage() {
	try {
		const response = await fetch(endpoint, {
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
