// A query that states what it wanted when it finds nothing. Modules that build
// from Designer markup fail at init with the selector in the message, rather
// than further along on a null.
export function requireElement(scope, selector, label = selector) {
	const element = scope.querySelector(selector);

	if (!element) throw new Error(`missing ${label}: expected "${selector}"`);

	return element;
}

/** Elements the browser already makes clickable from the keyboard. */
const NATIVE_CONTROLS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

/**
 * Wire an element to run on a click, whether the click came from a pointer or
 * from the keyboard.
 *
 * A div with a click listener is invisible to anyone not using a mouse: it
 * cannot be reached by Tab and it does not answer Enter. Rather than repeat the
 * tabindex, the role and the keydown in every module that styles something to
 * look like a button, they live here once. A real button or link is left alone
 * — the browser already turns Enter into a click on those, and adding our own
 * would fire the action twice.
 */
export function press(element, run, signal) {
	element.addEventListener("click", run, { signal });

	if (NATIVE_CONTROLS.has(element.tagName)) return;

	if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "0");
	if (!element.hasAttribute("role")) element.setAttribute("role", "button");

	element.addEventListener(
		"keydown",
		(event) => {
			if (event.key !== "Enter" && event.key !== " ") return;

			// Space scrolls the page otherwise, and Enter can submit a form.
			event.preventDefault();
			run(event);
		},
		{ signal },
	);
}

/**
 * Claim an element for a module, once.
 *
 * During a page transition both the outgoing and the incoming page are in the
 * DOM together, so a module that queries the document finds the old page's
 * elements as well as the new one's and sets them up a second time — a second
 * carousel, a second observer, a second autoplay timer on something that is
 * about to be thrown away. A claim left on the element says it is already
 * spoken for. It travels with the page, so it disappears when that page does.
 */
export function claimOnce(element, attribute) {
	if (element.hasAttribute(attribute)) return false;

	element.setAttribute(attribute, "");

	return true;
}

/**
 * Tear down a carousel without moving it.
 *
 * Teardown runs the moment a navigation starts, while the outgoing page is
 * still fully on screen and opaque — the crossfade has not begun. Embla's
 * destroy clears the container's transform, so a slider the reader had scrolled
 * jumps back to its first slide, in front of them, for the few frames before
 * the fade. The page is on its way out; where its slides sit does not need
 * correcting.
 */
export function freezeAndDestroy(embla, container) {
	const resting = container?.style.transform ?? "";

	embla.destroy();

	if (container) container.style.transform = resting;
}

/**
 * Let Enter and Space activate an element whose click another library already
 * owns.
 *
 * Swiper binds the click on its own navigation arrows, so press() would add a
 * second one and advance two slides per mouse click. This forwards the keys to
 * the click the library is already listening for, and nothing else. A disabled
 * arrow stays inert, because the library ignores its own click on one.
 */
export function keyActivates(element, signal) {
	if (NATIVE_CONTROLS.has(element.tagName)) return;

	if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "0");
	if (!element.hasAttribute("role")) element.setAttribute("role", "button");

	element.addEventListener(
		"keydown",
		(event) => {
			if (event.key !== "Enter" && event.key !== " ") return;

			event.preventDefault();
			element.click();
		},
		{ signal },
	);
}
