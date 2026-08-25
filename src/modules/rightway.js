const emblaUrl = "https://cdn.jsdelivr.net/npm/embla-carousel/embla-carousel.umd.js";
const sliderBreakpoint = 991;

document.addEventListener("DOMContentLoaded", initRightwaySlider);

async function initRightwaySlider() {
	const slider = document.querySelector(".rightway_slider");

	if (!slider) {
		throw new Error('Rightway slider root ".rightway_slider" not found.');
	}

	if (!window.EmblaCarousel) {
		await import(emblaUrl);
	}

	if (!window.EmblaCarousel) {
		throw new Error("Embla Carousel failed to load.");
	}

	createResponsiveSlider(slider);
}

function createResponsiveSlider(slider) {
	const root = slider.closest(".rightway_layout");
	const container = slider.querySelector(".rightway_grid");
	const slides = slider.querySelectorAll(".rightway_card");
	const dotsNode = root?.querySelector(".rightway_dots.carousel-dots");

	if (!root) {
		throw new Error('Rightway slider is missing parent ".rightway_layout".');
	}

	if (!container) {
		throw new Error('Rightway slider is missing ".rightway_grid".');
	}

	if (!slides.length) {
		throw new Error('Rightway slider is missing ".rightway_card" items.');
	}

	if (!dotsNode) {
		throw new Error('Rightway slider is missing ".rightway_dots.carousel-dots".');
	}

	const breakpoint = window.matchMedia(`(max-width: ${sliderBreakpoint}px)`);
	let emblaApi = null;
	let dotNodes = [];

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
			});
		});
	}

	function updateActiveDot() {
		const selectedIndex = emblaApi.selectedScrollSnap();

		dotNodes.forEach((dot, index) => {
			dot.classList.toggle("is-selected", index === selectedIndex);
		});
	}

	function enableSlider() {
		if (emblaApi) return;

		emblaApi = window.EmblaCarousel(slider, {
			loop: false,
			align: "start",
			containScroll: "trimSnaps",
		});

		emblaApi
			.on("init", buildDots)
			.on("reInit", buildDots)
			.on("init", updateActiveDot)
			.on("reInit", updateActiveDot)
			.on("select", updateActiveDot);

		buildDots();
		updateActiveDot();
	}

	function disableSlider() {
		if (!emblaApi) return;

		emblaApi.destroy();
		emblaApi = null;
		dotNodes = [];
		dotsNode.innerHTML = "";
	}

	function syncSlider() {
		if (breakpoint.matches) {
			enableSlider();
		} else {
			disableSlider();
		}
	}

	breakpoint.addEventListener("change", syncSlider);
	syncSlider();
}
