import { loadDataPage } from "../data-page.js";

// A work card prints one service, from its single "service on card" field; the
// case study lists them all. /dev/data lists each case study's services
// ([data-work-slug] items holding [data-work-service] items), and this adds the
// ones a card is missing after its own tag, which stays first. Each added tag
// is a copy of that tag, marked [data-work-tag] for the fade in the "Global —
// motion" embed. Without the data a card keeps its one tag.

const CARD = ".work-item_component";
const TAG = ".tagline-m";
const DONE = "data-work-tags";
const ADDED = "data-work-tag";

export function initWorkTags(root = document, { signal } = {}) {
	if (!root.querySelector(CARD)) return;

	let services = null;

	const fill = () => {
		if (!services) return;

		for (const card of root.querySelectorAll(`${CARD}:not([${DONE}])`)) addTags(card, services);
	};

	// Not awaited, like cms-counts: the data must not hold up the other modules.
	loadDataPage().then((doc) => {
		if (!doc) return;

		services = readServices(doc);
		fill();
	});

	// A Finsweet list renders its cards again on filter. Its own hook is not
	// used: the router restarts Finsweet after each page change, which replaces
	// the list a hook was added to. Only the list's own children are watched,
	// so the tags added here do not trigger it.
	for (const list of root.querySelectorAll('[fs-list-element="list"]')) {
		const observer = new MutationObserver(fill);

		observer.observe(list, { childList: true });
		signal?.addEventListener("abort", () => observer.disconnect());
	}
}

function readServices(doc) {
	const bySlug = new Map();

	for (const item of doc.querySelectorAll("[data-work-slug]")) {
		const names = [...item.querySelectorAll("[data-work-service]")]
			.map((service) => service.getAttribute("data-work-service").trim())
			.filter(Boolean);

		bySlug.set(item.getAttribute("data-work-slug").trim(), names);
	}

	return bySlug;
}

// The card's link is /work/<slug>.
function slugOf(card) {
	const href = card.querySelector(".work-item_link")?.getAttribute("href") || "";

	return href.split(/[?#]/)[0].split("/").filter(Boolean).pop();
}

function addTags(card, bySlug) {
	const names = bySlug.get(slugOf(card));
	const tags = [...card.querySelectorAll(TAG)];

	if (!names || !tags.length) return;

	const shown = new Set(tags.map((tag) => tag.textContent.trim()));
	let last = tags.at(-1);

	for (const name of names) {
		if (shown.has(name)) continue;

		const tag = tags[0].cloneNode(false);

		tag.textContent = name;
		tag.setAttribute(ADDED, "");
		last.after(tag);
		last = tag;
		shown.add(name);
	}

	card.setAttribute(DONE, "");
}
