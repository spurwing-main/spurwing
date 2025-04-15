function main() {
	// pageFunctions.addFunction('matter_all', function() {
	function matter_marbles() {
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

	function matter_404() {
		const container = document.querySelector("._404_matter");
		if (!container) return;

		const addButton = () => {
			const button = document.createElement("div");
			button.style.display = "none";
			button.style.marginTop = "2rem";
			button.style.height = "auto";
			button.style.paddingBlock = "1rem";

			button.className = "button";
			button.innerHTML = "Reload";
			const parent = document.querySelector("._404_content");
			if (parent) {
				parent.appendChild(button);
			} else {
				console.error("Parent element not found");
			}
			button.onclick = () => {
				window.location.reload();
			};

			return button;
		};

		const button = addButton();

		function enableButton(bool, str) {
			if (bool) {
				container.style.pointerEvents = "none";
				button.style.display = "flex";
				button.innerHTML = str;
			} else {
				container.style.pointerEvents = "auto";
				button.style.display = "none";
			}
		}

		const width = container.offsetWidth;
		const height = container.offsetHeight;

		const SVG_PROJECTILES = [
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7e05c38a306d0c30ea60_spw.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7ddca8731615e20eff7e_webflow.svg",
		];

		const SVG_BLOCKS = [
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7daaf7506d703a4e0265_umbraco.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7daa7c8e3283e5f007bb_wix.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7daa514ad41d50002d48_contentful.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7da93dbc1a6c62898740_wordpress.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7da922003b105fd185c5_sitecore.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7da9c38a306d0c30a621_squarespace.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7da99b7fdf699ce51f8a_drupal.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7da969d1211b1766a5bc_storyblok.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7da9bd6d747e3b5c9a03_joomla.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7da993f9e4c1da8cdcb8_hubspot.svg",
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fe7da9631cced8e5f08dd5_framer.svg",
		];
		const emptyTarget =
			"https://cdn.prod.website-files.com/67810ba8d6e06130a12d3be6/67fd16c9c7451c91b6bc2dc1_empty-target.svg";

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

		let gameStatus = "Game not started";
		let gameResult = "";

		// define collision filter categories.
		const CATEGORY = {
			MOUSE: 0x0001,
			PROJECTILE: 0x0002,
			TARGET: 0x0004,
			TERRAIN: 0x0008,
			AMMO: 0x0010,
		};

		// helpers for setting collision

		// projectile can collide with mouse before launch, terrain and targets after launch
		const setCollisionForProjectile = (body, { launched = false } = {}) => {
			body.collisionFilter.category = CATEGORY.PROJECTILE;
			body.collisionFilter.mask = launched
				? CATEGORY.TARGET | CATEGORY.TERRAIN | CATEGORY.PROJECTILE | CATEGORY.AMMO
				: CATEGORY.MOUSE;
		};

		// ammo can collide with terrain and other ammo
		const setCollisionForAmmo = (body) => {
			body.collisionFilter.category = CATEGORY.AMMO;
			body.collisionFilter.mask = CATEGORY.AMMO | CATEGORY.TERRAIN;
		};

		// targets can collide with terrain and projectiles
		const setCollisionForTarget = (body) => {
			body.collisionFilter.category = CATEGORY.TARGET;
			body.collisionFilter.mask = CATEGORY.PROJECTILE | CATEGORY.TERRAIN | CATEGORY.TARGET;
		};

		// terrain can collide with projectiles, targets and ammo
		const setCollisionForTerrain = (body) => {
			body.collisionFilter.category = CATEGORY.TERRAIN;
			body.collisionFilter.mask =
				CATEGORY.TERRAIN | CATEGORY.PROJECTILE | CATEGORY.TARGET | CATEGORY.AMMO;
		};

		const CONFIG = (() => {
			const terrainElements = {
				ammo: {
					x: 0,
					y: 0.9 * height,
					width: 0.4 * width,
					height: 0.21 * height,
					group: 0,
				},
				launch: {
					x: 0.175 * width + 0.04 * width,
					y: 0.84 * height,
					width: 0.08 * width,
					height: 0.38 * height,
					group: 0,
				},
				target: {
					x: width - 0.03 * width - 0.23 * width,
					y: height * 0.8,
					width: width * 0.46,
					height: height * 0.45,
					group: 1,
				},
			};

			return {
				terrain: {
					fill: "#0300A3",
					stroke: "#6866C8",
					chamfer: { radius: 8 },
					elements: terrainElements,
				},
				gravity: { x: 0, y: 1, scale: 0.001 },
				slingshot: {
					radius: 0.035 * width,
					get anchor() {
						const launch = terrainElements.launch;
						return {
							x: launch.x,
							y: launch.y - launch.height / 2 - this.radius - 5,
						};
					},
					stiffness: 0.05,
					damping: 0.01,
					maxSpeed: 45,
					density: 0.004,
					constraintLength: 0.01,
					ammo: { count: 3, x: 0 * width, y: 0.745 * height },
				},
				ammo: {
					count: 3,
					get radius() {
						return CONFIG.slingshot.radius;
					},
					get position() {
						const launch = terrainElements.launch;
						const ammo = terrainElements.ammo;
						return {
							x: launch.x - launch.width / 2 - this.radius - 20, // 20 is gap between vertical wall and first ammo
							y: ammo.y - ammo.height / 2 - this.radius - 5,
						};
					},
				},
				ground: {
					thickness: 100,
					offset: -200,
					fillStyle: "white",
				},
				ceiling: {
					thickness: 100,
					offset: 0,
					yOffset: 0,
					fillStyle: "white",
				},
				walls: {
					thickness: 100,
					offset: 0,
					fillStyle: "white",
				},
				targets: {
					size: 0.088 * width,
					spacing: 0.005 * width,
					countPerRow: [4, 3, 2],
					fill: "#4E4DD9",
					targetPercentage: 1,
					get position() {
						const targetPlatform = terrainElements.target;
						return { x: targetPlatform.x, y: targetPlatform.y - targetPlatform.height / 2 };
					},
				},
				mouse: { stiffness: 0.2 },
			};
		})();

		console.log(CONFIG.targets.position);

		const engine = Engine.create({ gravity: CONFIG.gravity });
		let render, resizeObserver;
		let projectile, elastic;

		const createProjectile = (spriteUrl, x, y) => {
			const body = Bodies.circle(x, y, CONFIG.slingshot.radius, {
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
			});
			body.label = "projectile"; // for debugging

			return body;
		};

		const addSlingshot = () => {
			const spriteUrl = randomFrom(SVG_PROJECTILES);
			projectile = createProjectile(
				spriteUrl,
				CONFIG.slingshot.anchor.x,
				CONFIG.slingshot.anchor.y
			);
			setCollisionForProjectile(projectile); // pre-launch

			elastic = Constraint.create({
				pointA: CONFIG.slingshot.anchor,
				bodyB: projectile,
				length: CONFIG.slingshot.constraintLength,
				damping: CONFIG.slingshot.damping,
				stiffness: CONFIG.slingshot.stiffness,
				render: {
					visible: true,
					lineWidth: 1,
					strokeStyle: "#B3B3EE",
					type: "line",
				},
			});
			World.add(engine.world, [projectile, elastic]);
		};

		let ammoBodies = [];
		let allTargets = [];
		let destroyedTargets = [];

		const addAmmo = () => {
			const count = CONFIG.ammo.count;
			const start_x = CONFIG.ammo.position.x;
			const start_y = CONFIG.ammo.position.y;
			const spacing = CONFIG.ammo.radius * 2 + 20; // 20 is gap between ammo

			console.log(start_x, start_y, spacing);

			for (let i = 0; i < count; i++) {
				const spriteUrl = randomFrom(SVG_PROJECTILES);
				const ammo = createProjectile(spriteUrl, start_x - i * spacing, start_y);
				setCollisionForAmmo(ammo);

				ammo.isAmmo = true;
				ammo.render.opacity = 0.5;
				ammoBodies.push(ammo);
			}
			World.add(engine.world, ammoBodies);
		};

		const addTargets = (centerX, baseY) => {
			const blockSize = CONFIG.targets.size;
			const spacing = 0;
			const rows = CONFIG.targets.countPerRow;
			const blocks = Composite.create();

			rows.forEach((count, rowIndex) => {
				const totalWidth = count * blockSize + (count - 1) * spacing;
				const startX = centerX - totalWidth / 2 + blockSize / 2;
				const y = baseY - rowIndex * (blockSize + spacing);

				for (let i = 0; i < count; i++) {
					const x = startX + i * (blockSize + spacing);

					const spriteUrl = randomFrom(SVG_BLOCKS);

					const block = createBlock(x, y, spriteUrl, blockSize);
					setCollisionForTarget(block);

					block.isTarget = true;
					Composite.add(blocks, block);

					allTargets.push(block); // Track all target blocks
				}
			});
			World.add(engine.world, blocks);
		};

		const createBlock = (x, y, spriteUrl, size) => {
			const block = Bodies.rectangle(x, y, size, size, {
				restitution: 0.5,
				render: spriteUrl
					? {
							sprite: {
								texture: spriteUrl,
								xScale: size / 141,
								yScale: size / 141,
							},
					  }
					: {
							fillStyle: CONFIG.targets.fill, // non-target fallback color
							strokeStyle: "#0200C8",
							lineWidth: 8,
					  },
				// collisionFilter: {
				// 	category: CATEGORY.TARGET,
				// 	mask: CATEGORY.TERRAIN | CATEGORY.PROJECTILE | CATEGORY.TARGET, // Collides with most things, but not mouse
				// },
			});

			return block;
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

			// create terrain using compound bodies
			const terrainArray = Object.values(CONFIG.terrain.elements).map((element) =>
				Bodies.rectangle(element.x, element.y, element.width, element.height, {
					render: {
						fillStyle: CONFIG.terrain.fill,
						// strokeStyle: CONFIG.terrain.stroke,
						// lineWidth: 1,
					},
					chamfer: CONFIG.terrain.chamfer,
				})
			);
			let terrain = Body.create({
				parts: terrainArray,
				isStatic: true,
				// collisionFilter: {
				// 	category: CATEGORY.TERRAIN,
				// 	mask: CATEGORY.PROJECTILE | CATEGORY.TARGET,
				// },
			});
			setCollisionForTerrain(terrain);

			const ground = Bodies.rectangle(
				width / 2,
				height + CONFIG.ground.thickness / 2 - CONFIG.ground.offset,
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

			addSlingshot();
			addAmmo();

			addTargets(CONFIG.targets.position.x, CONFIG.targets.position.y - CONFIG.targets.size / 2);

			World.add(engine.world, [ground, ceiling, terrain]);

			const mouse = Mouse.create(render.canvas);
			const mouseConstraint = MouseConstraint.create(engine, {
				mouse,
				constraint: {
					stiffness: CONFIG.mouse.stiffness,
					render: { visible: false },
				},
				collisionFilter: {
					category: CATEGORY.MOUSE, // mouse is a body with category MOUSE
					mask: CATEGORY.PROJECTILE, // mouse will only interact with bodies in the PROJECTILE category
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
					// Clamp speed
					if (Body.getSpeed(projectile) > CONFIG.slingshot.maxSpeed) {
						Body.setSpeed(projectile, CONFIG.slingshot.maxSpeed);
					}

					// Apply spin to current projectile *before* releasing
					const randomSpin = (Math.random() - 0.5) * 0.4;
					Body.setAngularVelocity(projectile, randomSpin);

					// update projectile collisions
					setCollisionForProjectile(projectile, { launched: true });

					// Take next from ammo
					const next = ammoBodies.shift();

					// After popping the next projectile:
					const spacing = CONFIG.ammo.radius * 2 + 20;
					ammoBodies.forEach((body, i) => {
						const targetX = CONFIG.ammo.position.x - i * spacing;
						const targetY = CONFIG.ammo.position.y;

						// Animate toward the new position
						Body.setVelocity(body, {
							x: (targetX - body.position.x) * 0.09,
							y: (targetY - body.position.y) * 0.09,
						});
					});

					if (next) {
						// Make it dynamic & move to anchor
						Body.setStatic(next, false);
						Body.setPosition(next, CONFIG.slingshot.anchor);
						Body.setVelocity(next, { x: 0, y: 0 });
						Body.setAngularVelocity(next, 0);
						next.render.opacity = 1;

						setCollisionForProjectile(next, { launched: false });

						elastic.bodyB = next;
						projectile = next;
					} else {
						elastic.bodyB = null;
						projectile = null;
						elastic.render.visible = false;
						checkGameEnd();
					}
				}
				if (gameStatus === "Game finished") return;
				// check for fallen targets
				allTargets.forEach((block) => {
					if (block.position.y > height + 100) {
						if (!destroyedTargets.includes(block)) {
							destroyedTargets.push(block);
							World.remove(engine.world, block);
						}
					}
				});

				// Check if all targets are destroyed
				if (destroyedTargets.length === allTargets.length) {
					gameEnd("win");
					gameStatus = "Game finished";
				}
			});

			Events.on(engine, "collisionStart", (event) => {
				return;
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

			function gameEnd(str) {
				if (str === "win") {
					enableButton(true, "You won! Reload");
				}
				if (str === "lose") {
					enableButton(true, "You lost! Reload");
				}
			}

			function checkGameEnd() {
				if (destroyedTargets.length === allTargets.length) {
					gameEnd("win");
				} else {
					gameEnd("lose");
				}
			}

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

	function randomFrom(array) {
		return array[Math.floor(Math.random() * array.length)];
	}

	matter_marbles();
	matter_404();
	// });
}
