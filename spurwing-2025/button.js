function main() {
	document.querySelectorAll(".button").forEach((button) => {
		// set params

		const timescale = 0.75; // speed of animation

		const splitType = "words"; // animate words or chars
		const el_class_out = "button-anim-out"; // class added to animated word/char
		const el_class_in = "button-anim-in"; // class added to animated word/char

		const duration_out = 0.5; // duration of each
		const duration_in = 0.5;

		const duration_opacity_out = 0.4;
		const duration_opacity_in = 0.1;

		const stagger_out = 0.02;
		const stagger_in = 0.02;

		const delay = 0.0;

		// const opacityStartOffset = duration_in - duration_opacity_in;
		const opacityStartOffset = 0;

		const fan_out = 1;
		const fan_in = 1;

		const rotation_out = 2;
		const rotation_in = -2;

		const y_out = 52;
		const y_in = 52;

		const ease_out = "power3.out";
		const ease_in = "elastic.out(1,2)";
		const ease_opacity_out = "power1.out";
		const ease_opacity_in = "power2.inOut";

		const scale_out = 0.95;
		const scale_in = 0.95;

		// Find elements
		const text_el_out = button.querySelector(".button_text.is-default");
		const text_el_in = button.querySelector(".button_text.is-hover");
		const bg = button.querySelector(".button_bg");

		let els_out, els_in; // animated elements
		let split_out, split_in; // split text objs

		// if we want to animate words
		if (splitType === "words") {
			split_out = new SplitText(text_el_out, {
				type: "chars, words",
				wordsClass: el_class_out,
			});
			split_in = new SplitText(text_el_in, {
				type: "chars, words",
				wordsClass: el_class_in,
			});
			els_out = split_out.words;
			els_in = split_in.words;
		}
		// if we want to animate chars
		else {
			split_out = new SplitText(text_el_out, {
				type: "chars, words",
				charsClass: el_class_out,
			});
			split_in = new SplitText(text_el_in, {
				type: "chars, words",
				charsClass: el_class_in,
			});
			els_out = split_out.chars;
			els_in = split_in.chars;
		}

		// const center_out = (els_out.length - 1) / 2;
		// const center_in = (els_in.length - 1) / 2;

		// 4. Initial state
		gsap.set(els_in, {
			opacity: 0,
			x: (i) => (i - 1.5) * fan_in,
			y: y_in,
			rotation: (i) => (i - 1.5) * rotation_in,
			scale: scale_in,
		});

		gsap.set(text_el_in, { opacity: 1 });

		// 5. Timeline
		let tl = gsap.timeline({ paused: true, defaults: { duration: 0.15, ease: "power2.inOut" } });

		tl.to(
			els_out,
			{
				y: -y_out,
				x: (i) => (i - 1.5) * fan_out,
				rotation: (i) => (i - 1.5) * rotation_out,
				scale: scale_out,
				ease: ease_out,
				duration: duration_out,
				stagger: {
					each: stagger_out,
					from: "start",
				},
			},
			"0"
		);
		tl.to(
			els_out,
			{
				opacity: 0,
				duration: duration_opacity_out,
				ease: ease_opacity_out,
				stagger: {
					each: stagger_out,
					from: "start",
				},
			},
			"0"
		);
		tl.to(
			els_in,
			{
				y: 0,
				x: 0,
				rotation: 0,
				scale: 1,
				ease: ease_in,
				duration: duration_in,

				stagger: {
					each: stagger_in,
					from: "start",
				},
			},
			delay
		);
		tl.to(
			els_in,
			{
				opacity: 1,
				duration: duration_opacity_in,
				ease: ease_opacity_in,
				stagger: {
					each: stagger_in,
					from: "start",
				},
			},
			delay + opacityStartOffset
		);
		tl.to(
			bg,
			{
				scale: 1.05,
				duration: 0.3,
				ease: "power2.inOut",
			},
			0
		);

		tl.timeScale(timescale);

		// 6. Triggers
		button.addEventListener("mouseenter", () => {
			tl.play();
		});

		button.addEventListener("mouseleave", () => {
			tl.reverse();
		});
	});
}
