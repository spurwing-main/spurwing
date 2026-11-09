/**
 * Background videos: a `<video data-bg-video>` custom element in the Designer,
 * placed after the image it sits over and given that image's class.
 *
 * Webflow publishes a custom element without its `muted` and `loop`
 * attributes, even when they are set in the Designer, and a browser will not
 * start a video that has sound by itself. So this sets both, then plays the
 * video only while it is near the screen and pauses it when it leaves. Set
 * `preload="none"` on the element so nothing downloads before then.
 *
 * Visitors who ask for less motion keep the still image under it: the video is
 * never played here, and the "Global — motion" embed hides it.
 */

const SELECTOR = "video[data-bg-video]";

export function initBgVideo(root = document, { signal } = {}) {
	const videos = [...root.querySelectorAll(SELECTOR)];
	if (!videos.length) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const observer = new IntersectionObserver(
		(entries) => {
			for (const { target, isIntersecting } of entries) {
				// A refused play (low power mode, data saver) leaves the still image.
				if (isIntersecting) target.play()?.catch(() => {});
				else target.pause();
			}
		},
		{ rootMargin: "200px" },
	);

	for (const video of videos) {
		video.muted = true;
		video.loop = true;
		video.playsInline = true;
		observer.observe(video);
	}

	signal?.addEventListener("abort", () => observer.disconnect());
}
