function main() {
	// function requestPermission() {
	// 	if (
	// 		typeof DeviceOrientationEvent !== "undefined" &&
	// 		typeof DeviceOrientationEvent.requestPermission === "function"
	// 	) {
	// 		DeviceOrientationEvent.requestPermission()
	// 			.then((permissionState) => {
	// 				if (permissionState === "granted") {
	// 					// Safe to listen to deviceorientation
	// 				}
	// 			})
	// 			.catch(console.error);
	// 	}
	// }

	function changeColors() {
		const color_logo = "white";
		const color_text = "white";
		const color_bg = "#0200c8";
		const color_bg_dark = "#0300a3";
		const color_border = "#e0e0e080";

		/* set inital colors of Tabs section */
		gsap.set([".s-tabs", ".tab-button__bg"], {
			backgroundColor: color_text,
			color: color_bg,
		});

		const tl = gsap.timeline({
			scrollTrigger: {
				trigger: ".clients_title",
				start: "center center",
				end: "bottom-=400 top",
				toggleActions: "play none none reverse",
			},
			defaults: {
				duration: 0.35,
				ease: "power1.inOut",
			},
		});

		tl.to(
			[".clients_title", ".bento_head", ".s-tabs", ".tab-button__bg"],
			{
				color: color_logo,
			},
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
			[".s-bento", ".s-clients", ".s-tabs"],
			{
				backgroundColor: color_bg,
			},
			0
		);

		tl.to(
			[".tab-button__bg"],
			{
				backgroundColor: color_bg_dark,
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

		let mouseMovedSinceScroll = true;

		window.addEventListener("scroll", () => {
			mouseMovedSinceScroll = false;
			if (isVisible) hidePreview();
		});

		window.addEventListener("mousemove", (e) => {
			if (!mouseMovedSinceScroll) {
				mouseMovedSinceScroll = true;
				// don't need to do anything else here — hover handler will catch it
			}
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
				if (!mouseMovedSinceScroll) return;

				const imgEl = block.querySelector(".clients_block-img");

				if (!imgEl || !imgEl.src) {
					hidePreview();
					return;
				}

				const src = imgEl.src;

				previewImg.src = src;

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
		const items = scope.querySelectorAll(".home-work_col-item"); // initially load items in doc

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

		const { Engine, Render, Runner, World, Bodies, Body, Events, Mouse, MouseConstraint } = Matter;
		let currentMousePos, lastMousePos;
		let runner;

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
				frictionAir: 0.05, // slows down between mouse moves
				inertia: Infinity, // no rotation
			},
		};

		// Override config for mobile (<= 767px)
		if (window.innerWidth <= 767) {
			CONFIG.circles.radius = 30; // or whatever value looks best
			CONFIG.pusher.radius = 30; // keep interaction area in proportion
		}

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
			Runner.stop(runner);
			hasInitialized = false; // Allow re-init
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

				const setupDeviceOrientation = () => {
					const triggerSection = document.querySelector(".s-circles");
					const handleOrientation = (event) => {
						const gamma = event.gamma || 0;
						const beta = event.beta || 0;

						// Normalize and scale
						const gx = Math.min(Math.max(gamma / 90, -1), 1);
						const gy = Math.min(Math.max(beta / 90, -1), 1);

						const intensity = 3; // Try values between 2 and 5
						engine.gravity.x = gx * intensity;
						engine.gravity.y = gy * intensity;
					};

					const permissionPrompt = async () => {
						try {
							if (typeof DeviceOrientationEvent.requestPermission === "function") {
								const response = await DeviceOrientationEvent.requestPermission();
								if (response === "granted") {
									window.addEventListener("deviceorientation", handleOrientation);
									triggerSection.removeEventListener("click", permissionPrompt);
								} else {
									alert("Motion access denied.");
								}
							} else {
								// No permission required (Android / older iOS)
								window.addEventListener("deviceorientation", handleOrientation);
								triggerSection.removeEventListener("click", permissionPrompt);
							}
						} catch (e) {
							console.error("Motion permission error:", e);
						}
					};

					triggerSection.addEventListener("click", permissionPrompt);
				};

				if (window.innerWidth <= 767 && window.DeviceOrientationEvent) {
					setupDeviceOrientation();
				}

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
				runner = Matter.Runner.run(engine);
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
					if (entry.isIntersecting) {
						initSimulation(); // Start/restart
					} else {
						cleanup(); // Pause/kill when out of view
					}
				},
				{ threshold: CONFIG.thresholds.intersectionObserver }
			).observe(container);
		} catch (error) {
			console.error(`IntersectionObserver failed: ${error.message}`);
			initSimulation();
		}
	}

	function game() {
		const container = document.querySelector("._404_matter");
		if (!container) return;

		const width = container.offsetWidth;
		const height = container.offsetHeight;

		const SVG_PROJECTILES = [
			"https://cdn.prod.website-files.com/67ef99f37a7ad65dba02007d/67f3e58c78696f7c1f4de688_spw.svg",
			"https://cdn.prod.website-files.com/67ef99f37a7ad65dba02007d/67f3ec7a83fe3cc9ea00c7dd_webflow.svg",
		];

		const SVG_BLOCKS = [
			"https://cdn.prod.website-files.com/67ef99f37a7ad65dba02007d/67f3eb2577fb9db7d3f3569c_wordpress.svg",
			"https://cdn.prod.website-files.com/67ef99f37a7ad65dba02007d/67f3eb25d1436cb92ef4d1fb_wix.svg",
			"https://cdn.prod.website-files.com/67ef99f37a7ad65dba02007d/67f3eb250844d0f6b0977911_drupal.svg",
			"https://cdn.prod.website-files.com/67ef99f37a7ad65dba02007d/67f3eb2545e5fa241a582aff_joomla.svg",
			"https://cdn.prod.website-files.com/67ef99f37a7ad65dba02007d/67f3eb2570b120fd34900fad_squarespace.svg",
		];

		const {
			Engine,
			Render,
			World,
			Bodies,
			Constraint,
			Body,
			Mouse,
			MouseConstraint,
			Events,
			Composite,
		} = Matter;

		const CONFIG = {
			gravity: { x: 0, y: 1, scale: 0.001 },
			slingshot: {
				anchor: { x: 0.2 * width, y: 0.8 * height },
				stiffness: 0.05,
				damping: 0.01,
				maxSpeed: 45,
				radius: 0.025 * width, // rel
				density: 0.004,
				constraintLength: 0.01,
			},
			ground: {
				thickness: 100,
				visibleThickness: 0,
				fillStyle: "white",
			},
			ceiling: {
				thickness: 100,
				visibleThickness: 0,
				yOffset: 0, // how much higher than top edge we want ceiling to be
				fillStyle: "white",
			},
			walls: {
				thickness: 100,
				visibleThickness: 0,
				fillStyle: "white",
			},
			platforms: {
				thickness: 2,
				maxX: 0.95 * width, // max x position of platform
				minX: 0.5 * width, // min x position of platform
				maxY: 0.9 * height, // max y position of platform
				minY: 0.1 * height, // min y position of platform
				fill: "white",
				maxCount: 3, // max number of platforms
				maxWidth: 0.2 * width, // max width of platform
				minWidth: 0.05 * width, // min width of platform
			},
			blocks: {
				size: 0.04 * width,
				spacing: 0.005 * width,
				maxRows: 4,
				minRows: 1,
				fill: "white",
				targetPercentage: 0.35, // percentage of blocks that should be target blocks
				targetFill: "#0200c8",
				fallbackFill: "#ffffff", // non-target fallback color
				strokeStyle: "#000000",
				lineWidth: 2,
			},
			mouse: { stiffness: 0.2 },
		};

		const engine = Engine.create({ gravity: CONFIG.gravity });
		let render, resizeObserver;
		let projectile, elastic;

		const createProjectile = (spriteUrl) => {
			const body = Bodies.circle(
				CONFIG.slingshot.anchor.x,
				CONFIG.slingshot.anchor.y,
				CONFIG.slingshot.radius,
				{
					density: CONFIG.slingshot.density,
					friction: 0.9,
					restitution: 0.8,
					render: {
						sprite: {
							texture: spriteUrl,
							xScale: (CONFIG.slingshot.radius * 2) / 112, // 112 = original SVG viewBox width
							yScale: (CONFIG.slingshot.radius * 2) / 112,
						},
					},
				}
			);
			body.label = "projectile"; // for debugging

			return body;
		};

		const addSlingshot = () => {
			const spriteUrl = randomFrom(SVG_PROJECTILES);
			projectile = createProjectile(spriteUrl);
			elastic = Constraint.create({
				pointA: CONFIG.slingshot.anchor,
				bodyB: projectile,
				length: CONFIG.slingshot.constraintLength,
				damping: CONFIG.slingshot.damping,
				stiffness: CONFIG.slingshot.stiffness,
				render: {
					visible: true,
					lineWidth: 1,
					strokeStyle: "#0200c8",
					type: "line",
				},
			});
			World.add(engine.world, [projectile, elastic]);
		};

		const createBlock = (x, y, spriteUrl, size) => {
			return Bodies.rectangle(x, y, size, size, {
				restitution: 0.5,
				render: spriteUrl
					? {
							sprite: {
								texture: spriteUrl,
								xScale: size / 112,
								yScale: size / 112,
							},
					  }
					: {
							fillStyle: CONFIG.blocks.fallbackFill, // non-target fallback color
							strokeStyle: CONFIG.blocks.strokeStyle,
							lineWidth: CONFIG.blocks.lineWidth,
					  },
			});
		};

		const initSimulation = async () => {
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

			const ground = Bodies.rectangle(
				width / 2,
				height + CONFIG.ground.thickness / 2 - CONFIG.ground.visibleThickness,
				width,
				CONFIG.ground.thickness,
				{
					isStatic: true,
					render: { fillStyle: CONFIG.ground.fillStyle },
				}
			);

			const ceiling = Bodies.rectangle(
				width / 2,
				0 - CONFIG.ceiling.yOffset - CONFIG.ceiling.thickness / 2,
				width,
				CONFIG.ceiling.thickness,
				{
					isStatic: true,
					render: { fillStyle: CONFIG.ceiling.fillStyle },
				}
			);

			const leftWall = Bodies.rectangle(
				0 - CONFIG.walls.thickness / 2 + CONFIG.walls.visibleThickness,
				height / 2,
				CONFIG.walls.thickness,
				height + CONFIG.ceiling.yOffset,
				{
					isStatic: true,
					render: { fillStyle: CONFIG.walls.fillStyle },
				}
			);

			const rightWall = Bodies.rectangle(
				width + CONFIG.walls.thickness / 2 - CONFIG.walls.visibleThickness,
				height / 2,
				CONFIG.walls.thickness,
				height + CONFIG.ceiling.yOffset,
				{
					isStatic: true,
					render: { fillStyle: CONFIG.walls.fillStyle },
				}
			);

			const placedRects = [];
			const platforms = [];
			const allBlocks = [];
			const groundContacts = new Map(); // body -> timeoutId

			const generatePlatformWithBlocks = ({
				minX,
				maxX,
				minY,
				maxY,
				minW,
				maxW,
				blockSize,
				blockSpacing,
				maxBlockRows,
				minBlockRows,
				platformThickness,
				ceilingHeight = 0,
				platformPadding = 10,
				maxAttempts = 50,
			}) => {
				for (let attempt = 0; attempt < maxAttempts; attempt++) {
					const platformWidth = Math.random() * (maxW - minW) + minW;
					const platformX =
						Math.random() * (maxX - platformWidth / 2 - (minX + platformWidth / 2)) +
						(minX + platformWidth / 2);
					const platformY = Math.random() * (maxY - minY) + minY;

					// Calculate how much vertical room we have above the platform
					const verticalSpace = platformY - platformThickness / 2 - ceilingHeight - platformPadding;

					const maxRowsFit = Math.floor(verticalSpace / (blockSize + blockSpacing));

					// Clamp between allowed min/max from config
					const blockRows = Math.max(minBlockRows, Math.min(maxBlockRows, maxRowsFit));

					// Skip if no space for even 1 row
					if (blockRows < 1) continue;

					const blockCols = Math.floor((platformWidth + blockSpacing) / (blockSize + blockSpacing));
					const fullBlockHeight = blockRows * (blockSize + blockSpacing);

					const bounds = {
						minX: platformX - platformWidth / 2 - platformPadding,
						maxX: platformX + platformWidth / 2 + platformPadding,
						minY: platformY - platformThickness / 2 - fullBlockHeight - platformPadding,
						maxY: platformY + platformThickness / 2 + platformPadding,
					};

					const overlaps = placedRects.some(
						(rect) =>
							!(
								bounds.maxX < rect.minX ||
								bounds.minX > rect.maxX ||
								bounds.maxY < rect.minY ||
								bounds.minY > rect.maxY
							)
					);

					if (!overlaps) {
						placedRects.push(bounds);

						const platform = Bodies.rectangle(
							platformX,
							platformY,
							platformWidth,
							platformThickness,
							{
								isStatic: true,
								render: { fillStyle: CONFIG.platforms.fill },
							}
						);

						const blocks = Composite.create();
						const startX =
							platformX -
							(blockCols / 2) * (blockSize + blockSpacing) +
							(blockSize + blockSpacing) / 2;
						const startY = platformY - platformThickness / 2 - blockSize / 2;

						const allPositions = [];

						for (let row = 0; row < blockRows; row++) {
							for (let col = 0; col < blockCols; col++) {
								const x = startX + col * (blockSize + blockSpacing);
								const y = startY - row * (blockSize + blockSpacing);
								allPositions.push({ x, y });
							}
						}

						// Shuffle the positions
						const shuffled = allPositions.sort(() => Math.random() - 0.5);

						// Choose targets
						const targetCount = Math.floor(shuffled.length * CONFIG.blocks.targetPercentage);
						const targetPositions = shuffled.slice(0, targetCount);
						const normalPositions = shuffled.slice(targetCount);

						// Add target blocks
						for (const pos of targetPositions) {
							const spriteUrl = randomFrom(SVG_BLOCKS);
							const block = createBlock(pos.x, pos.y, spriteUrl, blockSize);
							block.isTarget = true; // tag it
							Composite.add(blocks, block);
						}

						// Add normal blocks
						for (const pos of normalPositions) {
							const block = createBlock(pos.x, pos.y, null, blockSize); // no sprite
							block.isTarget = false;
							Composite.add(blocks, block);
						}

						return { platform, blocks };
					}
				}

				console.warn("Could not place platform/blocks without overlap.");
				return null;
			};

			const rows =
				Math.floor(Math.random() * (CONFIG.blocks.maxRows - CONFIG.blocks.minRows + 1)) +
				CONFIG.blocks.minRows;

			for (let i = 0; i < CONFIG.platforms.maxCount; i++) {
				const result = generatePlatformWithBlocks({
					minX: CONFIG.platforms.minX,
					maxX: CONFIG.platforms.maxX,
					minY: CONFIG.platforms.minY,
					maxY: CONFIG.platforms.maxY,
					minW: CONFIG.platforms.minWidth,
					maxW: CONFIG.platforms.maxWidth,
					blockSize: CONFIG.blocks.size,
					blockSpacing: CONFIG.blocks.spacing,
					maxBlockRows: CONFIG.blocks.maxRows,
					minBlockRows: CONFIG.blocks.minRows,
					platformThickness: CONFIG.platforms.thickness,
					ceilingHeight: CONFIG.ceiling.thickness,
				});

				if (result) {
					platforms.push(result.platform);
					allBlocks.push(result.blocks);
				}
			}

			console.log(platforms, allBlocks);

			addSlingshot();

			const allBlockBodies = allBlocks.flatMap((comp) => comp.bodies);

			World.add(engine.world, [
				ground,
				ceiling,
				leftWall,
				rightWall,
				...platforms,
				...allBlockBodies,
			]);

			const mouse = Mouse.create(render.canvas);
			const mouseConstraint = MouseConstraint.create(engine, {
				mouse,
				constraint: {
					stiffness: CONFIG.mouse.stiffness,
					render: { visible: false },
				},
			});

			// Disable scroll capturing
			mouse.element.removeEventListener("wheel", mouse.mousewheel);
			mouse.element.removeEventListener("mousewheel", mouse.mousewheel);
			mouse.element.removeEventListener("DOMMouseScroll", mouse.mousewheel);

			World.add(engine.world, mouseConstraint);
			render.mouse = mouse;

			Events.on(engine, "afterUpdate", () => {
				if (
					mouseConstraint.mouse.button === -1 &&
					elastic.bodyB &&
					(projectile.position.x > CONFIG.slingshot.anchor.x + 20 ||
						projectile.position.y < CONFIG.slingshot.anchor.y - 20)
				) {
					// Clamp speed if needed
					if (Body.getSpeed(projectile) > CONFIG.slingshot.maxSpeed) {
						Body.setSpeed(projectile, CONFIG.slingshot.maxSpeed);
					}

					// Apply spin to current projectile *before* releasing
					const randomSpin = (Math.random() - 0.5) * 0.4;
					Body.setAngularVelocity(projectile, randomSpin);

					// Spawn and attach the next projectile
					projectileNew = createProjectile(randomFrom(SVG_PROJECTILES));
					World.add(engine.world, projectileNew);
					elastic.bodyB = projectileNew;
					projectile = projectileNew;
				}
			});

			Events.on(engine, "collisionStart", (event) => {
				for (const pair of event.pairs) {
					const { bodyA, bodyB } = pair;

					// Check both combinations
					[bodyA, bodyB].forEach((body, index) => {
						const other = index === 0 ? bodyB : bodyA;

						if (other === ground && !body._fadingOut) {
							body._fadingOut = true;
							console.log("Block touched ground:", body.id);
							setTimeout(() => {
								fadeAndDestroy(body);
							}, 3000);
						}

						if (body === ground && other.isTarget) {
							shatterBlock(other);
							// Optional: add score, particles, sound, etc.
						}

						if (
							(bodyA.isTarget && bodyB.label === "projectile") ||
							(bodyB.isTarget && bodyA.label === "projectile")
						) {
							const target = bodyA.isTarget ? bodyA : bodyB;
							shatterBlock(target);
						}
					});
				}
			});

			// Events.on(engine, "collisionEnd", (event) => {
			// 	for (const pair of event.pairs) {
			// 		const { bodyA, bodyB } = pair;

			// 		[bodyA, bodyB].forEach((body) => {
			// 			if (groundContacts.has(body)) {
			// 				// Cancel the fade-out
			// 				clearTimeout(groundContacts.get(body));
			// 				groundContacts.delete(body);
			// 			}
			// 		});
			// 	}
			// });

			const fadeAndDestroy = (block, duration = 300) => {
				let opacity = 1;
				const steps = 10;
				const interval = duration / steps;

				const fade = setInterval(() => {
					opacity -= 1 / steps;
					block.render.opacity = opacity;

					if (opacity <= 0) {
						clearInterval(fade);
						World.remove(engine.world, block);
					}
				}, interval);
			};

			const shatterBlock = (block) => {
				const { x, y } = block.position;
				const size = block.bounds.max.x - block.bounds.min.x;
				const pieceSize = size / 3;

				World.remove(engine.world, block);

				const pieces = [];

				for (let i = 0; i < 9; i++) {
					const px = x + (i % 2 === 0 ? -1 : 1) * (pieceSize / 2);
					const py = y + (i < 2 ? -1 : 1) * (pieceSize / 2);

					const piece = Bodies.rectangle(px, py, pieceSize, pieceSize, {
						restitution: 0.5,
						render: {
							fillStyle: "#0200c8",
						},
					});

					Body.setVelocity(piece, {
						x: (Math.random() - 0.5) * 2,
						y: (Math.random() - 0.5) * 2,
					});
					Body.setAngularVelocity(piece, (Math.random() - 0.5) * 0.2);

					pieces.push(piece);
					fadeAndDestroy(piece, 1000);
				}

				World.add(engine.world, pieces);
			};

			Render.run(render);
			Matter.Runner.run(engine);
		};

		initSimulation();
	}

	function randomColor() {
		let color = Math.floor(Math.random() * 16777215).toString(16);
		return "#" + color;
	}

	function randomFrom(array) {
		return array[Math.floor(Math.random() * array.length)];
	}

	clientHover();
	changeColors();

	const mm = gsap.matchMedia();

	loadWorkItems();
	handleNewWorkItems();
	// requestPermission();
	physics();
	game();
}
