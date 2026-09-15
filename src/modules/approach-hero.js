import { animate, inView } from "motion";

import { requireElement } from "../dom.js";

export function initApproachHero(root = document, { signal } = {}) {
	const section = root.querySelector(".section_caps");

	if (!section) return;

	const blur = requireElement(root, ".progressive-blur[data-fade-out]", "progressive blur");

	blur.style.setProperty("--fade", "1");

	let anim = null;
	let inSection = false;
	let armed = false;
	let current = 1; // 1 visible, 0 hidden

	const armY = () => Math.round(window.innerHeight * 0.15);
	const hysteresisPx = 24; // prevents arm flicker around the threshold

	const setFade = (to) => {
		if (current === to) return;
		current = to;

		anim?.cancel?.();
		anim = animate(
			blur,
			{ "--fade": to },
			// `ease`, not `easing`: Motion reads the former and silently ignores the
			// latter, which left this fading on the default curve.
			{ duration: to === 0 ? 0.6 : 0.45, ease: [0.215, 0.61, 0.355, 1] },
		);
	};

	const update = () => {
		// If you're not armed, always stay visible.
		if (!armed) return setFade(1);

		// Armed: in section => fade out, out of section => fade in. Repeat forever.
		setFade(inSection ? 0 : 1);
	};

	const armIfNeeded = () => {
		const y = window.scrollY;
		const threshold = armY();

		const nextArmed = armed ? y >= threshold - hysteresisPx : y >= threshold + hysteresisPx;

		if (armed === nextArmed) return;

		armed = nextArmed;
		update();
	};

	window.addEventListener("scroll", armIfNeeded, { passive: true, signal });
	window.addEventListener("resize", armIfNeeded, { signal });

	// inView returns its own stop function; discarding it left an
	// IntersectionObserver watching a section the router had already removed.
	const stopInView = inView(
		section,
		() => {
			inSection = true;
			update();
			return () => {
				inSection = false;
				update();
			};
		},
		{ margin: "-15% 0px -15% 0px" },
	);

	signal?.addEventListener("abort", () => stopInView());

	armIfNeeded();
	update();
}
