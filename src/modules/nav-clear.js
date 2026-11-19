/**
 * A see-through nav over a photo hero.
 *
 *   <div class="hero-split_top" data-nav-clear>…</div>
 *
 * While the nav is over the marked hero, the CSS in the Global code "nav" embed
 * shows it see-through with white text. Once the hero has scrolled up under
 * the nav, this marks the nav data-nav-solid and it returns to the white bar.
 * An open menu or dropdown is always solid (CSS).
 *
 * The header outlives a page transition, so the mark is removed when this
 * run is aborted; the next page decides again.
 */
export function initNavClear(root = document, { signal } = {}) {
	const hero = root.querySelector("[data-nav-clear]");
	const nav = document.querySelector(".nav");

	if (!hero || !nav) return;

	// The split hero's sky fades to white over its last 15.625rem, where white
	// nav text would vanish, so the nav turns solid as the fade reaches it.
	const fade = hero.querySelector(".hero-split_bg-fade")?.offsetHeight ?? 0;
	const observer = new IntersectionObserver(
		([entry]) => nav.toggleAttribute("data-nav-solid", !entry.isIntersecting),
		{ rootMargin: `-${Math.round(nav.offsetHeight + fade)}px 0px 0px 0px` },
	);

	observer.observe(hero);

	signal?.addEventListener("abort", () => {
		observer.disconnect();
		nav.removeAttribute("data-nav-solid");
	});
}
