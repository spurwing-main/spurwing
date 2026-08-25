import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initCursor } from "./cursor.js";

function createMotionValue(initialValue) {
	let value = initialValue;
	const listeners = new Set();

	return {
		get: () => value,
		set(nextValue) {
			value = nextValue;
			listeners.forEach((listener) => listener(nextValue));
		},
		jump(nextValue) {
			value = nextValue;
		},
		on(_event, listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		destroy() {
			listeners.clear();
		},
	};
}

const motion = {
	animate: () => ({ cancel() {}, finished: Promise.resolve() }),
	motionValue: createMotionValue,
	springValue: (source) => createMotionValue(source.get()),
	styleEffect: () => () => {},
};

function cursorMarkup() {
	return `
		<div class="cursor-root">
			<div class="cursor-item" data-cursor-target=".loaded-card" data-cursor-anchor="bottom-right">
				<div class="cursor-item-visual"><div><div>View item</div></div></div>
			</div>
		</div>
	`;
}

describe("initCursor", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({
				matches: true,
				addEventListener() {},
				removeEventListener() {},
			})),
		);
	});

	afterEach(() => {
		document.querySelector(".cursor-root")?.cursor?.destroy();
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("matches a target added after startup whenever a cursor root is present", async () => {
		document.body.innerHTML = cursorMarkup();
		await initCursor(document, async () => motion);

		const target = document.createElement("a");
		target.className = "loaded-card";
		target.innerHTML = "<span>Loaded card</span>";
		document.body.appendChild(target);

		target.firstElementChild.dispatchEvent(
			new MouseEvent("pointerover", { bubbles: true, relatedTarget: null }),
		);

		expect(document.querySelector(".cursor-item").style.visibility).toBe("visible");
	});

	it("does not initialize on a device without hover and a fine pointer", async () => {
		matchMedia.mockReturnValue({
			matches: false,
			addEventListener() {},
			removeEventListener() {},
		});
		document.body.innerHTML = cursorMarkup();
		const loadMotion = vi.fn(async () => motion);

		await initCursor(document, loadMotion);

		expect(loadMotion).not.toHaveBeenCalled();
	});

	it("does not load Motion when the cursor root has no cursor items", async () => {
		document.body.innerHTML = '<div class="cursor-root"></div>';
		const loadMotion = vi.fn(async () => motion);

		await initCursor(document, loadMotion);

		expect(loadMotion).not.toHaveBeenCalled();
	});
});
