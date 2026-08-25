if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initFaq);
} else {
	initFaq();
}

function initFaq() {
	const section = document.querySelector(".section_faq");
	if (!section) return;

	if (!window.gsap) {
		throw new Error("GSAP is required for the FAQ accordion.");
	}

	if (section.dataset.faqBound === "true") return;
	section.dataset.faqBound = "true";

	const FAQ_EASE = "expo.inOut";
	const FAQ_DURATION = 0.8;

	const list = section.querySelector('[fs-list-element="list"]') || section;
	const items = new WeakMap();
	const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	let resizeFrame = null;

	setupFaqItems();
	bindClicks();
	observeList();

	window.addEventListener("resize", requestOpenItemRefresh);

	function setupFaqItems(root = list) {
		root.querySelectorAll(".faq_item").forEach(setupFaqItem);
	}

	function setupFaqItem(item) {
		if (items.has(item)) return;

		const head = item.querySelector(".faq_item-head");
		const panel = item.querySelector(".faq_item-panel");
		const inner = item.querySelector(".faq_item-panel-inner");
		const icon = item.querySelector(".faq_item-svg");
		const lines = icon ? icon.querySelectorAll("rect") : [];
		const verticalLine = lines[1];

		if (!head || !panel || !inner || !icon || !verticalLine) {
			throw new Error(
				"FAQ item is missing .faq_item-head, .faq_item-panel, .faq_item-panel-inner, .faq_item-svg, or the second SVG rect.",
			);
		}

		const isOpen =
			item.classList.contains("is-open") ||
			item.dataset.faqOpen === "true" ||
			head.getAttribute("aria-expanded") === "true";

		item.dataset.faqOpen = isOpen ? "true" : "false";
		head.setAttribute("aria-expanded", isOpen ? "true" : "false");
		item.classList.toggle("is-open", isOpen);

		gsap.set(panel, {
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
			head,
			panel,
			inner,
			icon,
			verticalLine,
			tl: null,
		});
	}

	function bindClicks() {
		section.addEventListener("click", function (event) {
			const head = event.target.closest(".faq_item-head");
			if (!head || !section.contains(head)) return;

			const item = head.closest(".faq_item");
			if (!item) {
				throw new Error("Clicked .faq_item-head has no parent .faq_item.");
			}

			toggleItem(item);
		});
	}

	function toggleItem(item) {
		if (item.dataset.faqOpen === "true") {
			closeItem(item);
			return;
		}

		closeSiblingItems(item);
		openItem(item);
	}

	function closeSiblingItems(currentItem) {
		list.querySelectorAll(".faq_item").forEach(function (item) {
			if (item !== currentItem && item.dataset.faqOpen === "true") {
				closeItem(item);
			}
		});
	}

	function openItem(item) {
		const entry = items.get(item);
		if (!entry) return;

		killTimeline(entry);

		item.dataset.faqOpen = "true";
		item.classList.add("is-open");
		entry.head.setAttribute("aria-expanded", "true");

		if (shouldReduceMotion) {
			gsap.set(entry.panel, { height: "auto", overflow: "hidden" });
			gsap.set(entry.icon, { rotate: 180 });
			gsap.set(entry.verticalLine, { opacity: 0 });
			return;
		}

		const currentHeight = entry.panel.offsetHeight;
		const targetHeight = entry.inner.scrollHeight;

		gsap.set(entry.panel, {
			height: currentHeight,
			overflow: "hidden",
		});

		entry.tl = gsap.timeline({
			defaults: { overwrite: "auto" },
			onComplete: function () {
				gsap.set(entry.panel, { height: "auto" });
				entry.tl = null;
			},
		});

		entry.tl.to(
			entry.panel,
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

		item.dataset.faqOpen = "false";
		item.classList.remove("is-open");
		entry.head.setAttribute("aria-expanded", "false");

		if (shouldReduceMotion) {
			gsap.set(entry.panel, { height: 0, overflow: "hidden" });
			gsap.set(entry.icon, { rotate: 0 });
			gsap.set(entry.verticalLine, { opacity: 1 });
			return;
		}

		gsap.set(entry.panel, {
			height: entry.panel.offsetHeight,
			overflow: "hidden",
		});

		entry.tl = gsap.timeline({
			defaults: { overwrite: "auto" },
			onComplete: function () {
				gsap.set(entry.panel, { height: 0 });
				entry.tl = null;
			},
		});

		entry.tl.to(
			entry.panel,
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
		list.querySelectorAll('.faq_item[data-faq-open="true"]').forEach(function (item) {
			const entry = items.get(item);
			if (!entry) return;
			gsap.set(entry.panel, { height: "auto" });
		});
	}

	function observeList() {
		const observer = new MutationObserver(function (mutations) {
			mutations.forEach(function (mutation) {
				mutation.addedNodes.forEach(function (node) {
					if (!(node instanceof Element)) return;
					if (node.matches(".faq_item")) setupFaqItem(node);
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
