---
title: Lightbox
description: Lightbox from @rivetjs/cdk displays images, video, embeds and PDF, with zoom, captions, thumbnails and plugins.
template: guide
status: experimental
related: [components/carousel, components/modal, foundations/motion, foundations/focus-trap]
---

`Lightbox` shows images, videos, embeds (YouTube, Vimeo, any iframe) and PDF documents full screen, one slide at a time. Rivet builds it from parts on the cdk overlay layer: the modal traps focus, locks scroll, closes on Escape and returns focus to the trigger. Swipe, pull, wheel and keyboard navigation run on the house motion (`@rivetjs/cdk/motion`).

::example{id=lightbox-basic}

## Anatomy

```html
<div class="rv-LightboxOverlay" data-lightbox-overlay="" style="position:fixed;inset:0;--rv-lightbox-fade:250ms">
  <div class="rv-Lightbox" data-lightbox-root="" style="position:absolute;inset:0">
    <div role="dialog" aria-modal="true" aria-label="Photos" class="rv-LightboxContainer" data-lightbox-container="" tabindex="-1" style="display:grid;…">
      <div role="region" aria-roledescription="carousel" class="rv-LightboxCarousel" data-lightbox-carousel="">
        <div role="group" aria-roledescription="slide" aria-label="2 of 4" class="rv-LightboxSlide" data-lightbox-slide="" data-current="true">
          <img class="rv-LightboxImage" data-lightbox-zoomable="" src="…" alt="…" />
        </div>
        …
      </div>
      <div class="rv-LightboxToolbar" data-lightbox-toolbar="">
        <button type="button" aria-label="Close" class="rv-LightboxButton" data-action="close">…</button>
      </div>
      <button type="button" aria-label="Previous" class="rv-LightboxButton" data-action="prev">…</button>
      <button type="button" aria-label="Next" class="rv-LightboxButton" data-action="next">…</button>
    </div>
  </div>
</div>
```

| Part                                                 |                                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Lightbox`                                           | modal root: overlay (`overlayClass`), dialog (`class`), container (`containerClass`, `role="dialog"`, the gesture surface)   |
| `LightboxCarousel`                                   | the current slide and `preload` slides on each side; its render function draws a slide (default: `LightboxImage` for images) |
| `LightboxImage`                                      | image slide: `srcset` / `sizes`, loading and error placeholders, `object-fit`                                                |
| `LightboxToolbar`, `LightboxButton`                  | button row (position it with CSS) and a labelled icon button for your own actions                                            |
| `LightboxClose`, `LightboxPrevious`, `LightboxNext`  | close (not rendered inline) and navigation buttons, disabled at the ends of a `finite` carousel                              |
| `LightboxVideo`, `LightboxEmbed`, `LightboxPdf`      | media slides, each in its own subpath                                                                                        |
| `LightboxInline`                                     | the same view in the page, without an overlay                                                                                |
| Plugin parts (`LightboxZoom`, `LightboxCaptions`, …) | one subpath per plugin: an unused plugin adds 0 bytes                                                                        |

The container is a CSS grid with `top`, `start`, `main`, `end` and `bottom` areas. The carousel fills `main`; a thumbnails strip takes its side's area. Absolutely positioned parts with `grid-area: main` (toolbar, buttons, counter, captions) stay over the carousel, never over the strip.

## Import

```ts
import { Lightbox, LightboxCarousel, LightboxClose, LightboxNext, LightboxPrevious, LightboxToolbar } from "@rivetjs/cdk/lightbox";
import { LightboxZoom, LightboxZoomIn, LightboxZoomOut } from "@rivetjs/cdk/lightbox/zoom";
import { LightboxVideo } from "@rivetjs/cdk/lightbox/video";
import { LightboxEmbed } from "@rivetjs/cdk/lightbox/embed";
import { LightboxPdf } from "@rivetjs/cdk/lightbox/pdf";
```

Subpaths: `lightbox`, `lightbox/zoom`, `lightbox/video`, `lightbox/embed`, `lightbox/pdf`, `lightbox/captions`, `lightbox/counter`, `lightbox/download`, `lightbox/fullscreen`, `lightbox/share`, `lightbox/slideshow`, `lightbox/thumbnails`, `lightbox/inline`.

## Slides

Slides are plain data, so they serialize on a resumed page. An image slide needs `src`; `width` / `height` let the lightbox size it before it loads and pick `sizes`. `srcSet` lists other widths of the same image.

```ts
import type { LightboxSlide } from "@rivetjs/cdk/lightbox";

