import { initApproachHero } from "./approach-hero.js";
import { initBookingDetails } from "./booking-details.js";
import { initCaps } from "./caps.js";
import { initCardReveal } from "./card-reveal.js";
import { initCmsCounts } from "./cms-counts.js";
import { initCopyToClipboard } from "./copy-to-clipboard.js";
import { initCursor } from "./cursor.js";
import { initFaq } from "./faq.js";
import { initImpactSlider } from "./impact-slider.js";
import { initInsightToc } from "./insight-toc.js";
import { initIslandReveal } from "./island-reveal.js";
import { initMenuToggle } from "./menu-toggle.js";
import { initNavAutoHide } from "./nav-auto-hide.js";
import { initNavPanel } from "./nav-panel.js";
import { initQuoteFade } from "./quote-fade.js";
import { initRightway } from "./rightway.js";
import { initRtFlow } from "./rt-flow.js";
import { initWorkSchema } from "./work-schema.js";
import { initStick } from "./stick.js";
import { initTeamSwitch } from "./team-switch.js";
import { initWorkArchive } from "./work-archive.js";
import { initWorkSlide } from "./work-slide.js";

// Modules that build or reveal DOM come before the ones that measure or animate
// what they produced. Order matters nowhere else: each runs independently, and
// a module that throws does not stop the next.
export const modules = [
	{ name: "island-reveal", init: initIslandReveal },
	{ name: "cms-counts", init: initCmsCounts },
	{ name: "rt-flow", init: initRtFlow },
	// After rt-flow: the facts it reads only exist once that has run.
	{ name: "work-schema", init: initWorkSchema },
	{ name: "impact-slider", init: initImpactSlider },
	{ name: "booking-details", init: initBookingDetails },

	{ name: "menu-toggle", init: initMenuToggle },
	{ name: "nav-auto-hide", init: initNavAutoHide },
	{ name: "nav-panel", init: initNavPanel },
	{ name: "copy-to-clipboard", init: initCopyToClipboard },
	{ name: "faq", init: initFaq },
	{ name: "insight-toc", init: initInsightToc },
	{ name: "team-switch", init: initTeamSwitch },
	{ name: "stick", init: initStick },
	{ name: "work-archive", init: initWorkArchive },

	{ name: "caps", init: initCaps },
	{ name: "rightway", init: initRightway },
	{ name: "work-slide", init: initWorkSlide },
	{ name: "quote-fade", init: initQuoteFade },
	{ name: "card-reveal", init: initCardReveal },
	{ name: "approach-hero", init: initApproachHero },
	{ name: "cursor", init: initCursor },
];
