# JavaScript modules

The site bundle starts these modules through `src/modules/index.js` after the DOM is ready. Each behavior is scoped to its relevant Webflow markup and otherwise exits without affecting the current page.

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

### `insight-toc.js`

Tracks the current Finsweet table-of-contents link and writes its position and height to CSS custom properties for the sidebar indicator. It preserves the last active state during brief gaps where Finsweet removes its `w--current` class.

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

### `work-rail.js`

Runs the featured-work rail with a custom looping desktop presentation and an Embla-based mobile mode. It coordinates slide geometry, navigation, featured text, overflow treatments, responsive rebuilds, and reduced-motion behavior.

### `work-slide.js`

Initializes the selected-work carousel with the globally loaded Swiper constructor. It calculates Webflow container offsets and equal slide widths, builds pagination dots, updates on resize, and prevents dragged links from being opened accidentally.

### `work-slider.js`

Builds the Impact carousel slides from rich-text headings, paragraphs, and optional italic content before initializing Embla. It wires previous/next controls, disabled states, and drag cursor feedback for each Impact section.

## Runtime support

### `index.js`

Imports every behavior initializer and defines their public names and startup order. This registry is used both by the automatic boot process and by the `window[namespace].modules` console interface.

### `init-once.js`

Shares an in-flight initialization promise for a specific DOM element so concurrent starts cannot attach the same behavior twice. If setup fails, it removes the sentinel so a later call can retry cleanly.
