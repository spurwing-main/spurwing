import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { notePage, noteQuestion, startVisit, syncClarityConsent, tagClarity, trackBooking } from "./visit-source.js";

const page = (path, search = "") => ({ pathname: path, search, hostname: "www.spurwing.co.uk" });
const start = Date.UTC(2026, 10, 20, 10, 0);
const fields = () => JSON.parse(sessionStorage.getItem("spw_booking"));

describe("visit source", () => {
	beforeEach(() => {
		sessionStorage.clear();
		vi.stubGlobal("clarity", vi.fn());
		vi.stubGlobal("plausible", vi.fn());
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		delete window.FinsweetConsentPro;
	});

	it("names the site a visitor came from when the link has no utm", () => {
		expect(startVisit(page("/work"), "https://claude.ai/")).toMatchObject({
			utm_source: "claude.ai",
			utm_medium: "referral",
			first_referrer: "claude.ai",
			landing_page: "/work",
		});
	});

	it("marks a search engine as organic, and no referrer as direct", () => {
		expect(startVisit(page("/"), "https://www.google.co.uk/").utm_medium).toBe("organic");
		sessionStorage.clear();
		expect(startVisit(page("/"), "https://mail.google.com/").utm_medium).toBe("referral");
		sessionStorage.clear();
		expect(startVisit(page("/"), "https://search.yahoo.com/").utm_medium).toBe("organic");
		sessionStorage.clear();
		expect(startVisit(page("/"), "").utm_source).toBe("direct");
	});

	it("marks an ad click as paid", () => {
		expect(startVisit(page("/", "?gclid=abc"), "https://www.google.com/")).toMatchObject({
			utm_source: "google",
			utm_medium: "cpc",
			gclid: "abc",
		});
		sessionStorage.clear();
		expect(startVisit(page("/", "?msclkid=x"), "")).toMatchObject({ utm_source: "bing", utm_medium: "cpc" });
	});

	it("keeps the utm values from the link", () => {
		expect(startVisit(page("/", "?utm_source=linkedin&utm_medium=social"), "https://claude.ai/")).toMatchObject({
			utm_source: "linkedin",
			utm_medium: "social",
		});
	});

	it("records the first page only, and ignores this site as a referrer", () => {
		startVisit(page("/work"), "https://claude.ai/");

		expect(startVisit(page("/about"), "https://www.spurwing.co.uk/work").landing_page).toBe("/work");
		sessionStorage.clear();
		expect(startVisit(page("/about"), "https://www.spurwing.co.uk/work").first_referrer).toBe("");
	});

	it("tags the recording with the first source", () => {
		tagClarity(startVisit(page("/work"), "https://claude.ai/"));

		expect(clarity).toHaveBeenCalledWith("set", "first_source", "claude.ai");
		expect(clarity).toHaveBeenCalledWith("set", "first_landing_page", "/work");
	});

	it("saves what a booking should carry, with everything in utm_content", () => {
		vi.useFakeTimers({ now: start });
		startVisit(page("/"), "https://claude.ai/", start);
		notePage("/");
		notePage("/webflow-agency");
		noteQuestion("c-1");
		noteQuestion("c-1");
		vi.setSystemTime(start + 5 * 60_000);
		notePage("/discovery-call");

		expect(fields()).toEqual({
			utm_source: "claude.ai",
			utm_medium: "referral",
			utm_content:
				"landing_page: / | first_referrer: claude.ai | booking_page: /webflow-agency | pages_viewed: 3 | visit_minutes: 5 | ask_box_used: yes (2) | ask_box_id: c-1",
			landing_page: "/",
			first_referrer: "claude.ai",
			booking_page: "/webflow-agency",
			pages_viewed: "3",
			visit_minutes: "5",
			ask_box_used: "yes (2)",
			ask_box_id: "c-1",
		});
	});

	it("puts the link's own utm_content first", () => {
		startVisit(page("/work", "?utm_content=banner"), "");

		expect(fields().utm_content).toMatch(/^banner \| landing_page: \/work \|/);
	});

	it("names the booking page itself when the visit started there", () => {
		startVisit(page("/discovery-call"), "");
		notePage("/discovery-call");

		expect(fields()).toMatchObject({ booking_page: "/discovery-call", ask_box_used: "no" });
	});

	it("keeps working when storage is blocked", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("blocked");
		});

		expect(startVisit(page("/"), "https://claude.ai/").utm_source).toBe("claude.ai");
		expect(() => notePage("/work")).not.toThrow();
		expect(() => trackBooking("uid-1")).not.toThrow();
	});

	it("counts a booking once, with where the visitor came from", () => {
		startVisit(page("/"), "https://claude.ai/");
		notePage("/");
		notePage("/faq");
		noteQuestion("c-1");
		notePage("/discovery-call");
		notePage("/discovery-call/booked");

		trackBooking("uid-1");
		trackBooking("uid-1");

		expect(plausible).toHaveBeenCalledTimes(1);
		expect(plausible).toHaveBeenCalledWith("Booked call", {
			props: {
				utm_source: "claude.ai",
				utm_medium: "referral",
				landing_page: "/",
				first_referrer: "claude.ai",
				booking_page: "/faq",
				pages_viewed: "4",
				visit_minutes: "0",
				ask_box_used: "yes (1)",
			},
		});
		expect(clarity).toHaveBeenCalledWith("set", "booking_uid", "uid-1");
		expect(clarity).toHaveBeenCalledWith("event", "booked_call");
	});

	it("passes the cookie choice to Clarity, and again when it changes", () => {
		let choices = { analytics: false, marketing: false };
		let onUpdate;
		const consent = {
			consents: { get: () => choices },
			on: (name, handler) => {
				if (name === "consent-updated") onUpdate = handler;
			},
		};
		window.FinsweetConsentPro = { push: (entry) => entry[1](consent) };

		syncClarityConsent();
		expect(clarity).toHaveBeenLastCalledWith("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });

		choices = { analytics: true, marketing: false };
		onUpdate();
		expect(clarity).toHaveBeenLastCalledWith("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
	});
});
