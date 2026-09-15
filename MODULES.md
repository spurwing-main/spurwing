# JavaScript modules

The site bundle starts these modules through `src/modules/index.js` after the DOM is ready, and starts them again after every page transition. Each behavior is scoped to its relevant Webflow markup and otherwise exits without affecting the current page.

Every module is called as `init(root, { signal })`. The signal is fresh on each run and the previous run's signal is aborted first, so listeners, observers and timers cannot stack up across a transition; a module that only reads the DOM can ignore it. Nothing else goes in that second argument, and nothing goes beside it — a loader passed positionally is how three modules once received the options object where a function belonged, and `contract.test.js` now reads the signatures to stop it recurring.

Embla and Motion are ordinary npm imports, bundled by esbuild. Tests mock the package (`vi.mock("motion", …)`) rather than injecting a loader.

## Behavior modules

### `approach-hero.js`

Controls the progressive blur on the Approach page, fading it as the visitor scrolls into and out of the capabilities section. It loads Motion from jsDelivr and uses the section as the module's page-level guard.

### `booking-details.js`

Builds the booking confirmation details from Cal.com query parameters, including attendee information, formatted dates, and the reschedule link. It hides incomplete content and uses Motion for the finished details entrance.

### `caps.js`

Initializes capability carousels that use the shared `.embla` structure, adding pagination dots and viewport-aware autoplay with pause-on-hover behavior. Embla is loaded from jsDelivr when a matching carousel is present.

### `copy.js`

Makes `.copy_component` elements copy their normalized text to the clipboard when clicked. After a successful copy, it briefly activates the component's copy icon as visual feedback.

### `cursor.js`

Runs the custom pointer-following cursor system, matching configured cursor items to target selectors and supporting per-target text and anchor positions. Live delegated matching supports targets inserted later by tools such as FS Load, while Motion supplies the spring movement, resizing, blur, and text-swap animations; the module skips devices without hover and a fine pointer.

### `data-loader.js`

Fetches `/dev/data`, counts children in matching CMS source lists, and writes those counts into `[data-cms-count-target]` elements. Hydration runs in the background so the request cannot delay the rest of the site modules.

### `faq.js`

Provides the single-open FAQ accordion behavior, including accessible expanded states, icon transitions, responsive height refreshes, and support for dynamically inserted Finsweet list items. It relies on the globally loaded GSAP core library; no GSAP plugins are required.

### `menu-toggle.js`

Opens and closes the mobile navigation menu, toggling `is-open` across the nav layout, menu and trigger together. It closes itself when a navigation starts, which releases the body scroll lock before the router scrolls anything.

### `nav-auto-hide.js`

Hides the navigation bar as the visitor scrolls down and brings it back once they scroll up far enough to mean it, so a short bounce does not make it flicker. It stays visible at the top of the page, while the mobile menu is open, and while focus is inside it.

### `page-transition.js`

Crossfades `main` and the footer through a brief white hold while the navigation stays untouched, so nothing in the nav rebuilds or flashes. It fetches the next page, waits for that page's stylesheet, webfonts and above-the-fold images, then swaps the content with `setHTMLUnsafe` so Webflow code components keep their shadow DOM. A page with a different shell, a failed fetch or a missing `setHTMLUnsafe` falls back to an ordinary navigation. It owns navigation for the whole session, so it starts once from `src/index.js` rather than through the module registry, and it carries its own CSS.

### `insight-toc.js`

Tracks the current Finsweet table-of-contents link and writes its position and height to CSS custom properties for the sidebar indicator. It preserves the last active state during brief gaps where Finsweet removes its `w--current` class.

### `quote-fade.js`

Turns a testimonial Collection List into a cross-fading, auto-advancing quote using the globally loaded Swiper constructor. It writes the autoplay's progress to a `--quote-progress` custom property for the rule drawn under the card. A list holding a single quote is left as static markup, and visitors who prefer reduced motion get an instant, non-autoplaying slider with no progress rule.

### `rightway.js`

Turns the Rightway card grid into an Embla carousel at widths up to 991px and restores the static grid above that breakpoint. It creates responsive pagination dots and uses the globally exposed Embla UMD build loaded from jsDelivr.

### `rt-flow.js`

Converts structured rich-text source content into repeated Webflow template items using `data-rt-el` field mappings. It supports paired content fields, single-field lists, and an optional `data-rt-max` item limit.

### `stick.js`

On desktop widths, marks the sticky-list item closest to the vertical midpoint of the viewport as active. It disables the observer and clears active state below the breakpoint.

### `team-switch.js`

Synchronizes the active team-switch pill with the team section through their shared `data-active` index. Where supported, the state change is wrapped in the browser View Transition API.

### `work-archive.js`

Extends the Finsweet work-archive sector filters so tags on individual cards can apply or clear the matching filter. It also synchronizes active tag styling and temporarily stabilizes section height while filtered results update.

### `work-card-anim.js`

Assigns CSS stagger delays and viewport-entry attributes to work cards and team items for their reveal animations. Visitors who prefer reduced motion receive the non-animated state instead.

### `work-slide.js`

Initializes the selected-work carousel with the globally loaded Swiper constructor. It calculates Webflow container offsets and equal slide widths, builds pagination dots, hands any `data-work-slide` previous/next controls to Swiper's navigation module so they carry `swiper-button-disabled` at each end, forwards Enter and Space to them, updates on resize, and prevents dragged links from being opened accidentally.

### `work-slider.js`

Builds the Impact carousel slides from rich-text headings, paragraphs, and optional italic content before initializing Embla. It wires previous/next controls, disabled states, and drag cursor feedback for each Impact section.

## Runtime support

### `boot.js`

Starts each module in registry order with a fresh `AbortSignal`, logs a module that fails without stopping the rest, and marks the document `data-modules-ready`. `restartModules` runs them all again against a new page, aborting the previous signals first; the page transition calls it on `spw:page`.

### `index.js`

Imports every behavior initializer and defines their public names and startup order. This registry is used both by the automatic boot process and by the `window[namespace].modules` console interface.

### `init-once.js`

Shares an in-flight initialization promise for a specific DOM element so concurrent starts cannot attach the same behavior twice. If setup fails, it removes the sentinel so a later call can retry cleanly.

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
