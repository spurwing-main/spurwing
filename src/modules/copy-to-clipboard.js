const copyConfig = {
	componentSelector: ".copy_component",
	iconSelector: ".copy_icon-svg",
	activeClass: "is-active",
	activeMs: 2000,
};

export function initCopyToClipboard(root = document, { signal } = {}) {
	root.querySelectorAll(copyConfig.componentSelector).forEach((component) => {
		const icons = [...component.querySelectorAll(copyConfig.iconSelector)];

		if (!icons.length) {
			throw new Error(`copy component has no "${copyConfig.iconSelector}"`);
		}

		component.style.cursor = "pointer";

		let activeTimer = 0;

		component.addEventListener(
			"click",
			async () => {
				const text = component.textContent.replace(/\s+/g, " ").trim();

				// Nothing to copy, or an insecure origin where the clipboard is not
				// available. Either way the tick would be a lie, so say nothing.
				if (!text || !navigator.clipboard?.writeText) return;

				try {
					await navigator.clipboard.writeText(text);
				} catch {
					return;
				}

				icons.forEach((icon) => icon.classList.add(copyConfig.activeClass));

				clearTimeout(activeTimer);
				activeTimer = window.setTimeout(() => {
					icons.forEach((icon) => icon.classList.remove(copyConfig.activeClass));
				}, copyConfig.activeMs);
			},
			{ signal },
		);
	});
}
