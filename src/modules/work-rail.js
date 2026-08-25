import { initializeOnce } from "./init-once.js";

let EmblaCarousel;
let emblaLoad;
const initKey = Symbol("workRailInit");

const config = {
	sectionSelector: ".section_work-hero",
	railSelector: ".work-rail",
	viewportSelector: ".work-rail_viewport",
	trackSelector: ".work-rail_track",
	slideSelector: ".work-rail_slide",
	textListSelector: ".work-rail_text-list",
	textItemSelector: ".work-rail_text-item",
	prevBtnSelector: '[data-work-rail="prev"]',
	nextBtnSelector: '[data-work-rail="next"]',
	featuredClass: "is-featured",
	movingClass: "is-moving",
	overflowLeftClass: "is-overflow-left",
	overflowRightClass: "is-overflow-right",
	modeAttr: "data-mode",
	mobileMq: "(max-width: 767px)",
	leadSlides: 3,
	cloneBufferSlots: 8,
	cssVars: {
		duration: "--dur-move",
		ease: "--ease-move",
	},
	text: {
		enterVar: "--text-enter-x",
		exitVar: "--text-exit-x",
		enterForward: "15%",
		exitForward: "-5%",
		enterBackward: "-15%",
		exitBackward: "5%",
	},
};

const px = (v, fallback = 0) => {
	const n = Number.parseFloat(v);
	return Number.isFinite(n) ? n : fallback;
};

const mod = (n, m) => ((n % m) + m) % m;

const round = (n, precision = 100) => Math.round(n * precision) / precision;

const required = (scope, sel, label = sel) => {
	const el = scope.querySelector(sel);
	if (!el) throw new Error(`work-rail: missing ${label} (${sel})`);
	return el;
};

const inferLoopedDir = (curr, prev, count) => {
	if (count <= 1 || curr === prev) return 1;
	const fwd = (curr - prev + count) % count;
	const back = (prev - curr + count) % count;
	return fwd <= back ? 1 : -1;
};

function createStable(rail) {
	let token = 0;
	let raf1 = 0;
	let raf2 = 0;

	const clear = () => {
		if (raf1) cancelAnimationFrame(raf1);
		if (raf2) cancelAnimationFrame(raf2);
		raf1 = 0;
		raf2 = 0;
	};

	rail.dataset.stable = "0";

	return {
		hide() {
			token += 1;
			clear();
			rail.dataset.stable = "0";
		},

		showSoon() {
			const id = ++token;
			clear();

			raf1 = requestAnimationFrame(() => {
				raf1 = 0;
				raf2 = requestAnimationFrame(() => {
					raf2 = 0;
					if (id !== token) return;
					rail.dataset.stable = "1";
				});
			});
		},

		destroy() {
			clear();
		},
	};
}

function createText(section, count) {
	const list = required(section, config.textListSelector, "text list");
	const items = Array.from(list.querySelectorAll(config.textItemSelector));

	if (items.length !== count) {
		throw new Error(
			`work-rail: text item count (${items.length}) must match slide count (${count})`,
		);
	}

	let activeIndex = 0;
	let prevIndex = 0;
	let hasAnimated = false;

	const setDirVars = (dir) => {
		const forward = dir > 0;
		list.style.setProperty(
			config.text.enterVar,
			forward ? config.text.enterForward : config.text.enterBackward,
		);
		list.style.setProperty(
			config.text.exitVar,
			forward ? config.text.exitForward : config.text.exitBackward,
		);
	};

	const setInstant = (next) => {
		items.forEach((el, i) => {
			el.classList.toggle("is-active", i === next);
			el.classList.remove("is-prev", "is-prep");
		});
		activeIndex = next;
		prevIndex = next;
		hasAnimated = true;
	};

	const setAnimated = (next) => {
		const prevEl = items[prevIndex];
		const nextEl = items[next];

		items.forEach((el, i) => {
			if (i !== prevIndex && i !== next) {
				el.classList.remove("is-active", "is-prev", "is-prep");
			}
		});

		prevEl.classList.remove("is-active", "is-prep");
		prevEl.classList.add("is-prev");

		nextEl.classList.remove("is-active", "is-prev");
		nextEl.classList.add("is-prep");

		requestAnimationFrame(() => {
			nextEl.classList.remove("is-prep");
			nextEl.classList.add("is-active");
		});

		activeIndex = next;
		prevIndex = next;
		hasAnimated = true;
	};

	return {
		sync(rawIndex, dir = 1, instant = false) {
			if (!Number.isInteger(rawIndex)) return;

			const next = mod(rawIndex, items.length);
			if (hasAnimated && next === activeIndex) return;

			setDirVars(dir);

			if (!hasAnimated || instant) {
				setInstant(next);
				return;
			}

			setAnimated(next);
		},
	};
}

