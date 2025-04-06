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
			".clients_rich svg",
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
		const container = document.querySelector(".clients_grid");
		if (!container) {
			return;
		}
		const preview = document.querySelector(".clients_preview");
		const previewImg = preview.querySelector("img");
		let currentTarget = null;
		let isVisible = false;
		let isHovering = false;
		let mouseX = 0,
			mouseY = 0;

		gsap.ticker.add(() => {
			if (isHovering) {
				gsap.to(preview, {
					x: mouseX,
					y: mouseY,
					duration: 0.4,
					ease: "power3.out",
				});
			}
		});

		window.addEventListener("mousemove", (e) => {
			const bounds = container.getBoundingClientRect();
			mouseX = e.clientX - bounds.left;
			mouseY = e.clientY - bounds.top;
		});

		// Hide preview on mouse leave of container
		container.addEventListener("mouseenter", () => {
			isHovering = true;
		});
		container.addEventListener("mouseleave", () => {
			isHovering = false;
			hidePreview();
		});

		document.querySelectorAll(".clients_block").forEach((block) => {
			block.addEventListener("mouseenter", () => {
				const imgEl = block.querySelector(".clients_block-img");

				if (!imgEl || !imgEl.src) {
					hidePreview();
					return;
				}

				const src = imgEl.src;

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
					// preview.style.display = "none";
				},
			});
			isVisible = false;
			currentTarget = null;
		}
	}

	function loadWorkItems(scope = document) {
		const items = scope.querySelectorAll(".work_list-item"); // initially load items in doc

		mm.add("(min-width: 768px)", () => {
			// Animate in pairs
			for (let i = 0; i < items.length; i += 2) {
				const leftItem = items[i];
				const rightItem = items[i + 1];

				if (leftItem.dataset.animated) continue; // Skip if already animated

				const tl = gsap.timeline({
					scrollTrigger: {
						trigger: leftItem,
						start: "top 80%",
						toggleActions: "play none none none",
					},
				});

				tl.fromTo(
					leftItem,
					{
						autoAlpha: 0,
						y: 50,
					},
					{
						autoAlpha: 1,
						y: 0,
						duration: 0.6,
						ease: "power2.out",
					}
				);

				if (rightItem) {
					tl.fromTo(
						rightItem,
						{
							autoAlpha: 0,
							y: 50,
						},
						{
							autoAlpha: 1,
							y: 0,
							duration: 0.6,
							ease: "power2.out",
						},
						0.15
					);
				}

				// Mark items as animated
				leftItem.dataset.animated = true;
				if (rightItem) rightItem.dataset.animated = true;
			}
		});

		mm.add("(max-width: 767px)", () => {
			items.forEach((item) => {
				if (item.dataset.animatedMbl) return; // Skip if already animated. We separate mbl and dsk tracking to avoid conflicts when resizing

				const tl = gsap.timeline({
					scrollTrigger: {
						trigger: item,
						start: "top 80%",
						toggleActions: "play none none none",
					},
				});

				tl.fromTo(
					item,
					{
						autoAlpha: 0,
						y: 50,
					},
					{
						autoAlpha: 1,
						y: 0,
						duration: 0.6,
						ease: "power2.out",
					}
				);

				item.dataset.animatedMbl = true; // Mark item as animated
			});
		});
	}

	function handleNewWorkItems() {
		// Run after Finsweet loads more items
		window.fsAttributes = window.fsAttributes || [];
		window.fsAttributes.push([
			"cmsload",
			(listInstances) => {
				listInstances.forEach((list) => {
					list.on("renderitems", (renderedItems) => {
						loadWorkItems(list.list); // Pass the container to scope the animation
					});
				});
			},
		]);
	}

	clientHover();
	changeColors();

	const mm = gsap.matchMedia();

	loadWorkItems();
	handleNewWorkItems();
}
