import { animate, cancelFrame, frame, hover, motionValue, springValue } from "motion";

import { claimOnce } from "../dom.js";

/**
 * Hover motion on the two Next steps cards. Every movement is a spring.
 *
 * People (`.next-team_list`): the ring of faces winds up to speed and stretches
 * outward as it spins, like something elastic being turned. Leaving lets
 * friction take the speed away, so it coasts down, draws back in with a little
 * give, and stays where it stopped. Faces stay upright and the same size.
 *
 * Projects (`.next-card_shot-wrap`): the front screenshot drops, passes under
 * the other two once it is clear of them, and rises into the back of the pile
 * while the others settle forward. It repeats while the pointer stays.
 *
 * The section is built on each page rather than as a component, so each card
 * is found by its own markup and marked with data-next-card for the CSS in the
 * Global code "agency" embed. Touch and reduced motion get the cards as built.
 */

const config = {
	// One turn every 10s at full speed.
	speed: 36,
	spinUp: { type: "spring", stiffness: 60, damping: 18 },
	// Seconds for friction to take away about two thirds of the speed.
	coast: 1,
	// How far the ring stretches at full speed, and how elastic it feels.
	stretch: 0.12,
	elastic: { stiffness: 120, damping: 10 },
	// Seconds between screenshot moves while the pointer stays.
	pause: 1.8,
	fall: { type: "spring", stiffness: 70, damping: 14 },
	rise: { type: "spring", stiffness: 80, damping: 15 },
	settle: { type: "spring", stiffness: 110, damping: 18 },
};

export function initNextCards(root = document, { signal } = {}) {
	const lists = [...root.querySelectorAll(".next-card .next-team_list")];
	const wraps = [...root.querySelectorAll(".next-card .next-card_shot-wrap")];

	if (!lists.length && !wraps.length) return;
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	for (const list of lists) {
		if (claimOnce(list, "data-next-card-ready")) people(list.closest(".next-card"), list, signal);
	}

	for (const wrap of wraps) {
		if (claimOnce(wrap, "data-next-card-ready")) projects(wrap.closest(".next-card"), wrap, signal);
	}
}

function people(card, list, signal) {
	card.dataset.nextCard = "people";

	const turn = motionValue(0);
	const speed = motionValue(0);
	const reach = motionValue(1);
	const spread = springValue(reach, config.elastic);

	turn.on("change", (v) => list.style.setProperty("--turn", `${v}deg`));
	spread.on("change", (v) => list.style.setProperty("--spread", v));

	let hovered = false;
	let loop = null;

	const stop = () => {
		cancelFrame(loop);
		loop = null;
		list.style.willChange = "";
	};

	const tick = ({ delta }) => {
		const dt = Math.min(delta / 1000, 0.1);

		if (!hovered) speed.set(speed.get() * Math.exp(-dt / config.coast));
		turn.set(turn.get() + speed.get() * dt);
		reach.set(1 + config.stretch * Math.min(speed.get() / config.speed, 1.2));

		if (!hovered && speed.get() < 0.3 && Math.abs(spread.get() - 1) < 0.001) stop();
	};

	const cancel = hover(card, () => {
		hovered = true;
		animate(speed, config.speed, config.spinUp);

		if (!loop) {
			list.style.willChange = "transform";
			loop = frame.update(tick, true);
		}

		return () => {
			hovered = false;
			speed.stop();
		};
	});

	signal?.addEventListener("abort", () => {
		cancel();
		stop();
		spread.destroy();
	});
}

function projects(card, wrap, signal) {
	card.dataset.nextCard = "projects";

	const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
	const seat = (n) =>
		[
			{ y: 0, scale: 1, filter: "brightness(1)" },
			{ y: -0.9375 * rem(), scale: 0.9087, filter: "brightness(0.97)" },
			{ y: -1.875 * rem(), scale: 0.8043, filter: "brightness(0.93)" },
		][n];

	const imgs = [...wrap.querySelectorAll(":scope > img")];
	const seatOf = (img) =>
		img.classList.contains("next-card_shot-back") ? 2 : img.classList.contains("next-card_shot-mid") ? 1 : 0;

	for (const img of imgs) {
		img.dataset.seat = seatOf(img);
		animate(img, seat(+img.dataset.seat), { duration: 0 });
	}

	if (imgs.length !== 3) return;

	let hovered = false;
	let busy = false;
	let check = null;
	let timer = 0;

	const wait = (s) => new Promise((done) => (timer = setTimeout(done, s * 1000)));
	const at = (n) => imgs.find((img) => +img.dataset.seat === n);

	const move = async () => {
		busy = true;
		const [front, mid, back] = [at(0), at(1), at(2)];

		// The front shot falls, shrinking to the back size as it goes. Each frame
		// checks whether it has dropped clear below the other two; the moment it
		// has, it moves to the back layer and a second spring takes over from the
		// fall's speed, so it turns round smoothly and rises behind the pile.
		animate(front, { y: front.offsetHeight * 1.2, scale: seat(2).scale, filter: "brightness(0.93)" }, config.fall);
		setTimeout(() => animate(mid, seat(0), config.settle), 250);
		setTimeout(() => animate(back, seat(1), config.settle), 330);

		await new Promise((clear) => {
			check = frame.read(() => {
				const top = front.getBoundingClientRect().top;

				if (top < mid.getBoundingClientRect().bottom + 1 || top < back.getBoundingClientRect().bottom + 1) return;
				cancelFrame(check);
				clear();
			}, true);
		});

		front.dataset.seat = 2;
		mid.dataset.seat = 0;
		back.dataset.seat = 1;
		await animate(front, seat(2), config.rise);

		busy = false;
		await wait(config.pause);
		if (hovered && !busy && !signal?.aborted) move();
	};

	const cancel = hover(card, () => {
		hovered = true;
		if (!busy) move();

		return () => {
			hovered = false;
		};
	});

	signal?.addEventListener("abort", () => {
		cancel();
		cancelFrame(check);
		clearTimeout(timer);
		hovered = false;
	});
}
