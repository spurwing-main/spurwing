const config = {
	rootSel: ".team_switch",
	sectionSel: ".section_team",
	pillSel: ".team_switch-pill",
	activeAttr: "data-active",
};

export function initTeamSwitch(queryRoot = document) {
	const root = queryRoot.querySelector(config.rootSel);
	if (!root || root.dataset.teamSwitchReady === "true") return;

	const section = queryRoot.querySelector(config.sectionSel);
	if (!section) throw new Error(`team switch: missing section "${config.sectionSel}"`);

	const pills = Array.from(root.querySelectorAll(config.pillSel));
	if (pills.length < 2) throw new Error(`team switch: expected 2+ "${config.pillSel}"`);
	root.dataset.teamSwitchReady = "true";

	const canViewTransition = typeof document.startViewTransition === "function";

	let active = clampIndex(Number(root.getAttribute(config.activeAttr) ?? 0));
	applyActive(active);

	root.addEventListener("click", (event) => {
		const pill = event.target.closest(config.pillSel);
		if (!pill || !root.contains(pill)) return;

		const next = pills.indexOf(pill);
		if (next === -1 || next === active) return;

		const apply = () => {
			active = next;
			applyActive(active);
		};

		if (canViewTransition) document.startViewTransition(apply);
		else apply();
	});

	function clampIndex(index) {
		if (!Number.isFinite(index)) return 0;
		return Math.min(Math.max(0, index), pills.length - 1);
	}

	function applyActive(index) {
		root.setAttribute(config.activeAttr, String(index));
		section.setAttribute(config.activeAttr, String(index));
	}
}
