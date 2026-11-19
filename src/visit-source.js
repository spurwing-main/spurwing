// Where a visitor first came from, kept for the length of the visit so the
// recording, the booking and the "Booked call" goal all say it.
//
// A visitor who asks an AI assistant about us, then searches for us and books,
// arrives on one page and books on another. The booking page only knows its own
// address, so without this the booking says nothing about how they found us.
//
// Kept in sessionStorage: it lasts until the tab closes and is never sent
// anywhere on its own. It goes to Clarity (which only loads after Accept),
// to Plausible on a booking, and into the cal.com booking the visitor makes.

const storageKey = "spw_first_visit";
const bookedKey = "spw_booked";
const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

// Sent into the booking. cal.com saves the utm values on every booking; the
// other three need a hidden booking question of the same name in cal.com.
const bookingKeys = [...utmKeys, "gclid", "landing_page", "first_referrer"];

const searchEngines = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex)\.[a-z.]+$/;
const calEmbed = '[id^="my-cal-inline"]';
const bookingPath = "/discovery-call";

function read(key) {
	try {
		return sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key, value) {
	try {
		sessionStorage.setItem(key, value);
	} catch {}
}

function bareHost(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

export function firstVisit() {
	try {
		return JSON.parse(read(storageKey)) || null;
	} catch {
		return null;
	}
}

// Recorded once per visit, on the page the visitor arrived on. A referrer from
// this site is not a source: it means the record was lost, not a new arrival.
export function captureFirstVisit(loc = location, referrer = document.referrer) {
	const saved = firstVisit();

	if (saved) return saved;

	const params = new URLSearchParams(loc.search);
	const from = bareHost(referrer);
	const external = from && from !== loc.hostname.replace(/^www\./, "") ? from : "";
	const visit = {
		landing_page: loc.pathname,
		first_referrer: external,
		gclid: params.get("gclid") || "",
	};

	for (const key of utmKeys) visit[key] = params.get(key) || "";

	// No utm on the link: name the site they came from, so the booking still
	// shows "claude.ai" or "google.com" where cal.com keeps utm_source.
	if (!visit.utm_source && external) {
		visit.utm_source = external;
		visit.utm_medium = searchEngines.test(external) ? "organic" : "referral";
	}

	write(storageKey, JSON.stringify(visit));

	return visit;
}

function sourceProps(visit) {
	const props = {
		source: visit.utm_source || "direct",
		medium: visit.utm_medium,
		campaign: visit.utm_campaign,
		landing_page: visit.landing_page,
	};

	return Object.fromEntries(Object.entries(props).filter(([, value]) => value));
}

// Clarity queues these until it loads, which is after Accept, then files them
// against the whole recording so it can be filtered by first source.
export function tagClarity(visit) {
	for (const [key, value] of Object.entries(sourceProps(visit))) {
		window.clarity?.("set", `first_${key}`, value);
	}
}

// cal.com copies the page's own query string into the booking form
// (forwardQueryParams in the Designer embed), and reads it when it builds the
// form. So the first visit is written into this page's address before then.
// Values already in the address win.
export function forwardToBooking(visit, hasEmbed) {
	if (!visit || !hasEmbed) return;

	const params = new URLSearchParams(location.search);
	let changed = false;

	for (const key of bookingKeys) {
		if (visit[key] && !params.has(key)) {
			params.set(key, visit[key]);
			changed = true;
		}
	}

	if (!changed) return;

	history.replaceState(history.state, "", `${location.pathname}?${params}${location.hash}`);
}

// Called by booking-details.js on the confirmation page. A refresh of that page
// is the same booking, so each booking counts once.
export function trackBooking(uid) {
	if (!uid || read(bookedKey) === uid) return;

	write(bookedKey, uid);

	const props = sourceProps(firstVisit() || {});

	window.clarity?.("set", "booked", "yes");
	window.clarity?.("event", "booked_call");
	window.plausible?.("Booked call", { props });
}

// The banner already keeps Clarity off until Accept. This tells Clarity the
// choice as well, so a visitor who later turns analytics off in the cookie
// settings has Clarity's cookies removed rather than left in place.
export function syncClarityConsent() {
	const tell = (choices) => {
		window.clarity?.("consentv2", {
			ad_Storage: choices?.marketing ? "granted" : "denied",
			analytics_Storage: choices?.analytics ? "granted" : "denied",
		});
	};

	window.FinsweetConsentPro = window.FinsweetConsentPro || [];
	window.FinsweetConsentPro.push([
		"consent",
		(consent) => {
			tell(consent.consents.get());
			consent.on("consent-updated", () => tell(consent.consents.get()));
		},
	]);
}

// Runs when the bundle loads, not on DOM ready: on a full load of the booking
// page the embed may build its form before then, so the page is known by its
// address while the body may still be arriving.
export function initVisitSource() {
	const visit = captureFirstVisit();

	tagClarity(visit);
	syncClarityConsent();
	forwardToBooking(visit, location.pathname === bookingPath || !!document.querySelector(calEmbed));

	// The router fires spw:page before it runs the incoming page's scripts, so
	// the address is ready before the cal.com embed reads it.
	document.addEventListener("spw:page", (event) => {
		forwardToBooking(firstVisit(), !!event.detail?.container?.querySelector(calEmbed));
	});
}
