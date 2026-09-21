// An editor writes a list as one Rich Text block; this reshapes it into the
// Designer's own item template, so the styling lives in Webflow rather than here.

export function initRtFlow(root = document) {
	root.querySelectorAll('[data-rt-el="list"]').forEach((container) => {
		// Building consumes the source and the template, so a second run would
		// read its own output.
		if (container.dataset.rtFlowBuilt) return;

		const source = container.querySelector('[data-rt-el="source"]');
		const template = container.querySelector('[data-rt-el="item"]');
		const maxItems = readMaxItems(container);

		if (!source) {
			throw new Error('missing rich text source: expected [data-rt-el="source"]');
		}

		if (!template) {
			throw new Error('missing item template: expected [data-rt-el="item"]');
		}

		const targets = Array.from(template.querySelectorAll("[data-rt-el]")).filter((target) => {
			return target.getAttribute("data-rt-el") !== "item";
		});

		if (!targets.length) {
			throw new Error("item template has no [data-rt-el] targets");
		}

		const sourceItems = Array.from(source.childNodes)
			.map((node) => readNode(node))
			.filter(Boolean);

		const items =
			targets.length === 1
				? sourceItems.map((item) => ({
						[targets[0].getAttribute("data-rt-el")]: item.text,
					}))
				: pairUp(sourceItems);

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

				// A slot the source has nothing for is removed, not left alone. Left
				// alone it kept the template's own text, so an item written without
				// its italic line published the Designer's placeholder copy.
				if (item[key] === undefined) target.remove();
				else target.textContent = item[key];
			});

			fragment.appendChild(clone);
		});

		template.remove();
		source.style.display = "none";
		container.appendChild(fragment);
		container.dataset.rtFlowBuilt = "true";
	});
}

function readMaxItems(container) {
	const value = container.getAttribute("data-rt-max");

	if (!value) {
		return null;
	}

	const maxItems = Number(value);

	if (!Number.isInteger(maxItems) || maxItems < 1) {
		throw new Error("data-rt-max must be a positive whole number");
	}

	return maxItems;
}

function readNode(node) {
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

function pairUp(sourceItems) {
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
