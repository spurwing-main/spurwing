# JavaScript modules

The bundle starts these through `src/modules/index.js` once the DOM is ready, and again after every page transition. Each one is scoped to its own Webflow markup and otherwise returns without touching the page.

Every module is called as `init(root, { signal })`. The signal is fresh on each run and the previous run's is aborted first. Anything that outlives the markup it was created for takes the signal: listeners on `window`, `document` or a `MediaQueryList`, observers, timers, and third-party instances with their own teardown. A listener bound to a node inside the swapped page does not need it, because the node goes and takes the listener with it — but nothing bound outside that page may omit it, which is how a slider once kept autoplaying against a list that had already been thrown away. Nothing else goes in that second argument, and nothing goes beside it — a loader passed positionally is how three modules once received the options object where a function belonged, and `contract.test.js` reads the signatures to stop it recurring.

`boot.js` owns running each module once per page, so a module does not guard itself for that reason. Several guard for a different one: during a transition the outgoing and incoming pages are both in the DOM, so a module that queries the document finds the old page's elements too and would set them up a second time. `impact-slider.js`, `quote-fade.js` and `rt-flow.js` consume the markup they build from and would read their own output; `approach-slider.js`, `caps.js`, `copy-to-clipboard.js` and `work-slide.js` use `claimOnce` from `src/dom.js` to leave a claim on each element they take. A lookup that must not cross pages scopes itself to `[data-pt-container]` — `faq.js` and `insight-toc.js` both do.

Anything that hides content must be able to reveal it again after its run has been aborted. A page transition aborts the previous signal, so a reveal that depends on a listener carrying that signal can be taken away mid-flight, and the next run will skip an element already marked as handled. That has shipped twice — once in `image-fade.js` and once, unnoticed, in `island-reveal.js`. `src/dom.js` also holds `press` and `keyActivates` for elements styled to look like buttons, and `freezeAndDestroy` for tearing a carousel down without moving it while the old page is still on screen.

Embla, Motion and Swiper are ordinary npm imports, bundled by esbuild; `src/swiper.js` registers the Swiper modules the site uses and is what the sliders import. GSAP is still a global that Webflow's own head loads, as is Swiper's stylesheet. Tests mock the npm packages (`vi.mock("motion", …)`) rather than injecting a loader.

Most modules have a test beside them. `src/modules/index.test.js` reads this directory and fails if a module file is not registered, so the list below cannot silently fall behind the code.

## Behaviour modules

### `anim.js`

The site's one reveal system. Flips `data-anim-state="in"` when an element tagged in the Designer arrives in the viewport, and guards against anything left invisible. Every duration, distance and easing lives in the "Global — motion" embed; this file only decides when. Reveals immediately, rather than skipping, anything inside a subtree a scroll reveal cannot reach — a closed nav panel, a carousel slide parked off to the side.

### `approach-hero.js`

Fades the progressive blur over the Approach hero out as the reader scrolls into the capabilities section, and back in when they leave it.

### `booking-details.js`

Builds the booking confirmation from the Cal.com query parameters — attendee, formatted times, reschedule link — hiding any row it has no value for, then reveals the rows in sequence.

### `approach-slider.js`

Drives the Approach quote slider: the linked main, meta and optional logo stacks, the creative effects between slides, and the text colour crossing over mid-drag rather than snapping when a slide lands.

### `caps.js`

Runs the capability carousels built on the shared `.embla` markup: dots, and autoplay that only runs while the slider is on screen and the pointer is away.

### `card-reveal.js`

Reveals work and team cards as they enter the viewport, staggering each grid so the cards arrive on a diagonal. Reduced motion opts every card out instead.

### `cms-counts.js`

Counts the items in each Collection from a hidden page and writes the numbers into `[data-cms-count-target]`. It runs in the background so it cannot delay the other modules.

### `copy-to-clipboard.js`

Copies a `.copy_component`'s own text on click and ticks its icon for two seconds. It stays silent where the clipboard is unavailable, rather than showing a tick for a copy that did not happen.

### `cursor.js`

Runs the pointer-following cursor: matches cursor items to their target selectors, positions each at its configured anchor, and springs the movement, resize and text swap. Devices without a fine pointer are skipped.

### `faq.js`

The single-open FAQ accordion, including its accessible expanded state, icon transition and height refresh on resize. It picks up items Finsweet inserts later, and uses the globally loaded GSAP.

### `image-fade.js`

