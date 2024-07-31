function main() {
	/* set up custom cursor */
	spw.cursor = {}; // obj for storing cursor info
	spw.cursor.element = document.querySelector(".custom-cursor"); // the cursor element itself
	spw.cursor.target = null; // target element
	spw.cursor.activeClass = "custom-cursor-on"; // class we add to the <html> element when cursor active
	spw.cursor.enabled = false; // cursor can only be shown if this is enabled. Helps control behaviour on page transitions

	/* set up scroll disabling */
	spw.scrollDisabler = {};

	// Method to disable scroll
	spw.scrollDisabler.run = function () {
		if (spw.scrollDisabler.scrollDisabled) return;

		spw.scrollDisabler.scrollPosition = window.scrollY;
		document.body.style.position = "fixed";
		document.body.style.top = `-${spw.scrollDisabler.scrollPosition}px`;
		document.body.style.width = "100%";

		spw.scrollDisabler.preserveElements.forEach((el) => {
			el.style.overflow = "auto";
		});

		spw.scrollDisabler.scrollDisabled = true;
	};

	// Method to enable scroll
	spw.scrollDisabler.kill = function () {
		if (!spw.scrollDisabler.scrollDisabled) return;

		document.body.style.position = "";
		document.body.style.top = "";
		document.body.style.width = "";
		window.scrollTo(0, spw.scrollDisabler.scrollPosition);

		spw.scrollDisabler.preserveElements.forEach((el) => {
			el.style.overflow = "";
		});

		spw.scrollDisabler.scrollDisabled = false;
	};

	// initialise scroll disabler
	spw.scrollDisabler.init = function () {
		// Define variables to track scroll state and position
		spw.scrollDisabler.scrollDisabled = false;
		spw.scrollDisabler.scrollPosition = 0;

		// Select the toggle element and preserve elements
		spw.scrollDisabler.toggleElement = document.querySelector(
			'[fs-scrolldisable-element="toggle"]'
		);
		spw.scrollDisabler.preserveElements = document.querySelectorAll(
			'[fs-scrolldisable-element="preserve"]'
		);
		// Add event listener to the toggle element
		if (spw.scrollDisabler.toggleElement) {
			spw.scrollDisabler.toggleElement.addEventListener("click", () => {
				if (spw.scrollDisabler.scrollDisabled) {
					spw.scrollDisabler.kill();
				} else {
					spw.scrollDisabler.run();
				}
			});
		}
	};

	spw.log();

	spw.updateCopyrightYear = function () {
		const year = new Date().getFullYear().toString();
		document
			.querySelectorAll('[copyright="year"]')
			.forEach((el) => (el.textContent = year));
	};

	spw.startLenis = function () {
		if (Webflow.env("editor") === undefined) {
			// if we're not in the Editor
			spw.lenis = new Lenis({
				lerp: 0.3,
				wheelMultiplier: 0.8,
				gestureOrientation: "vertical",
				normalizeWheel: false,
				smoothTouch: false,
			});
			function raf(time) {
				spw.lenis.raf(time);
				requestAnimationFrame(raf);
			}
			requestAnimationFrame(raf);
		}
		$("[data-lenis-start]").on("click", function () {
			spw.lenis.start();
		});
		$("[data-lenis-stop]").on("click", function () {
			spw.lenis.stop();
		});
		$("[data-lenis-toggle]").on("click", function () {
			$(this).toggleClass("stop-scroll");
			if ($(this).hasClass("stop-scroll")) {
				spw.lenis.stop();
			} else {
				spw.lenis.start();
			}
		});
	};

	/* initialise cursor */
	spw.cursor.init = function () {
		// turn cursor on
		spw.cursor.enabled = true;

		// get cursor dims
		const cursor = spw.cursor.element;
		const cursor_w = cursor.offsetWidth / 2;
		const cursor_h = cursor.offsetHeight / 2;

		// get all targets
		let newTargets = gsap.utils.toArray("[spw-cursor='on']");
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

		function applyCustomCursor(newTarget) {
			// when mouse enters target
			newTarget.addEventListener("mouseenter", (e) => {
				// store target
				spw.cursor.target = newTarget;
				// add a top level class to the doc
				document.documentElement.classList.add(spw.cursor.activeClass);
				// update and animate in cursor
				// only if cursor is enabled
				if (spw.cursor.enabled) {
					spw.cursor.update(newTarget);
					spw.cursor.animateIn(newTarget);
				}
			});

			// when mouse leaves target
			newTarget.addEventListener("mouseleave", (e) => {
				// spw.log("cursor exit");
				spw.cursor.reset();
			});

			newTarget.setAttribute("spw-cursor-applied", true);

			successfulTargets.push(newTarget);
		}

		// Apply the custom cursor to initial targets
		newTargets.forEach((newTarget) => {
			applyCustomCursor(newTarget);
		});

		// Observe the entire document for any new elements added
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						// Check if the added node or any of its children have the spw-cursor attribute
						if (node.matches("[spw-cursor='on']")) {
							applyCustomCursor(node);
						}
						node.querySelectorAll("[spw-cursor='on']").forEach((child) => {
							applyCustomCursor(child);
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

		// animate out cursor
		spw.cursor.animateOut(spw.cursor.target);

		// clear target
		spw.cursor.target = null;

		// remove class from doc
		document.documentElement.classList.remove(spw.cursor.activeClass);

		// reset any styling on cursor
		cursor.setAttribute("spw-cursor-style", "");
		cursor.setAttribute("spw-cursor-icon", "");
		// spw.log("Cursor reset");
	};

	/* helper functions for animating cursor in and out */
	spw.cursor.animateIn = function (target = null) {
		// only animate in for big screens
		if (window.innerWidth < 768) {
			return;
		}
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
						spw.log("sliderFirstMove");
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
						spw.log("Swiper initialised");

						const activeSlide = this.slides[this.activeIndex];
						const video = activeSlide.querySelector("video");
						if (video) {
							video.loop = true;
							video.play();
						}

						// Set custom cursor text on prev, next, and active slides
						this.slides.forEach((slideElement) => {
							const targetElement = slideElement.querySelector("[spw-cursor]");
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
						spw.log("transitionEnd");
						spw.log(spw);
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

							const targetElement = slideElement.querySelector("[spw-cursor]");
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

	spw.loadLatestSlider = function (mySelector) {
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

	spw.loadAboutHeroSlider = function () {
		/* slider specific options */
		const selector = '[splide="about-hero"]';
		const options = {
			perMove: 1,
			gap: "4rem",
			arrows: false,
			pagination: false,
			focus: "center",
			speed: 600,
			dragAngleThreshold: 60,
			autoWidth: true,
			rewind: false,
			rewindSpeed: 400,
			waitForTransition: false,
			updateOnMove: true,
			trimSpace: false,
			type: "loop",
			drag: "free",
			snap: false,
			flickPower: 500,
			flickMaxPages: 1,
			cloneStatus: true,
			lazyLoad: false,
			clones: 20,
			autoScroll: {
				speed: 0.5,
				pauseOnHover: false,
				pauseOnFocus: false,
			},
		};

		/* initialize the slider */
		let target = document.querySelector(selector);
		if (target) {
			let splide = new Splide(target, options);
			splide.mount(window.splide.Extensions);
		}
	};

	spw.updateCopyrightYear();
	spw.startLenis();
	spw.linkHover();
	spw.cursor.init();
	spw.loadHomeHeroSlider();
	spw.loadLatestSlider(".latest_col-wrap.swiper");
	spw.loadAboutHeroSlider();
	spw.scrollDisabler.init();
}
