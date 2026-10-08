import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({
	animate: vi.fn(),
	inView: vi.fn(),
}));

vi.mock("motion", () => motion);

import { initProcessTabs } from "./process-tabs.js";

function section(count) {
	const steps = Array.from({ length: count })
		.map((_, index) => `<div data-process-step><h3>Step ${index + 1}</h3></div>`)
		.join("");

	return `
		<section data-process-tabs>
			<div>${steps}</div>
			<div role="tablist">
				<div class="process-tabs_tab" data-process-tab><div>01</div></div>
			</div>
			<div class="process-tabs_track"><div data-process-progress></div></div>
		</section>
	`;
}

const steps = () => [...document.querySelectorAll("[data-process-step]")];
const tabs = () => [...document.querySelectorAll("[data-process-tab]")];

// A controllable animation: the test decides when it finishes.
function animation() {
	let finish;
	const finished = new Promise((resolve) => {
		finish = resolve;
	});

	return { stop: vi.fn(), finished, finish };
}

function stubReducedMotion(matches) {
	vi.stubGlobal("matchMedia", vi.fn(() => ({ matches })));
}

describe("initProcessTabs", () => {
	let runs;

	beforeEach(() => {
		runs = [];
		motion.animate.mockReset();
		motion.animate.mockImplementation(() => {
			const run = animation();
			runs.push(run);
			return run;
		});
		motion.inView.mockReset();
		motion.inView.mockReturnValue(() => {});
		stubReducedMotion(false);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	const onScreen = () => motion.inView.mock.calls.at(-1)[1]();

	it("makes one tab per step, named by its title, and shows only the first step", () => {
		document.body.innerHTML = section(4);

		initProcessTabs();

		expect(tabs().map((tab) => tab.firstElementChild.textContent)).toEqual(["Step 1", "Step 2", "Step 3", "Step 4"]);
		expect(steps().map((step) => step.hidden)).toEqual([false, true, true, true]);
		expect(tabs()[0].classList.contains("is-active")).toBe(true);
		expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
		expect(tabs()[1].getAttribute("aria-selected")).toBe("false");
	});

	it("ties each tab to its step for assistive technology", () => {
		document.body.innerHTML = section(2);

		initProcessTabs();

		const [tab] = tabs();
		const [step] = steps();

		expect(tab.getAttribute("role")).toBe("tab");
		expect(tab.getAttribute("aria-controls")).toBe(step.id);
		expect(step.getAttribute("role")).toBe("tabpanel");
		expect(step.getAttribute("aria-labelledby")).toBe(tab.id);
	});

	it("moves to the next step when the progress line fills on screen", async () => {
		document.body.innerHTML = section(3);

		initProcessTabs();
		expect(motion.animate).not.toHaveBeenCalled();

		onScreen();
		runs.at(-1).finish();
		await Promise.resolve();

		expect(steps().map((step) => step.hidden)).toEqual([true, false, true]);
	});

	it("stops moving on by itself once a tab is picked", async () => {
		document.body.innerHTML = section(3);

		initProcessTabs();
		onScreen();
		const first = runs.at(-1);

		tabs()[2].click();
		first.finish();
		await Promise.resolve();

		expect(steps().map((step) => step.hidden)).toEqual([true, true, false]);
		expect(first.stop).toHaveBeenCalled();
		expect(runs.length).toBe(1);
	});

	it("fills the line over the step showing, then fades it out as the next comes up", async () => {
		document.body.innerHTML = section(4);

		initProcessTabs();
		const line = document.querySelector("[data-process-progress]");
		expect(line.style.transform).toBe("scaleX(0)");

		onScreen();
		const [from, to, options] = motion.animate.mock.calls.at(-1);

		expect([from, to, options.duration]).toEqual([0, 1, 7]);
		options.onUpdate(0.5);
		expect(line.style.transform).toBe("scaleX(0.5)");
		options.onUpdate(1);

		runs.at(-1).finish();
		await Promise.resolve();

		// The next step is up and the full line fades rather than running back.
		expect(steps()[1].hidden).toBe(false);
		const [fadeFrom, fadeTo, fade] = motion.animate.mock.calls.at(-1);
		expect([fadeFrom, fadeTo]).toEqual([1, 0]);
		fade.onUpdate(0.5);
		expect(line.style.opacity).toBe("0.5");
		expect(line.style.transform).toBe("scaleX(1)");

		runs.at(-1).finish();
		await Promise.resolve();

		expect(line.style.transform).toBe("scaleX(0)");
		expect(line.style.opacity).toBe("");
		expect(motion.animate.mock.calls.at(-1).slice(0, 2)).toEqual([0, 1]);
	});

	it("fades the line out when a tab is picked and leaves it empty", async () => {
		document.body.innerHTML = section(4);

		initProcessTabs();
		onScreen();
		const [first] = runs;
		motion.animate.mock.calls.at(-1)[2].onUpdate(0.6);

		tabs()[2].click();
		expect(first.stop).toHaveBeenCalled();
		expect(motion.animate.mock.calls.at(-1).slice(0, 2)).toEqual([1, 0]);

		runs.at(-1).finish();
		await Promise.resolve();

		expect(document.querySelector("[data-process-progress]").style.transform).toBe("scaleX(0)");
		expect(motion.animate).toHaveBeenCalledTimes(2);
	});

	it("carries on from where the line stopped when it comes back on screen", () => {
		document.body.innerHTML = section(3);

		initProcessTabs();
		const leave = onScreen();
		motion.animate.mock.calls.at(-1)[2].onUpdate(0.25);
		leave();
		onScreen();

		const [from, to, options] = motion.animate.mock.calls.at(-1);
		expect([from, to, options.duration]).toEqual([0.25, 1, 5.25]);
	});

	it("moves between tabs with the arrow keys", () => {
		document.body.innerHTML = section(3);

		initProcessTabs();
		tabs()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));

		expect(steps().map((step) => step.hidden)).toEqual([true, true, false]);
		expect(document.activeElement).toBe(tabs()[2]);
	});

	it("never moves on by itself for reduced motion", () => {
		stubReducedMotion(true);
		document.body.innerHTML = section(3);

		initProcessTabs();
		onScreen();

		expect(motion.animate).not.toHaveBeenCalled();
		expect(steps()[0].hidden).toBe(false);
	});

	it("numbers a tab whose step has no title", () => {
		document.body.innerHTML = section(2).replace("<h3>Step 2</h3>", "");

		initProcessTabs();

		expect(tabs().map((tab) => tab.firstElementChild.textContent)).toEqual(["Step 1", "02"]);
	});

	it("leaves a single step as it is", () => {
		document.body.innerHTML = section(1);

		initProcessTabs();

		expect(tabs()).toHaveLength(1);
		expect(steps()[0].hidden).toBe(false);
		expect(motion.inView).not.toHaveBeenCalled();
	});

	it("does not start twice on the same section", () => {
		document.body.innerHTML = section(2);

		initProcessTabs();
		initProcessTabs();

		expect(tabs()).toHaveLength(2);
	});
});