Fades each image up as it decodes, so a picture does not snap from nothing to everything inside a block that has already swept in. An image already in cache when this runs is left alone. Watches for images built after boot, because a Finsweet list re-renders its items and those were never seen by the first pass.

### `impact-slider.js`

Reads the impact cards out of one Rich Text block — a title, a body and an optional italic line each — and builds them into the `.section_impact` slider with its arrows.

### `insight-toc.js`

Positions the sidebar indicator against the current Finsweet table-of-contents link, holding its last position through the gaps where Finsweet drops its `w--current` class.

### `island-reveal.js`

Holds a Webflow code component's wrapper at zero opacity until the component has rendered, then fades it in. Webflow serves these as an empty shell, so the hero media on `/approach` was a blank gap for around 600ms and then snapped in. It leaves alone a component that had already rendered, and any wrapper holding more than the component, and reveals regardless after 2.5s so a failed component CDN is late rather than blank.

### `menu-toggle.js`

Opens and closes the mobile menu across the nav layout, menu and trigger together. It closes itself when a navigation starts, which releases the body scroll lock before the router scrolls anything.

### `nav-auto-hide.js`

Hides the nav on the way down and brings it back once the reader has gone up far enough to mean it, so a short bounce does not make it flicker. It stays put at the top of the page, while the menu is open, and while focus is inside it.

### `nav-panel.js`

The navigation dropdowns: open and close state on one attribute, `inert` on what is closed, Escape and focusout, and the work rail inside each panel.

### `page-transition.js`

Crossfades `main` and the footer through a brief white hold while the nav stays untouched, so nothing in it rebuilds or flashes. It fetches the next page, waits for that page's stylesheet, webfonts and above-the-fold images, then swaps with `setHTMLUnsafe` so Webflow code components keep their shadow DOM. A different shell, a failed fetch or a missing `setHTMLUnsafe` falls back to an ordinary navigation. It owns navigation for the whole session, so it starts once from `src/index.js` rather than through the registry, and carries its own CSS.

The container it fades is built on the first navigation, never on load. Moving `main` takes every `<code-island>` out of the document and puts it back, and doing that while a component's first mount is still in flight makes Webflow mount it twice and append a second copy. `page-transition.test.js` holds that line.

### `quote-fade.js`

Turns a testimonial Collection List into a cross-fading, auto-advancing quote, and reports the autoplay's progress as `--quote-progress` for the rule under the card. A single quote is left as static markup, and reduced motion gets an instant slider with no autoplay and no rule.

### `rightway.js`

Turns the Rightway card grid into a slider with dots below the breakpoint where the grid stops fitting, and takes it apart again above it.

### `rt-flow.js`

Reshapes one Rich Text block into the Designer's own repeated item template, so the styling stays in Webflow.

### `slider-controls.js`

The parts every slider shares, whichever library drives it: the dots, and the grab cursor.

### `stick.js`

Marks whichever item in the sticky list sits nearest the middle of the viewport. Desktop only — below the breakpoint the list reads straight through.

### `team-switch.js`

Switches the team section between its groups, cross-fading with a view transition where the browser has one.

### `work-archive.js`

Adds the two things Finsweet does not do on the work archive: a second click on the active sector clears it, and the sector tag on each card is itself a filter control.

### `work-slide.js`

Runs the `.section_work-slide` slider: slides all as wide as the widest card, first and last aligned to the page's text column while the track runs full-bleed, dots, arrows, and links that do not fire at the end of a drag.

## Runtime support

### `boot.js`

Starts each module with a fresh `AbortSignal`, aborting the previous run's signal first, and starts them all again on each new page.

### `index.js`

Waits for the DOM, starts the router once, then boots the module list.

### `dom.js`

`requireElement(scope, selector, label)` — a query that throws with the selector it wanted, so a module built from Designer markup fails at init rather than further along on a null.

## Archived

### `work-rail.js` — not live, archived 2026-09-15

Moved to `archive/`. It drove a horizontal rail in `.section_work-hero` on the Work
page. That section still exists in the Designer but is set to **not visible**, so it
has never appeared in published HTML on any of the 32 pages — and the `.work-rail`
markup the module requires is not inside it, so even un-hiding the section would make
`initWorkRail` throw on its first required lookup.

Checked in the Designer on 2026-09-15: `section_work-hero` present on the Work page,
`visible: false`; `work-rail`, `work-rail_viewport`, `work-rail_track` and
`work-rail_slide` all absent from every page. Restoring it means rebuilding that
markup first; the file is in `archive/` and in Git history.
