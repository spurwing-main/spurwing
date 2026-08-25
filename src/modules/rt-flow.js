function initRtflow() {
	document.querySelectorAll('[data-rt-el="list"]').forEach((container) => {
		if (container.dataset.rtflowDone) return;

		const source = container.querySelector('[data-rt-el="source"]');
		const template = container.querySelector('[data-rt-el="item"]');
		const maxItems = getRtflowMaxItems(container);

		if (!source) {
			throw new Error("Rtflow source not found.");
		}

		if (!template) {
			throw new Error("Rtflow item template not found.");
		}

		const targets = Array.from(template.querySelectorAll("[data-rt-el]")).filter((target) => {
			return target.getAttribute("data-rt-el") !== "item";
		});

		if (!targets.length) {
			throw new Error("Rtflow item template has no data-rt-el targets.");
		}

		const sourceItems = Array.from(source.childNodes)
			.map((node) => getRtflowNodeData(node))
			.filter(Boolean);

		const items =
			targets.length === 1
				? sourceItems.map((item) => ({
						[targets[0].getAttribute("data-rt-el")]: item.text,
					}))
				: getRtflowPairs(sourceItems);

		const limitedItems = maxItems ? items.slice(0, maxItems) : items;

		if (!limitedItems.length) {
			container.style.display = "none";
			return;
		}

		const fragment = document.createDocumentFragment();

		limitedItems.forEach((item) => {
			const clone = template.cloneNode(true);
			clone.removeAttribute("data-rt-el");

			clone.querySelectorAll("[data-rt-el]").forEach((target) => {
				const key = target.getAttribute("data-rt-el");

				if (item[key] !== undefined) {
					target.textContent = item[key];
				}
			});

			fragment.appendChild(clone);
		});

		template.remove();
		source.style.display = "none";
		container.appendChild(fragment);
		container.dataset.rtflowDone = "true";
	});
}

function getRtflowMaxItems(container) {
	const value = container.getAttribute("data-rt-max");

	if (!value) {
		return null;
	}

	const maxItems = Number(value);

	if (!Number.isInteger(maxItems) || maxItems < 1) {
		throw new Error("Rtflow data-rt-max must be a positive whole number.");
	}

	return maxItems;
}

function getRtflowNodeData(node) {
	if (node.nodeType === Node.TEXT_NODE) {
		const text = node.textContent.trim();

		return text ? { key: "p", text } : null;
	}

	if (node.nodeType !== Node.ELEMENT_NODE) {
		return null;
	}

	const text = node.textContent.trim();

	if (!text) {
		return null;
	}

	if (node.tagName === "EM") {
		return { key: "em", text };
	}

	const directEm = node.querySelector(":scope > em");

	if (directEm) {
		return { key: "em", text: directEm.textContent.trim() };
	}

	return { key: node.tagName.toLowerCase(), text };
}

function getRtflowPairs(sourceItems) {
	const items = [];
	let currentItem = {};

	sourceItems.forEach((sourceItem) => {
		if (currentItem[sourceItem.key] !== undefined) {
			items.push(currentItem);
			currentItem = {};
		}

		currentItem[sourceItem.key] = sourceItem.text;

		if (currentItem.em !== undefined && currentItem.p !== undefined) {
			items.push(currentItem);
			currentItem = {};
		}
	});

	if (Object.keys(currentItem).length) {
		items.push(currentItem);
	}

	return items;
}

document.addEventListener("DOMContentLoaded", initRtflow);
window.addEventListener("load", initRtflow);
