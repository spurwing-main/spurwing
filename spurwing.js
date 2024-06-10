function loadSliders() {
	/* splide defaults */
	Splide.defaults = {
		perMove: 1,
		gap: "0rem",
		arrows: false,
		pagination: false,
		focus: 0,
		speed: 600,
		dragAngleThreshold: 60,
		autoWidth: false,
		rewind: false,
		rewindSpeed: 400,
		waitForTransition: false,
		updateOnMove: true,
		trimSpace: "move",
		type: "loop",
		drag: true,
		snap: true,
		autoWidth: false,
		autoplay: false,
	};

	function initializeSplide(selector, options) {
		let targets = document.querySelectorAll(selector);
		let splides = [];

		for (let i = 0; i < targets.length; i++) {
			let splide = new Splide(targets[i], options);
			splide.mount();
			splides.push(splide);
		}

		return splides;
	}

	const splides = [
		{
			selector: ".hero-slider",
			options: {
				type: "loop",
				perPage: 1,
				autoplay: false,
			},
		},
	];

	splides.forEach(({ selector, options }) => {
		initializeSplide(selector, options);
	});
}

function customCursor() {
	//
	const cursor = document.querySelector(".custom-cursor"); // get cursor
	const cursor_w = cursor.offsetWidth / 2;
	const cursor_h = cursor.offsetHeight / 2;

	let targets = gsap.utils.toArray("[data-spw-cursor='true']"); // get all targets

	const xSetter = gsap.quickSetter(cursor, "x", "px");
	const ySetter = gsap.quickSetter(cursor, "y", "px");

	document.addEventListener("mousemove", mouseMove);

	function mouseMove(e) {
		xSetter(e.x - cursor_w);
		ySetter(e.y - cursor_h);
	}

	gsap.set(cursor, {
		scale: 0.5, // initial starting state
	});

	/* hide/show cursor on hover */
	targets.forEach((target) => {
		//
		let content = target.dataset.spwCursorContent;

		target.addEventListener("mouseenter", (e) => {
			//
			document.documentElement.classList.add("custom-cursor-on");

			gsap.killTweensOf(target); // kill active tweens

			console.log("play");

			gsap.to(cursor, {
				autoAlpha: 1, //show cursor
				duration: 0.25,
				scale: 1,
				ease: "power3.out",
			});

			if (content) cursor.innerHTML = content; //update content
		});

		target.addEventListener("mouseleave", (e) => {
			//
			document.documentElement.classList.remove("custom-cursor-on");

			gsap.killTweensOf(target); //kill tweens of target we're leaving to avoid cursor persisting if we move too quick

			console.log("reverse");

			gsap.to(cursor, {
				autoAlpha: 0, //show cursor
				duration: 0.25,
				scale: 0.5,
				ease: "power3.out",
			});
		});
	});
}
