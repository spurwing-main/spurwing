import { loadDataPage } from "../data-page.js";

// A tag slot is an element with [data-tags-for="key"] placed straight after a
// tag, inside the row that holds the tags. /dev/data lists the tags for each key
// the same way: [data-tags-for="key"] holding [data-tag="name"] items. Each
// listed tag the row doesn't already show is added to the slot as a copy of the
// tag before it. The slot is display: contents in Webflow, so the copies sit in
// the same row; the "Global — motion" embed fades them in. Webflow decides
// which cards have a tag row at all. Without the data, nothing is added.

const SLOT = "[data-tags-for]";

export function initTagSlots(root = document, { signal } = {}) {
	if (!root.querySelector(SLOT)) return;

	let lists = null;

	const fill = () => {
		if (lists) for (const slot of root.querySelectorAll(SLOT)) fillSlot(slot, lists);
	};

	// Not awaited, like cms-counts: the data must not hold up the other modules.
	loadDataPage().then((doc) => {
		if (!doc) return;

		lists = readLists(doc);
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

function readLists(doc) {
	const lists = new Map();

	for (const item of doc.querySelectorAll(SLOT)) {
		const names = [...item.querySelectorAll("[data-tag]")].map((tag) => tag.getAttribute("data-tag").trim());

		lists.set(item.getAttribute("data-tags-for").trim(), names.filter(Boolean));
	}

	return lists;
}

function fillSlot(slot, lists) {
	const model = slot.previousElementSibling;
	const names = lists.get(slot.getAttribute("data-tags-for").trim());

	if (slot.childElementCount || !model || !names) return;

	const shown = new Set([...slot.parentElement.children].map((tag) => tag.textContent.trim()));

	for (const name of names) {
		if (shown.has(name)) continue;

		const tag = model.cloneNode(false);

		tag.textContent = name;
		slot.append(tag);
		shown.add(name);
	}
}
