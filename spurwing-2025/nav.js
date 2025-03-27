function main() {
	// set some variables
	const menuButton = document.querySelector(".header-bar_menu-btn");
	const menu = document.querySelector(".menu-panel_inner");
	const menuLinks = document.querySelectorAll(".nav-link");
	const menuLinksList = document.querySelector(".menu-panel_menu-links");
	const menuCTA = document.querySelector(".menu-panel_menu-cta");
	const logoWrap = document.querySelector(".header-bar_logo-wrap");
	const bar = document.querySelector(".header-bar_inner");
	let menuOpen = false;
	let tl_nav = gsap.timeline({
		paused: true,
		defaults: { ease: "power3.out" },
	});

	function menuReveal(target) {
		let menuForcedShown = false;
		const hideThreshold = 20; // Distance to scroll before hiding is allowed
		const showThreshold = 10; // Distance from the top where the menu is always shown

		let menuRevealAnim = gsap
			.from(target, {
				yPercent: -100,
				//autoAlpha: 0,
				paused: true,
				duration: 0.3,
			})
			.progress(1);

		let lastScrollY = window.scrollY;
		let scrollBuffer = 0;

		let menuScrollTrigger = ScrollTrigger.create({
			start: "top -1px",
			pinSpacing: false,
			onUpdate: (self) => {
				// prevent menu from hiding if it was forced to show
				if (menuForcedShown) {
					return;
				}

				const currentScrollY = window.scrollY;
				const deltaY = currentScrollY - lastScrollY;

				if (currentScrollY <= showThreshold) {
					// Always show menu near top
					menuRevealAnim.play();
					scrollBuffer = 0;
				} else if (deltaY > 0 && currentScrollY > hideThreshold) {
					// Only hide after scrolling past hideThreshold
					menuRevealAnim.reverse();
					scrollBuffer = 0;
				} else if (deltaY < 0) {
					// Reveal menu when scrolling up
					scrollBuffer -= deltaY;
					if (scrollBuffer >= 50) {
						menuRevealAnim.play();
						scrollBuffer = 0;
					}
				}

				lastScrollY = currentScrollY; // Update last scroll position
			},
		});
	}

	function handleNavButtonClick() {
		if (!menuOpen) {
			console.log("open menu");
			tl_nav.play();
			menuButton.innerHTML = "Close";
			disableScroll([bar, menuLinksList]);
			menuOpen = true;
		} else {
			console.log("close menu");
			tl_nav.reverse();
			menuButton.innerHTML = "Menu";
			enableScroll([bar, menuLinksList]);
			menuOpen = false;
		}
	}

	function openNav() {
		tl_nav
			.fromTo(
				menu,
				{ height: 0 },
				{
					height: "100vh",
					duration: 0.75,
				}
			)
			.to(menuButton, { backgroundColor: "#F0F0F0", duration: 0.3 }, "0")
			.fromTo(
				menuLinks,
				{ y: 20, autoAlpha: 0 },
				{ y: 0, autoAlpha: 1, stagger: 0.1, duration: 0.3 },
				"-=0.3"
			)
			.fromTo(
				menuCTA,
				{ y: 20, autoAlpha: 0 },
				{ y: 0, autoAlpha: 1, duration: 0.3 },
				"-=0.2"
			)
			.to(logoWrap, { color: "#0200c8", duration: 0.3 }, "0");

		// Ensure the click event listener is added only once
		menuButton.removeEventListener("click", handleNavButtonClick);
		menuButton.addEventListener("click", handleNavButtonClick);
	}

	// helper function to disable scroll
	function disableScroll(elements) {
		const scrollBarWidth =
			window.innerWidth - document.documentElement.clientWidth;
		document.body.style.overflow = "hidden";
		document.body.style.paddingRight = `${scrollBarWidth}px`;
		if (elements) {
			elements.forEach((el) => {
				el.style.paddingRight = `${scrollBarWidth}px`;
			});
		}
	}

	// helper function to enable scroll
	function enableScroll(elements) {
		document.body.style.overflow = "";
		document.body.style.paddingRight = "";
		if (elements) {
			elements.forEach((el) => {
				el.style.paddingRight = "";
			});
		}
	}

	// helper function to reset menu
	function resetMenu() {
		menuOpen = false;
		menuButton.innerHTML = "Menu";
		tl_nav.pause(0); // Reset animations
		enableScroll([bar, menu]);
		menuButton.removeEventListener("click", handleNavButtonClick);
	}

	// set up GSAP MM
	let mm = gsap.matchMedia();

	// on desktop, reveal menu on scroll
	mm.add("(min-width: 768px)", () => {
		menuReveal(".menu-panel_inner");

		return () => {};
	});

	// on mobile, reveal logo and menu button on scroll, and open menu on click
	mm.add("(max-width: 767px)", () => {
		menuReveal(".header-bar_inner");
		openNav();

		// reset menu on resize
		return () => {
			resetMenu();
		};
	});
}