function clearSlideState(slides) {
	slides.forEach((slide) => {
		slide.classList.remove(
			config.featuredClass,
			config.overflowLeftClass,
			config.overflowRightClass,
		);
		slide.removeAttribute("aria-current");
	});
}

function getCustomVisibleCount(rail) {
	const sideCount = px(getComputedStyle(rail).getPropertyValue("--side-count"), 3);
	return Math.max(1, Math.round(sideCount));
}

function syncGeometryOverflowScrims(slides, boundsEl, featuredIndex) {
	const boundsRect = boundsEl.getBoundingClientRect();
	const leftEdge = boundsRect.left;
	const rightEdge = boundsRect.right;
	const threshold = 3;

	slides.forEach((slide, index) => {
		if (index === featuredIndex) {
			slide.classList.remove(config.overflowLeftClass, config.overflowRightClass);
			return;
		}

		const rect = slide.getBoundingClientRect();
		const isOverflowLeft = rect.left < leftEdge - threshold;
		const isOverflowRight = rect.right > rightEdge + threshold;

		slide.classList.toggle(config.overflowLeftClass, isOverflowLeft);
		slide.classList.toggle(config.overflowRightClass, isOverflowRight);
	});
}

function syncCustomOverflowScrims(slides, featuredIndex, rail) {
	const visibleCount = getCustomVisibleCount(rail);
	const visibleStart = featuredIndex;
	const visibleEnd = featuredIndex + visibleCount;

	slides.forEach((slide, index) => {
		const isVisible = index >= visibleStart && index <= visibleEnd;
		const isOverflowLeft = index < visibleStart;
		const isOverflowRight = index > visibleEnd;

		slide.classList.toggle(config.overflowLeftClass, !isVisible && isOverflowLeft);
		slide.classList.toggle(config.overflowRightClass, !isVisible && isOverflowRight);
	});
}

