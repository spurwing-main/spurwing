// A query that states what it wanted when it finds nothing. Modules that build
// from Designer markup fail at init with the selector in the message, rather
// than further along on a null.
export function requireElement(scope, selector, label = selector) {
	const element = scope.querySelector(selector);

	if (!element) throw new Error(`missing ${label}: expected "${selector}"`);

	return element;
}
