const teamSwitchConfig = {
	switchSelector: ".team_switch",
	sectionSelector: ".section_team",
	pillSelector: ".team_switch-pill",
	activeAttr: "data-active",
};

export function initTeamSwitch(root = document, { signal } = {}) {
	const control = root.querySelector(teamSwitchConfig.switchSelector);

	if (!control) return;

	const section = root.querySelector(teamSwitchConfig.sectionSelector);

	if (!section) {
		throw new Error(`missing team section: expected "${teamSwitchConfig.sectionSelector}"`);
	}

	const pills = [...control.querySelectorAll(teamSwitchConfig.pillSelector)];

	if (pills.length < 2) {
		throw new Error(`missing team pills: expected 2 or more "${teamSwitchConfig.pillSelector}"`);
	}

	// The control and the section both carry the index, so the switch and the
	// content it filters can be styled from the same one number.
	function show(index) {
		control.setAttribute(teamSwitchConfig.activeAttr, String(index));
		section.setAttribute(teamSwitchConfig.activeAttr, String(index));

		// The index is what the CSS reads. This is what a screen reader reads:
		// without it, which pill is selected was carried only by an attribute on
		// the parent and announced nowhere.
		pills.forEach((pill, pillIndex) => {
			pill.setAttribute("aria-pressed", pillIndex === index ? "true" : "false");
		});
	}

	// The pills are Div Blocks in the Designer. aria-pressed is only allowed on a
	// button, and a div is not in the Tab order, so each one is made a button for
	// keyboards and screen readers here.
	for (const pill of pills) {
		if (pill.tagName === "BUTTON") continue;
		pill.setAttribute("role", "button");
		pill.tabIndex = 0;
	}

	const start = Number(control.getAttribute(teamSwitchConfig.activeAttr));
	let active = Number.isInteger(start) && pills[start] ? start : 0;

	show(active);

	function choose(index) {
		if (index === -1 || index === active) return;

		active = index;

		// A view transition cross-fades the two team lists for free where the
		// browser has one; elsewhere the swap is instant, which is also fine.
		if (document.startViewTransition) document.startViewTransition(() => show(active));
		else show(active);
	}

	control.addEventListener("click", (event) => choose(pills.indexOf(event.target.closest(teamSwitchConfig.pillSelector))), {
		signal,
	});

	// Enter and Space press a button; a div given the role has to be told.
	control.addEventListener(
		"keydown",
		(event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			const index = pills.indexOf(event.target.closest(teamSwitchConfig.pillSelector));
			if (index === -1) return;
			event.preventDefault();
			choose(index);
		},
		{ signal },
	);
}
