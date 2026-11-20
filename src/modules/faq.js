// Each FAQ card is a <details name="faq">: the browser opens and closes it,
// keeps one open at a time, hides a closed answer from Tab and screen readers,
// and opens one that find-in-page lands in.
//
// Every card is handled here the same way, however it got on the page: a
// written one from the CMS list, one picked into the FAQs component's slot,
// and an AI answer, kept from an earlier visit or asked now. This adds what
// markup cannot do:
//   - each card comes in with the site's card reveal, a turn after the card
//     above it. A card added later opens its room and comes in the same way.
//   - the answer slides open and shut over 0.4s, the same in every browser.
//     CSS alone can only animate a details' height in Chrome; Safari and
//     Firefox would open it at once.
//   - the first answer is open on arrival on a page that asks for it.
//
// A card still being written (aria-busy) is left open and out of its group
// until it is finished. The "Global — FAQ" embed turns the plus to a minus,
// keyed on [open], and on [data-closing] while an answer is sliding shut.

// An answer's slide. An AI answer growing as it is written eases the same way.
export const SLIDE = { duration: 400, easing: "ease" };
// A card arriving or leaving opens or gives back its room on a long, gentle ease-out.
const ROOM = "cubic-bezier(0.22, 1, 0.36, 1)";

const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function initFaq(root = document, { signal } = {}) {
	// Opens arriving on their own (the first answer below, find-in-page, the
	// ask box opening a matching question) slide open too, from the toggle event, which fires after the answer is shown.
	// A slide already running is replaced.
	root.addEventListener(
		"toggle",
		(event) => {
			const item = event.target;
			if (!item.matches?.('details[data-accordion="item"]') || !item.open) return;
			if (calm() || item.hasAttribute("data-faq-still") || item.hasAttribute("aria-busy")) {
				item.removeAttribute("data-faq-still");
				return;
			}
			slide(item, true);
		},
		{ capture: true, signal },
	);

	// Closing has to be held back until the answer has slid shut, so the
	// question's click is taken over.
	root.addEventListener(
		"click",
		(event) => {
			const summary = event.target.closest?.('details[data-accordion="item"] > summary');
			if (!summary) return;
			const item = summary.parentElement;
			if (item.hasAttribute("aria-busy")) return event.preventDefault();
			if (calm()) return;
			event.preventDefault();
			if (item.open && !item.hasAttribute("data-closing")) close(item);
			else open(item);
		},
		{ signal },
	);

	for (const component of root.querySelectorAll('[data-accordion="component"]')) reveal(component);
	openFirst(root);
}

/**
 * Opens a card as its question's click does: the others in its group slide
 * shut first. A card still being written opens out of its group, so another
 * opening cannot shut it; opened again once finished, it rejoins.
 */
export function open(item) {
	const group = item.getAttribute("name") || item.dataset.faqGroup;
	if (group) {
		for (const other of document.querySelectorAll("details[open]")) {
			if (other !== item && other.getAttribute("name") === group) close(other);
		}
	}
	if (item.hasAttribute("aria-busy")) {
		leaveGroup(item);
		item.open = true;
		return;
	}
	const closing = item.hasAttribute("data-closing");
	item.removeAttribute("data-closing");
	rejoin(item);
	// Caught while sliding shut, it is still open: it slides back open.
	if (!item.open) item.open = true;
	else if (closing && !calm()) slide(item, true);
}

/**
 * Every card in the component comes in with the site's card reveal, in page
 * order, whatever made it: the ask box, the AI answers kept under it, the
 * written list, the slot. A CMS card comes in as its list item, which the
 * list's own stagger would otherwise move as well.
 */
function reveal(component) {
	component.querySelectorAll(".faq-card").forEach((card, index) => {
		const unit = card.closest(".w-dyn-item") ?? card;
		unit.setAttribute("data-anim", "card");
		unit.style.setProperty("--anim-i", String(Math.min(index, 6)));
	});
}

/**
 * A card added once the page is in (an AI answer just asked, or brought back
 * by Undo) first opens its room, so the page below glides down rather than
 * jumps, and comes in with the same card reveal, straight away.
 */
export function arrive(card) {
	card.setAttribute("data-anim", "card");
	card.style.setProperty("--anim-i", "0");
	card.removeAttribute("data-anim-done");
	card.setAttribute("data-anim-state", "in");
	if (calm()) return;
	card.animate([{ marginTop: `${-room(card)}px` }, { marginTop: "0px" }], { duration: 560, easing: ROOM });
}

// A card leaving fades and shrinks a touch, then gives its room back.
export function depart(card) {
	if (calm()) return card.remove();
	const leaving = card.animate(
		[
			{ opacity: 1, transform: "none" },
			{ opacity: 0, transform: "scale(0.985)", marginTop: "0px", offset: 0.4 },
			{ opacity: 0, transform: "scale(0.985)", marginTop: `${-room(card)}px` },
		],
		{ duration: 640, easing: ROOM },
	);
	leaving.onfinish = () => card.remove();
}

// The space a card takes in its list: its height and the gap above it.
function room(card) {
	return card.getBoundingClientRect().height + (parseFloat(getComputedStyle(card.parentElement).rowGap) || 0);
}

function answerOf(item) {
	return item.querySelector('[data-accordion="content"]');
}

function slide(item, opening) {
	const answer = answerOf(item);
	if (!answer?.animate) return null;
	const height = `${answer.scrollHeight}px`;
	answer.getAnimations().forEach((animation) => animation.cancel());
	return answer.animate({ height: opening ? ["0px", height] : [height, "0px"], overflow: ["clip", "clip"] }, SLIDE);
}

// The open attribute goes when the slide has finished. Until then the card
// leaves its group, or the browser would shut it at once as another opens.
function close(item) {
	if (calm()) {
		item.open = false;
		return;
	}
	leaveGroup(item);
	item.setAttribute("data-closing", "");
	const animation = slide(item, false);
	const done = () => {
		if (!item.hasAttribute("data-closing")) return;
		item.removeAttribute("data-closing");
		item.open = false;
		rejoin(item);
	};
	if (!animation) return done();
	animation.addEventListener("finish", done, { once: true });
}

// Out of its group, which it keeps in data-faq-group to rejoin.
function leaveGroup(item) {
	const group = item.getAttribute("name");
	if (group) item.dataset.faqGroup = group;
	item.removeAttribute("name");
}

function rejoin(item) {
	if (item.dataset.faqGroup) item.setAttribute("name", item.dataset.faqGroup);
}

function openFirst(root) {
	const component = root.querySelector('[data-accordion="component"]');
	if (!component) return;

	// A page asks for its first answer to be showing on arrival by carrying
	// data-faq-open-first. The FAQ section is one Component on five pages, so
	// the page is the only place that can say it.
	// Scoped to the page this component is on. Read from the document, it found
	// the outgoing page's flag during a transition and opened the first answer on
	// a page that had not asked for it.
	if (!component.closest("[data-faq-open-first]") && !pageOf(component)?.querySelector("[data-faq-open-first]")) return;

	// The first written answer: AI answers kept from earlier stay closed.
	const list = component.querySelector('[fs-list-element="list"]') || component;
	const first = list.querySelector('[data-accordion="item"]:not([data-ai-faq])');
	if (!first) return;
	// Already open as the page arrives, not sliding open.
	first.setAttribute("data-faq-still", "");
	first.open = true;
}

// The page container this component sits in, so a lookup cannot reach across
// to the other page that is in the DOM during a transition.
function pageOf(element) {
	return element.closest("[data-pt-container], main") ?? document;
}
