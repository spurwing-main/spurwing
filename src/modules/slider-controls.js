import { press } from "../dom.js";

// The parts every slider on the site shares, whichever library drives it.

// Dots are rebuilt rather than reconciled: a slider re-inits on resize and on
//every page, and the count can change with it.
export function buildDots(dotsNode, { count, label, dotClass, selectedClass, onSelect }) {
	dotsNode.innerHTML = Array.from({ length: count }, (_, index) => {
		return `<button class="${dotClass}" type="button" data-index="${index}" aria-label="${label} ${index + 1}"></button>`;
	}).join("");

	const dots = [...dotsNode.querySelectorAll(`.${dotClass}`)];

	dots.forEach((dot) => {
		press(dot, () => onSelect(Number(dot.dataset.index)));
	});

	return {
		select(selectedIndex) {
			dots.forEach((dot, index) => {
				const isSelected = index === selectedIndex;

				dot.classList.toggle(selectedClass, isSelected);
				// The class is the look; this is the announcement.
				dot.setAttribute("aria-current", isSelected ? "true" : "false");
			});
		},
	};
}

// A pointer held down on a slider should read as held, and let go everywhere it
// can end — including a window blur, which fires no pointer event of its own.
export function grabCursor(element, grabbingClass, signal) {
	const set = (grabbing) => element.classList.toggle(grabbingClass, grabbing);

	const down = (event) => {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		set(true);
	};

	const up = () => set(false);

	element.addEventListener("pointerdown", down, { passive: true, signal });
	element.addEventListener("pointerup", up, { passive: true, signal });
	element.addEventListener("pointercancel", up, { passive: true, signal });
	element.addEventListener("lostpointercapture", up, { passive: true, signal });
	window.addEventListener("blur", up, { signal });
}
