const workSlideConfig = {
	rootSelector: ".section_work-slide",
	viewportSelector: ".work-slide_swiper",
	wrapperSelector: ".work-slide_list",
	slideSelector: ".work-slide_item",
	cardSelector: ".work-item_component",
	dotsSelector: ".caps_dots",
	arrowSelector: "[data-work-slide]",
	prevSelector: '[data-work-slide="prev"]',
	nextSelector: '[data-work-slide="next"]',
	disabledClass: "swiper-button-disabled",
	containerSelector: ".container",
	revealOptOutAttr: "data-reveal-disabled",
	dotClass: "caps_dot",
	selectedDotClass: "caps_dot--selected",
	grabbingClass: "is-grabbing",
	gapVar: "--work-slide--gap",
	readyValue: "swiper-fixed-v4",
};

export function initWorkSlide(root = document) {
	const roots = Array.from(root.querySelectorAll(workSlideConfig.rootSelector));

	if (!roots.length) return;

	if (!window.Swiper) {
		throw new Error("Swiper failed to load.");
	}

	roots.forEach(initSlider);
}

function getRequired(scope, selector, label) {
	const el = scope.querySelector(selector);

	if (!el) {
		throw new Error("Missing " + label + ': expected "' + selector + '".');
	}

	return el;
}

function getNumber(value) {
	const number = parseFloat(value);

	if (Number.isNaN(number)) {
		return 0;
	}

	return number;
}

function getCssLengthInPx(scope, value) {
	const trimmedValue = String(value || "").trim();

	if (!trimmedValue) {
		return null;
	}

	const probe = document.createElement("div");

	probe.style.position = "absolute";
	probe.style.visibility = "hidden";
	probe.style.pointerEvents = "none";
	probe.style.width = trimmedValue;

	scope.appendChild(probe);

	const width = probe.getBoundingClientRect().width;

	probe.remove();

	if (!width && trimmedValue !== "0" && trimmedValue !== "0px") {
		return null;
	}

	return width;
}

