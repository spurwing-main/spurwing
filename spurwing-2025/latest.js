function main() {
	gsap.registerPlugin(Draggable);

	/* Splide defaults */
	Splide.defaults = {
		perMove: 1,
		gap: "0rem",
		arrows: false,
		pagination: false,
		focus: 0,
		flickPower: 400,
		speed: 600,
		dragAngleThreshold: 60,
		autoWidth: true,
		rewind: false,
		rewindSpeed: 400,
		waitForTransition: false,
		updateOnMove: true,
		trimSpace: "move",
		type: "slide",
		drag: "free",
		snap: false,
		autoplay: false,
	};

	/* Helper: Check if an element is in the viewport */
	function isElementInViewport(el) {
		const rect = el.getBoundingClientRect();
		return (
			rect.top < window.innerHeight &&
			rect.bottom > 0 &&
			rect.left < window.innerWidth &&
			rect.right > 0
		);
	}

	function initializeSplide({
		selector,
		options,
		useExtensions = false,
		useProgressBar = false,
	}) {
		const targets = document.querySelectorAll(selector);

		targets.forEach((target) => {
			const track = target.querySelector(".splide__track");
			const list = target.querySelector(".splide__list");
			const slides = target.querySelectorAll(".splide__slide");

			if (!track || !list || slides.length === 0) {
				console.warn(`Incomplete Splide structure for target:`, target);
				return;
			}

			const splide = new Splide(target, options);
			let progressWrapper = target.querySelector(".track");
			let bar = target.querySelector(".handle-wrapper");
			let observer;
			let isHandleDragging = false;

			// Update handle position based on slider position
			const updateProgressBar = () => {
				if (!list || !bar || !progressWrapper || isHandleDragging) return;

				const { Layout, Move, Direction } = splide.Components;
				const position = Direction.orient(Move.getPosition());
				const base = Layout.sliderSize();
				const containerW = target.getBoundingClientRect().width;
				const adjustedBase = base - containerW;

				const rate = adjustedBase > 0 ? position / adjustedBase : 0;
				const maxTranslateX = progressWrapper.offsetWidth - bar.offsetWidth;
				const translateX = rate * maxTranslateX;

				gsap.to(bar, {
					x: translateX,
					duration: 0.3,
					ease: "power2.out",
				});
			};

			// Enable syncing from slider to handle
			const enableProgressBar = () => {
				if (!list || !bar || !progressWrapper) return;

				let lastTransform = "";
				observer = new MutationObserver(() => {
					const currentTransform = list.style.transform;
					if (currentTransform !== lastTransform) {
						lastTransform = currentTransform;
						updateProgressBar();
					}
				});

				observer.observe(list, {
					attributes: true,
					attributeFilter: ["style"],
				});

				splide.on("mounted move", updateProgressBar);
			};

			const disableProgressBar = () => {
				if (observer) observer.disconnect();
				if (bar) bar.style.transform = "";
			};

			const handleResize = () => {
				if (window.innerWidth <= 767) {
					disableProgressBar();
				} else if (useProgressBar) {
					enableProgressBar();
				}
			};

			// Setup progress bar if enabled
			if (useProgressBar) enableProgressBar();

			window.addEventListener("resize", handleResize);
			splide.on("destroy", () => {
				window.removeEventListener("resize", handleResize);
				disableProgressBar();
			});

			// Disable drag during scroll
			let isScrolling = false;
			window.addEventListener("scroll", () => {
				if (!isScrolling) {
					isScrolling = true;
					requestAnimationFrame(() => {
						if (isElementInViewport(target)) {
							splide.options.drag = false;
						}
						isScrolling = false;
					});
				}
			});

			window.addEventListener("scrollend", () => {
				if (isElementInViewport(target)) {
					splide.options.drag = "free";
				}
			});

			target.addEventListener("click", (e) => {
				if (splide.Components.Drag.isDragging()) {
					e.preventDefault();
					e.stopImmediatePropagation();
				}
			});

			// Mount the slider
			if (useExtensions) {
				splide.mount(window.splide.Extensions);
			} else {
				splide.mount();
			}

			//  Enable dragging the handle to control the slider
			if (bar && progressWrapper) {
				const updateSliderFromHandle = (x) => {
					const maxTranslateX = progressWrapper.offsetWidth - bar.offsetWidth;
					const fraction = Math.max(0, Math.min(x / maxTranslateX, 1)); // clamp

					const slideCount = splide.Components.Slides.get().length;
					const maxIndex = slideCount - 1;
					console.log({ fraction, maxIndex });
					splide.go(Math.round(fraction * maxIndex));
				};

				Draggable.create(bar, {
					type: "x",
					bounds: progressWrapper,
					inertia: false,
					onPress() {
						isHandleDragging = true;
						bar.classList.add("is-dragging");
					},
					onDrag() {
						updateSliderFromHandle(this.x);
					},
					onRelease() {
						isHandleDragging = false;
						bar.classList.remove("is-dragging");
					},
				});
			}
		});
	}

	/* Loop through and initialize sliders */
	initializeSplide({
		selector: ".splide",
		options: {},
		useExtensions: false,
		useProgressBar: true,
	});
}
