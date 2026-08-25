document.addEventListener("DOMContentLoaded", () => {
	const root = document.querySelector(".section_work-archive");

	if (!root) {
		throw new Error('Work archive root ".section_work-archive" not found.');
	}

	const filters = root.querySelector('[fs-list-element="filters"]');
	const list = root.querySelector('[fs-list-element="list"]');
	const clear = filters?.querySelector('[fs-list-element="clear"]');

	if (!filters) {
		throw new Error('Finsweet filters element "[fs-list-element=filters]" not found.');
	}

	if (!list) {
		throw new Error('Finsweet list element "[fs-list-element=list]" not found.');
	}

	if (!clear) {
		throw new Error('Finsweet clear element "[fs-list-element=clear]" not found.');
	}

	const fieldSelector = 'input[fs-list-field="sector"]';
	const itemTagSelector = '.work-archive_card [fs-list-field="sector"].tag';
	const activeClass = "is-list-active";

	let syncFrame = 0;
	let releaseTimer = 0;
	let wasCheckedBeforeClick = false;

	const getText = (element) => {
		return element.textContent.trim();
	};

	const getActiveValue = () => {
		const checkedInput = filters.querySelector(`${fieldSelector}:checked`);
		return checkedInput?.getAttribute("fs-list-value") || "";
	};

	const getInputByValue = (value) => {
		return [...filters.querySelectorAll(fieldSelector)].find((input) => {
			return input.getAttribute("fs-list-value") === value;
		});
	};

	const getClickedFilterInput = (event) => {
		const target = event.target;

		if (!(target instanceof Element)) {
			return null;
		}

		if (target.matches(fieldSelector)) {
			return target;
		}

		const tag = target.closest(".tag");

		if (!tag || !filters.contains(tag)) {
			return null;
		}

		return tag.querySelector(fieldSelector);
	};

	const lockSectionHeight = () => {
		clearTimeout(releaseTimer);

		const height = root.getBoundingClientRect().height;
		root.style.minHeight = `${height}px`;
	};

	const releaseSectionHeight = () => {
		clearTimeout(releaseTimer);

		releaseTimer = window.setTimeout(() => {
			root.style.minHeight = "";
		}, 900);
	};

	const emitInputChange = (input) => {
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	};

	const syncActiveTags = () => {
		cancelAnimationFrame(syncFrame);

		syncFrame = requestAnimationFrame(() => {
			const activeValue = getActiveValue();

			list.querySelectorAll(itemTagSelector).forEach((tag) => {
				tag.classList.toggle(activeClass, getText(tag) === activeValue);
			});
		});
	};

	const clearFilter = () => {
		lockSectionHeight();
		clear.click();
		syncActiveTags();
		releaseSectionHeight();
	};

	const setFilter = (value) => {
		if (!value) return;

		if (value === getActiveValue()) {
			clearFilter();
			return;
		}

		const input = getInputByValue(value);

		if (!input) {
			throw new Error(`No sector filter found for "${value}".`);
		}

		lockSectionHeight();

		input.checked = true;
		emitInputChange(input);

		syncActiveTags();
		releaseSectionHeight();
	};

	const prepareItemTags = () => {
		list.querySelectorAll(itemTagSelector).forEach((tag) => {
			if (tag.dataset.itemTagReady === "true") return;

			tag.dataset.itemTagReady = "true";
			tag.setAttribute("role", "button");
			tag.setAttribute("tabindex", "0");

			tag.addEventListener("click", () => {
				setFilter(getText(tag));
			});

			tag.addEventListener("keydown", (event) => {
				if (event.key !== "Enter" && event.key !== " ") return;

				event.preventDefault();
				setFilter(getText(tag));
			});
		});

		syncActiveTags();
	};

	filters.addEventListener(
		"pointerdown",
		(event) => {
			const input = getClickedFilterInput(event);
			wasCheckedBeforeClick = Boolean(input?.checked);
		},
		true,
	);

	filters.addEventListener(
		"click",
		(event) => {
			const input = getClickedFilterInput(event);

			if (!input) {
				lockSectionHeight();
				syncActiveTags();
				releaseSectionHeight();
				return;
			}

			if (!wasCheckedBeforeClick) {
				lockSectionHeight();
				syncActiveTags();
				releaseSectionHeight();
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			clearFilter();
		},
		true,
	);

	filters.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;

		const input = getClickedFilterInput(event);

		if (!input || !input.checked) return;

		event.preventDefault();
		clearFilter();
	});

	filters.addEventListener("input", syncActiveTags);
	filters.addEventListener("change", syncActiveTags);

	prepareItemTags();

	const observer = new MutationObserver(() => {
		prepareItemTags();
		releaseSectionHeight();
	});

	observer.observe(list, {
		childList: true,
		subtree: true,
	});
});
