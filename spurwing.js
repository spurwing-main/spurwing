function main() {
	/* set up custom cursor */
	spw.cursor = {}; // obj for storing cursor info
	spw.cursor.element = document.querySelector(".custom-cursor"); // the cursor element itself
	spw.cursor.target = null; // target element
	spw.cursor.activeClass = "doc_active_class"; // class we add to the <html> element when cursor active
	spw.log();

	spw.updateCopyrightYear = function () {
		const year = new Date().getFullYear().toString();
		document
			.querySelectorAll('[copyright="year"]')
			.forEach((el) => (el.textContent = year));
	};

	spw.startLenis = function () {
		let lenis;
		if (Webflow.env("editor") === undefined) {
			// if we're not in the Editor
			lenis = new Lenis({
				lerp: 0.3,
				wheelMultiplier: 0.8,
				gestureOrientation: "vertical",
				normalizeWheel: false,
				smoothTouch: false,
			});
			function raf(time) {
				lenis.raf(time);
				requestAnimationFrame(raf);
			}
			requestAnimationFrame(raf);
		}
		$("[data-lenis-start]").on("click", function () {
			lenis.start();
		});
		$("[data-lenis-stop]").on("click", function () {
			lenis.stop();
		});
		$("[data-lenis-toggle]").on("click", function () {
			$(this).toggleClass("stop-scroll");
			if ($(this).hasClass("stop-scroll")) {
				lenis.stop();
			} else {
				lenis.start();
			}
		});
	};

	/* initialise cursor */
	spw.cursor.init = function () {
		// get cursor dims
		const cursor = spw.cursor.element;
		const cursor_w = cursor.offsetWidth / 2;
		const cursor_h = cursor.offsetHeight / 2;

		// get all targets
		let targets = gsap.utils.toArray("[spw-cursor='on']");
		const successfulTargets = [];

		// create gsap functions to update cursor position
		const xSetter = gsap.quickSetter(cursor, "x", "px");
		const ySetter = gsap.quickSetter(cursor, "y", "px");

		// when mouse moves, update position of custom cursor
		// updated from a mousemove to pointermove event to also support drag actions
		document.addEventListener("pointermove", mouseMove);
		function mouseMove(e) {
			xSetter(e.clientX - cursor_w);
			ySetter(e.clientY - cursor_h);
		}

		// set initial starting state
		gsap.set(cursor, {
			scale: 0.5,
		});

		function applyCustomCursor(cursor, target) {
			// when mouse enters target
			target.addEventListener("mouseenter", (e) => {
				// store target
				cursor.target = target;
				// add a top level class to the doc
				document.documentElement.classList.add(cursor.activeClass);
				// update and animate in cursor
				spw.cursor.update(cursor, target);
				spw.cursor.animateIn(cursor, target);
			});

			// when mouse leaves target
			target.addEventListener("mouseleave", (e) => {
				spw.log("cursor exit");
				spw.cursor.reset();
			});

			target.setAttribute("spw-cursor-applied", true);

			successfulTargets.push(target);
		}

		// Apply the custom cursor to initial targets
		targets.forEach((target) => {
			applyCustomCursor(cursor, target);
		});

		// Observe the entire document for any new elements added
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						// Check if the added node or any of its children have the spw-cursor attribute
						if (node.matches("[spw-cursor='on']")) {
							applyCustomCursor(cursor, node);
						}
						node.querySelectorAll("[spw-cursor='on']").forEach((child) => {
							applyCustomCursor(cursor, child);
						});
					}
				});
			});
		});

		observer.observe(document.body, { childList: true, subtree: true });

		spw.log(`Custom cursor added to ${successfulTargets.length} targets`);
	};

	/* helper function for updating cursor - used by other functions outside customCursor() */
	spw.cursor.update = function (target = spw.cursor.target) {
		if (!target) {
			// spw.log("target is missing");
			return;
		}

		const cursor = spw.cursor.element;

		// get data from the target
		let cursorContent = target.getAttribute("spw-cursor-content");
		let cursorStyle = target.getAttribute("spw-cursor-style");
		let cursorIcon = target.getAttribute("spw-cursor-icon");

		// if a style has been defined for this cursor, set it
		if (cursorStyle) cursor.setAttribute("spw-cursor-style", cursorStyle);
		// if icon is enabled, set it on cursor
		if (cursorIcon) cursor.setAttribute("spw-cursor-icon", cursorIcon);

		// update content
		if (cursorContent) cursor.innerHTML = cursorContent;

		// spw.log("Cursor updated");
		// spw.log(spw);
	};

	/* helper function for resetting cursor */
	spw.cursor.reset = function () {
		const cursor = spw.cursor.element;
		let target = spw.cursor.target;

		spw.cursor.animateOut(target);

		// clear target
		target = null;
		// remove class from doc
		document.documentElement.classList.remove(cursor.activeClass);
		// remove any styling from cursor
		cursor.setAttribute("spw-cursor-style", "");
		cursor.setAttribute("spw-cursor-icon", "");
		spw.log("Cursor reset");
	};

	/* helper functions for animating cursor in and out */
	spw.cursor.animateIn = function (target = null) {
		const cursor = spw.cursor.element;

		// kill active tweens
		if (target) gsap.killTweensOf(target);

		// animate cursor - scale up and show
		gsap.to(cursor, {
			autoAlpha: 1,
			duration: 0.25,
			scale: 1,
			ease: "power3.out",
		});
	};
	spw.cursor.animateOut = function (target = null) {
		const cursor = spw.cursor.element;

		// kill active tweens
		if (target) gsap.killTweensOf(target);

		// animate cursor - shrink down and hide
		gsap.to(cursor, {
			autoAlpha: 0,
			duration: 0.25,
			scale: 0.5,
			ease: "power3.out",
		});
	};

	spw.linkHover = function () {
		// Check if window width is at least 768px
		if ($(window).width() >= 768) {
			// Apply hover effects directly to elements with 'link-fade' attributes set to 'navi'
			$('[link-fade="navi"]').hover(
				function () {
					// On hover, add 'is-dim' class to other '[link-fade="navi"]' elements not being hovered
					$('[link-fade="navi"]').not(this).addClass("is-dim");
				},
				function () {
					// On hover out, remove 'is-dim' class from all '[link-fade="navi"]' elements
					$('[link-fade="navi"]').removeClass("is-dim");
				}
			);

			// Apply hover effects for elements with 'link-fade' attributes set to 'list'
			$('[link-fade="list"]').each(function () {
				var items = $(this).find('a, [link-fade="include"]');
				items.hover(
					function () {
						// On hover, add 'is-dim' class to other items not being hovered
						items.not(this).addClass("is-dim");
					},
					function () {
						// On hover out, remove 'is-dim' class from all items
						items.removeClass("is-dim");
					}
				);
			});
		}
	};

	spw.loadSliders = function () {
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
			helperFunctions,
			useExtensions = false
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

				// Mount splide instance with or without extensions
				if (useExtensions) {
					splide.mount(window.splide.Extensions);
				} else {
					splide.mount();
				}

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
						spw.log("Hero slider mounted");
						// Call the createTimelines helper function
						helperFunctions.createTimelines.call(this);
						// Set custom cursor text on prev and next slides
						helperFunctions.setCursorContent.call(this);
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
					move: function (helperFunctions) {
						helperFunctions.setCursorContent.call(this);
					},
				},
				helperFunctions: {
					createTimelines: function () {
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
					setCursorContent: function () {
						// Set custom cursor text on prev and next slides
						this.Components.Slides.forEach((splide_slide) => {
							const slideElement = splide_slide.slide;
							const targetElement =
								splide_slide.slide.querySelector("[data-spw-cursor"); // the element with the custom cursor enabled
							if (slideElement.classList.contains("is-next")) {
								targetElement.setAttribute("data-spw-cursor-content", "Next");
							} else if (slideElement.classList.contains("is-prev")) {
								targetElement.setAttribute("data-spw-cursor-content", "Prev");
							} else {
								targetElement.setAttribute("data-spw-cursor-content", "View");
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
						spw.log("About slider mounted");
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
				useExtensions: true, // use Autoscroll
			},
		];

		/* loop through and initialize each slider */
		sliders.forEach(
			({
				selector,
				options,
				initCallbacks,
				eventCallbacks,
				helperFunctions,
				useExtensions,
			}) => {
				initializeSplide(
					selector,
					options,
					initCallbacks,
					eventCallbacks,
					helperFunctions,
					useExtensions
				);
			}
		);
	};

	spw.loadHomeHeroSlider = function (
		mySelector = ".hero-slider_list-wrapper.swiper"
	) {
		// Get all swiper containers
		const swiperContainers = document.querySelectorAll(mySelector);

		swiperContainers.forEach((container) => {
			// Get the swiper-wrapper within the current container
			const swiperWrapper = container.querySelector(".swiper-wrapper");

			// Get all swiper-slide elements within the current container
			const swiperSlides = container.querySelectorAll(".swiper-slide");

			// Clone each swiper-slide element 4 times and append to the swiper-wrapper
			for (let i = 0; i < 4; i++) {
				swiperSlides.forEach((slide) => {
					const clone = slide.cloneNode(true);
					swiperWrapper.appendChild(clone);
				});
			}

			const swiper = new Swiper(container, {
				centeredSlides: true,
				slideToClickedSlide: true /* click on slide to scroll to it */,
				slidesPerView: 1,
				loop: true,
				loopAdditionalSlides: 5 /* render more slides */,
				freeMode: {
					/* allow 'flick scrolling */ enabled: true,
					sticky: true /* snap to slides */,
					minimumVelocity: 0.05,
					momentumVelocityRatio: 0.1,
					momentumRatio: 0.5 /* dial it down a little */,
				},
				effect: "creative" /* enable scaling effect */,
				creativeEffect: {
					limitProgress: 2,
					prev: {
						// Slide scale
						scale: 0.9,
						translate: ["-100%", 0, 0],
						origin: "right center",
						opacity: 0.75,
					},
					next: {
						// Slide scale
						scale: 0.9,
						translate: ["100%", 0, 0],
						origin: "left center",
						opacity: 0.75,
					},
				},
				keyboard: {
					enabled: true,
					onlyInViewport: false,
				},
				on: {
					sliderFirstMove: function () {
						// spw.log("sliderFirstMove");
						const activeSlide = this.slides[this.activeIndex];
						const prevSlide = this.slides[this.activeIndex - 1];
						const nextSlide = this.slides[this.activeIndex + 1];
						[activeSlide, prevSlide, nextSlide].forEach((slide) => {
							const video = slide.querySelector("video");
							if (video) {
								video.loop = true;
								video.play();
							}
						});
					},
					afterInit: function () {
						// spw.log("Swiper initialised");

						const activeSlide = this.slides[this.activeIndex];
						const video = activeSlide.querySelector("video");
						if (video) {
							video.loop = true;
							video.play();
						}

						// Set custom cursor text on prev, next, and active slides
						this.slides.forEach((slideElement) => {
							const targetElement = slideElement.querySelector("[spw-cursor]"); // fixed the selector
							if (targetElement) {
								if (slideElement.classList.contains("swiper-slide-next")) {
									targetElement.setAttribute("spw-cursor-content", "Next");
								} else if (
									slideElement.classList.contains("swiper-slide-prev")
								) {
									targetElement.setAttribute("spw-cursor-content", "Prev");
								} else if (
									slideElement.classList.contains("swiper-slide-active")
								) {
									targetElement.setAttribute("spw-cursor-content", "View");
								} else {
									targetElement.removeAttribute("spw-cursor-content");
								}
							}
						});
					},
					transitionEnd: function () {
						// spw.log("transitionEnd");
						// spw.log(spw);
						const activeSlide = this.slides[this.activeIndex];

						// Set custom cursor text on prev, next, and active slides
						this.slides.forEach((slideElement) => {
							const video = slideElement.querySelector("video");
							if (slideElement === activeSlide) {
								if (video) {
									video.loop = true;
									video.play();
								}
							} else {
								if (video) {
									video.pause();
								}
							}

							const targetElement = slideElement.querySelector("[spw-cursor]"); // fixed the selector
							if (targetElement) {
								if (slideElement.classList.contains("swiper-slide-next")) {
									targetElement.setAttribute("spw-cursor-content", "Next");
								} else if (
									slideElement.classList.contains("swiper-slide-prev")
								) {
									targetElement.setAttribute("spw-cursor-content", "Prev");
								} else if (
									slideElement.classList.contains("swiper-slide-active")
								) {
									targetElement.setAttribute("spw-cursor-content", "View");
								} else {
									targetElement.removeAttribute("spw-cursor-content");
								}
							}
						});

						// update cursor for current target
						spw.cursor.update();
					},
				},
			});
		});
	};

	spw.loadSwiperSliders = function (mySelector) {
		// Get all swiper containers
		const swiperContainers = document.querySelectorAll(mySelector);

		swiperContainers.forEach((container) => {
			// Get the swiper-wrapper within the current container
			const swiperWrapper = container.querySelector(".swiper-wrapper");

			// Get all swiper-slide elements within the current container
			const swiperSlides = container.querySelectorAll(".swiper-slide");

			const swiper = new Swiper(container, {
				slidesPerView: 4,
				breakpoints: {
					992: {
						slidesPerView: 3,
					},
					768: {
						slidesPerView: 2,
					},
					480: {
						slidesPerView: 1,
					},
				},

				freeMode: {
					/* allow 'flick scrolling */ enabled: true,
					sticky: true /* snap to slides */,
					minimumVelocity: 0.05,
					momentumVelocityRatio: 0.1,
					momentumRatio: 0.5 /* dial it down a little */,
				},

				keyboard: {
					enabled: true,
					onlyInViewport: false,
				},
			});
		});
	};

	spw.updateCopyrightYear();
	spw.startLenis();
	spw.linkHover();
	spw.cursor.init();
	spw.loadHomeHeroSlider();
	spw.loadSwiperSliders(".latest_col-wrap.swiper");
}
