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

	/* get and launch all chosen splide instances */
	function initializeSplide(
		selector,
		options,
		initCallbacks,
		eventCallbacks,
		helperFunctions
	) {
		let targets = document.querySelectorAll(selector);
		let splides = [];

		for (let i = 0; i < targets.length; i++) {
			/* new splide instance */
			let splide = new Splide(targets[i], options);

			// Apply initialization callbacks if any
			if (initCallbacks) {
				for (let [event, callback] of Object.entries(initCallbacks)) {
					splide.on(event, callback.bind(splide, helperFunctions)); // Ensure 'this' is bound to the splide instance
				}
			}

			/* mount splide instance */
			splide.mount();
			// splide.mount(window.splide.Extensions);

			// Apply event callbacks if any
			if (eventCallbacks) {
				for (let [event, callback] of Object.entries(eventCallbacks)) {
					splide.on(event, function (...args) {
						callback.apply(splide, [helperFunctions, ...args]);
					});
				}
			}
			splides.push(splide);
		}

		/* return all created splide instances */
		return splides;
	}

	/* declare slider selectors, options and any callback functions */
	const sliders = [
		{
			selector: ".hero-slider",
			options: {
				type: "loop",
				perPage: 1,
				autoplay: false,
				autoScroll: {
					autoStart: false,
				},
			},
			initCallbacks: {
				mounted: function (helperFunctions) {
					console.log("mounted");
					// Call the createTimelines helper function
					helperFunctions.createTimelines.call(this);
				},
			},
			eventCallbacks: {
				active: function (helperFunctions, Slide) {
					// grow active slide
					// Slide is the Slide component that becomes active.
					Slide.slide.timeline.play();
				},
				inactive: function (helperFunctions, Slide) {
					// shrink inactive slide
					// Slide is the Slide component that becomes inactive.
					Slide.slide.timeline.reverse();
				},
				resize: function (helperFunctions) {
					// when window resized, recalculate timeline distances
					helperFunctions.createTimelines.call(this);
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
							const newHeight = originalHeight * 0.05;
							// Store the timeline in the slide element
							splide_slide.slide.timeline = gsap
								.timeline({ paused: true })
								.to(imgWrap, { scaleY: 1.1, duration: 0.3 }, 0)
								.to(caption, { y: newHeight, duration: 0.3 }, 0);
							// play if the slide is  active
							if (splide_slide.index == 0) {
								splide_slide.slide.timeline.play();
							}
						}
					});
				},
			},
		},
		{
			selector: '[splide="about-hero"]',
			options: {
				autoWidth: true,
				focus: "center",
				type: "loop",
				gap: "4rem",
				trimSpace: false,
				lazyLoad: false,
				drag: "free",
				flickPower: 300,
				flickMaxPages: 1,
				cloneStatus: true,
				autoScroll: {
					speed: 0.5,
					pauseOnHover: false,
					pauseOnFocus: false,
				},
				breakpoints: {
					991: {},
					767: {},
					479: {},
				},
			},
			initCallbacks: {
				mounted: function () {
					/* on mount, add additional slides required to fill screen */
					const splide = this;
					const totalSlides = splide.length;
					const requiredSlides = Math.ceil(
						window.innerWidth / this.Components.Elements.track.clientWidth
					);
					if (totalSlides < requiredSlides) {
						for (let i = totalSlides; i < requiredSlides; i++) {
							splide.add(
								`<div class="splide__slide">${splide.Components.Elements.slides[0].innerHTML}</div>`
							);
						}
					}
					splide.refresh();
				},
			},
			eventCallbacks: {},
			helperFunctions: {},
		},
	];

	/* loop through and initialize each slider */
	sliders.forEach(
		({ selector, options, initCallbacks, eventCallbacks, helperFunctions }) => {
			initializeSplide(
				selector,
				options,
				initCallbacks,
				eventCallbacks,
				helperFunctions
			);
		}
	);
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
