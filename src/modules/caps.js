const emblaUrl = "https://cdn.jsdelivr.net/npm/embla-carousel/embla-carousel.umd.js";
const autoplayDelay = 4000;

document.addEventListener("DOMContentLoaded", initEmblaSliders);

async function initEmblaSliders() {
	if (!window.EmblaCarousel) {
		await import(emblaUrl);
	}

	if (!window.EmblaCarousel) {
		throw new Error("Embla Carousel failed to load.");
	}

	document.querySelectorAll(".embla").forEach(initSlider);
}

function initSlider(slider) {
	const container = slider.querySelector(".embla__container");
	const slides = slider.querySelectorAll(".embla__slide");
	const dotsNode = slider.querySelector(".carousel-dots");

	// Not a carousel instance: the "Capabilities slider" Component shows a single
	// image when its slot is empty, so most .embla roots have no slides. Skip
	// them; throwing here aborts the forEach and kills every later slider.
	if (!container || !slides.length || !dotsNode) {
		return;
	}

	const emblaApi = window.EmblaCarousel(slider, {
		loop: true,
		align: "start",
	});

	let dotNodes = [];
	let autoplayTimer = null;
	let isVisible = false;

	function buildDots() {
		dotsNode.innerHTML = emblaApi
			.scrollSnapList()
			.map((_, index) => {
				return `<button class="carousel-dot" type="button" data-index="${index}" aria-label="Go to slide ${index + 1}"></button>`;
			})
			.join("");

		dotNodes = Array.from(dotsNode.querySelectorAll(".carousel-dot"));

		dotNodes.forEach((dot) => {
			dot.addEventListener("click", () => {
				emblaApi.scrollTo(Number(dot.dataset.index));
				restartAutoplay();
			});
		});
	}

	function updateActiveDot() {
		const selectedIndex = emblaApi.selectedScrollSnap();

		dotNodes.forEach((dot, index) => {
			dot.classList.toggle("is-selected", index === selectedIndex);
		});
	}

	function startAutoplay() {
		if (autoplayTimer || !isVisible) return;

		autoplayTimer = window.setInterval(() => {
			emblaApi.scrollNext();
		}, autoplayDelay);
	}

	function stopAutoplay() {
		if (!autoplayTimer) return;

		window.clearInterval(autoplayTimer);
		autoplayTimer = null;
	}

	function restartAutoplay() {
		stopAutoplay();
		startAutoplay();
	}

	const observer = new IntersectionObserver(
		([entry]) => {
			isVisible = entry.isIntersecting;

			if (isVisible) {
				startAutoplay();
			} else {
				stopAutoplay();
			}
		},
		{ threshold: 0.3 },
	);

	slider.addEventListener("mouseenter", stopAutoplay);
	slider.addEventListener("mouseleave", startAutoplay);

	emblaApi
		.on("init", buildDots)
		.on("reInit", buildDots)
		.on("init", updateActiveDot)
		.on("reInit", updateActiveDot)
		.on("select", updateActiveDot)
		.on("pointerDown", stopAutoplay)
		.on("pointerUp", startAutoplay);

	buildDots();
	updateActiveDot();
	observer.observe(slider);
}
