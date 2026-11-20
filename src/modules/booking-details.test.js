import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initBookingDetails } from "./booking-details.js";

const row = (label) => `<div class="booking-details_row"><div>${label}</div><div></div></div>`;

describe("booking details", () => {
	beforeEach(() => {
		sessionStorage.clear();
		vi.stubGlobal("plausible", vi.fn());
		vi.stubGlobal("clarity", vi.fn());
		document.body.innerHTML = `<section class="section_booking-details" hidden>
			<div class="booking-details_head"></div>
			${["Name", "Email", "Description", "Start time", "End time"].map(row).join("")}
			<a data-booking-reschedule href="#">Reschedule</a>
		</section>`;
	});

	afterEach(() => {
		history.replaceState(null, "", "/");
		vi.unstubAllGlobals();
	});

	it("shows the booking, counts it once, then takes the name and email out of the address", () => {
		history.replaceState(null, "", "/discovery-call/booked?uid=abc&attendeeName=Sam&email=sam%40example.com");

		initBookingDetails();

		expect(document.querySelector(".section_booking-details").hidden).toBe(false);
		expect(document.body.textContent).toContain("sam@example.com");
		expect(plausible).toHaveBeenCalledTimes(1);
		expect(location.pathname + location.search).toBe("/discovery-call/booked");
	});

	it("hides the section and counts nothing without a booking", () => {
		history.replaceState(null, "", "/discovery-call/booked");

		initBookingDetails();

		expect(document.querySelector(".section_booking-details").hidden).toBe(true);
		expect(plausible).not.toHaveBeenCalled();
	});
});
