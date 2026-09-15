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
  initPageTransition();
  await bootModules(modules);

  if (typeof project.boot?.ready === "function") {
    project.boot.ready();
  } else {
    document.documentElement.classList.add(`${namespace}-ready`);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
