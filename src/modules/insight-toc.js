// The Insights contents list: ids, links, the active section and its indicator.
//
// Built here rather than by Finsweet because the ids were the whole problem.
// Section ids do not exist in the published HTML — they are slugified from the
// headings at runtime — and the browser resolves the fragment in a shared URL
// while the page is still parsing. A script that assigns ids after that has
// already lost the race, so a link to a section landed at the top of the
// article for one reader and on the section for the next. Owning it means the
// ids exist before anything needs them and honouring the fragment is this
// module's job rather than a matter of timing.
//
// It is also less code than working around the library was. The old version
// watched Finsweet's `w--current` class through a MutationObserver and kept its
// own copy of the active link, because that class disappears for a moment while
// the reader scrolls between sections. A module that decides which section is
// active can simply say so.

const insightTocConfig = {
	// The lead-in is a separate rich text block above the article and its
	// heading is not a section.
	bodySelector: ".insights-item-main_body .rich-text:not(.is-insights-leadin)",
	listSelector: ".insights-item-sidebar_links",
	itemSelector: ".insights-item-sidebar_link-wrap",
	linkSelector: ".insights-item-sidebar_link",
	headingSelector: "h2",
	currentAttribute: "data-insights-toc-current",
	// Where in the viewport a section counts as the one being read.
	readingLine: 0.3,
};

export function initInsightToc(root = document, { signal } = {}) {
	const list = root.querySelector(insightTocConfig.listSelector);
	const body = root.querySelector(insightTocConfig.bodySelector);

	if (!list || !body) return;

	// The Designer holds one item as the template for the generated links. It is
	// taken out of the list and cloned per heading, so the markup stays a
	// designed thing rather than a string in here.
	const template = list.querySelector(insightTocConfig.itemSelector);

	if (!template) return;

	template.remove();

	// Ids already in use on THIS page. Read from the whole document, it also saw
	// the outgoing article during a transition: two articles sharing a "Summary"
	// heading gave the second one `summary-2`, so a contents link copied from it
	// was dead the moment the old page was removed.
	const page = list.closest("[data-pt-container]") ?? root;
	const used = new Set([...page.querySelectorAll("[id]")].map((element) => element.id));

	for (const heading of body.querySelectorAll(insightTocConfig.headingSelector)) {
		if (!heading.id) heading.id = uniqueId(slug(heading.textContent), used);

		used.add(heading.id);

		const item = template.cloneNode(true);
		const link = item.querySelector(insightTocConfig.linkSelector) || item;

		link.setAttribute("href", `#${heading.id}`);
		link.textContent = heading.textContent.trim();
		list.append(item);
	}

	// Every link in the list, including any the Designer authored — the opening
	// "Intro" is one of those, and it should take its turn like the rest.
	const links = [...list.querySelectorAll(`a[href^="#"]`)]
		.map((link) => ({ link, target: document.getElementById(link.hash.slice(1)) }))
		.filter((pair) => pair.target);

	if (!links.length) return;

	/* --- the fragment ---------------------------------------------------- */

	// The ids exist now. If the reader arrived on one and the browser could not
	// act on it, act on it here — but only while they are still at the top,
	// because pulling the page out from under someone who has started reading is
	// worse than the link not working. scroll-behavior is smooth site-wide and a
	// shared link should land rather than tour the article on the way.
	const arrived = links.find((pair) => `#${pair.target.id}` === location.hash);

	if (arrived && window.scrollY < 2) {
		const previous = document.documentElement.style.scrollBehavior;

		document.documentElement.style.scrollBehavior = "auto";
		arrived.target.scrollIntoView({ block: "start" });
		document.documentElement.style.scrollBehavior = previous;
	}

	/* --- the active section ------------------------------------------------ */

	let current = null;
	let frame = 0;

	function update() {
		frame = 0;

		const line = window.innerHeight * insightTocConfig.readingLine;
		const bottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
		// Past the reading line, the last one wins. At the very bottom the final
		// section can be too short to ever reach that line, so it is given.
		const active = bottom
			? links[links.length - 1]
			: links.filter((pair) => pair.target.getBoundingClientRect().top <= line).pop() || links[0];

		if (active === current) return;

		current = active;

		for (const pair of links) {
			pair.link.toggleAttribute(insightTocConfig.currentAttribute, pair === active);
		}

		position(list, active.link);
	}

	const schedule = () => {
		frame ||= requestAnimationFrame(update);
	};

	window.addEventListener("scroll", schedule, { passive: true, signal });
	window.addEventListener("resize", schedule, { passive: true, signal });
	signal?.addEventListener("abort", () => cancelAnimationFrame(frame));

	// A link that wraps onto a second line changes height when the fonts land.
	if (typeof ResizeObserver !== "undefined") {
		const observer = new ResizeObserver(() => {
			if (current) position(list, current.link);
		});

		observer.observe(list);
		signal?.addEventListener("abort", () => observer.disconnect());
	}

	update();
}

// The indicator is the list's ::before, so this supplies its two runtime values.
function position(list, link) {
	const listBox = list.getBoundingClientRect();
	const linkBox = link.getBoundingClientRect();

	list.style.setProperty("--insights-toc-t", `${linkBox.top - listBox.top - list.clientTop + list.scrollTop}px`);
	list.style.setProperty("--insights-toc-h", `${linkBox.height}px`);
}

function slug(text) {
	return (
		text
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "section"
	);
}

// Two headings can say the same thing. The first keeps the clean id so the
// links already shared to it stay pointing at the same place.
function uniqueId(base, used) {
	if (!used.has(base)) return base;

	let n = 2;

	while (used.has(`${base}-${n}`)) n += 1;

	return `${base}-${n}`;
}
