import { keyActivates } from "../dom.js";

const menuToggleConfig = {
	triggerSelector: ".nav_menu-wrap",
	managedSelectors: [".nav_layout", ".nav_menu", ".nav_menu-wrap"],
	openClass: "is-open",
};

export function initMenuToggle(root = document, { signal } = {}) {
	const trigger = root.querySelector(menuToggleConfig.triggerSelector);

	if (!trigger) return;

	// It is a div, so it answered the mouse only — and aria-expanded below needs
	// a role that can carry it. The click is delegated on root, and a synthetic
	// click from the keyboard bubbles to it like any other.
	keyActivates(trigger, signal);

	const managed = menuToggleConfig.managedSelectors
		.map(function (selector) {
			return root.querySelector(selector);
		})
		.filter(Boolean);

	function isOpen() {
		return managed.some(function (element) {
			return element.classList.contains(menuToggleConfig.openClass);
		});
	}

	function setOpen(open) {
		managed.forEach(function (element) {
			element.classList.toggle(menuToggleConfig.openClass, open);
		});

		// The class is what the CSS reads; this is what a screen reader reads.
		// Without it the trigger announced nothing about whether the menu was
		// open, and the state was carried only by a class name.
		trigger.setAttribute("aria-expanded", open ? "true" : "false");
	}

	// The open menu holds a body scroll lock, so it has to close before the
	// router scrolls anything. spw:leave fires synchronously, before that.
	document.addEventListener(
		"spw:leave",
		function () {
			setOpen(false);
		},
		{ signal },
	);

	root.addEventListener(
		"click",
		function (event) {
			if (!event.target.closest?.(menuToggleConfig.triggerSelector)) return;

			event.preventDefault();
			setOpen(!isOpen());
		},
		{ signal },
	);

	// Escape closes it, the way every other overlay on the site does. Without
	// this the only way out was finding the trigger again.
	document.addEventListener(
		"keydown",
		function (event) {
			if (event.key !== "Escape" || !isOpen()) return;

			setOpen(false);
			trigger.focus?.();
		},
		{ signal },
	);

	setOpen(false);
}
