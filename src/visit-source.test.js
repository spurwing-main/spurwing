import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	captureFirstVisit,
	firstVisit,
	forwardToBooking,
	syncClarityConsent,
	tagClarity,
	trackBooking,
} from "./visit-source.js";

const page = (path, search = "") => ({ pathname: path, search, hostname: "www.spurwing.co.uk" });

describe("visit source", () => {
	beforeEach(() => {
		sessionStorage.clear();
		vi.stubGlobal("clarity", vi.fn());
		vi.stubGlobal("plausible", vi.fn());
	});

	afterEach(() => {
		history.replaceState(null, "", "/");
		vi.unstubAllGlobals();
		delete window.FinsweetConsentPro;
	});

	it("names the site a visitor came from when the link has no utm", () => {
		const visit = captureFirstVisit(page("/work"), "https://claude.ai/");

		expect(visit).toMatchObject({
			utm_source: "claude.ai",
			utm_medium: "referral",
			first_referrer: "claude.ai",
			landing_page: "/work",
		});
	});

	it("marks a search engine as organic", () => {
		expect(captureFirstVisit(page("/"), "https://www.google.co.uk/").utm_medium).toBe("organic");
	});

	it("keeps the link's own utm and gclid over the referrer", () => {
		const visit = captureFirstVisit(
			page("/", "?utm_source=newsletter&utm_medium=email&gclid=abc"),
			"https://www.google.com/",
		);

		expect(visit).toMatchObject({ utm_source: "newsletter", utm_medium: "email", gclid: "abc" });
	});

	it("does not count this site as a source", () => {
		expect(captureFirstVisit(page("/about"), "https://www.spurwing.co.uk/").utm_source).toBe("");
	});

	it("keeps the first page of the visit, not later ones", () => {
		captureFirstVisit(page("/work"), "https://claude.ai/");
		captureFirstVisit(page("/discovery-call"), "https://www.google.com/");

		expect(firstVisit().utm_source).toBe("claude.ai");
	});

	it("tags the recording with the first source", () => {
		tagClarity(captureFirstVisit(page("/work"), "https://claude.ai/"));

		expect(clarity).toHaveBeenCalledWith("set", "first_source", "claude.ai");
		expect(clarity).toHaveBeenCalledWith("set", "first_landing_page", "/work");
	});

	it("tags a visit with no source as direct", () => {
		tagClarity(captureFirstVisit(page("/"), ""));

		expect(clarity).toHaveBeenCalledWith("set", "first_source", "direct");
	});

	it("writes the first visit into the booking page's address, keeping what is there", () => {
		const visit = captureFirstVisit(page("/work"), "https://claude.ai/");
		history.replaceState(null, "", "/discovery-call?notes=hello&utm_campaign=faq");

		forwardToBooking(visit, true);

		const params = new URLSearchParams(location.search);
		expect(location.pathname).toBe("/discovery-call");
		expect(params.get("notes")).toBe("hello");
		expect(params.get("utm_campaign")).toBe("faq");
		expect(params.get("utm_source")).toBe("claude.ai");
		expect(params.get("landing_page")).toBe("/work");
	});

	it("leaves pages without the booking embed alone", () => {
		const visit = captureFirstVisit(page("/work"), "https://claude.ai/");
		history.replaceState(null, "", "/work");

		forwardToBooking(visit, false);

		expect(location.search).toBe("");
	});

	it("counts a booking once, with its first source", () => {
		captureFirstVisit(page("/work"), "https://claude.ai/");

		trackBooking("uid-1");
		trackBooking("uid-1");

		expect(plausible).toHaveBeenCalledTimes(1);
		expect(plausible).toHaveBeenCalledWith("Booked call", {
			props: { source: "claude.ai", medium: "referral", landing_page: "/work" },
		});
		expect(clarity).toHaveBeenCalledWith("event", "booked_call");
	});

	it("passes the cookie choice to Clarity, and again when it changes", () => {
		let choices = { analytics: false, marketing: false };
		let onUpdate;
		window.FinsweetConsentPro = {
			push: (entry) => entry[1](consent),
		};
		const consent = {
			consents: { get: () => choices },
			on: (name, handler) => {
				if (name === "consent-updated") onUpdate = handler;
			},
		};

		syncClarityConsent();
		expect(clarity).toHaveBeenLastCalledWith("consentv2", {
			ad_Storage: "denied",
			analytics_Storage: "denied",
		});

		choices = { analytics: true, marketing: false };
		onUpdate();
		expect(clarity).toHaveBeenLastCalledWith("consentv2", {
			ad_Storage: "denied",
			analytics_Storage: "granted",
		});
	});
});
