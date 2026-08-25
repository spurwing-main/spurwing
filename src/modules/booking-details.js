import { animate, stagger } from "https://cdn.jsdelivr.net/npm/motion@12.23.24/+esm";

document.addEventListener("DOMContentLoaded", initBookingDetails);

function initBookingDetails() {
	const section = document.querySelector(".section_booking-details");

	if (!section) {
		throw new Error('Booking details section ".section_booking-details" not found.');
	}

	const rows = [...section.querySelectorAll(".booking-details_row")];

	for (const row of rows) {
		row.hidden = true;
	}

	const params = new URLSearchParams(window.location.search);
	const uid = params.get("uid");

	if (!uid) {
		section.hidden = true;
		return;
	}

	const values = {
		name: params.get("attendeeName"),
		email: params.get("email"),
		description: params.get("description"),
		"start time": formatBookingDate(params.get("startTime")),
		"end time": formatBookingDate(params.get("endTime")),
	};

	const hasVisibleValues = Object.values(values).some(Boolean);

	if (!hasVisibleValues) {
		section.hidden = true;
		return;
	}

	for (const label in values) {
		setBookingValue(section, label, values[label]);
	}

	setupRescheduleLink(section, uid, values.email);
	updateLastVisibleRow(section);

	section.hidden = false;
	section.classList.add("is-ready");

	animateBookingDetails(section);
}

function setBookingValue(section, label, value) {
	const row = getBookingRow(section, label);

	if (!row) {
		throw new Error(`Booking row "${label}" not found.`);
	}

	const valueElement = row.children[1];

	if (!valueElement) {
		throw new Error(`Booking row "${label}" is missing a value element.`);
	}

	if (!value) {
		row.hidden = true;
		return;
	}

	valueElement.textContent = value;
	row.hidden = false;
}

function getBookingRow(section, label) {
	const rows = section.querySelectorAll(".booking-details_row");

	for (const row of rows) {
		const rowLabel = row.children[0]?.textContent.trim().toLowerCase();

		if (rowLabel === label) {
			return row;
		}
	}

	return null;
}

function setupRescheduleLink(section, uid, email) {
	const rescheduleLink = section.querySelector("[data-booking-reschedule]");

	if (!rescheduleLink) {
		throw new Error('Reschedule link "[data-booking-reschedule]" not found.');
	}

	const rescheduleUrl = new URL(`https://cal.com/reschedule/${encodeURIComponent(uid)}`);

	if (email) {
		rescheduleUrl.searchParams.set("rescheduledBy", email);
	}

	rescheduleLink.href = rescheduleUrl.toString();
}

function updateLastVisibleRow(section) {
	const rows = [...section.querySelectorAll(".booking-details_row")];
	const visibleRows = rows.filter((row) => !row.hidden);

	for (const row of rows) {
		row.classList.remove("is-last");
	}

	visibleRows.at(-1)?.classList.add("is-last");
}

function animateBookingDetails(section) {
	const items = section.querySelectorAll(
		".booking-details_head, .booking-details_row:not([hidden])",
	);

	animate(
		items,
		{
			opacity: [0, 1],
			transform: ["translateY(0.5rem)", "translateY(0rem)"],
			filter: ["blur(0.25rem)", "blur(0rem)"],
		},
		{
			duration: 0.55,
			delay: stagger(0.06),
			ease: "easeOut",
		},
	);
}

function formatBookingDate(value) {
	if (!value) return "";

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}