const slides: LightboxSlide[] = [
  {
    src: "/photos/coast-1600.jpg",
    alt: "Coast at dawn",
    width: 1600,
    height: 1067,
    srcSet: [
      { src: "/photos/coast-800.jpg", width: 800, height: 533 },
      { src: "/photos/coast-1600.jpg", width: 1600, height: 1067 },
    ],
    title: "Coast",
    description: "First light over the bay.",
  },
  { type: "video", poster: "/clip.jpg", width: 1280, height: 720, sources: [{ src: "/clip.mp4", type: "video/mp4" }] },
  { type: "embed", provider: "youtube", id: "aqz-KE-bpKQ", title: "Trailer" },
  { type: "pdf", src: "/spec.pdf", title: "Spec sheet" },
];
```

| Slide type             | Fields                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| image (`type` omitted) | `src`, `alt`, `width`, `height`, `srcSet`, `sizes`, `imageFit`                                               |
| `video`                | `sources`, `poster`, `width`, `height`, `autoPlay`, `controls`, `loop`, `muted`, `playsInline`, `preload`, … |
| `embed`                | `provider` (`youtube`, `vimeo`, `iframe`), `id` or `src`, `poster`, `width`, `height`, `start`, `allow`      |
| `pdf`                  | `src`, `width`, `height`                                                                                     |
| any other `type`       | your own fields; draw it in the carousel's render function                                                   |
| every slide            | `title`, `description` (Captions), `download`, `share`, `thumbnail`                                          |

## Controlled

`isOpen` and `index` take a two-way signal (or a value / an accessor). The lightbox writes the signal when it closes or moves, so a trigger only sets them:

```tsx
const open = signal(false);
const index = signal(0);

