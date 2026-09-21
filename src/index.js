import { bootModules, restartModules } from "./boot.js";
import { modules } from "./modules/index.js";
import { initPageTransition } from "./modules/page-transition.js";

const namespace = document.documentElement.dataset.projectNamespace || "spurwing";
const project = (window[namespace] = window[namespace] || {});
project.modules = Object.fromEntries(modules.map((module) => [module.name, module.init]));

// The router owns navigation for the whole session, so it starts once and is
// not in the module list. It restarts the modules against each new page.
document.addEventListener("spw:page", () => restartModules());

async function start() {
  // Outside bootModules' per-module try/catch, so it gets one of its own. The
  // router throwing used to mean no module booted at all and data-modules-ready
  // was never set — the page's whole reveal system resting on one call.
  try {
    initPageTransition();
  } catch (error) {
    console.error("[site] the router did not start.", error);
  }

  await bootModules(modules);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
