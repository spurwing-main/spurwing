export function initializeOnce(target, key, setup) {
	if (target[key]) return target[key];

	const pending = Promise.resolve().then(setup);
	target[key] = pending.catch((error) => {
		delete target[key];
		throw error;
	});

	return target[key];
}
