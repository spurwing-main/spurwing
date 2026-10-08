# JavaScript modules

The bundle starts these through `src/modules/index.js` once the DOM is ready, and again after every page transition. Each one is scoped to its own Webflow markup and otherwise returns without touching the page.

Every module is called as `init(root, { signal })`. The signal is fresh on each run and the previous run's is aborted first. Anything that outlives the markup it was created for takes the signal: listeners on `window`, `document` or a `MediaQueryList`, observers, timers, and third-party instances with their own teardown. A listener bound to a node inside the swapped page does not need it, because the node goes and takes the listener with it — but nothing bound outside that page may omit it, which is how a slider once kept autoplaying against a list that had already been thrown away. Nothing else goes in that second argument, and nothing goes beside it — a loader passed positionally is how three modules once received the options object where a function belonged, and `contract.test.js` reads the signatures to stop it recurring.

`boot.js` owns running each module once per page, so a module does not guard itself for that reason. Several guard for a different one: during a transition the outgoing and incoming pages are both in the DOM, so a module that queries the document finds the old page's elements too and would set them up a second time. `impact-slider.js`, `quote-fade.js` and `rt-flow.js` consume the markup they build from and would read their own output; `approach-slider.js`, `caps.js`, `copy-to-clipboard.js` and `work-slide.js` use `claimOnce` from `src/dom.js` to leave a claim on each element they take. A lookup that must not cross pages scopes itself to `[data-pt-container]` — `faq.js` and `insight-toc.js` both do.

Anything that hides content must be able to reveal it again after its run has been aborted. A page transition aborts the previous signal, so a reveal that depends on a listener carrying that signal can be taken away mid-flight, and the next run will skip an element already marked as handled. That has shipped before, in `image-fade.js`. `src/dom.js` also holds `press` and `keyActivates` for elements styled to look like buttons, and `freezeAndDestroy` for tearing a carousel down without moving it while the old page is still on screen.

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

### `client-logos.js`

Cycles the logos in `[data-client-logos]`, whose `[data-client-logos-list]` grid holds one Client logo per logo, filled into the component's Logos slot. Each logo also gets `--logo-ratio`, its width over its height, once it loads; the header CSS uses it to give every logo the same area, so they read at the same size. That needs logos cropped to their edges. A list whose later rows show, as the Static variant does, is left as a still grid. The Designer sets the column count on the grid, four on desktop and two on a phone, and collapses every row after the first, so the first logos paint in place before this runs. This reads that column count and the number of logos, gives logo n to column n mod columns, and every five seconds each column with more than one logo moves on to its next, one column after another. Any number of logos works; a column with one logo stays still. Every logo stays in the list for a screen reader. Pauses off screen; reduced motion keeps the first row still.

### `cms-counts.js`

Counts the items in each Collection from a hidden page and writes the numbers into `[data-cms-count-target]`. It runs in the background so it cannot delay the other modules.

### `copy-to-clipboard.js`

Copies a `.copy_component`'s own text on click and ticks its icon for two seconds. It stays silent where the clipboard is unavailable, rather than showing a tick for a copy that did not happen.

### `cursor.js`

Runs the one pill that follows the pointer over anything carrying `data-cursor-text`. The Designer holds `.cursor-root` with a single `.button` div inside it; the root moves and the pill grows in, resizes and cross-fades its words, so moving between two targets morphs one pill rather than replaying its entrance. A target's `data-cursor-text` sets the words, and an empty value keeps the pill's own. A target marked `aria-disabled="true"`, like a slider's arrow at its last slide, shows nothing, and a click that switches the target off under a still pointer lets go of it. Leaving is a spring with no bounce, so a pointer that comes back part way turns the pill round rather than restarting it. The root sits in the header, which no transition replaces, so like the router it starts once from `src/index.js` and lets go of its target on `spw:leave`. Skipped without a fine pointer; a visitor who asks for reduced motion gets a plain fade.

### `faq.js`

The single-open FAQ accordion, including its accessible expanded state, icon transition and height refresh on resize. It picks up items Finsweet inserts later, and uses the globally loaded GSAP.

### `image-fade.js`

Fades each image up as it decodes, so a picture does not snap from nothing to everything inside a block that has already swept in. An image already in cache when this runs is left alone. Watches for images built after boot, because a Finsweet list re-renders its items and those were never seen by the first pass.

### `impact-slider.js`

Reads the impact cards out of one Rich Text block — a title, a body and an optional italic line each — and builds them into the `.section_impact` slider with its arrows.

### `insight-toc.js`

Positions the sidebar indicator against the current Finsweet table-of-contents link, holding its last position through the gaps where Finsweet drops its `w--current` class.

### `menu-toggle.js`

