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

	function physics() {
		// Early dependency check
		if (typeof Matter === "undefined") {
			console.log("Matter.js not loaded");
			return;
		}

		// DOM container check
		const container = document.querySelector(".circles_sim");
		if (!container) {
			console.log("Container .circles_sim not found");
			return;
		}

		const { Engine, Render, World, Bodies, Body, Events, Mouse, MouseConstraint } = Matter;
		let currentMousePos, lastMousePos;

		// Configuration object
		const CONFIG = {
			circles: {
				count: 30,
				radius: 50,
				restitution: 0.4,
				friction: 5,
				frictionAir: 0.0005,
				fillStyle: "#8180e4",
				opacity: 1,
				spawnInterval: 100, // ms
			},
			gravity: { x: -0.2, y: 0.5, scale: 0.001 },
			mouse: { stiffness: 0.2 },
			timing: {
				svgCircleDelay: 2000,
				scrollReenableDelay: 200,
			},
			maxVelocity: 8, // lower number = more sluggish feel, high number = risk of explosive movements
			thresholds: {
				scrollSwipe: 50,
				intersectionObserver: 0.1,
			},
			pusher: {
				// the element controlled by hover
				radius: 50,
				frictionAir: 0.1, // slows down between mouse moves
				inertia: Infinity, // no rotation
			},
		};

		// Create physics engine
		const engine = Engine.create({
			gravity: CONFIG.gravity,
		});

		let render, resizeObserver;
		let hasInitialized = false;

		// Helper functions
		const createCircle = (x, y, radius, options = {}) => {
			return Bodies.circle(x, y, radius, {
				restitution: CONFIG.circles.restitution,
				friction: CONFIG.circles.friction,
				frictionAir: CONFIG.circles.frictionAir,
				render: {
					fillStyle: CONFIG.circles.fillStyle,
					opacity: CONFIG.circles.opacity,
					lineWidth: 0, // just in case
				},
				...options,
			});
		};

		const loadSvgImage = (svgString) => {
			return new Promise((resolve, reject) => {
				try {
					const svgDataUrl = "data:image/svg+xml;base64," + btoa(svgString);
					const image = new Image();
					image.onload = () => resolve(svgDataUrl);
					image.onerror = () => reject(new Error("Failed to load SVG image"));
					image.src = svgDataUrl;
				} catch (error) {
					reject(new Error(`SVG processing error: ${error.message}`));
				}
			});
		};

		const setupMouseControls = (render) => {
			const mouse = Mouse.create(render.canvas);
			const mouseConstraint = MouseConstraint.create(engine, {
				mouse,
				constraint: {
					stiffness: CONFIG.mouse.stiffness,
					render: { visible: false },
				},
			});

			// hover
			const canvas = render.canvas;
			lastMousePos = { x: 0, y: 0 };
			currentMousePos = { x: 0, y: 0 };
			canvas.addEventListener("mousemove", (e) => {
				const rect = canvas.getBoundingClientRect();
				currentMousePos = {
					x: e.clientX - rect.left,
					y: e.clientY - rect.top,
				};
			});

			// Disable scroll capturing
			mouse.element.removeEventListener("wheel", mouse.mousewheel);
			mouse.element.removeEventListener("mousewheel", mouse.mousewheel);
			mouse.element.removeEventListener("DOMMouseScroll", mouse.mousewheel);
			canvas.removeEventListener("wheel", mouse.mousewheel);

			// disable touch events for now
			mouse.element.removeEventListener("touchmove", mouseConstraint.mouse.mousemove);
			mouse.element.removeEventListener("touchstart", mouseConstraint.mouse.mousedown);
			mouse.element.removeEventListener("touchend", mouseConstraint.mouse.mouseup);

			// Handle scroll and touch events
			let scrollTimeout;
			const handleScroll = () => {
				mouseConstraint.constraint.stiffness = 0;
				clearTimeout(scrollTimeout);
				scrollTimeout = setTimeout(() => {
					mouseConstraint.constraint.stiffness = CONFIG.mouse.stiffness;
				}, CONFIG.timing.scrollReenableDelay);
			};

			canvas.addEventListener("wheel", handleScroll);

			// // Touch handling
			// let touchStartY = 0;
			// canvas.addEventListener("touchstart", (event) => {
			// 	touchStartY = event.touches[0].clientY;
			// });

			// canvas.addEventListener("touchmove", (event) => {
			// 	if (Math.abs(event.touches[0].clientY - touchStartY) > CONFIG.thresholds.scrollSwipe) {
			// 		mouseConstraint.constraint.stiffness = 0;
			// 	}
			// });

			// canvas.addEventListener("touchend", () => {
			// 	mouseConstraint.constraint.stiffness = CONFIG.mouse.stiffness;
			// });

			return mouseConstraint;
		};

		const debounce = (fn, delay) => {
			let timeoutId;
			return (...args) => {
				clearTimeout(timeoutId);
				timeoutId = setTimeout(() => fn(...args), delay);
			};
		};

		const keepCirclesInBounds = (width, height) => {
			const margin = 10; // buffer before correcting
			const bodies = engine.world.bodies.filter((body) => body.circleRadius);

			for (const circle of bodies) {
				const r = circle.circleRadius;
				const { x, y } = circle.position;

				if (x < r - margin || x > width - r + margin || y < r - margin || y > height - r + margin) {
					const clampedX = Math.min(Math.max(x, r), width - r);
					const clampedY = Math.min(Math.max(y, r), height - r);
					const fx = (clampedX - x) * 0.002; // small nudging force
					const fy = (clampedY - y) * 0.002;

					Body.applyForce(circle, circle.position, { x: fx, y: fy });
				}
			}
		};

		const cleanup = () => {
			resizeObserver?.disconnect();
			Events.off(engine, "beforeUpdate");
			if (render) {
				Render.stop(render);
				render.canvas?.remove();
			}
			World.clear(engine.world);
			Engine.clear(engine);
		};

		const initSimulation = async () => {
			if (hasInitialized) return;
			hasInitialized = true;

			try {
				// Get dimensions with fallbacks
				let width = container.offsetWidth || 100;
				let height = container.offsetHeight || 100;

				// Create renderer
				render = Render.create({
					element: container,
					engine,
					options: {
						width,
						height,
						background: "transparent",
						wireframes: false,
					},
				});

				const wallStyle = {
					isStatic: true,
					render: {
						visible: false,
						// fillStyle: "red",
					},
				};

				const wallThickness = 10;
				const offset = 0; // for testing to see walls

				const walls = [
					Bodies.rectangle(
						width / 2,
						height + wallThickness / 2 - offset,
						width,
						wallThickness,
						wallStyle
					), // bottom
					Bodies.rectangle(
						-wallThickness / 2 + offset,
						height / 2,
						wallThickness,
						height,
						wallStyle
					), // left
					Bodies.rectangle(
						width + wallThickness / 2 - offset,
						height / 2,
						wallThickness,
						height,
						wallStyle
					), // right
					// Bodies.rectangle(width / 2, -wallThickness / 2 + offset, width, wallThickness, wallStyle), // top
				];

				// Create circles - old
				// const circles = Array.from({ length: CONFIG.circles.count }, () => {
				// 	const radius = CONFIG.circles.radius;
				// 	return createCircle(radius + Math.random() * 100, radius + Math.random() * 100, radius);
				// });

				const circles = [];
				const spawnCount = CONFIG.circles.count;
				const spawnInterval = CONFIG.circles.spawnInterval; // ms
				const startX = CONFIG.circles.radius + 20;
				const startY = -CONFIG.circles.radius - 20;

				for (let i = 0; i < spawnCount; i++) {
					setTimeout(() => {
						const radius = CONFIG.circles.radius;

						// Cascade diagonally
						const x = startX + i * 5 + Math.random() * 10; // cascade right
						const y = Math.min(startY + i * 2 + Math.random() * 5, -radius);
						const circle = createCircle(x, y, radius);

						// Give it a little motion down and to the right
						Body.setVelocity(circle, {
							x: Math.random() * 0 + 0.05,
							y: Math.random() * 0.5 + 0.05,
						});

						circles.push(circle);
						World.add(engine.world, circle);
					}, i * spawnInterval);
				}

				const pusher = Bodies.circle(-1000, -1000, CONFIG.pusher.radius, {
					render: {
						visible: false,
					},
					frictionAir: CONFIG.pusher.frictionAir,
					inertia: CONFIG.pusher.inertia,
					collisionFilter: { group: -1 }, // optional: don't collide with mouse constraint
				});

				// Add mouse interaction
				const mouseConstraint = setupMouseControls(render);

				// Add all objects to world
				World.add(engine.world, [...walls, ...circles, pusher, mouseConstraint]);

				// Prepare SVG circle
				const svgString = `<svg width="112" height="112" viewBox="0 0 112 112" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="56" cy="56" r="56" fill="white"/>
        <path d="M52.5438 84.2423C33.9131 84.2423 23.0706 76.7894 25.2849 65.4949H39.1816C38.4944 69.106 42.3885 72.8709 53.3837 73.0246C63.6153 73.1014 71.6327 71.7184 72.5489 66.9547C74.3815 56.5053 25.8958 68.7219 29.9426 45.6718C31.8515 34.6845 44.3738 28 61.2483 28C78.7337 28 89.3471 35.376 87.5146 46.7474H73.6179C74.3051 43.0594 70.9455 39.2946 60.2557 39.2177C51.0167 39.0641 44.0684 40.5239 43.2285 45.0571C41.4723 55.1223 89.8053 43.9814 85.8348 66.4937C83.8495 77.5577 70.5637 84.2423 52.5438 84.2423Z" fill="#0200C8"/>
  </svg>`;

				const svgDataUrl = await loadSvgImage(svgString);

				// Add SVG circle after delay
				setTimeout(() => {
					const radius = CONFIG.circles.radius * 1.5;
					const svgCircle = Bodies.circle(radius + Math.random() * 100, -radius, radius, {
						restitution: CONFIG.circles.restitution,
						friction: CONFIG.circles.friction,
						frictionAir: CONFIG.circles.frictionAir,
						render: {
							sprite: {
								texture: svgDataUrl,
								xScale: (radius * 2) / 112,
								yScale: (radius * 2) / 112,
							},
						},
					});
					Body.setVelocity(svgCircle, { x: 0, y: 2 });
					World.add(engine.world, svgCircle);
				}, CONFIG.timing.svgCircleDelay);

				// Handle window resizing
				const updateSize = () => {
					const newWidth = container.offsetWidth || 100;
					const newHeight = container.offsetHeight || 100;

					if (newWidth !== width || newHeight !== height) {
						width = newWidth;
						height = newHeight;

						// Update render dimensions
						render.options.width = width;
						render.options.height = height;
						render.canvas.width = width;
						render.canvas.height = height;

						// Clear old walls
						World.remove(engine.world, walls);
						walls.length = 0; // clear reference

						// Recreate walls with new dimensions
						const newWalls = [
							Bodies.rectangle(
								width / 2,
								height + wallThickness / 2,
								width,
								wallThickness,
								wallStyle
							), // bottom
							Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, wallStyle), // left
							Bodies.rectangle(
								width + wallThickness / 2,
								height / 2,
								wallThickness,
								height,
								wallStyle
							), // right
							// Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, wallStyle), // top
						];

						// Add new walls and store references
						World.add(engine.world, newWalls);
						walls.push(...newWalls);
					}
				};

				const debouncedUpdateSize = debounce(updateSize, 100);
				resizeObserver = new ResizeObserver(debouncedUpdateSize);
				resizeObserver.observe(container);

				Events.on(engine, "beforeUpdate", () => {
					// Keep circles in bounds
					keepCirclesInBounds(width, height);

					// Clamp velocities
					const clampVelocity = (body) => {
						let { x, y } = body.velocity;
						const maxV = CONFIG.maxVelocity;

						if (Math.abs(x) > maxV) x = x > 0 ? maxV : -maxV;
						if (Math.abs(y) > maxV) y = y > 0 ? maxV : -maxV;

						Body.setVelocity(body, { x, y });
					};

					for (const body of engine.world.bodies) {
						if (body.circleRadius) {
							clampVelocity(body);
						}
					}

					// Interpolate toward the mouse
					const lerp = (start, end, t) => start + (end - start) * t;
					const targetX = lerp(pusher.position.x, currentMousePos.x, 0.2);
					const targetY = lerp(pusher.position.y, currentMousePos.y, 0.2);

					const dx = targetX - pusher.position.x;
					const dy = targetY - pusher.position.y;

					const forceMultiplier = 0.008; // Tune this to get desired push strength
					const force = { x: dx * forceMultiplier, y: dy * forceMultiplier };

					Body.applyForce(pusher, pusher.position, force);

					lastMousePos = { ...currentMousePos }; // store for next frame
				});

				// Start the simulation
				Matter.Runner.run(engine);
				Render.run(render);
			} catch (error) {
				console.error(`Simulation failed: ${error.message}`);
				cleanup();
			}
		};

		// Initialize when visible using IntersectionObserver
		try {
			new IntersectionObserver(
				([entry]) => {
					if (entry.isIntersecting) initSimulation();
				},
				{ threshold: CONFIG.thresholds.intersectionObserver }
			).observe(container);
		} catch (error) {
			console.error(`IntersectionObserver failed: ${error.message}`);
			initSimulation();
		}
	}

	clientHover();
	changeColors();

	const mm = gsap.matchMedia();

	loadWorkItems();
	handleNewWorkItems();
	physics();
}
