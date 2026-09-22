import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initTabbed } from "./tabbed.js";

function section({ items = 3, groups = 2, openIndex = 0 } = {}) {
	const group = (g) =>
		`<div class="tcp_group"${g === 0 ? ' data-stage-open=""' : ""}>
			<div class="tcp_row">${Array.from({ length: items }, (_, i) =>
				`<div class="tcp_item"${i === openIndex ? ' data-open=""' : ""}>
					<div class="tcp_panel"></div>
					<div class="tcp_copy"><h3>Title ${g}-${i}</h3><p>Body.</p></div>
				</div>`).join("")}</div>
		</div>`;

	document.body.innerHTML = `
		<section class="tcp">
			<div class="tcp_stages">${Array.from({ length: groups }, () => '<div class="tcp_stage">Stage</div>').join("")}</div>
			<div class="tcp_rows">${Array.from({ length: groups }, (_, g) => group(g)).join("")}</div>
		</section>`;

	return document.querySelector(".tcp");
}

const panels = () => [...document.querySelectorAll(".tcp_panel")];

/** Reduced motion skips the arrival, so the shipped state is the state. */
function withoutIntro() {
	vi.stubGlobal("matchMedia", () => ({ matches: true }));
}
const openItems = () => [...document.querySelectorAll(".tcp_item[data-open]")];

describe("initTabbed", () => {
	beforeEach(() => {
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			},
		);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
	});

	// The gate is the only thing that lets the CSS hide anything, so it must go
	// on, and it must go on after the section is wired.
	it("marks the section ready", () => {
		const element = section();

		initTabbed();

		expect(element.hasAttribute("data-tabbed-ready")).toBe(true);
	});

	it("opens exactly one item per group, honouring the markup", () => {
		withoutIntro();
		section({ items: 3, groups: 2, openIndex: 1 });

		initTabbed();

		expect(openItems()).toHaveLength(2);

		for (const group of document.querySelectorAll(".tcp_group")) {
			const items = [...group.querySelectorAll(".tcp_item")];

			expect(items.findIndex((item) => item.hasAttribute("data-open"))).toBe(1);
		}
	});

	it("moves the open item on click and says so for a screen reader", () => {
		section({ items: 3 });

		initTabbed();
		panels()[2].click();

		const items = [...document.querySelectorAll(".tcp_group")[0].querySelectorAll(".tcp_item")];

		expect(items[2].hasAttribute("data-open")).toBe(true);
		expect(items[0].hasAttribute("data-open")).toBe(false);
		expect(panels()[2].getAttribute("aria-expanded")).toBe("true");
		expect(panels()[0].getAttribute("aria-expanded")).toBe("false");
	});

	it("makes each panel reachable and operable without a mouse", () => {
		section({ items: 3 });

		initTabbed();

		expect(panels()[0].getAttribute("tabindex")).toBe("0");
		expect(panels()[0].getAttribute("role")).toBe("button");

		panels()[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

		expect(panels()[1].getAttribute("aria-expanded")).toBe("true");
	});

	it("names the region each panel controls", () => {
		section({ items: 2 });

		initTabbed();

		const panel = panels()[0];
		const copy = document.getElementById(panel.getAttribute("aria-controls"));

		expect(copy).not.toBeNull();
		expect(copy.getAttribute("aria-labelledby")).toBe(panel.id);
		expect(copy.getAttribute("role")).toBe("region");
	});

	it("shows one stage and marks its switch as current", () => {
		section({ groups: 3 });

		initTabbed();

		expect(document.querySelectorAll(".tcp_group[data-stage-open]")).toHaveLength(1);

		document.querySelectorAll(".tcp_stage")[2].click();

		const groups = [...document.querySelectorAll(".tcp_group")];

		expect(groups[2].hasAttribute("data-stage-open")).toBe(true);
		expect(groups[0].hasAttribute("data-stage-open")).toBe(false);
		expect(document.querySelectorAll(".tcp_stage")[2].getAttribute("aria-pressed")).toBe("true");
	});

	// A soft navigation leaves both pages in the DOM for a moment, so the
	// outgoing section must not be wired again.
	it("claims a section once", () => {
		withoutIntro();

		const element = section();

		initTabbed();
		initTabbed();

		expect(element.hasAttribute("data-tabbed-built")).toBe(true);
		expect(openItems()).toHaveLength(2);
	});

	it("arrives closed, then opens the shipped item when the row is on screen", () => {
		let fire;

		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(callback) {
					fire = () => callback([{ isIntersecting: true }]);
				}
				observe() {}
				disconnect() {}
			},
		);
		vi.useFakeTimers();

		section({ items: 3, groups: 1, openIndex: 2 });
		initTabbed();

		// Closed on arrival, so the first panel has something to open from.
		expect(openItems()).toHaveLength(0);

		fire();
		vi.advanceTimersByTime(300);

		const items = [...document.querySelectorAll(".tcp_item")];

		expect(items[2].hasAttribute("data-open")).toBe(true);
		vi.useRealTimers();
	});

	it("does nothing on a page without the section", () => {
		document.body.innerHTML = "<main></main>";

		expect(() => initTabbed()).not.toThrow();
	});
});
