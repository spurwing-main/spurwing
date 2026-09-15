const menuToggleConfig = {
	triggerSelector: ".nav_menu-wrap",
	managedSelectors: [".nav_layout", ".nav_menu", ".nav_menu-wrap"],
	openClass: "is-open",
};

export function initMenuToggle(root = document, { signal } = {}) {
	const trigger = root.querySelector(menuToggleConfig.triggerSelector);

	if (!trigger) return;

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

	setOpen(false);
}
