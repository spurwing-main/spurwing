function loadSliders() {
	/* this is a change */

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

	/* get and launch all chosen splide instances */
	function initializeSplide(selector, options, initCallbacks, eventCallbacks) {
		let targets = document.querySelectorAll(selector);
		let splides = [];

		for (let i = 0; i < targets.length; i++) {
			let splide = new Splide(targets[i], options);

			// Apply initialization callbacks if any
			if (initCallbacks) {
				for (let [event, callback] of Object.entries(initCallbacks)) {
					splide.on(event, callback.bind(splide)); // Ensure 'this' is bound to the splide instance
				}
			}

			splide.mount();

			// Apply event callbacks if any
			if (eventCallbacks) {
				for (let [event, callback] of Object.entries(eventCallbacks)) {
					splide.on(event, callback.bind(splide)); // Ensure 'this' is bound to the splide instance
				}
			}
			splides.push(splide);
		}

		return splides;
	}

	const sliders = [
		{
			selector: ".hero-slider",
			options: {
				type: "loop",
				perPage: 1,
				autoplay: false,
			},
			initCallbacks: {
				mounted: function () {
					console.log("mounted");

					this.Components.Slides.forEach((splide_slide) => {
						const imgWrap = splide_slide.slide.querySelector(
							".hero-slide_img-wrap"
						);
						const caption =
							splide_slide.slide.querySelector(".hero-slide_footer");
						if (imgWrap) {
							const originalHeight = imgWrap.offsetHeight;
							const newHeight = originalHeight * -0.05;
							// Store the timeline in the slide element
							splide_slide.slide.timeline = gsap
								.timeline({ paused: true })
								.to(imgWrap, { scaleY: 0.9, duration: 0.3, ease: "none" }, 0)
								.to(caption, { y: newHeight, duration: 0.3, ease: "none" }, 0);
							// play if the slide is not active
							if (splide_slide.index !== 0) {
								splide_slide.slide.timeline.play();
							}
						}
					});
				},
			},
			eventCallbacks: {
				active: function (Slide) {
					const newActiveSlide = Slide;
					newActiveSlide.slide.timeline.reverse();
				},
				inactive: function (Slide) {
					const newInactiveSlide = Slide;
					newInactiveSlide.slide.timeline.play();
				},
				resize: function () {
					// when window resized, recalculate timeline distances
				},
			},
			helperFunctions: {
				createTimelines: function () {
					console.log("Create timelines");
					this.Components.Slides.forEach((splide_slide) => {
						const imgWrap = splide_slide.slide.querySelector(
							".hero-slide_img-wrap"
						);
						const caption =
							splide_slide.slide.querySelector(".hero-slide_footer");
						if (imgWrap && caption) {
							const originalHeight = imgWrap.offsetHeight;
							const newHeight = originalHeight * -0.05;
							// Store the timeline in the slide element
							splide_slide.slide.timeline = gsap
								.timeline({ paused: true })
								.to(imgWrap, { scaleY: 0.9, duration: 0.3, ease: "none" }, 0)
								.to(caption, { y: newHeight, duration: 0.3, ease: "none" }, 0);
							// play if the slide is not active
							if (splide_slide.index !== 0) {
								splide_slide.slide.timeline.play();
							}
						}
					});
				},
			},
		},
	];

	sliders.forEach(({ selector, options, initCallbacks, eventCallbacks }) => {
		initializeSplide(selector, options, initCallbacks, eventCallbacks);
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

			// console.log("play");

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

			// console.log("reverse");

			gsap.to(cursor, {
				autoAlpha: 0, //show cursor
				duration: 0.25,
				scale: 0.5,
				ease: "power3.out",
			});
		});
	});
}
