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
	}

	const start = Number(control.getAttribute(teamSwitchConfig.activeAttr));
	let active = Number.isInteger(start) && pills[start] ? start : 0;

	show(active);

	control.addEventListener(
		"click",
		(event) => {
			const index = pills.indexOf(event.target.closest(teamSwitchConfig.pillSelector));

			if (index === -1 || index === active) return;

			active = index;

			// A view transition cross-fades the two team lists for free where the
			// browser has one; elsewhere the swap is instant, which is also fine.
			if (document.startViewTransition) document.startViewTransition(() => show(active));
			else show(active);
		},
		{ signal },
	);
}
