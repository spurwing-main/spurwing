function game() {
	// select container
	const container = document.querySelector("._404_matter");
	if (!container) return;

	// declare top level vars
	let engine, render;
	let resizeObserver;

	// declare top level fns
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
						fillStyle: randomColor(),
				  },
		});
	};
	const cleanup = () => {
		if (render) {
			Render.stop(render);
			render.canvas.remove();
		}
		if (engine) {
			Matter.World.clear(engine.world);
			Matter.Engine.clear(engine);
		}
	};

	// sim setup
	const initSimulation = async (width, height, CONFIG) => {
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

		const targetPlatform = Bodies.rectangle(
			CONFIG.platform.x,
			CONFIG.platform.y,
			CONFIG.platform.width,
			CONFIG.platform.height,
			{
				isStatic: true,
				render: { fillStyle: CONFIG.platform.fill },
			}
		);

		const blockSize = CONFIG.blocks.width;
		const spacing = CONFIG.blocks.spacing;
		const blockRows = CONFIG.blocks.rows;

		const blockCols = Math.floor((CONFIG.platform.width + spacing) / (blockSize + spacing));

		const blocks = Composite.create();
		const startX =
			CONFIG.platform.x - (blockCols / 2) * (blockSize + spacing) + (blockSize + spacing) / 2;
		const startY = CONFIG.platform.y - CONFIG.platform.height / 2 - blockSize / 2;

		for (let i = 0; i < blockRows; i++) {
			for (let j = 0; j < blockCols; j++) {
				const x = startX + j * (blockSize + spacing);
				const y = startY - i * (blockSize + spacing);

				const spriteUrl = randomFrom(SVG_BLOCKS);
				const block = createBlock(x, y, spriteUrl, blockSize);

				// Slight bounce upward and small horizontal nudge
				Body.setVelocity(block, {
					x: (Math.random() - 0.5) * 0.5, // small side wiggle
					y: -1.5 - Math.random() * 0.5, // upward kick
				});
				Composite.add(blocks, block);
			}
		}

		addSlingshot();
		World.add(engine.world, [ground, ceiling, leftWall, rightWall, targetPlatform, blocks]);

		const mouse = Mouse.create(render.canvas);
		const mouseConstraint = MouseConstraint.create(engine, {
			mouse,
			constraint: {
				stiffness: CONFIG.mouse.stiffness,
				render: { visible: false },
			},
		});
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

		Render.run(render);
		Matter.Runner.run(engine);
	};

	const resizeAwareInit = () => {
		cleanup(); // 1. stop current sim

		// 2. get new dimensions
		const width = container.offsetWidth;
		const height = container.offsetHeight;
	};

	const resizeAwareInit = () => {
		cleanup(); // remove previous canvas + world

		// Read up-to-date size
		const width = container.offsetWidth;
		const height = container.offsetHeight;

		// Rebuild the engine, render, and sim
		engine = Engine.create({ gravity: CONFIG.gravity });
		initSimulation(width, height); // pass size into init
	};

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
			anchor: { x: 0.2 * width, y: 0.6 * height },
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
		platform: {
			height: 0.01 * height,
			width: 0.25 * width,
			x: width - 0.2 * width,
			y: height - 0.2 * height,
			fill: "white",
		},
		blocks: {
			width: 0.04 * width,
			height: 0.04 * width,
			spacing: 0.005 * width,
			rows: 5,
			fill: "white",
		},
		mouse: { stiffness: 0.2 },
	};

	const engine = Engine.create({ gravity: CONFIG.gravity });
	let render, resizeObserver;
	let projectile, elastic;

	resizeAwareInit();

	resizeObserver = new ResizeObserver(() => {
		resizeAwareInit();
	});
	resizeObserver.observe(container);
}
