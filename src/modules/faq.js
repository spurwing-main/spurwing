// Each FAQ card is a <details name="faq">: the browser opens and closes it,
// keeps one open at a time, hides a closed answer from Tab and screen readers,
// and opens one that find-in-page lands in.
//
// This adds two things markup cannot do:
//   - the answer slides open and shut over 0.4s, the same in every browser.
//     CSS alone can only animate a details' height in Chrome; Safari and
//     Firefox would open it at once.
//   - the first answer is open on arrival on a page that asks for it.
//
// The "Global — FAQ" embed turns the plus to a minus, keyed on [open], and on
// [data-closing] while an answer is sliding shut.

const DURATION = 400;
const EASE = "ease";

export function initFaq(root = document, { signal } = {}) {
	const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

	// Opens arriving on their own (the first answer below, find-in-page, the
	// ask box opening a matching question) slide open too, from the toggle
	// event, which fires after the answer is shown. A slide already running
	// is replaced.
	root.addEventListener(
		"toggle",
		(event) => {
			const item = event.target;
			if (!item.matches?.('details[data-accordion="item"]') || !item.open) return;
			if (reduceMotion || item.hasAttribute("data-faq-still")) {
				item.removeAttribute("data-faq-still");
				return;
			}
			slide(item, true);
		},
		{ capture: true, signal },
	);

	// Closing has to be held back until the answer has slid shut, so the
	// question's click is taken over: an open answer slides shut and only then
	// closes; a closed one closes the others in its group the same way and opens.
	root.addEventListener(
		"click",
		(event) => {
			const summary = event.target.closest?.('details[data-accordion="item"] > summary');
			if (!summary || reduceMotion) return;
			const item = summary.parentElement;
			event.preventDefault();
			if (item.open && !item.hasAttribute("data-closing")) {
				close(item);
				return;
			}
			// The others in its group slide shut first, so rejoining cannot shut it.
			const group = item.getAttribute("name") || item.dataset.faqGroup;
			if (group) {
				for (const other of document.querySelectorAll("details[open]")) {
					if (other !== item && other.getAttribute("name") === group) close(other);
				}
			}
			item.removeAttribute("data-closing");
			rejoin(item);
			// Caught while sliding shut, it is still open: it slides back open.
			if (item.open) slide(item, true);
			else item.open = true;
		},
		{ signal },
	);

	openFirst(root);
}

function answerOf(item) {
	return item.querySelector('[data-accordion="content"]');
}

function slide(item, opening) {
	const answer = answerOf(item);
	if (!answer?.animate) return null;
	const height = `${answer.scrollHeight}px`;
	answer.getAnimations().forEach((animation) => animation.cancel());
	return answer.animate(
		{ height: opening ? ["0px", height] : [height, "0px"], overflow: ["clip", "clip"] },
		{ duration: DURATION, easing: EASE },
	);
}

// The open attribute goes when the slide has finished. Until then the card
// leaves its group, or the browser would shut it at once as another opens.
function close(item) {
	const group = item.getAttribute("name");
	if (group) item.dataset.faqGroup = group;
	item.removeAttribute("name");
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

// Back in its group, once closed or reopened.
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

	const list = component.querySelector('[fs-list-element="list"]') || component;
	const first = list.querySelector('[data-accordion="item"]');
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
