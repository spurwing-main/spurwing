export function initFaq(root = document, { signal } = {}) {
	const component = root.querySelector('[data-accordion="component"]');
	if (!component) return;

	if (!window.gsap) {
		throw new Error("GSAP is required for the FAQ accordion.");
	}
	const { gsap } = window;

	// The reference Helena marked this against animates on the CSS `ease` curve:
	// a soft entry, then most of the travel by half way. None of GSAP's power
	// eases follow that shape, so it is expressed directly rather than guessed at.
	const ease = cubicBezierEase(0.25, 0.1, 0.25, 1);
	const duration = 0.4;

	const list = component.querySelector('[fs-list-element="list"]') || component;
	const items = new WeakMap();
	const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	let resizeFrame = null;

	// A page asks for its first answer to be showing on arrival by carrying
	// data-faq-open-first. The FAQ section is one Component on five pages, so
	// the page is the only place that can say it. Marked before setup, which
	// already knows how to render an item that starts open.
	if (document.querySelector("[data-faq-open-first]")) {
		const firstItem = list.querySelector('[data-accordion="item"]');
		if (firstItem) firstItem.dataset.accordionOpen = "true";
	}

	setupFaqItems();
	bindClicks();
	observeList(signal);

	window.addEventListener("resize", requestOpenItemRefresh, { signal });

	function setupFaqItems(root = list) {
		root.querySelectorAll('[data-accordion="item"]').forEach(setupFaqItem);
	}

	function setupFaqItem(item) {
		if (items.has(item)) return;

		const trigger = item.querySelector('[data-accordion="trigger"]');
		const content = item.querySelector('[data-accordion="content"]');
		const icon = item.querySelector('[data-accordion="icon"]');
		const lines = icon ? icon.querySelectorAll("rect") : [];
		const verticalLine = lines[1];

		if (!trigger || !content || !icon || !verticalLine) {
			throw new Error(
				'Accordion item is missing data-accordion="trigger", data-accordion="content", data-accordion="icon", or the icon\'s second SVG rect.',
			);
		}

		const isOpen =
			item.classList.contains("is-open") ||
			item.dataset.accordionOpen === "true" ||
			trigger.getAttribute("aria-expanded") === "true";

		item.dataset.accordionOpen = isOpen ? "true" : "false";
		trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
		item.classList.toggle("is-open", isOpen);

		gsap.set(content, {
			height: isOpen ? "auto" : 0,
			overflow: "hidden",
		});

		gsap.set(verticalLine, {
			rotate: isOpen ? 90 : 0,
			svgOrigin: "12 12",
			willChange: "transform",
		});

		items.set(item, {
			trigger,
			content,
			verticalLine,
			tl: null,
		});
	}

	function bindClicks() {
		component.addEventListener("click", function (event) {
			const trigger = event.target.closest('[data-accordion="trigger"]');
			if (!trigger || !component.contains(trigger)) return;

			const item = trigger.closest('[data-accordion="item"]');
			if (!item) {
				throw new Error(
					'Clicked data-accordion="trigger" has no parent data-accordion="item".',
				);
			}

			toggleItem(item);
		});
	}

	function toggleItem(item) {
		if (item.dataset.accordionOpen === "true") {
			closeItem(item);
			return;
		}

		closeSiblingItems(item);
		openItem(item);
	}

	function closeSiblingItems(currentItem) {
		list.querySelectorAll('[data-accordion="item"]').forEach(function (item) {
			if (item !== currentItem && item.dataset.accordionOpen === "true") {
				closeItem(item);
			}
		});
	}

	function openItem(item) {
		const entry = items.get(item);
		if (!entry) return;

		killTimeline(entry);

		item.dataset.accordionOpen = "true";
		item.classList.add("is-open");
		entry.trigger.setAttribute("aria-expanded", "true");

		if (shouldReduceMotion) {
			gsap.set(entry.content, { height: "auto", overflow: "hidden" });
			gsap.set(entry.verticalLine, { rotate: 90 });
			return;
		}

		const currentHeight = entry.content.offsetHeight;
		const targetHeight = entry.content.scrollHeight;

		gsap.set(entry.content, {
			height: currentHeight,
			overflow: "hidden",
		});

		entry.tl = gsap.timeline({
			defaults: { overwrite: "auto" },
			onComplete: function () {
				gsap.set(entry.content, { height: "auto" });
				entry.tl = null;
			},
		});

		entry.tl.to(
			entry.content,
			{
				height: targetHeight,
				duration,
				ease,
			},
			0,
		);

		entry.tl.to(
			entry.verticalLine,
			{
				rotate: 90,
				duration,
				ease,
			},
			0,
		);
	}

	function closeItem(item) {
		const entry = items.get(item);
		if (!entry) return;

		killTimeline(entry);

		item.dataset.accordionOpen = "false";
		item.classList.remove("is-open");
		entry.trigger.setAttribute("aria-expanded", "false");

		if (shouldReduceMotion) {
			gsap.set(entry.content, { height: 0, overflow: "hidden" });
			gsap.set(entry.verticalLine, { rotate: 0 });
			return;
		}

		gsap.set(entry.content, {
			height: entry.content.offsetHeight,
			overflow: "hidden",
		});

		entry.tl = gsap.timeline({
			defaults: { overwrite: "auto" },
			onComplete: function () {
				gsap.set(entry.content, { height: 0 });
				entry.tl = null;
			},
		});

		entry.tl.to(
			entry.content,
			{
				height: 0,
				duration,
				ease,
			},
			0,
		);

		entry.tl.to(
			entry.verticalLine,
			{
				rotate: 0,
				duration,
				ease,
			},
			0,
		);
	}

	function killTimeline(entry) {
		if (!entry.tl) return;
		entry.tl.kill();
		entry.tl = null;
	}

	function requestOpenItemRefresh() {
		if (resizeFrame) return;

		resizeFrame = requestAnimationFrame(function () {
			resizeFrame = null;
			refreshOpenItems();
		});
	}

	function refreshOpenItems() {
		list
			.querySelectorAll('[data-accordion="item"][data-accordion-open="true"]')
			.forEach(function (item) {
				const entry = items.get(item);
				if (!entry) return;
				gsap.set(entry.content, { height: "auto" });
			});
	}

	function observeList(signal) {
		const observer = new MutationObserver(function (mutations) {
			mutations.forEach(function (mutation) {
				mutation.addedNodes.forEach(function (node) {
					if (!(node instanceof Element)) return;
					if (node.matches('[data-accordion="item"]')) setupFaqItem(node);
					setupFaqItems(node);
				});
			});

			refreshOpenItems();
		});

		observer.observe(list, {
			childList: true,
			subtree: true,
		});

		signal?.addEventListener("abort", () => observer.disconnect());
	}
}

// y for a given x on a CSS cubic-bezier, the shape a browser uses for
// transition-timing-function. x is solved by bisection, which is exact enough
// for a 0.4s tween and needs no plugin.
function cubicBezierEase(p1x, p1y, p2x, p2y) {
	const curve = (a, b, t) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;

	return (progress) => {
		let low = 0;
		let high = 1;

		for (let i = 0; i < 20; i += 1) {
			const middle = (low + high) / 2;

			if (curve(p1x, p2x, middle) < progress) low = middle;
			else high = middle;
		}

		return curve(p1y, p2y, (low + high) / 2);
	};
}
