function main() {
	function changeColors() {
		const color_logo = "white";
		const color_text = "white";
		const color_bg = "#0200c8";
		const color_border = "#e0e0e080";

		const tl = gsap.timeline({
			scrollTrigger: {
				trigger: ".clients_title",
				// start: "top+=200 bottom",
				start: "center center",
				end: "bottom-=400 top",
				toggleActions: "play none none reverse",
			},
			defaults: {
				duration: 1,
				ease: "circ.inOut",
			},
		});

		tl.to(
			[".clients_title", ".bento_head"],
			{
				color: color_text,
			},
			0
		);

		tl.to(
			".clients_logo",
			{
				color: color_logo,
			},
			0
		);

		tl.to(
			[".s-bento", ".s-clients"],
			{
				backgroundColor: color_bg,
			},
			0
		);

		tl.to(
			[".clients_grid", ".clients_block"],
			{
				borderColor: color_border,
				duration: 0.1,
			},
			0
		);
	}

	function clientHover() {
		const preview = document.querySelector(".clients_preview");
		const previewImg = preview.querySelector("img");
		let currentTarget = null;
		let isVisible = false;
		let mouseX = 0,
			mouseY = 0;

		gsap.ticker.add(() => {
			if (isVisible) {
				gsap.to(preview, {
					x: mouseX,
					y: mouseY,
					duration: 0.4,
					ease: "power3.out",
				});
			}
		});

		const container = document.querySelector(".clients_grid");

		window.addEventListener("mousemove", (e) => {
			const bounds = container.getBoundingClientRect();
			mouseX = e.clientX - bounds.left;
			mouseY = e.clientY - bounds.top;
		});

		document.querySelectorAll(".clients_block").forEach((block) => {
			block.addEventListener("mouseenter", () => {
				const imgEl = block.querySelector(".clients_block-img");

				if (!imgEl || !imgEl.src) return; // No image found

				const src = imgEl.src;
				// console.log(src);

				// Avoid reloading if already shown
				// if (currentTarget !== block) {
				previewImg.src = src;
				console.log(previewImg.src);

				// Wait for the image to load before showing preview
				previewImg.onload = () => {
					if (!isVisible) {
						preview.style.display = "block";
						gsap.to(preview, {
							autoAlpha: 1,
							scale: 1,
							duration: 0.3,
							ease: "power2.out",
						});
						isVisible = true;
					}
				};

				// Hide on error
				previewImg.onerror = () => {
					hidePreview();
				};

				currentTarget = block;
				// }
			});

			block.addEventListener("mouseleave", (e) => {
				const related = e.relatedTarget;
				const stillInside = related && related.closest(".clients_block");

				if (!stillInside) {
					hidePreview();
				}
			});
		});

		function hidePreview() {
			gsap.to(preview, {
				autoAlpha: 0,
				scale: 0.95,
				duration: 0.3,
				ease: "power2.out",
				onComplete: () => {
					preview.style.display = "none";
				},
			});
			isVisible = false;
			currentTarget = null;
		}
	}

	clientHover();
	changeColors();
}
