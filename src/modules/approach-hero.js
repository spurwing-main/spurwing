import { initializeOnce } from "./init-once.js";

const motionUrl = "https://cdn.jsdelivr.net/npm/motion@12.34.0/+esm";
const initKey = Symbol("approachHeroInit");

function loadDefaultMotion() {
	return import(motionUrl);
}

export function initApproachHero(root = document, loadMotion = loadDefaultMotion) {
	const section = root.querySelector(".section_caps");
	if (!section || section.dataset.approachHeroReady === "true") return;

	return initializeOnce(section, initKey, () => setupApproachHero(root, section, loadMotion));
}

async function setupApproachHero(root, section, loadMotion) {
	const blur = root.querySelector(".progressive-blur[data-fade-out]");
	if (!blur) throw new Error('blur not found: expected ".progressive-blur[data-fade-out]"');

	const { animate, inView } = await loadMotion();
	section.dataset.approachHeroReady = "true";
	blur.style.setProperty("--fade", "1");

	let anim = null;
	let inSection = false;
	let armed = false;
	let current = 1; // 1 visible, 0 hidden

	const armY = () => Math.round(window.innerHeight * 0.15);
	const hysteresisPx = 24; // prevents arm flicker around the threshold

	const setFade = (to) => {
		if (current === to) return;
		console.log("[blur] fade", current, "->", to);
		current = to;

		anim?.cancel?.();
		anim = animate(
			blur,
			{ "--fade": to },
			{ duration: to === 0 ? 0.6 : 0.45, easing: [0.215, 0.61, 0.355, 1] },
		);
	};

	const update = (reason) => {
		console.log("[blur] update", reason, {
			armed,
			inSection,
			scrollY: Math.round(window.scrollY),
		});

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

		console.log("[blur] armed", armed, "->", nextArmed, {
			threshold,
			hysteresisPx,
			scrollY: Math.round(y),
		});

		armed = nextArmed;
		update("arm-toggle");
	};

	window.addEventListener("scroll", armIfNeeded, { passive: true });
	window.addEventListener("resize", armIfNeeded);

	inView(
		section,
		() => {
			inSection = true;
			console.log("[blur] enter");
			update("enter");
			return () => {
				inSection = false;
				console.log("[blur] leave");
				update("leave");
			};
		},
		{ margin: "-15% 0px -15% 0px" },
	);

	console.log("[blur] init", { threshold: armY(), hysteresisPx });
	armIfNeeded();
	update("init");
}
