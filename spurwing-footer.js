// Set up global Spurwing object
const spw = {
	config: {
		scriptVers: "68dd0e3a34183db1591065ff2539f8a8477bd17f", // github commit id. Updated manually on each release
		scriptName: "spurwing.js", // script name
		get devPath() {
			return `http://localhost:5500/${this.scriptName}`; // local script
		},
		get livePath() {
			return `https://cdn.jsdelivr.net/gh/spurwing-main/spurwing@${this.scriptVers}/${this.scriptName}`; // live script
		},
		get ENV() {
			return localStorage.getItem("spw_ENV") || "live"; // check localStorage for spw_ENV variable, default is 'live'
		},
		debug: true, // turns on console logging etc
	},
};

/* helper function for logging */
spw.log = function (str) {
	// if debug turned off, exit
	if (!spw.config.debug) return;

	// if a message exists, log it, otherwise just log the global element
	if (str) console.log(str);
	else console.log(spw);
};

document.addEventListener("DOMContentLoaded", () => {
	// This runs on initial load only

	// Load custom scripts at start of session
	loadCustomScripts();

	// Initialize Swup
	const swup_options = {
		containers: ["main"],
		// plugins: [new SwupDebugPlugin()],
		plugins: [],
	};
	spw.swup = new Swup(swup_options);

	// Function to load all custom scripts
	function loadCustomScripts() {
		// create script element
		spw.config.scriptEl = document.createElement("script");

		// load either dev or live version, depending on ENV
		spw.config.scriptEl.src =
			spw.config.ENV === "dev" ? spw.config.devPath : spw.config.livePath;

		// when script loads...
		spw.config.scriptEl.onload = function () {
			console.log(`Site code loaded from ${spw.config.ENV} source`);
			// ...run functions
			main();
		};

		// append script element to doc
		document.head.appendChild(spw.config.scriptEl);

		/* update and show dev mode banner */
		if (spw.config.ENV === "dev") {
			const devBanner = document.querySelector(".dev-banner");
			if (devBanner) {
				devBanner.style.display = "block"; // show dev mode banner
				devBanner.textContent = "dev mode";
			}
		}
	}

	// Function to restart Webflow
	const restartWebflow = () => {
		spw.log("restart WF");
		window.Webflow.destroy();
		window.Webflow.ready();
		window.Webflow.require("ix2")?.init();
		document.dispatchEvent(new Event("readystatechange"));
	};

	// Function to fetch new page content and extract data-wf-page attribute
	const fetchNewPageDataWfPage = async (url) => {
		try {
			const response = await fetch(url);
			const html = await response.text();
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");
			const newWfPageId = doc.documentElement.getAttribute("data-wf-page");
			return newWfPageId;
		} catch (error) {
			console.error("Error fetching new page:", error);
			return null;
		}
	};

	// Event before page transition starts
	spw.swup.hooks.on("visit:start", async (visit) => {
		// const newWfPageId =
		// 	visit.to.document?.documentElement.getAttribute("data-wf-page");
		// // const newWfPageId = await fetchNewPageDataWfPage(visit.to.url);
		// spw.log(newWfPageId);
		// if (newWfPageId) {
		// 	document.documentElement.setAttribute("data-wf-page", newWfPageId);
		// }
	});

	// Event after new content has been replaced
	spw.swup.hooks.on("content:replace", (visit) => {
		const newWfPageId =
			visit.to.document?.documentElement.getAttribute("data-wf-page");
		spw.log(newWfPageId);

		if (newWfPageId) {
			document.documentElement.setAttribute("data-wf-page", newWfPageId);
		}
		spw.log("Swup content replaced");
		restartWebflow();
	});

	// Reload scripts after each page transition - this is where Swup docs recommend scripts get reloaded
	spw.swup.hooks.on("page:view", () => {
		spw.log("Swup page view");

		/* load scripts */
		loadCustomScripts();
	});
});