function initSlider(section) {
	const viewport = getRequired(section, workSlideConfig.viewportSelector, "work slider viewport");
	const wrapper = getRequired(section, workSlideConfig.wrapperSelector, "work slider wrapper");
	const dotsNode = getRequired(section, workSlideConfig.dotsSelector, "work slider dots");
	const container = getRequired(
		section,
		workSlideConfig.containerSelector,
		"work slider container",
	);
	const slides = Array.from(wrapper.querySelectorAll(workSlideConfig.slideSelector));

	if (!slides.length) {
		throw new Error('Missing work slides: expected ".work-slide_item".');
	}

	if (section.dataset.workSlideReady === workSlideConfig.readyValue) {
		return;
	}

	if (viewport.swiper) {
		viewport.swiper.destroy(true, true);
	}

	section.dataset.workSlideReady = workSlideConfig.readyValue;

	viewport.classList.remove("embla", "keen-slider");
	wrapper.classList.remove("embla__container", "keen-slider", "swiper-wrapper");

	slides.forEach(function (slide) {
		slide.classList.remove("embla__slide", "keen-slider__slide", "swiper-slide");
		slide.style.marginLeft = "";
		slide.style.marginRight = "";
		slide.style.width = "";
		slide.style.minWidth = "";
		slide.style.maxWidth = "";
		slide.style.flexBasis = "";
	});

	const slideGap = getSlideGap();

	wrapper.style.gap = "0px";
	wrapper.style.columnGap = "0px";
	wrapper.style.rowGap = "0px";

	setEqualSlideWidth();

	viewport.classList.add("swiper");
	wrapper.classList.add("swiper-wrapper");

	slides.forEach(function (slide) {
		slide.classList.add("swiper-slide");

		// The site reveals work cards on scroll by watching .work_list-item, which
		// a slide is not, so an unclaimed card would sit at opacity 0 forever.
		// The reveal already ships an opt-out attribute; using it keeps the escape
		// hatch in one place instead of a CSS override.
		const card = slide.querySelector(workSlideConfig.cardSelector);

		if (card) {
			card.setAttribute(workSlideConfig.revealOptOutAttr, "");
		}
	});

	let swiper = null;
	let updateFrame = null;
	let dotNodes = [];

	const initialMetrics = getSliderMetrics();

	// The Designer marks optional controls with data-work-slide="prev" or "next".
	// Handing them to Swiper's own navigation module — rather than stepping the
	// slider by hand — is what gives them .swiper-button-disabled at each end,
	// the class the site's shared slider-arrows CSS already styles.
	const prevArrow = section.querySelector(workSlideConfig.prevSelector);
	const nextArrow = section.querySelector(workSlideConfig.nextSelector);

	swiper = new window.Swiper(viewport, {
		navigation:
			prevArrow || nextArrow
				? {
						prevEl: prevArrow,
						nextEl: nextArrow,
						disabledClass: workSlideConfig.disabledClass,
					}
				: false,
		slidesPerView: "auto",
		slidesPerGroup: 1,
		spaceBetween: initialMetrics.gap,
		slidesOffsetBefore: initialMetrics.before,
		slidesOffsetAfter: initialMetrics.after,
		speed: 450,
		resistance: false,
		grabCursor: false,
		watchOverflow: true,
		normalizeSlideIndex: true,
		slideToClickedSlide: false,
		longSwipes: true,
		shortSwipes: true,
		followFinger: true,
		threshold: 6,
		preventClicks: false,
		preventClicksPropagation: false,
		on: {
			init: function (instance) {
				buildDots(instance);
				updateActiveDot(instance);
			},
			slideChange: function (instance) {
				updateActiveDot(instance);
			},
			transitionEnd: function (instance) {
				updateActiveDot(instance);
			},
			reachEnd: function (instance) {
				updateActiveDot(instance);
			},
			fromEdge: function (instance) {
				updateActiveDot(instance);
			},
			resize: scheduleUpdate,
		},
	});

	wireGrabCursor(viewport);
	protectSlideLinks(viewport);
	wireArrowKeys(section);

	window.addEventListener("resize", scheduleUpdate);
	window.addEventListener("load", scheduleUpdate, { once: true });

	const resizeObserver = new ResizeObserver(scheduleUpdate);

	resizeObserver.observe(viewport);
	resizeObserver.observe(container);

	function getSlideGap() {
		const styles = window.getComputedStyle(section);
		const cssGap = getCssLengthInPx(section, styles.getPropertyValue(workSlideConfig.gapVar));

		if (cssGap !== null) {
			return cssGap;
		}

		return 0;
	}

	function setEqualSlideWidth() {
		section.style.setProperty("--work-slide-item-width", "auto");

		const widths = slides.map(function (slide) {
			const card = slide.querySelector(workSlideConfig.cardSelector) || slide;

			return card.getBoundingClientRect().width;
		});

		const maxWidth = Math.max.apply(null, widths);

		if (!maxWidth) {
			throw new Error("Work slider width failed: slide width measured as 0.");
		}

		section.style.setProperty("--work-slide-item-width", maxWidth + "px");
	}

	function getContainerContentRect() {
		const rect = container.getBoundingClientRect();
		const styles = window.getComputedStyle(container);
		const paddingLeft = getNumber(styles.paddingLeft);
		const paddingRight = getNumber(styles.paddingRight);

		return {
			left: rect.left + paddingLeft,
			right: rect.right - paddingRight,
		};
	}

	function getSliderMetrics() {
		const viewportRect = viewport.getBoundingClientRect();
		const contentRect = getContainerContentRect();
		const gap = getSlideGap();

		const before = Math.max(0, contentRect.left - viewportRect.left);
		const after = Math.max(0, viewportRect.right - contentRect.right);

		return {
			before: before,
			after: after,
			gap: gap,
		};
	}

	function applySliderMetrics() {
		setEqualSlideWidth();

		const metrics = getSliderMetrics();

		swiper.params.spaceBetween = metrics.gap;
		swiper.params.slidesOffsetBefore = metrics.before;
		swiper.params.slidesOffsetAfter = metrics.after;
	}

	function buildDots(instance) {
		dotsNode.innerHTML = slides
			.map(function (_, index) {
				return (
					'<button class="' +
					workSlideConfig.dotClass +
					'" type="button" data-index="' +
					index +
					'" aria-label="Go to selected work slide ' +
					(index + 1) +
					'"></button>'
				);
			})
			.join("");

		dotNodes = Array.from(dotsNode.querySelectorAll("." + workSlideConfig.dotClass));

		dotNodes.forEach(function (dot) {
			dot.addEventListener("click", function () {
				instance.slideTo(Number(dot.dataset.index));
			});
		});
	}

	function getSelectedIndex(instance) {
		if (instance.isEnd) {
			return slides.length - 1;
		}

		if (instance.isBeginning) {
			return 0;
		}

		return instance.activeIndex;
	}

	function updateActiveDot(instance) {
		const selectedIndex = getSelectedIndex(instance);

		dotNodes.forEach(function (dot, index) {
			dot.classList.toggle(workSlideConfig.selectedDotClass, index === selectedIndex);
		});
	}

	function scheduleUpdate() {
		if (updateFrame) {
			window.cancelAnimationFrame(updateFrame);
		}

		updateFrame = window.requestAnimationFrame(function () {
			if (!swiper || swiper.destroyed) {
				throw new Error("Work slider update failed: Swiper instance is not available.");
			}

			applySliderMetrics();
			swiper.update();
			updateActiveDot(swiper);

			updateFrame = null;
		});
	}

	// The controls are divs with role="button", so Enter and Space do not
	// activate them by themselves. Swiper owns the click; this only forwards the
	// keys to it, and a disabled arrow stays inert because Swiper ignores it.
	function wireArrowKeys(scope) {
		const arrows = Array.from(scope.querySelectorAll(workSlideConfig.arrowSelector));

		arrows.forEach(function (arrow) {
			arrow.addEventListener("keydown", function (event) {
				if (event.key !== "Enter" && event.key !== " ") {
					return;
				}

				event.preventDefault();
				arrow.click();
			});
		});
	}

	function protectSlideLinks(el) {
		let pointerStart = null;
		let didDrag = false;

		function onPointerDown(event) {
			const link = event.target.closest("a");

			if (!link || !el.contains(link)) {
				pointerStart = null;
				didDrag = false;
				return;
			}

			pointerStart = {
				x: event.clientX,
				y: event.clientY,
			};

			didDrag = false;
		}

		function onPointerMove(event) {
			if (!pointerStart) {
				return;
			}

			const deltaX = Math.abs(event.clientX - pointerStart.x);
			const deltaY = Math.abs(event.clientY - pointerStart.y);

			if (deltaX > 6 || deltaY > 6) {
				didDrag = true;
			}
		}

		function onClick(event) {
			const link = event.target.closest("a");

			if (!link || !el.contains(link)) {
				return;
			}

			if (didDrag) {
				event.preventDefault();
			}
		}

		function onPointerEnd() {
			pointerStart = null;

			window.setTimeout(function () {
				didDrag = false;
			}, 0);
		}

		el.addEventListener("pointerdown", onPointerDown);
		el.addEventListener("pointermove", onPointerMove);
		el.addEventListener("click", onClick, true);
		el.addEventListener("pointerup", onPointerEnd);
		el.addEventListener("pointercancel", onPointerEnd);
	}

	function wireGrabCursor(el) {
		function setGrabbing(on) {
			el.classList.toggle(workSlideConfig.grabbingClass, on);
		}

		function onPointerDown(event) {
			if (event.pointerType === "mouse" && event.button !== 0) {
				return;
			}

			setGrabbing(true);
		}

		function onPointerUp() {
			setGrabbing(false);
		}

		el.addEventListener("pointerdown", onPointerDown, { passive: true });
		el.addEventListener("pointerup", onPointerUp, { passive: true });
		el.addEventListener("pointercancel", onPointerUp, { passive: true });
		window.addEventListener("blur", onPointerUp);
	}
}
