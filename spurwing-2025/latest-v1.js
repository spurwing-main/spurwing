function main() {
	gsap.registerPlugin(Draggable);

	// Optional: catch slider initialization errors
	let slider;
	try {
		// Easing function
		const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

		// 1) Setup KeenSlider
		slider = new KeenSlider(".latest_slider", {
			selector: ".latest_slide",
			loop: false,
			mode: "free-snap",
			rubberband: false,
			renderMode: "performance",
			slides: { perView: "auto" },
			defaultAnimation: {
				duration: 400,
				easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic for more tension
			},
		});
	} catch (e) {
		console.error("Slider initialization error:", e);
		return; // Exit if KeenSlider failed to initialize
	}

	// 2) Cache elements
	const $track = $(".track");
	const $handle = $(".handle-wrapper");

	// Safely check for required elements
	if (!$track.length || !$handle.length) {
		console.warn("Missing .track or .handle-wrapper elements.");
		return;
	}

	// 3) Utility clamp
	const clamp = (val, min, max) => Math.max(min, Math.min(val, max));

	// 4) Compute initial trackWidth
	let trackWidth = $track.width() - $handle.width();

	// 5) Flags
	let isHandleControlling = false;

	// 6) Create Draggable
	// Draggable.create($handle, {
	// 	type: "x",
	// 	bounds: $track[0],
	// 	onPress() {
	// 		isHandleControlling = true;
	// 		$handle.addClass("is-dragging");
	// 	},
	// 	onDrag() {
	// 		// Guard against zero or negative trackWidth
	// 		const fraction = trackWidth > 0 ? clamp(this.x / trackWidth, 0, 1) : 0;
	// 		const max = slider.track.details?.max ?? 0;
	// 		slider.track.to(fraction * max);
	// 		// slider.track.to(fraction * max * 0.5); // only allow 90% progress = heavier drag
	// 	},
	// 	onRelease() {
	// 		isHandleControlling = false;
	// 		$handle.removeClass("is-dragging");
	// 	},
	// });

	// 7) Sync slider -> handle (and keep Draggable in sync)
	slider.on("detailsChanged", (s) => {
		if (!isHandleControlling) {
			const progress = s.track.details?.progress || 0;
			const xPos = progress * trackWidth;
			$handle[0].style.transform = `translate3d(${xPos}px, 0, 0)`;

			// Keep Draggable's internal state in sync to prevent jumping
			// const dragInstance = Draggable.get($handle);
			// if (dragInstance) {
			// 	// Re-check the element's transform
			// 	dragInstance.update(true);
			// 	// Also make sure the draggable bounds are still valid
			// 	dragInstance.applyBounds($track[0]);
			// }
		}
	});

	// 8) Safely update dimensions & Draggable bounds on resize
	const updateHandlePosition = () => {
		trackWidth = $track.width() - $handle.width();
		// Update Draggable bounds if the track has changed size
		const dragInstance = Draggable.get($handle);
		if (dragInstance) {
			dragInstance.applyBounds($track[0]);
		}
		// Update handle position only if not currently dragging
		if (!isHandleControlling) {
			const p = slider.track.details?.progress || 0;
			const xPos = p * trackWidth;
			// $handle[0].style.transform = `translate3d(${xPos}px, 0, 0)`;
			gsap.to($handle[0], {
				x: xPos,
				duration: 0.4,
				ease: "power2.out",
			});
			if (dragInstance) {
				dragInstance.update(true);
			}
		}
	};

	// Simple debounce helper to optimize resize events
	let resizeTimer;
	const debounce = (func, delay) => {
		return () => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(func, delay);
		};
	};

	$(window).on("resize", debounce(updateHandlePosition, 100));
}
