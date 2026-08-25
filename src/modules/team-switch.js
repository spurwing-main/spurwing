const config = {
	rootSel: ".team_switch",
	sectionSel: ".section_team",
	pillSel: ".team_switch-pill",
	activeAttr: "data-active",
};

const root = document.querySelector(config.rootSel);
if (!root) throw new Error(`team switch: missing root "${config.rootSel}"`);

const section = document.querySelector(config.sectionSel);
if (!section) throw new Error(`team switch: missing section "${config.sectionSel}"`);

const pills = Array.from(root.querySelectorAll(config.pillSel));
if (pills.length < 2) throw new Error(`team switch: expected 2+ "${config.pillSel}"`);

const canVt = typeof document.startViewTransition === "function";

let active = clampIndex(Number(root.getAttribute(config.activeAttr) ?? 0));
applyActive(active);

root.addEventListener("click", (e) => {
	const pill = e.target.closest(config.pillSel);
	if (!pill || !root.contains(pill)) return;

	const next = pills.indexOf(pill);
	if (next === -1 || next === active) return;

	const apply = () => {
		active = next;
		applyActive(active);
	};

	if (canVt) document.startViewTransition(apply);
	else apply();
});

function clampIndex(n) {
	if (!Number.isFinite(n)) return 0;
	return Math.min(Math.max(0, n), pills.length - 1);
}

function applyActive(index) {
	root.setAttribute(config.activeAttr, String(index));
	section.setAttribute(config.activeAttr, String(index));
}
