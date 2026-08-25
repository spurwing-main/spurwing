export function initFaq(root = document) {
	const component = root.querySelector('[data-accordion="component"]');
	if (!component) return;

	if (!window.gsap) {
		throw new Error("GSAP is required for the FAQ accordion.");
	}
	const { gsap } = window;

	if (component.dataset.accordionBound === "true") return;
	component.dataset.accordionBound = "true";

	const FAQ_EASE = "expo.inOut";
	const FAQ_DURATION = 0.8;

	const list = component.querySelector('[fs-list-element="list"]') || component;
	const items = new WeakMap();
	const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	let resizeFrame = null;

	setupFaqItems();
	bindClicks();
	observeList();

	window.addEventListener("resize", requestOpenItemRefresh);

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

		gsap.set(icon, {
			rotate: isOpen ? 180 : 0,
			transformOrigin: "50% 50%",
			willChange: "transform",
		});

		gsap.set(verticalLine, {
			opacity: isOpen ? 0 : 1,
			transformOrigin: "50% 50%",
			willChange: "opacity",
		});

		items.set(item, {
			trigger,
			content,
			icon,
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
			gsap.set(entry.icon, { rotate: 180 });
			gsap.set(entry.verticalLine, { opacity: 0 });
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
				duration: FAQ_DURATION,
				ease: FAQ_EASE,
			},
			0,
		);

		entry.tl.to(
			entry.icon,
			{
				rotate: 180,
				duration: FAQ_DURATION,
				ease: FAQ_EASE,
			},
			0,
		);

		entry.tl.to(
			entry.verticalLine,
			{
				opacity: 0,
				duration: FAQ_DURATION,
				ease: FAQ_EASE,
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
			gsap.set(entry.icon, { rotate: 0 });
			gsap.set(entry.verticalLine, { opacity: 1 });
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
				duration: FAQ_DURATION,
				ease: FAQ_EASE,
			},
			0,
		);

		entry.tl.to(
			entry.icon,
			{
				rotate: 0,
				duration: FAQ_DURATION,
				ease: FAQ_EASE,
			},
			0,
		);

		entry.tl.to(
			entry.verticalLine,
			{
				opacity: 1,
				duration: FAQ_DURATION,
				ease: FAQ_EASE,
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

	function observeList() {
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
	}
}
