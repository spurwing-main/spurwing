export function initCopy(root = document) {
	const nodes = root.querySelectorAll(".copy_component");
	if (!nodes.length) return;

	nodes.forEach((el) => {
		if (el.dataset.copyWired === "1") return;
		el.dataset.copyWired = "1";

		el.style.cursor = "pointer";

		el.addEventListener("click", async () => {
			const text = (el.textContent || "").replace(/\s+/g, " ").trim();
			if (!text) throw new Error("copy failed: empty text");

			if (!navigator.clipboard?.writeText) {
				throw new Error(
					"copy failed: navigator.clipboard.writeText not available (requires https)",
				);
			}
			await navigator.clipboard.writeText(text);

			const icons = [...el.querySelectorAll(".copy_icon-svg")];
			if (!icons.length) throw new Error('copy init failed: no ".copy_icon-svg" found');

			icons.forEach((n) => n.classList.add("is-active"));
			window.clearTimeout(el._copyActiveT);
			el._copyActiveT = window.setTimeout(
				() => icons.forEach((n) => n.classList.remove("is-active")),
				2000,
			);
		});
	});
}
