// Set up global Spurwing object
const spw = {
	config: {
		scriptVers: "9493f61877af534ba217ce197fc548bd37a22a14", // github commit id. Updated manually on each release
		scriptName: "spurwing.js", // script name
		get devPath() {
			return `http://localhost:5500/${this.scriptName}`; // local script path
		},
		get livePath() {
			return `https://cdn.jsdelivr.net/gh/spurwing-main/spurwing@${this.scriptVers}/${this.scriptName}`; // live path
		},
		get ENV() {
			return localStorage.getItem("spw_ENV") || "live"; // checks localStorage for spw_ENV variable (default is 'live')
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

// array of third party scripts to load
spw.scriptsExt = [
	"https://cdn.jsdelivr.net/npm/@finsweet/attributes-cmsfilter@1/cmsfilter.js",
];

document.addEventListener("DOMContentLoaded", () => {
	// This runs on initial load only

	// Load custom scripts at start of session
	loadCustomScripts();
	loadExtScripts();

	// Initialize Swup
	const swup_options = {
		containers: ["main"],
		plugins: [],
	};
	spw.swup = new Swup(swup_options);

	// Function to load all custom scripts
	function loadCustomScripts() {
		spw.config.scriptEl = document.createElement("script");
		// load either dev or live version, depending on ENV
		spw.config.scriptEl.src =
			spw.config.ENV === "dev" ? spw.config.devPath : spw.config.livePath;
		spw.config.scriptEl.onload = function () {
			console.log(`Site code loaded from ${spw.config.ENV} source`);
			main();
		};
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

	// Function to load external scripts
	function loadExtScripts() {
		for (var i = 0; i < spw.scriptsExt.length; i++) {
			console.log(spw.scriptsExt[i]);
			var scriptEl = document.createElement("script");
			scriptEl.src = spw.scriptsExt[i];
			document.head.appendChild(scriptEl);
			scriptEl.onload = function () {
				console.log("External script loaded: " + scriptEl.src);
			};
		}
	}

	// Function to restart Webflow
	function restartWebflow() {
		spw.log("restart WF");
		window.Webflow.destroy();
		window.Webflow.ready();
		window.Webflow.require("ix2")?.init();
		document.dispatchEvent(new Event("readystatechange"));
	}

	// Event before page transition starts
	spw.swup.hooks.on("visit:start", async (visit) => {
		spw.log("Swup visit:start");

		// kill custom cursor
		spw.cursor.enabled = false;
		spw.cursor.reset();
	});

	// Event after new content has been replaced
	spw.swup.hooks.on("content:replace", (visit) => {
		spw.log("Swup content:replace");

		// get id of new page and add to existing <html>. This is need to restart WF anims properly
		const newWfPageId =
			visit.to.document?.documentElement.getAttribute("data-wf-page");
		if (newWfPageId)
			document.documentElement.setAttribute("data-wf-page", newWfPageId);

		// restart WF
		restartWebflow();
	});

	// Event after new page loaded
	spw.swup.hooks.on("page:view", () => {
		spw.log("Swup page:view");

		/* load scripts */
		loadCustomScripts();
		loadExtScripts();
		console.log(`Site code reloaded from ${spw.config.ENV} source by swup.js`);
	});
});
