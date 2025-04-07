function main() {
	const container = document.querySelector(".slingshot_sim");
	if (!container) return;

	const width = container.offsetWidth;
	const height = width * 0.5; // 2:1 aspect ratio

	const SVG_ASSETS = {
		spw: `<svg width="112" height="112" viewBox="0 0 112 112" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="56" cy="56" r="56" fill="white"/>
            <path d="M52.5438 84.2423C33.9131 84.2423 23.0706 76.7894 25.2849 65.4949H39.1816C38.4944 69.106 42.3885 72.8709 53.3837 73.0246C63.6153 73.1014 71.6327 71.7184 72.5489 66.9547C74.3815 56.5053 25.8958 68.7219 29.9426 45.6718C31.8515 34.6845 44.3738 28 61.2483 28C78.7337 28 89.3471 35.376 87.5146 46.7474H73.6179C74.3051 43.0594 70.9455 39.2946 60.2557 39.2177C51.0167 39.0641 44.0684 40.5239 43.2285 45.0571C41.4723 55.1223 89.8053 43.9814 85.8348 66.4937C83.8495 77.5577 70.5637 84.2423 52.5438 84.2423Z" fill="#0200C8"/>
        </svg>`,
		wf: `<svg width="112" height="112" viewBox="0 0 112 112" xmlns="http://www.w3.org/2000/svg">
            <rect width="112" height="112" rx="10" fill="#FF6B6B"/>
        </svg>`,
	};

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
			polygonSides: 1,
			radius: 0.025 * width, // rel
			density: 0.004,
			constraintLength: 0.01,
		},
		ground: {
			height: 0.01 * height,
		},
		platform: {
			height: 0.01 * height,
			width: 0.15 * width,
			x: width - 0.2 * width,
			y: height - 0.2 * height,
			fill: "#222",
		},
		blocks: {
			width: 0.04 * width,
			height: 0.04 * width,
			spacing: 0.005 * width,
			rows: 4,
			fill: "#888",
		},
		mouse: { stiffness: 0.2 },
	};

	const engine = Engine.create({ gravity: CONFIG.gravity });
	let render, resizeObserver;
	let projectile, elastic;

	let svgDataUrl;

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

		// Give it a random spin
		const randomSpin = (Math.random() - 0.5) * 0.1; // tweak this value for more/less spin
		Body.setAngularVelocity(body, randomSpin);

		return body;
	};

	const loadSvgSprite = async (name) => {
		const svgString = SVG_ASSETS[name];
		if (!svgString) throw new Error(`SVG not found for key: ${name}`);

		const dataUrl = "data:image/svg+xml;base64," + btoa(svgString);
		const image = new Image();

		return new Promise((resolve, reject) => {
			image.onload = () => resolve(dataUrl);
			image.onerror = () => reject(new Error(`Failed to load SVG for: ${name}`));
			image.src = dataUrl;
		});
	};

	const addSlingshot = () => {
		projectile = createProjectile(svgDataUrl);
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

	const initSimulation = async () => {
		const spwSprite = await loadSvgSprite("spw");
		const wfSprite = await loadSvgSprite("wf");

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
			height - CONFIG.ground.height / 2,
			width,
			CONFIG.ground.height,
			{
				isStatic: true,
				render: { fillStyle: "#222" },
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

		// // Prepare SVG circle
		// const svgString = `<svg width="112" height="112" viewBox="0 0 112 112" fill="none" xmlns="http://www.w3.org/2000/svg">
		//         <circle cx="56" cy="56" r="56" fill="white"/>
		//         <path d="M52.5438 84.2423C33.9131 84.2423 23.0706 76.7894 25.2849 65.4949H39.1816C38.4944 69.106 42.3885 72.8709 53.3837 73.0246C63.6153 73.1014 71.6327 71.7184 72.5489 66.9547C74.3815 56.5053 25.8958 68.7219 29.9426 45.6718C31.8515 34.6845 44.3738 28 61.2483 28C78.7337 28 89.3471 35.376 87.5146 46.7474H73.6179C74.3051 43.0594 70.9455 39.2946 60.2557 39.2177C51.0167 39.0641 44.0684 40.5239 43.2285 45.0571C41.4723 55.1223 89.8053 43.9814 85.8348 66.4937C83.8495 77.5577 70.5637 84.2423 52.5438 84.2423Z" fill="#0200C8"/>
		//   </svg>`;

		// svgDataUrl = await loadSvgImage(svgString);

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

				const block = createBlock(x, y, wfSprite, blockSize);

				// Slight bounce upward and small horizontal nudge
				Body.setVelocity(block, {
					x: (Math.random() - 0.5) * 0.5, // small side wiggle
					y: -1.5 - Math.random() * 0.5, // upward kick
				});
				Composite.add(blocks, block);
			}
		}

		addSlingshot();
		World.add(engine.world, [ground, targetPlatform, blocks]);

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

				// Release and immediately reattach elastic to new projectile
				projectile = createProjectile(spwSprite);
				World.add(engine.world, projectile);
				elastic.bodyB = projectile;
			}
		});

		Render.run(render);
		Matter.Runner.run(engine);

		// // Resize handling (optional)
		// resizeObserver = new ResizeObserver(() => {
		// 	// rebuild walls, scale elastic, etc.
		// });
		// resizeObserver.observe(container);
	};

	// new IntersectionObserver(
	// 	([entry]) => {
	// 		if (entry.isIntersecting) initSimulation();
	// 	},
	// 	{ threshold: 0.1 }
	// ).observe(container);

	initSimulation();
}

function randomColor() {
	let color = Math.floor(Math.random() * 16777215).toString(16);
	return "#" + color;
}
