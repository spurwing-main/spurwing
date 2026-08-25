export function initStick(root = document) {
	const layout = root.querySelector(".stick_layout");
	if (!layout || layout.dataset.stickReady === "true") return;
	const mq = window.matchMedia("(min-width: 768px)");

	const items = Array.from(layout.querySelectorAll(".stick_list-item"));
	if (!items.length) return;
	layout.dataset.stickReady = "true";

	const targets = items.map(function (item) {
		return item.querySelector("h2, h3") || item;
	});

	let idx = -1;
	let io = null;

	function setActive(next) {
		if (next === idx) return;
		if (idx >= 0 && items[idx]) items[idx].classList.remove("is-active");
		idx = next;
		if (idx >= 0 && items[idx]) items[idx].classList.add("is-active");
	}

	function clearActive() {
		items.forEach(function (item) {
			item.classList.remove("is-active");
		});
		idx = -1;
	}

	function pickClosestTo50vh() {
		if (!mq.matches) return;

		const triggerY = window.innerHeight * 0.5;
		let best = 0;
		let bestDist = Infinity;

		for (let i = 0; i < targets.length; i++) {
			const rect = targets[i].getBoundingClientRect();
			const dist = Math.abs(rect.top - triggerY);

			if (dist < bestDist) {
				bestDist = dist;
				best = i;
			}
		}

		setActive(best);
	}

	function enable() {
		if (io) return;

		io = new IntersectionObserver(
			function () {
				pickClosestTo50vh();
			},
			{
				root: null,
				threshold: 0,
				rootMargin: "-50% 0px -50% 0px",
			},
		);

		targets.forEach(function (target) {
			io.observe(target);
		});

		window.addEventListener("resize", pickClosestTo50vh);
		window.addEventListener("scroll", pickClosestTo50vh, { passive: true });
		pickClosestTo50vh();
	}

	function disable() {
		if (io) {
			io.disconnect();
			io = null;
		}

		window.removeEventListener("resize", pickClosestTo50vh);
		window.removeEventListener("scroll", pickClosestTo50vh);
		clearActive();
	}

	function handleBreakpointChange() {
		if (mq.matches) {
			enable();
		} else {
			disable();
		}
	}

	if (typeof mq.addEventListener === "function") {
		mq.addEventListener("change", handleBreakpointChange);
	} else {
		mq.addListener(handleBreakpointChange);
	}

	handleBreakpointChange();
}
