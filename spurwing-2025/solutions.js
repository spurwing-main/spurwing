pageFunctions.addFunction("solutions", function () {
	gsap.registerPlugin(CustomEase);
	CustomEase.create("osmo-ease", "0.625, 0.05, 0, 1");

	gsap.defaults({
		ease: "osmo-ease",
	});

	function initTabSystem() {
		// Scope to s-sol section
		const section = document.querySelector(".s-sol");
		if (!section) return;

		const wrappers = section.querySelectorAll('[data-tabs="wrapper"]');

		wrappers.forEach((wrapper) => {
			const contentItems = wrapper.querySelectorAll(
				'[data-tabs="content-item"]'
			);
			const visualItems = wrapper.querySelectorAll('[data-tabs="visual-item"]');

			let maxContentHeight = 0;
			function recalcMaxHeight() {
				maxContentHeight = 0;
				contentItems.forEach((item) => {
					const detail = item.querySelector('[data-tabs="item-details"]');
					// Temporarily set to auto to measure full height
					detail.style.height = "auto";
					const height = detail.scrollHeight;
					if (height > maxContentHeight) {
						maxContentHeight = height;
					}
					// Set height for active item or collapse non-active ones
					if (item.classList.contains("active")) {
						detail.style.height = maxContentHeight + "px";
					} else {
						detail.style.height = "0px";
					}
				});
			}

			// Initial calculation
			recalcMaxHeight();

			// Recalculate max height on window resize
			window.addEventListener("resize", recalcMaxHeight);

			const autoplay = wrapper.dataset.tabsAutoplay === "true";
			const autoplayDuration =
				parseInt(wrapper.dataset.tabsAutoplayDuration) || 5000;

			let activeContent = null;
			let activeVisual = null;
			let isAnimating = false;
			let progressBarTween = null;

			function startProgressBar(index) {
				if (progressBarTween) progressBarTween.kill();
				const bar = contentItems[index].querySelector(
					'[data-tabs="item-progress"]'
				);
				if (!bar) return;

				gsap.set(bar, { scaleX: 1, scaleY: 0, transformOrigin: "center top" });
				progressBarTween = gsap.to(bar, {
					scaleY: 1,
					duration: autoplayDuration / 1000,
					ease: "power1.inOut",
					onComplete: () => {
						if (!isAnimating) {
							const nextIndex = (index + 1) % contentItems.length;
							switchTab(nextIndex);
						}
					},
				});
			}

			function switchTab(index) {
				if (isAnimating || contentItems[index] === activeContent) return;

				isAnimating = true;
				if (progressBarTween) progressBarTween.kill();

				const outgoingContent = activeContent;
				const outgoingVisual = activeVisual;
				const outgoingBar = outgoingContent?.querySelector(
					'[data-tabs="item-progress"]'
				);

				const incomingContent = contentItems[index];
				const incomingVisual = visualItems[index];
				const incomingBar = incomingContent.querySelector(
					'[data-tabs="item-progress"]'
				);
				const incomingDetail = incomingContent.querySelector(
					'[data-tabs="item-details"]'
				);

				outgoingContent?.classList.remove("active");
				outgoingVisual?.classList.remove("active");
				incomingContent.classList.add("active");
				incomingVisual.classList.add("active");

				const tl = gsap.timeline({
					defaults: { duration: 0.65 },
					onComplete: () => {
						activeContent = incomingContent;
						activeVisual = incomingVisual;
						isAnimating = false;
						if (autoplay) startProgressBar(index);
					},
				});

				if (outgoingContent) {
					const outgoingDetail = outgoingContent.querySelector(
						'[data-tabs="item-details"]'
					);
					outgoingContent.classList.remove("active");
					outgoingVisual?.classList.remove("active");
					tl.set(outgoingBar, { transformOrigin: "center top" })
						.to(outgoingBar, { scaleY: 0, duration: 0.3 }, 0)
						.to(outgoingVisual, { autoAlpha: 0, xPercent: 3 }, 0)
						.to(outgoingDetail, { height: 0 }, 0);
				}

				tl.fromTo(
					incomingVisual,
					{ autoAlpha: 0, xPercent: 3 },
					{ autoAlpha: 1, xPercent: 0 },
					0.3
				)
					.fromTo(
						incomingDetail,
						{ height: 0 },
						{ height: maxContentHeight + "px" },
						0
					)
					.set(
						incomingBar,
						{ scaleX: 1, scaleY: 0, transformOrigin: "center top" },
						0
					);
			}

			switchTab(0);

			contentItems.forEach((item, i) => {
				item.addEventListener("click", () => {
					if (item === activeContent) return;
					switchTab(i);
				});
			});
		});
	}
	initTabSystem();
});
