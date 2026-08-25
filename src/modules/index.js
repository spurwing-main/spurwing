import { initApproachHero } from "./approach-hero.js";
import { initBookingDetails } from "./booking-details.js";
import { initCaps } from "./caps.js";
import { initCopy } from "./copy.js";
import { initCursor } from "./cursor.js";
import { initDataLoader } from "./data-loader.js";
import { initFaq } from "./faq.js";
import { initInsightToc } from "./insight-toc.js";
import { initRightway } from "./rightway.js";
import { initRtFlow } from "./rt-flow.js";
import { initStick } from "./stick.js";
import { initTeamSwitch } from "./team-switch.js";
import { initWorkArchive } from "./work-archive.js";
import { initWorkCardAnim } from "./work-card-anim.js";
import { initWorkRail } from "./work-rail.js";
import { initWorkSlide } from "./work-slide.js";
import { initWorkSlider } from "./work-slider.js";

// Keep DOM-building modules before the behaviors that measure or animate their output.
export const modules = [
	{ name: "data-loader", init: initDataLoader },
	{ name: "rt-flow", init: initRtFlow },
	{ name: "booking-details", init: initBookingDetails },
	{ name: "copy", init: initCopy },
	{ name: "faq", init: initFaq },
	{ name: "insight-toc", init: initInsightToc },
	{ name: "team-switch", init: initTeamSwitch },
	{ name: "stick", init: initStick },
	{ name: "work-archive", init: initWorkArchive },
	{ name: "work-slider", init: initWorkSlider },
	{ name: "caps", init: initCaps },
	{ name: "rightway", init: initRightway },
	{ name: "work-slide", init: initWorkSlide },
	{ name: "work-rail", init: initWorkRail },
	{ name: "work-card-anim", init: initWorkCardAnim },
	{ name: "approach-hero", init: initApproachHero },
	{ name: "cursor", init: initCursor },
];