<button onClick={() => { index.set(2); open.set(true); }}>Open the third photo</button>
<Lightbox isOpen={open} index={index} slides={slides} aria-label="Photos" />
```

Without children the lightbox renders its default parts: the carousel, a Close button and Previous / Next.

## Settings

### Part props

| Part | Props |
| --- | --- |
| `Lightbox` | `id`, `class` (default `rv-Lightbox`), `style`, `overlayClass` (`rv-LightboxOverlay`), `overlayStyle`, `containerClass` (`rv-LightboxContainer`), `aria-label` (defaults to the Lightbox label), `children` (content or a function; defaults to the carousel and controls). |
| `LightboxView` | Required `state: LightboxState`; optional `entering` accessor, `dialogLabel`, `class` (`rv-LightboxContainer`), `style`, `children`. Used by modal and inline presentations. |
| `LightboxCarousel` | `class` (`rv-LightboxCarousel`), `style`, `slideClass` (`rv-LightboxSlide`), `slideStyle`, `children(slide, { index, offset })`; `offset` is an accessor. |
| `LightboxImage` | `slide` (defaults to the enclosing slide), `class` (`rv-LightboxImage`), `style`, `imageProps`, `loading`, `error`, `placeholderClass` (`rv-LightboxPlaceholder`). |
| `LightboxToolbar` | `class` (`rv-LightboxToolbar`), `style`, `children`. |
| `LightboxButton` and navigation buttons | `class` (`rv-LightboxButton`), `style`, `label` (accessible label and title), `children`, `isDisabled` (boolean/accessor), `onPress(event: MouseEvent)`. |

### State options

| Prop         | Settings (defaults)                                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `carousel`   | `finite` (`false`: wraps around), `preload` (2 slides each side), `padding` (`"16px"`), `spacing` (`"30%"`), `imageFit` (`"contain"`)                                                                                                      |
| `animation`  | `fade` (250 ms, CSS `--rv-lightbox-fade`), `swipe` (500 ms), `navigation` (= `swipe`), `zoom` (500 ms)                                                                                                                                     |
| `controller` | `closeOnEscape` (`true`), `closeOnBackdropClick`, `closeOnPullDown`, `closeOnPullUp` (`false`), `touchAction` (`"none"` or `"pan-y"`), `disableSwipeNavigation`, `preventDefaultWheelX` (`true`), `preventDefaultWheelY`, `focus` (`true`) |
| `labels`     | every visible and accessible string (`Previous`, `Next`, `Close`, `"{index} of {total}"`, `Zoom in`, …)                                                                                                                                    |

## Events

| Prop                                               | When                                                      |
| -------------------------------------------------- | --------------------------------------------------------- |
| `onView({ index })`                                | a slide becomes current, also on open                     |
| `onClick({ index })`                               | the current slide's media is clicked                      |
| `onEntering`, `onEntered`, `onExiting`, `onExited` | the lightbox starts / ends opening, starts / ends closing |
| `onIndexChange(index)`, `onOpenChange(open)`       | the index or the open state changes                       |

## Plugins

Each plugin is a part in its own subpath. Render it inside the lightbox where it should appear.

::example{id=lightbox-plugins}

### Zoom

`LightboxZoom` adds wheel / trackpad zoom (Ctrl or `scrollToZoom`), pinch, double click or double tap, drag to pan, `+` / `-`, Ctrl / Cmd + `0` and the arrow keys. `LightboxZoomIn` and `LightboxZoomOut` are its buttons. Options: `maxZoomPixelRatio` (1), `zoomInMultiplier` (2), `doubleTapDelay`, `doubleClickDelay`, `doubleClickMaxStops`, `keyboardMoveDistance`, `wheelZoomDistanceFactor`, `pinchZoomDistanceFactor`, `scrollToZoom`, `minZoom`, `maxZoom`, `supports` (custom slide types), `onZoom`. While zoomed, swipe and arrow keys pan instead of changing the slide; the container carries `data-zoomed`.

### Captions

`LightboxCaptions` renders the current slide's `title` and `description` (`descriptionMaxLines`, `descriptionTextAlign`, `hidden`). `LightboxCaptionsToggle` shows and hides them (`aria-pressed`).

### Counter

`LightboxCounter` renders "2 / 4" (`separator`); it is `aria-hidden`, the slides already announce "2 of 4".

### Thumbnails

`LightboxThumbnails` renders a strip of every slide as buttons ("Go to slide 3", `aria-current`): `position` (`bottom`, `top`, `start`, `end`), `width`, `height`, `border`, `borderRadius`, `padding`, `gap`, `imageFit`, `vignette`, `hidden`. Slides without an image use their `thumbnail` or `poster`, else the render function you pass as children. `LightboxThumbnailsToggle` shows and hides the strip.

### Slideshow

`LightboxSlideshow` is a play / pause button (`delay` 3000 ms, `autoplay`, `onStart`, `onStop`). It waits for an image to load and for a playing video to end, and stops at the end of a `finite` carousel.

### Fullscreen

`LightboxFullscreen` toggles the Fullscreen API on the lightbox (`auto` enters on open, `onEnter`, `onExit`). It is hidden where the API is missing.

### Download

`LightboxDownload` saves the current slide (`download` field: `false`, a URL or `{ url, filename }`): same-origin, `data:` and `blob:` URLs through a link with `download`, other origins through a CORS fetch, falling back to a new tab. `download` prop: your own handler.

### Share

`LightboxShare` calls the Web Share API with the slide's `share` field or its URL; hidden where the API is missing unless you pass `share`.

## Video

`LightboxVideo` renders a native `<video>` with the slide's `sources`, `poster` and options. The current slide's video plays when `autoPlay` is set; a video that stops being current pauses. Presses on the bottom 40 px of a video with controls never start a swipe, so the scrubber works.

::example{id=lightbox-video}

## Embeds

`LightboxEmbed` renders an iframe for YouTube (`youtube-nocookie.com`), Vimeo (`dnt=1`) or any `src`. The iframe is created only while its slide is current; preloaded neighbours show the `poster`, and leaving the slide removes the iframe, which stops playback. A closed lightbox, or a slide you never open, makes no request to the provider.

::example{id=lightbox-embeds}

## PDF

`LightboxPdf` shows the document in the browser's own PDF viewer (`<object type="application/pdf">`), mounted for the current slide and its direct neighbours. Where the browser cannot show PDFs inline, the `fallback` content is a link that opens or downloads the file. No pdf.js: it would add ~1 MB for what the platform viewer already does.

::example{id=lightbox-pdf}

## Inline

`LightboxInline` renders the carousel in the page, without the overlay (YARL Inline plugin). Size it with `class` or `style`; there is no Close button. A server-rendered inline lightbox installs its listeners on the first pointer or focus.

::example{id=lightbox-inline}

## Custom slides

The carousel's render function gets each slide and draws it; return any content for your own slide types. A custom slide that should zoom marks its element `data-lightbox-zoomable` and lists its type in Zoom's `supports`.

::example{id=lightbox-custom-slides}

## Styling

The parts are headless: default `rv-Lightbox*` classes when `class` is omitted, state in attributes (`data-current`, `data-entering` / `data-exiting`, `data-zoomed`, `data-gesture`, `aria-pressed`, `disabled`). Positioning, the grid, the slide track and the media sizing are inline styles, so your classes only change the look. The styled version is [`@rivetjs/ui/lightbox`](site:ui/components/lightbox/).

## Accessibility

- The container is a `role="dialog"` with `aria-modal` and an accessible name (`aria-label`, default "Lightbox"). Focus moves into it on open, stays inside, and returns to the trigger on close.
- The carousel is an APG carousel region; each slide is a `role="group"` labelled "2 of 4"; slides that are not current are `inert`.
- Every button has an `aria-label` (and `title`) from `labels`; toggles expose `aria-pressed`.

| Key                                | Action                                       |
| ---------------------------------- | -------------------------------------------- |
| :kbd[ArrowLeft] / :kbd[ArrowRight] | previous / next slide (pan when zoomed)      |
| :kbd[Escape]                       | close (`closeOnEscape`)                      |
| :kbd[+] / :kbd[-]                  | zoom in / out (Zoom)                         |
| :kbd[Ctrl] + :kbd[0]               | reset zoom (Zoom; :kbd[Cmd] on macOS)        |
| :kbd[Tab]                          | moves through the buttons, inside the dialog |

## Resumability

- A closed lightbox renders only its overlay anchor on the server: no slides, no media requests, no code at load. Opening it creates the parts in the browser.
- Slides and settings are plain data. The parts are a render function (`{() => …}`), so they are created inside the open lightbox.
- Media state follows the DOM after each slide change (videos paused / played, the current thumbnail scrolled into view): no effects run while the lightbox is closed.

## Upstream

- Port of yet-another-react-lightbox 3.32.2 (MIT, © Igor Danchenko): core, Captions, Counter, Download, Fullscreen, Inline, Share, Slideshow, Thumbnails, Video and Zoom, with YARL's tests ported where they apply.
- Rivet differences:
  - parts instead of YARL's `plugins` / `render` props and module augmentation;
  - the motion is the house Motion1D physics: durations convert to its units, easing options are not used;
  - captions render once over the current slide; the thumbnails strip shows every slide with native scrolling;
  - Embed and PDF slides are Rivet additions (YARL leaves them to `render.slide`).
