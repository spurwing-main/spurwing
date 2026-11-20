// Each FAQ card is a <details name="faq">: the browser opens and closes it,
// keeps one open at a time, hides a closed answer from Tab and screen readers,
// and opens one that find-in-page lands in. The "Global — FAQ" embed animates
// it. This only does what markup cannot: open the first answer on a page that
// asks for it.
export function initFaq(root = document) {
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
	if (first) first.open = true;
}

// The page container this component sits in, so a lookup cannot reach across
// to the other page that is in the DOM during a transition.
function pageOf(element) {
	return element.closest("[data-pt-container], main") ?? document;
}
