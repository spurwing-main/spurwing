function main() {
	document.querySelectorAll(".button").forEach((button) => {
		const defaultTextEl = button.querySelector(".button_text.is-default");
		const hoverTextEl = button.querySelector(".button_text.is-hover");

		const defaultSplit = new SplitText(defaultTextEl, {
			type: "chars",
			charsClass: "char",
		});
		const hoverSplit = new SplitText(hoverTextEl, {
			type: "chars",
			charsClass: "char-hover",
		});

		const fan = 3; // Adjust for more/less spread
		const rotation = 1; // Adjust for more/less rotation
		const center = (defaultSplit.chars.length - 1) / 2;
		const centerHover = (hoverSplit.chars.length - 1) / 2;
		const stagger = 0.05;
		const staggerHover = 0.05;
		const hoverDelay = 0.2;
		const ease = "power2.inOut";
		// const easeHover = "elastic.out(1, 0.5)";
		easeHover = ease;

		// Set initial styles for hover chars
		gsap.set(hoverSplit.chars, {
			opacity: 0,
			x: (i) => (i - centerHover) * fan,
			y: 20,
			rotation: 5,
			scale: 0.95,
		});

		gsap.set(hoverTextEl, { opacity: 1 });

		let tl = gsap.timeline({ paused: true, defaults: { duration: 0.15 } });

		tl.to(
			defaultSplit.chars,
			{
				y: -20,
				x: (i) => (i - center) * fan,
				rotation: (i) => (i - center) * rotation,
				scale: 0.95,
				ease: ease,
				stagger: {
					each: stagger,
					from: "start",
				},
			},
			"0"
		);
		tl.to(
			defaultSplit.chars,
			{
				opacity: 0,
				duration: 0.1,
				stagger: {
					each: stagger,
					from: "start",
				},
			},
			"0"
		);
		tl.to(
			hoverSplit.chars,
			{
				y: 0,
				x: 0,
				rotation: 0,
				scale: 1,
				ease: easeHover,
				stagger: {
					each: staggerHover,
					from: "start",
				},
			},
			hoverDelay
		);
		tl.to(
			hoverSplit.chars,
			{
				opacity: 1,
				duration: 0.1,
				ease: easeHover,
				stagger: {
					each: staggerHover,
					from: "start",
				},
			},
			hoverDelay
		);

		tl.timeScale(1);

		button.addEventListener("mouseenter", () => {
			tl.play();
		});

		button.addEventListener("mouseleave", () => {
			tl.reverse();
		});
	});
}
