import { claimOnce, press } from "../dom.js";

const copyConfig = {
	componentSelector: ".copy_component",
	iconSelector: ".copy_icon-svg",
	activeClass: "is-active",
	activeMs: 2000,
};

export function initCopyToClipboard(root = document, { signal } = {}) {
	root.querySelectorAll(copyConfig.componentSelector).forEach((component) => {
		if (!claimOnce(component, "data-copy-built")) return;

		const icons = [...component.querySelectorAll(copyConfig.iconSelector)];

		// One component missing its icon is not a reason to leave the others
		// without a copy button.
		if (!icons.length) return;

		component.style.cursor = "pointer";

		let activeTimer = 0;

		// press(), not a click listener: this is a div styled to look like a
		// button, so without a tabindex and a keydown it could not be reached or
		// used without a mouse at all.
		press(
			component,
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
			signal,
		);
	});
}
