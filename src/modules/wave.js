import { animate, motionValue, springValue, styleEffect } from "motion";

/**
 * A hand that waves beside the pointer for as long as it is over the element
 * holding it, after FigJam's waving hand.
 *
 *   <a class="cta_button">
 *     <div>Discuss a project</div>
 *     <div class="cta_wave" data-wave-hand aria-hidden="true">
 *       <div>👋</div>
 *     </div>
 *   </a>
 *
 * The hand sits inside what it waves over, so it comes and goes with the page.
 * The Designer places the outer div at the top left of its parent and lets the
 * pointer through, and hides the inner one with its transform origin at the
 * wrist. The outer div follows the pointer and the inner one shows and waves,
 * so the two never fight over one transform.
 *
 * The Button component's Large variant waves too. Its hand is added here, so
 * the one Button needs no hidden hand in every other variant; the header CSS
 * places it by the same attribute.
 */

const config = {
	// Above and right of the pointer, so the pointer still shows what it is on.
	offset: { x: 10, y: -44 },
	follow: { stiffness: 1210, damping: 17.6, mass: 0.1 },
	enter: { type: "spring", visualDuration: 0.3, bounce: 0.4 },
	exit: { type: "spring", visualDuration: 0.3, bounce: 0 },
	// Three rocks from the wrist, a breath, and again.
	wave: { duration: 1.1, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.4 },
	fade: { duration: 0.2, ease: "easeOut" },
	// The Large button's hand, added by script.
	large: '[data-wf--button--variant="large"]',
	hand: '<div data-wave-hand aria-hidden="true"><div>👋</div></div>',
};

export function initWave(root = document, { signal } = {}) {
	const large = root.querySelectorAll(config.large);
	// Only a pointer that can hover; anyone else sees the button as it is.
	if (!large.length && !root.querySelector("[data-wave-hand]")) return;
	if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;

	for (const button of large) {
		if (!button.querySelector("[data-wave-hand]")) button.insertAdjacentHTML("beforeend", config.hand);
	}

	const hands = root.querySelectorAll("[data-wave-hand]");

	// A visitor who asked for less motion still gets the hand, as a fade that
	// sits by the pointer: nothing trails, bounces or waves.
	const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

	for (const hand of hands) {
		const area = hand.parentElement;
		const palm = hand.firstElementChild;
		if (!palm) throw new Error("[data-wave-hand] needs a div for the hand");

		const srcX = motionValue(0);
		const srcY = motionValue(0);
		const x = calm ? srcX : springValue(srcX, config.follow);
		const y = calm ? srcY : springValue(srcY, config.follow);
		styleEffect(hand, { x, y });

		let waving = null;

		function track(event) {
			const box = area.getBoundingClientRect();
			srcX.set(event.clientX - box.left + config.offset.x);
			srcY.set(event.clientY - box.top + config.offset.y);
		}

		function enter(event) {
			track(event);
			x.jump(srcX.get());
			y.jump(srcY.get());

			if (calm) {
				animate(palm, { opacity: 1 }, config.fade);
				return;
			}

			animate(palm, { opacity: 1, scale: [0.4, 1] }, config.enter);
			waving ??= animate(palm, { rotate: [0, 18, -10, 18, -6, 12, 0] }, config.wave);
		}

		function leave() {
			waving?.cancel();
			waving = null;
			animate(palm, calm ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: 0 }, calm ? config.fade : config.exit);
		}

		const on = (type, fn) => area.addEventListener(type, fn, { signal, passive: true });
		on("pointerenter", enter);
		on("pointermove", track);
		on("pointerleave", leave);
	}
}
