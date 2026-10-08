import { animate, inView } from "motion";

import { claimOnce } from "../dom.js";

/**
 * A row of client logos where each column cycles through its own share of the
 * logos, one column after another.
 *
 *   <div data-client-logos>
 *     <div data-client-logos-list>
 *       <div><img></div> × n (the Logos slot, one Client logo each)
 *     </div>
 *   </div>
 *
 * Each logo is sized to the same area as the others, so a long wordmark runs
 * wide and low and a compact mark stands taller. CSS does the sizing from
 * --logo-ratio, the logo's width over its height, which this writes once the
 * image has loaded. That only works for a logo cropped to its edges.
 *
 * The Designer sets how many columns show — four on desktop, two on a phone —
 * on the list's grid, and lets every row after the first collapse to nothing,
 * so the page paints the first logos in place before this runs. This counts
 * the columns from that grid and the logos from the list, so any number of
 * logos works: logo n goes to column n mod columns, and a column with one logo
 * stays still. All the logos stay in the list for a screen reader; the cycle
 * only changes which one each column shows.
 *
 * The cycle pauses off screen. Reduced motion keeps the first row still.
 */

const config = {
	// How long each logo shows, and how far apart the columns change.
	step: 5000,
	stagger: 0.2,
	duration: 0.6,
	ease: [0.28, 0.44, 0.49, 1],
	// The outgoing logo rises out of its column as the next one rises into it.
	out: { opacity: 0, y: "-60%", scale: 0.75, filter: "blur(6px)" },
	in: { opacity: [0, 1], y: ["60%", "0%"], scale: [0.75, 1], filter: ["blur(6px)", "blur(0px)"] },
};

export function initClientLogos(root = document, { signal } = {}) {
	for (const logos of root.querySelectorAll("[data-client-logos]")) {
		if (!claimOnce(logos, "data-client-logos-claimed")) continue;

		for (const img of logos.querySelectorAll("img")) measure(img, signal);

		const list = logos.querySelector("[data-client-logos-list]");

		if (list?.children.length) run(logos, list, signal);
	}
}

// The CSS sizes the logo from its shape, which is only known once it loads.
function measure(img, signal) {
	const write = () => {
		if (img.naturalWidth && img.naturalHeight) img.style.setProperty("--logo-ratio", (img.naturalWidth / img.naturalHeight).toFixed(3));
	};

	if (img.complete) write();
	else img.addEventListener("load", write, { once: true, signal });
}

function run(logos, list, signal) {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const items = [...list.children];

	let columns = 0;
	let shown = [];
	let timer = 0;
	let onScreen = false;
	const moving = new Set();

	// The grid's computed template lists one length per column, whatever the
	// Designer wrote, so its length is the column count at this width.
	const countColumns = () => getComputedStyle(list).gridTemplateColumns.split(" ").filter(Boolean).length;

	const column = (index) => items.filter((_, item) => item % columns === index);

	const layout = () => {
		for (const animation of moving) animation.stop();
		moving.clear();

		columns = countColumns();
		shown = Array.from({ length: columns }, () => 0);

		items.forEach((item, index) => {
			item.style.gridArea = `1 / ${(index % columns) + 1}`;
			item.style.opacity = index < columns ? "" : "0";
			item.style.transform = "";
			item.style.filter = "";
		});
	};

	const advance = () => {
		for (let index = 0; index < columns; index += 1) {
			const group = column(index);

			if (group.length < 2) continue;

			const current = group[shown[index]];
			shown[index] = (shown[index] + 1) % group.length;
			const next = group[shown[index]];
			const options = { duration: config.duration, ease: config.ease, delay: index * config.stagger };

			for (const animation of [animate(current, config.out, options), animate(next, config.in, options)]) {
				moving.add(animation);
				animation.finished.then(() => moving.delete(animation));
			}
		}
	};

	const running = () => onScreen && items.length > columns;

	const schedule = () => {
		clearTimeout(timer);

		if (!running()) return;

		timer = setTimeout(() => {
			advance();
			schedule();
		}, config.step);
	};

	layout();

	const stopWatching = inView(logos, () => {
		onScreen = true;
		schedule();

		return () => {
			onScreen = false;
			schedule();
		};
	});

	// The columns change at the Designer's breakpoints, and a logo laid out for
	// four columns sits in the wrong one at two.
	const resized = new ResizeObserver(() => {
		if (countColumns() === columns) return;

		layout();
		schedule();
	});

	resized.observe(list);

	signal?.addEventListener("abort", () => {
		clearTimeout(timer);
		for (const animation of moving) animation.stop();
		stopWatching();
		resized.disconnect();
	});
}
