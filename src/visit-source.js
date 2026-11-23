// Where a visitor came from and what they did before booking, so the booking,
// its Clarity recording and the "Booked call" goal in Plausible all say it.
//
// A visitor who asks an AI assistant about us, then searches for us and books,
// arrives on one page and books on another. The booking page only knows its own
// address, so without this the booking says nothing about how they found us.
//
// Kept in sessionStorage until the tab closes. On every page the fields a
// booking should carry are saved as "spw_booking"; the cal.com embed on
// /discovery-call reads them itself when it builds the form, so the calendar
// never waits for this code and nothing is written into the page's address.

const visitKey = "spw_visit";
const fieldsKey = "spw_booking";
const bookedKey = "spw_booked";
const bookingPath = "/discovery-call";
const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
// Any subdomain of a search engine (search.yahoo.com, cn.bing.com) except its mail.
const searchEngines = /^(?!mail\.)(.+\.)?(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex)\.[a-z.]+$/;
const adClicks = { gclid: "google", gbraid: "google", wbraid: "google", msclkid: "bing" };

function load(key) {
	try {
		return JSON.parse(sessionStorage.getItem(key));
	} catch {
		return null;
	}
}

function store(key, value) {
	try {
		sessionStorage.setItem(key, JSON.stringify(value));
	} catch {}
}

function host(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

// Recorded once, on the page the visitor arrived on. A referrer from this site
// is not a source: it means the record was lost, not a new arrival.
export function startVisit(loc = location, referrer = document.referrer, now = Date.now()) {
	const saved = load(visitKey);

	if (saved) return saved;

	const params = new URLSearchParams(loc.search);
	const from = host(referrer);
	const external = from === loc.hostname.replace(/^www\./, "") ? "" : from;
	const click = Object.keys(adClicks).find((key) => params.get(key));
	const visit = { landing_page: loc.pathname, first_referrer: external, gclid: params.get("gclid") || "" };

	for (const key of utmKeys) visit[key] = params.get(key) || "";

	// No utm on the link: an ad click is paid, a search engine organic, any
	// other site a referral, and nothing at all direct.
	if (!visit.utm_source) {
		visit.utm_source = click ? adClicks[click] : external || "direct";
		visit.utm_medium = click ? "cpc" : searchEngines.test(external) ? "organic" : external ? "referral" : "";
	}

	return save({ ...visit, started: now, pages: 0, asked: 0, conversations: [], last_page: "" }, now);
}

function save(visit, now = Date.now()) {
	store(visitKey, visit);
	store(fieldsKey, bookingFields(visit, now));
	return visit;
}

function update(change) {
	const visit = load(visitKey);

	if (!visit) return;
	change(visit);
	save(visit);
}

export function notePage(path = location.pathname) {
	update((visit) => {
		visit.pages += 1;
		if (!path.startsWith(bookingPath)) visit.last_page = path;
	});
}

// The ask box's conversation ID, as it goes to the question log, so a booking
// can be matched to the questions asked before it.
export function noteQuestion(conversation) {
	update((visit) => {
		visit.asked += 1;
		visit.conversations = [...new Set([...(visit.conversations || []), conversation].filter(Boolean))];
	});
}

// What a booking is told. cal.com saves the utm values with no setup; every
// other name needs a hidden booking question of that name, or is dropped. Until
// those exist, utm_content carries all of it in one line, after any
// utm_content the link brought.
export function bookingFields(visit, now = Date.now()) {
	const fields = {
		landing_page: visit.landing_page,
		first_referrer: visit.first_referrer,
		booking_page: visit.last_page || bookingPath,
		pages_viewed: String(visit.pages),
		visit_minutes: String(Math.max(0, Math.round((now - visit.started) / 60000))),
		ask_box_used: visit.asked ? `yes (${visit.asked})` : "no",
		ask_box_id: (visit.conversations || []).join(", "),
		gclid: visit.gclid,
		clarity_id: clarityIds().user,
	};
	const summary = Object.entries(fields)
		.filter(([, value]) => value)
		.map(([key, value]) => `${key}: ${value}`);
	const all = {
		...Object.fromEntries(utmKeys.map((key) => [key, visit[key]])),
		utm_content: [visit.utm_content, ...summary].filter(Boolean).join(" | "),
		...fields,
	};

	return Object.fromEntries(Object.entries(all).filter(([, value]) => value));
}

// Clarity's own visitor and session IDs, from its cookies (the first part of
// _clck and _clsk, split on ^ as Clarity writes them today, or |). Empty
// until the visitor accepts cookies.
export function clarityIds() {
	const first = (name) => {
		try {
			const value = document.cookie
				.split("; ")
				.find((cookie) => cookie.startsWith(`${name}=`))
				?.slice(name.length + 1);
			return value ? decodeURIComponent(value).split(/[|^]/)[0] : "";
		} catch {
			return "";
		}
	};
	return { user: first("_clck"), session: first("_clsk") };
}

// Clarity queues these until it loads, which is after Accept, then files them
// against the whole recording so it can be filtered by first source.
export function tagClarity(visit) {
	for (const key of ["utm_source", "utm_medium", "landing_page"]) {
		if (visit[key]) window.clarity?.("set", `first_${key.replace("utm_", "")}`, visit[key]);
	}
}

// Called by booking-details.js on the confirmation page. A refresh of that page
// is the same booking, so each booking counts once. The booking's uid is tagged
// in Clarity, so its recording is found by filtering on booking_uid.
export function trackBooking(uid) {
	if (!uid || load(bookedKey) === uid) return;
	store(bookedKey, uid);

	const { utm_content, ask_box_id, gclid, clarity_id, ...props } = load(fieldsKey) || {};

	window.clarity?.("set", "booking_uid", uid);
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

// The router fires spw:page before it runs the incoming page's scripts, so the
// fields are saved before the cal.com embed on the booking page reads them.
// On a full load of the booking page the embed may run first: it then falls
// back to what it can see itself (see the "Discovery / Cal embed" component).
export function initVisitSource() {
	document.addEventListener("spw:page", ({ detail }) => {
		notePage(new URL(detail?.url ?? location.href, location.href).pathname);
	});

	tagClarity(startVisit());
	syncClarityConsent();

	// A prerendered page counts once the visitor actually sees it.
	if (document.prerendering) document.addEventListener("prerenderingchange", () => notePage(), { once: true });
	else notePage();
}
