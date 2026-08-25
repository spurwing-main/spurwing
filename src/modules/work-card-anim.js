const config = {
	inAttr: "data-in-viewport",
	disabledAttr: "data-reveal-disabled",

	// observe THESE for viewport entry
	itemSelectors: [".work_list-item", ".team_item"],

	// set --stagger on THESE (or their inner targets)
	staggerGroups: [
		{
			containerSel: ".work-list_list",
			itemSel: ":scope > .work_list-item",
			applyToSel: ".work-item_component",
			cols: 1,
		},
		{
			containerSel: ".team_grid",
			itemSel: ":scope > .team_item",
			applyToSel: ":scope",
			cols: "auto",
		},
	],

	staggerStepMs: 70,
	staggerMaxMs: 260,

	threshold: 0.05,
	rootMargin: "0px 0px -5% 0px",
};

const canReduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const onReady = (fn) => {
	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", fn, { once: true });
	else fn();
};

onReady(() => {
	if (canReduce) {
		document.querySelectorAll(".work-item_component, .team_item").forEach((element) => {
			element.setAttribute(config.disabledAttr, "");
		});

		return;
	}

	const matchesAny = (el, selectors) => selectors.some((sel) => el.matches(sel));
	const isDisabled = (el) => el.hasAttribute(config.disabledAttr);
	const clampMs = (ms) => `${Math.min(ms, config.staggerMaxMs)}ms`;

	const computeCols = (items) => {
		if (items.length < 2) return 1;
		const firstTop = items[0].offsetTop;

		let cols = 0;
		for (const it of items) {
			if (it.offsetTop !== firstTop) break;
			cols += 1;
		}
		return Math.max(1, cols);
	};

	const applyStagger = () => {
		for (const group of config.staggerGroups) {
			const containers = document.querySelectorAll(group.containerSel);
			for (const container of containers) {
				const items = Array.from(container.querySelectorAll(group.itemSel)).filter(
					(item) => !isDisabled(item),
				);
				if (!items.length) continue;

				const cols =
					group.cols === "auto"
						? computeCols(items)
						: typeof group.cols === "number" && group.cols > 0
							? group.cols
							: computeCols(items);

				for (let i = 0; i < items.length; i++) {
					const item = items[i];
					const row = Math.floor(i / cols);
					const col = i % cols;

					const order = row * cols + col;
					const delay = clampMs(order * config.staggerStepMs);

					const applyTo =
						group.applyToSel === ":scope" ? item : item.querySelector(group.applyToSel);

					if (!applyTo) {
						throw new Error(
							`stagger: missing applyToSel "${group.applyToSel}" inside an item in "${group.containerSel}"`,
						);
					}

					applyTo.style.setProperty("--stagger", delay);
				}
			}
		}
	};

	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.setAttribute(config.inAttr, "");
				io.unobserve(entry.target);
			}
		},
		{ threshold: config.threshold, rootMargin: config.rootMargin },
	);

	const observeItem = (el) => {
		if (!matchesAny(el, config.itemSelectors)) return;
		if (isDisabled(el)) return;
		if (el.hasAttribute(config.inAttr)) return;
		io.observe(el);
	};

	const observeAllNow = () => {
		applyStagger();
		for (const sel of config.itemSelectors) {
			for (const el of document.querySelectorAll(sel)) observeItem(el);
		}
	};

	observeAllNow();

	let resizeRaf = 0;
	addEventListener("resize", () => {
		cancelAnimationFrame(resizeRaf);
		resizeRaf = requestAnimationFrame(applyStagger);
	});
});
