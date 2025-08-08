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

function main() {
	matter_404();
}