function createWorkRail(section) {
	const rail = required(section, config.railSelector, "rail");
	const viewport = required(rail, config.viewportSelector, "viewport");
	const track = required(rail, config.trackSelector, "track");
	const prevBtn = section.querySelector(config.prevBtnSelector);
	const nextBtn = section.querySelector(config.nextBtnSelector);

	const originals = Array.from(track.querySelectorAll(config.slideSelector));
	if (!originals.length) {
		throw new Error(`work-rail: no slides (${config.slideSelector})`);
	}

	originals.forEach((slide, i) => {
		slide.dataset.originIndex = String(i);
	});

	const count = originals.length;
	const originalMarkup = track.innerHTML;
	const stable = createStable(rail);
	const text = createText(section, count);
	const mobileMq = matchMedia(config.mobileMq);
	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

	const restoreSlides = () => {
		track.innerHTML = originalMarkup;

		const slides = Array.from(track.querySelectorAll(config.slideSelector));
		clearSlideState(slides);

		track.classList.remove(config.movingClass);
		track.style.transform = "";

		return slides;
	};

	const setFeatured = (slides, currentFeatured, index) => {
		const next = slides[index];
		if (!next) return currentFeatured;

		if (currentFeatured && currentFeatured !== next) {
			currentFeatured.classList.remove(config.featuredClass);
			currentFeatured.removeAttribute("aria-current");
		}

		if (currentFeatured !== next) {
			next.classList.add(config.featuredClass);
			next.setAttribute("aria-current", "true");
		}

		return next;
	};

	const createEmblaMode = () => {
		rail.setAttribute(config.modeAttr, "embla");
		stable.hide();

		const slides = restoreSlides();
		const container = rail.closest(".container");
		if (!container) {
			throw new Error('work-rail: missing closest ".container" for embla alignment');
		}

		const getInset = () => {
			const containerRect = container.getBoundingClientRect();
			const viewportRect = viewport.getBoundingClientRect();
			const paddingLeft = px(getComputedStyle(container).paddingLeft, 0);
			return containerRect.left + paddingLeft - viewportRect.left;
		};

		const getLayoutSignature = () => {
			const railRect = rail.getBoundingClientRect();
			const viewportRect = viewport.getBoundingClientRect();
			const sample =
				track.querySelector(`.work-rail_slide:not(.${config.featuredClass})`) ||
				track.querySelector(config.slideSelector);
			const sampleWidth = sample ? sample.getBoundingClientRect().width : 0;
			const gap = px(getComputedStyle(track).gap, 0);

			return [
				round(railRect.width),
				round(viewportRect.width),
				round(getInset()),
				round(sampleWidth),
				round(gap),
			].join("|");
		};

		const embla = EmblaCarousel(viewport, {
			align: () => getInset(),
			loop: true,
			containScroll: false,
			dragFree: false,
			skipSnaps: false,
		});

		const controller = new AbortController();
		const { signal } = controller;

		let featured = null;
		let lastSnap = embla.selectedScrollSnap();
		let resizeRaf = 0;
		let lastLayoutSignature = "";

		const sync = (instant = false) => {
			const currentSnap = embla.selectedScrollSnap();
			const snapCount = embla.scrollSnapList().length;
			const slide = slides[currentSnap];
			if (!slide) return;

			const dir = inferLoopedDir(currentSnap, lastSnap, snapCount);
			lastSnap = currentSnap;

			featured = setFeatured(slides, featured, currentSnap);
			syncGeometryOverflowScrims(slides, viewport, currentSnap);
			text.sync(Number.parseInt(slide.dataset.originIndex || "0", 10), dir, instant);

			lastLayoutSignature = getLayoutSignature();
			stable.showSoon();
		};

		const scheduleReinit = () => {
			if (resizeRaf) return;

			const nextSignature = getLayoutSignature();
			if (nextSignature === lastLayoutSignature) return;

			stable.hide();

			resizeRaf = requestAnimationFrame(() => {
				resizeRaf = 0;
				embla.reInit();
			});
		};

		prevBtn?.addEventListener(
			"click",
			(e) => {
				e.preventDefault();
				embla.scrollPrev();
			},
			{ signal },
		);

		nextBtn?.addEventListener(
			"click",
			(e) => {
				e.preventDefault();
				embla.scrollNext();
			},
			{ signal },
		);

		embla.on("select", () => {
			sync(false);
		});

		embla.on("reInit", () => {
			sync(true);
		});

		const ro = new ResizeObserver(scheduleReinit);
		ro.observe(rail);
		ro.observe(container);
		ro.observe(viewport);

		window.addEventListener("resize", scheduleReinit, { signal, passive: true });
		window.visualViewport?.addEventListener("resize", scheduleReinit, { signal, passive: true });

		sync(true);

		return () => {
			if (resizeRaf) cancelAnimationFrame(resizeRaf);
			ro.disconnect();
			controller.abort();
			embla.destroy();
			rail.removeAttribute(config.modeAttr);
		};
	};

	const createCustomMode = () => {
		rail.setAttribute(config.modeAttr, "custom");
		stable.hide();

		const templates = restoreSlides().map((slide) => slide.cloneNode(true));
		const trackNow = required(rail, config.trackSelector, "track");
		const viewportNow = required(rail, config.viewportSelector, "viewport");

		if (!prevBtn) throw new Error(`work-rail: missing prev button (${config.prevBtnSelector})`);
		if (!nextBtn) throw new Error(`work-rail: missing next button (${config.nextBtnSelector})`);

		const controller = new AbortController();
		const { signal } = controller;

		const state = {
			slides: [],
			featuredIndex: 0,
			visualFeaturedIndex: 0,
			featured: null,
			baseW: 0,
			gap: 16,
			containerLeft: 0,
			baseTransform: 0,
			durationMs: 700,
			ease: "cubic-bezier(0.22, 0.61, 0.36, 1)",
			animation: null,
		};

		let renderRaf = 0;
		let lastLayoutSignature = "";

		const logicalIndexAt = (visualIndex) => {
			return Number.parseInt(state.slides[visualIndex]?.dataset.originIndex || "0", 10) || 0;
		};

		const readX = () => {
			const t = getComputedStyle(trackNow).transform;
			if (!t || t === "none") return state.baseTransform;
			return new DOMMatrixReadOnly(t).m41;
		};

		const cancelAnimation = () => {
			state.animation?.cancel();
			state.animation = null;
		};

		const shiftSlides = (steps) => {
			if (!steps) return;

			if (steps > 0) {
				for (let i = 0; i < steps; i += 1) {
					const first = state.slides.shift();
					if (!first) break;
					state.slides.push(first);
					trackNow.appendChild(first);
				}
				return;
			}

			for (let i = 0; i < -steps; i += 1) {
				const last = state.slides.pop();
				if (!last) break;
				state.slides.unshift(last);
				trackNow.prepend(last);
			}
		};

		const measure = () => {
			const viewportRect = viewportNow.getBoundingClientRect();
			const railRect = rail.getBoundingClientRect();
			const railStyles = getComputedStyle(rail);
			const trackStyles = getComputedStyle(trackNow);

			state.gap = px(trackStyles.gap, 16);
			state.durationMs = px(railStyles.getPropertyValue(config.cssVars.duration), 700);
			state.ease = railStyles.getPropertyValue(config.cssVars.ease).trim() || state.ease;
			state.containerLeft = railRect.left - viewportRect.left;

			const sample =
				trackNow.querySelector(`.work-rail_slide:not(.${config.featuredClass})`) ||
				trackNow.querySelector(config.slideSelector);

			state.baseW = sample
				? sample.getBoundingClientRect().width
				: Math.max(1, railRect.width * 0.25);
		};

		const getLayoutSignature = () => {
			const railRect = rail.getBoundingClientRect();
			const viewportRect = viewportNow.getBoundingClientRect();
			return [
				round(railRect.width),
				round(viewportRect.width),
				round(state.baseW),
				round(state.gap),
				round(state.containerLeft),
			].join("|");
		};

		const rebuild = () => {
			const span = Math.max(1, state.baseW + state.gap);
			const viewportWidth = Math.max(1, viewportNow.clientWidth);
			const perSide = Math.max(
				1,
				Math.ceil((viewportWidth / span + config.cloneBufferSlots) / templates.length),
			);

			const frag = document.createDocumentFragment();
			const pushBlock = () => {
				templates.forEach((tpl) => frag.appendChild(tpl.cloneNode(true)));
			};

			for (let i = 0; i < perSide; i += 1) pushBlock();
			pushBlock();
			for (let i = 0; i < perSide; i += 1) pushBlock();

			trackNow.replaceChildren(frag);
			state.slides = Array.from(trackNow.querySelectorAll(config.slideSelector));

			const lead = Math.min(config.leadSlides, Math.max(1, templates.length - 2));
			state.featuredIndex = perSide * templates.length + lead;
			state.visualFeaturedIndex = state.featuredIndex;
			state.featured = null;
			state.baseTransform = state.containerLeft - state.featuredIndex * span;
		};

		const syncDecorators = (originIndex, dir, instant) => {
			state.featured = setFeatured(state.slides, state.featured, state.visualFeaturedIndex);
			syncCustomOverflowScrims(state.slides, state.visualFeaturedIndex, rail);
			text.sync(originIndex, dir, instant);

			lastLayoutSignature = getLayoutSignature();
			stable.showSoon();
		};

		const settle = (dir, instant) => {
			cancelAnimation();
			trackNow.classList.remove(config.movingClass);
			trackNow.style.transform = `translateX(${state.baseTransform}px)`;
			state.visualFeaturedIndex = state.featuredIndex;
			syncDecorators(logicalIndexAt(state.featuredIndex), dir, instant);
		};

		const finishMove = (targetIndex, dir) => {
			shiftSlides(targetIndex - state.featuredIndex);
			settle(dir, false);
		};

		const moveTo = (targetIndex) => {
			if (!state.slides.length) return;

			const nextVisual = mod(targetIndex, state.slides.length);
			if (nextVisual === state.visualFeaturedIndex) return;

			const fromX = readX();
			const span = state.baseW + state.gap;
			const toX = state.containerLeft - nextVisual * span;
			const dir = Math.sign(fromX - toX) || 1;

			state.visualFeaturedIndex = nextVisual;
			syncDecorators(logicalIndexAt(nextVisual), dir, false);
			cancelAnimation();

			if (reduceMotion.matches) {
				trackNow.style.transform = `translateX(${toX}px)`;
				finishMove(nextVisual, dir);
				return;
			}

			trackNow.classList.add(config.movingClass);

			const anim = trackNow.animate(
				[{ transform: `translateX(${fromX}px)` }, { transform: `translateX(${toX}px)` }],
				{ duration: state.durationMs, easing: state.ease, fill: "forwards" },
			);

			state.animation = anim;

			anim.finished
				.then(() => {
					if (state.animation !== anim) return;
					anim.commitStyles();
					anim.cancel();
					state.animation = null;
					finishMove(nextVisual, dir);
				})
				.catch(() => {
					if (state.animation === anim) state.animation = null;
				});
		};

		const rerender = () => {
			stable.hide();
			cancelAnimation();
			measure();
			rebuild();
			trackNow.classList.remove(config.movingClass);
			trackNow.style.transform = `translateX(${state.baseTransform}px)`;
			state.visualFeaturedIndex = state.featuredIndex;
			syncDecorators(logicalIndexAt(state.featuredIndex), 1, true);
		};

		const scheduleRender = () => {
			if (renderRaf) return;

			measure();
			const nextSignature = getLayoutSignature();
			if (nextSignature === lastLayoutSignature) return;

			stable.hide();

			renderRaf = requestAnimationFrame(() => {
				renderRaf = 0;
				rerender();
			});
		};

		trackNow.addEventListener(
			"click",
			(event) => {
				const slide = event.target.closest(config.slideSelector);
				if (!slide) return;

				const index = state.slides.indexOf(slide);
				if (index < 0) return;
				if (index === state.visualFeaturedIndex) return;

				event.preventDefault();
				moveTo(index);
			},
			{ signal },
		);

		prevBtn.addEventListener(
			"click",
			(e) => {
				e.preventDefault();
				moveTo(state.visualFeaturedIndex - 1);
			},
			{ signal },
		);

		nextBtn.addEventListener(
			"click",
			(e) => {
				e.preventDefault();
				moveTo(state.visualFeaturedIndex + 1);
			},
			{ signal },
		);

		const ro = new ResizeObserver(scheduleRender);
		ro.observe(viewportNow);
		ro.observe(rail);

		window.addEventListener("resize", scheduleRender, { signal, passive: true });
		window.visualViewport?.addEventListener("resize", scheduleRender, { signal, passive: true });
		reduceMotion.addEventListener("change", scheduleRender);

		rerender();

		return () => {
			if (renderRaf) cancelAnimationFrame(renderRaf);
			cancelAnimation();
			ro.disconnect();
			controller.abort();
			reduceMotion.removeEventListener("change", scheduleRender);
			rail.removeAttribute(config.modeAttr);
		};
	};

	const mode = {
		current: "",
		teardown: null,
	};

	let modeRaf = 0;

	const applyMode = () => {
		const nextMode = mobileMq.matches ? "embla" : "custom";
		if (mode.current === nextMode) return;

		stable.hide();
		mode.teardown?.();
		mode.teardown = nextMode === "embla" ? createEmblaMode() : createCustomMode();
		mode.current = nextMode;
	};

	const scheduleApplyMode = () => {
		if (modeRaf) return;

		modeRaf = requestAnimationFrame(() => {
			modeRaf = 0;
			applyMode();
		});
	};

	applyMode();
	mobileMq.addEventListener("change", scheduleApplyMode);

	return {
		destroy() {
			mobileMq.removeEventListener("change", scheduleApplyMode);
			if (modeRaf) cancelAnimationFrame(modeRaf);
			mode.teardown?.();
			stable.destroy();
		},
	};
}

function loadDefaultEmbla() {
	return import("https://cdn.jsdelivr.net/npm/embla-carousel@8.6.0/+esm");
}

async function loadEmbla(load) {
	if (EmblaCarousel) return;

	emblaLoad ||= load()
		.then((module) => {
			EmblaCarousel = module.default;
		})
		.catch((error) => {
			emblaLoad = null;
			throw error;
		});

	await emblaLoad;
}

export async function initWorkRail(root = document, load = loadDefaultEmbla) {
	const sections = Array.from(root.querySelectorAll(config.sectionSelector));
	if (!sections.length) return;

	await Promise.all(
		sections.map((section) => {
			if (section.workRail) return undefined;

			return initializeOnce(section, initKey, async () => {
				await loadEmbla(load);
				if (section.workRail) return;
				section.workRail = createWorkRail(section);
			});
		}),
	);
}