Opens and closes the mobile menu across the nav layout, menu and trigger together. It closes itself when a navigation starts, which releases the body scroll lock before the router scrolls anything.

### `nav-auto-hide.js`

Hides the nav on the way down and brings it back once the reader has gone up far enough to mean it, so a short bounce does not make it flicker. It stays put at the top of the page, while the menu is open, and while focus is inside it.

### `nav-panel.js`

The navigation dropdowns: open and close state on one attribute, `inert` on what is closed, Escape and focusout, and the work rail inside each panel.

### `page-transition.js`

Crossfades `main` and the footer through a brief white hold while the nav stays untouched, so nothing in it rebuilds or flashes. The outgoing page starts fading the moment a link is clicked, and the next page loads behind it: its HTML and stylesheet are already fetched when the pointer rests on the link, and the swap waits for its webfonts and above-the-fold images before fading it in. A different shell or a failed fetch falls back to an ordinary navigation. It owns navigation for the whole session, so it starts once from `src/index.js` rather than through the registry, and carries its own CSS.

The container it fades is built on the first navigation, never on load, so the page as served is the page as designed until someone clicks a link.

### `process-tabs.js`

Runs `[data-process-tabs]`: one `[data-process-step]` showing at a time, with a tab per step underneath, named by the step's title. The Designer holds every step in the section's Steps slot and a single `[data-process-tab]`; this copies that tab once per step and names it after the step's heading (its number if it has none), so the tabs always match the steps. Steps are hidden with the `hidden` attribute, so a step's own class sets no display; the active tab takes the `is-active` combo class. One `[data-process-progress]` line under the tabs fills over the step showing: while the section is on screen it fills over seven seconds and the next step comes up, and off screen it waits and carries on from there. Whenever the step changes the line fades out and starts again from empty, so it never jumps or runs back. Picking a tab, with a click or the arrow keys, shows that step and the steps carry on from there. Each step that comes up replays the site's reveal: its blocks carry `data-anim` in the Designer, and this rewinds their `anim-` keyframes. Without JavaScript every step reads in order, and reduced motion never moves them on.

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

### `tabbed.js`

Runs the tabbed capabilities section (`.tcp`): one stage at a time, and one panel open inside it. A stage and its row of panels pair by position, not by id. The module writes one attribute per level — `data-stage-open` on the group, `data-open` on the item, `data-current` on the stage — and gives each panel and its copy the ids that tie them together. Panels are controls, not tabs: each is a click-and-key target and the paragraph below the row is the region it names. The state the markup ships wins, so the Designer decides what opens; the section is marked ready only after it is wired, and every rule that collapses it is gated on that mark, so a blocked bundle leaves the section in normal flow. It claims each section once, because a page transition leaves both pages in the DOM. Rail width, expansion, the vertical label and the durations all live in the section's CSS embed — this file sets no style and knows no duration.

### `team-switch.js`

Switches the team section between its groups, cross-fading with a view transition where the browser has one.

### `ticker.js`

Runs every `[data-ticker]` strip: it drifts left at `data-ticker-velocity` rem a second, eases to `data-ticker-hover` times that under the pointer, stays under a dragging finger, and carries a flick before easing back into the drift. The Designer holds the real items in `[data-ticker-track]`, laid out as the strip first paints. One Motion value holds how far the strip has travelled; the row moves by it with `translate`, and an item that leaves the left edge is moved on by one loop, past the right edge, so starting moves nothing on screen and the real items are usually all it needs. Hidden copies are added only when one set is shorter than the screen. On a wide screen the room left of the text column fills on the first paint, and what lands there fades in. Pauses off screen; reduced motion stops the drift but keeps the drag.

### `wave.js`

Waves a hand beside the pointer for as long as it is over the element holding it, after FigJam's waving hand; on the site, the big "Discuss a project" button. The Designer puts `[data-wave-hand]` inside that element, with one div inside it for the hand: the outer div follows the pointer and the inner one grows in, rocks from the wrist on a loop and fades out on leaving. The hand is whatever the inner div holds, an emoji or an SVG. The Button component's Large variant (`data-wf--button--variant="large"`) gets its hand from this file, an emoji in the same two divs, and the header CSS places it. Skipped without a fine pointer; a visitor who asks for reduced motion gets the hand as a plain fade, without the wave.

### `work-archive.js`

Adds the two things Finsweet does not do on the work archive: a second click on the active sector clears it, and the sector tag on each card is itself a filter control.

### `work-slide.js`

Runs the `.section_work-slide` slider: slides all as wide as the widest card, first and last aligned to the page's text column while the track runs full-bleed, dots, arrows marked `aria-disabled` at each end, links that do not fire at the end of a drag, and no browser drag of a card's link or image, which would take the pointer away from the rail.

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
