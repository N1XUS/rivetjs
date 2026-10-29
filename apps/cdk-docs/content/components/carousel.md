---
title: Carousel
description: Carousel from @rivetjs/cdk provides draggable slides, W3C APG roles, navigation buttons, dots and rotation controls.
template: guide
status: experimental
related: [foundations/motion, components/button, components/tabs, foundations/keyboard-navigation]
---

`Carousel` shows a set of slides one view at a time. Slides move by an inline `transform` that embla's scroll body integrates frame by frame. The parts add the [W3C APG carousel](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) semantics: a labelled region, slides announced as "1 of 5", previous / next buttons, a tab-list slide picker and a rotation control for autoplay.

::example{id=carousel-basic}

## Anatomy

```html
<div
  role="region"
  aria-roledescription="carousel"
  aria-label="Landscapes"
  id="gallery"
  class="rv-Carousel"
  data-orientation="horizontal"
  data-draggable="true"
  data-rk="ArrowLeft ArrowRight"
>
  <div id="gallery-viewport" class="rv-CarouselViewport" style="overflow:hidden;touch-action:pan-y pinch-zoom">
    <div class="rv-CarouselContainer" aria-live="polite" style="display:flex">
      <div
        role="group"
        aria-roledescription="slide"
        aria-label="1 of 5"
        id="gallery-slide-0"
        class="rv-CarouselSlide"
        data-index="0"
        data-snapped="true"
        style="flex:0 0 var(--rv-carousel-slide-size, 100%);min-width:0"
      >
        …
      </div>
      …
    </div>
  </div>
  <button aria-label="Previous slide" aria-controls="gallery-viewport" class="rv-CarouselPrevious" disabled data-disabled="true">…</button>
  <button aria-label="Next slide" aria-controls="gallery-viewport" class="rv-CarouselNext">…</button>
</div>
```

| Part                                |                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Carousel`                          | APG carousel container: `role="region"`, `aria-roledescription="carousel"`, the embla options, the state                       |
| `CarouselViewport`                  | embla root: clips the track (`overflow: hidden`), owns the drag; id `<id>-viewport`                                            |
| `CarouselContainer`                 | embla container: the flex track the engine translates; `aria-live` region; `items` renders one slide per item                  |
| `CarouselSlide`                     | one slide: `role="group"` (`role="tabpanel"` with `tabs`), `aria-roledescription="slide"`, label "N of M"; id `<id>-slide-<i>` |
| `CarouselPrevious` / `CarouselNext` | cdk [Button](button.md)s, disabled when there is no previous / next snap                                                       |
| `CarouselDots` / `CarouselDot`      | slide picker: APG tab list with one tab per snap; tab ids `<id>-tab-<i>`                                                       |
| `CarouselRotationControl`           | cdk Button that stops / starts autoplay or auto scroll                                                                         |

## Import

```ts
import {
  Carousel,
  CarouselViewport,
  CarouselContainer,
  CarouselSlide,
  CarouselPrevious,
  CarouselNext,
  CarouselDots,
  CarouselDot,
  CarouselRotationControl,
} from "@rivetjs/cdk/carousel";
```

The engine alone (no components) is `@rivetjs/cdk/carousel/engine` (`EmblaCarousel(viewport, options, plugins)`, the embla API). The plugins are `@rivetjs/cdk/carousel/autoplay`, `/auto-scroll`, `/auto-height`, `/fade` and `/class-names`, each its own module (0 B when unused).

## Props

### Carousel

The embla options are props of `Carousel`. Defaults are embla's.

| Prop                                                 | Type                                                                    | Default                | Notes                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `align`                                              | `"start" \| "center" \| "end" \| (viewSize, snapSize, index) => number` | `"center"`             | Where a snap sits in the viewport.                                                                                         |
| `axis`                                               | `"x" \| "y"`                                                            | `"x"`                  | `"y"`: vertical; the viewport needs a height.                                                                              |
| `direction`                                          | `"ltr" \| "rtl"`                                                        | the locale's direction | Only for `axis="x"`. Put `dir="rtl"` on an ancestor too.                                                                   |
| `loop`                                               | `boolean`                                                               | `false`                | Slides are repositioned so the carousel wraps.                                                                             |
| `slidesToScroll`                                     | `number \| "auto"`                                                      | `1`                    | Slides per snap. `"auto"`: as many as fit.                                                                                 |
| `containScroll`                                      | `false \| "trimSnaps" \| "keepSnaps"`                                   | `"trimSnaps"`          | Removes empty space at the ends (no effect with `loop`).                                                                   |
| `dragFree`                                           | `boolean`                                                               | `false`                | Momentum scrolling without snapping on release.                                                                            |
| `dragThreshold`                                      | `number`                                                                | `10`                   | Pixels before a press becomes a drag (a click below it).                                                                   |
| `duration`                                           | `number`                                                                | `25`                   | Scroll duration in fixed 60 Hz steps (20–60 recommended); `0` jumps.                                                       |
| `startIndex`                                         | `number`                                                                | `0`                    | Snap selected on the first render.                                                                                         |
| `skipSnaps`                                          | `boolean`                                                               | `false`                | A strong flick may pass several snaps.                                                                                     |
| `inViewThreshold`                                    | `number \| number[]`                                                    | `0`                    | IntersectionObserver threshold for `data-in-view`.                                                                         |
| `watchDrag`                                          | `boolean \| (api, event) => boolean`                                    | `true`                 | `false` disables dragging.                                                                                                 |
| `watchResize`                                        | `boolean \| (api, entries) => boolean`                                  | `true`                 | Re-measure on resize.                                                                                                      |
| `watchSlides`                                        | `boolean \| (api, mutations) => boolean`                                | `true`                 | Re-initialise when slides are added or removed.                                                                            |
| `watchFocus`                                         | `boolean \| (api, event) => boolean`                                    | `true`                 | Scroll a slide into view when focus moves into it.                                                                         |
| `breakpoints`                                        | `{ [mediaQuery]: options }`                                             | `{}`                   | Options per media query.                                                                                                   |
| `active`                                             | `boolean`                                                               | `true`                 | `false` turns the engine off (also per breakpoint).                                                                        |
| `autoplay`                                           | `boolean \| AutoplayOptions`                                            | none                   | Embla Autoplay (`delay`, `jump`, `playOnInit`, `stopOnLastSnap`, …). See [Rotation](#rotation).                            |
| `autoScroll`                                         | `boolean \| AutoScrollOptions`                                          | none                   | Embla AutoScroll (`speed`, `direction`, `startDelay`, …).                                                                  |
| `plugins`                                            | `() => EmblaPluginType[]`                                               | none                   | More embla plugins, created when the engine starts. On a resumed page the engine then starts when the carousel is visible. |
| `tabs`                                               | `boolean`                                                               | `false`                | APG tabbed carousel: slides become tab panels labelled by their `CarouselDot`.                                             |
| `slideCount`                                         | `number`                                                                | counted                | Number of static slides, so the server can label them "N of M" and offset `startIndex`. Not needed with `items`.           |
| `onApi`                                              | `(api: EmblaCarouselType) => void`                                      | none                   | The engine API when it starts. On a resumed page the engine then starts when the carousel is visible.                      |
| `onSelect`                                           | `(index: number) => void`                                               | none                   | The selected snap changed (embla `select`).                                                                                |
| `onSettle`                                           | `(index: number) => void`                                               | none                   | The scroll came to rest (embla `settle`).                                                                                  |
| `aria-label`, `aria-labelledby`, `aria-describedby`  | `string`                                                                | none                   | Name the carousel (APG requires a label).                                                                                  |
| `aria-roledescription`                               | `string`                                                                | `"carousel"`           |                                                                                                                            |
| `id`, `slot`, `class`, `style`, `children`, `render` |                                                                         |                        | `class` / `style` / `children` may be functions of the render props.                                                       |

### Parts

| Part                                | Props                                                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CarouselViewport`                  | `class`, `style`, `ref`, `render`, DOM attributes. Its pointer handlers are chained after the carousel's.                                                       |
| `CarouselContainer`                 | `items` (array or accessor) + `by` (key) + function child `(item, index) => <CarouselSlide/>`, or static `CarouselSlide` children; `class`, `style`, `render`.  |
| `CarouselSlide`                     | `index` (default: render order or the `items` index), `aria-label` (default `"N of M"`), `aria-roledescription` (`"slide"`), `class`, `style`, `render`.        |
| `CarouselPrevious` / `CarouselNext` | [Button](button.md) props; `isDisabled` defaults to "no previous / next snap"; `aria-label` defaults to "Previous slide" / "Next slide".                        |
| `CarouselDots`                      | `children` `(index) => <CarouselDot index={index}/>` (default: one `CarouselDot` each), `aria-label` (`"Choose slide to display"`), `class`, `style`, `render`. |
| `CarouselDot`                       | `index` (required), `aria-label` (`"Slide n"`), `class`, `style`, `children`, `render`.                                                                         |
| `CarouselRotationControl`           | [Button](button.md) props, `stopLabel` (`"Stop automatic slide show"`), `startLabel` (`"Start automatic slide show"`).                                          |

### Render props

Every part's `class` / `style` / `children` function receives accessors:

| Render prop                       | Type                               |                                                                  |
| --------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `selectedIndex`                   | `() => number`                     | selected snap                                                    |
| `snapCount`                       | `() => number`                     | number of snaps                                                  |
| `canScrollPrev` / `canScrollNext` | `() => boolean`                    |                                                                  |
| `isPlaying`                       | `() => boolean`                    | autoplay / auto scroll is moving (false while a hover pauses it) |
| `isRotating`                      | `() => boolean`                    | rotation is on (not stopped by the user)                         |
| `isDragging`                      | `() => boolean`                    | pointer down on the viewport                                     |
| `orientation`                     | `() => "horizontal" \| "vertical"` |                                                                  |
| `state`                           | `CarouselState`                    | the state, for the commands below                                |
| `index`, `isSnapped`, `isInView`  | `() => …`                          | `CarouselSlide` only                                             |
| `index`, `isSelected`             | `() => …`                          | `CarouselDot` only                                               |

Commands take the state: `carouselScrollTo(state, index, jump?)`, `carouselScrollPrev(state)`, `carouselScrollNext(state)`, `carouselApi(state)` (the running embla API or `undefined`), `startRotation(state)`, `stopRotation(state)`.

### Engine API and events

`onApi` (or `carouselApi(state)`) returns embla's API: `scrollNext(jump?)`, `scrollPrev(jump?)`, `scrollTo(index, jump?)`, `canScrollNext()`, `canScrollPrev()`, `selectedScrollSnap()`, `previousScrollSnap()`, `scrollSnapList()`, `scrollProgress()`, `slidesInView()`, `slidesNotInView()`, `slideNodes()`, `rootNode()`, `containerNode()`, `plugins()`, `reInit(options?, plugins?)`, `internalEngine()`, `destroy()`, `on(event, cb)`, `off(event, cb)`, `emit(event)`.

| Event                                                                                             | When                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `init`, `reInit`, `destroy`                                                                       | lifecycle                                        |
| `select`                                                                                          | the selected snap changed                        |
| `scroll`, `settle`                                                                                | every frame of a scroll; the scroll came to rest |
| `pointerDown`, `pointerUp`                                                                        | a drag starts / ends                             |
| `slidesInView`, `slidesChanged`, `resize`                                                         | observers                                        |
| `slideFocusStart`, `slideFocus`                                                                   | focus moved into a slide                         |
| `autoplay:play`, `autoplay:stop`, `autoplay:select`, `autoplay:timerset`, `autoplay:timerstopped` | Autoplay                                         |
| `autoScroll:play`, `autoScroll:stop`                                                              | AutoScroll                                       |

## Loop

`loop` wraps around: embla's slide looper moves the slides that leave one edge to the other, so a drag never runs out of slides.

::example{id=carousel-loop}

## Several slides per view

Slide width is `--rv-carousel-slide-size` (default `100%` of the viewport), set on any ancestor. Combine it with `align="start"` and `slidesToScroll`.

::example{id=carousel-multiple}

## Vertical

`axis="y"` stacks the slides in a column. Give the viewport and the container a height. Arrow Up / Down replace Left / Right.

::example{id=carousel-vertical}

## Dots (tabbed carousel)

With `tabs` and `CarouselDots`, the carousel follows the APG tabbed variant. The dots form a tab list with automatic activation. Each slide is a `tabpanel` labelled by its tab.

::example{id=carousel-dots}

## Thumbnails

A function child of `Carousel` gets the render props, `state` included. Any control can then drive the carousel with `carouselScrollTo(state, index)`.

::example{id=carousel-thumbnails}

## Rotation

`autoplay` (or `autoScroll`) rotates the slides. W3C APG behaviour:

- hovering the carousel pauses rotation, and leaving resumes it (embla `stopOnMouseEnter`, with the whole carousel as the hover target);
- keyboard focus inside the carousel (`:focus-visible`) stops rotation until the user starts it again;
- `CarouselRotationControl` stops or starts it, and its label says what a press does;
- the slides container is `aria-live="off"` while rotation is on and `polite` once it is stopped.

::example{id=carousel-autoplay}

`isPlaying` follows the plugin, so it is false during a hover pause. `isRotating` says whether rotation is on at all. The rotation plugins load with a dynamic `import()` the first time a carousel uses them; carousels without rotation never load them.

## Examples

Ports of embla's predefined examples (embla-carousel.com, Examples → Predefined), in the same order. The parts replace embla's markup; options, plugins and tweens are embla's code.

### Basic examples

#### Default

The first example on this page, with [dots](#dots-tabbed-carousel).

#### Loop

See [Loop](#loop).

#### Right to left

`direction="rtl"` with `dir="rtl"` on an ancestor.

::example{id=carousel-rtl}

#### Slides to scroll

::example{id=carousel-slides-to-scroll}

#### Drag free

::example{id=carousel-drag-free}

#### Align

::example{id=carousel-align}

#### Variable widths

Each slide sets its own `--rv-carousel-slide-size`.

::example{id=carousel-variable-widths}

#### Y-axis

See [Vertical](#vertical).

#### Slides per view

The slide size changes per breakpoint; embla re-measures on resize.

::example{id=carousel-slides-per-view}

#### Thumbnails

See [Thumbnails](#thumbnails).

### Plugin examples

#### Autoplay

The `autoplay:timerset` / `autoplay:timerstopped` events drive a progress bar. Start / Stop is the `CarouselRotationControl`.

::example{id=carousel-autoplay-progress}

#### Auto scroll

::example{id=carousel-auto-scroll}

#### Auto height

`plugins={() => [AutoHeight()]}` from `@rivetjs/cdk/carousel/auto-height`.

::example{id=carousel-auto-height}

#### Fade

`plugins={() => [Fade()]}` from `@rivetjs/cdk/carousel/fade`: the slides stack and cross-fade. Drag, buttons and dots work as before.

::example{id=carousel-fade}

#### Class names

The ClassNames plugin sets `is-snapped`, `is-in-view`, `is-draggable`, `is-dragging` and `is-loop`. The parts already carry the same states as `data-*` attributes. Use the plugin when CSS keys on embla's classes.

::example{id=carousel-class-names}

### Tween examples

`onApi` gets the engine when it starts. These examples listen to `scroll`, read `scrollProgress()` and the slide registry, and style the slides.

#### Parallax

::example{id=carousel-parallax}

#### Scale

::example{id=carousel-scale}

#### Opacity

::example{id=carousel-opacity}

### Miscellaneous examples

#### Progress

`state.scrollProgress` mirrors embla's `scrollProgress()` on every scroll.

::example{id=carousel-progress}

#### Lazy load

::example{id=carousel-lazy-load}

#### Infinite scroll

A custom `watchSlides` re-initialises embla when slides are appended. It copies the scroll state into the new engine.

::example{id=carousel-infinite-scroll}

#### iOS style picker

embla's translate is turned off. The scroll progress rotates a 3D wheel.

::example{id=carousel-ios-picker}

#### iOS style picker loop

::example{id=carousel-ios-picker-loop}

## Motion

Scrolling, dragging and snapping use embla's own motion, with no CSS transitions:

- a fixed 60 Hz step loop with render interpolation;
- a scroll body that integrates velocity towards the target from `duration` and friction;
- a drag tracker whose flick force is boosted on release and snapped by the scroll target.

With `prefers-reduced-motion: reduce`, movements land at once instead of animating. This covers buttons, dots, keys, autoplay and the release of a drag. While you drag, the track still follows the pointer. A change of the setting applies to the next movement. AutoScroll keeps its speed.

The motion core is a standalone module, [`@rivetjs/cdk/motion`](../foundations/motion.md).

## Styling

| Selector                                                                  |                                                                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `.rv-Carousel`                                                            | root; `[data-orientation]`, `[data-loop]`, `[data-draggable]`, `[data-dragging]`, `[data-playing]`, `[data-ready]` (engine running)            |
| `.rv-CarouselViewport`, `.rv-CarouselContainer`                           | viewport and track                                                                                                                             |
| `.rv-CarouselSlide`                                                       | `[data-index]`, `[data-snapped]` (in the selected snap), `[data-in-view]`                                                                      |
| `.rv-CarouselPrevious`, `.rv-CarouselNext`, `.rv-CarouselRotationControl` | Button states (`[data-disabled]`, `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`); the rotation control also has `[data-rotating]` |
| `.rv-CarouselDots`, `.rv-CarouselDot`                                     | `[data-selected]`, focus states                                                                                                                |

The `data-*` attributes take the place of embla's ClassNames plugin (`is-snapped`, `is-in-view`, `is-dragging`, `is-draggable`, `is-loop`). The plugin itself is exported for custom markup. The viewport's `overflow` / `touch-action`, the container's flex track and the slide's `flex` basis are inline behaviour styles. Overriding a class cannot break them.

### Tailwind

All examples above use Tailwind with `@rivetjs/cdk/tailwind.css` variants (`data-[snapped]:`, `data-[selected]:`).

### Plain CSS

::example{id=carousel-css}

## Accessibility

- Root: `role="region"` + `aria-roledescription="carousel"`, named by `aria-label` / `aria-labelledby`.
- Slides: `role="group"` + `aria-roledescription="slide"`, labelled "N of M". In a tabbed carousel they are `role="tabpanel"`, labelled by their tab.
- Previous / next: buttons with `aria-controls` = the viewport. They are disabled when there is no previous / next snap.
- Dots: `role="tablist"` of `role="tab"` with `aria-selected`, roving `tabindex` and `aria-controls` = the snap's slides.
- Live region: `aria-live="polite"` on the container, `off` while rotating.

| Key                                                                           | Where                                                         | Action                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| :kbd[ArrowLeft] / :kbd[ArrowRight]                                            | anywhere in the carousel (not in text fields or the tab list) | previous / next snap (mirrored in RTL)                                                    |
| :kbd[ArrowUp] / :kbd[ArrowDown]                                               | same, `axis="y"`                                              | previous / next snap                                                                      |
| :kbd[ArrowLeft] / :kbd[ArrowRight] (:kbd[ArrowUp] / :kbd[ArrowDown] vertical) | tab list                                                      | move to the previous / next dot and select it (wraps with `loop`)                         |
| :kbd[Home] / :kbd[End]                                                        | tab list                                                      | first / last dot                                                                          |
| :kbd[Tab]                                                                     |                                                               | moves through the controls and the slides' content; focusing a slide scrolls it into view |

## Resumability

- The server renders every slide, the labels, the button states and the selected `startIndex`. A `startIndex` above 0 is shown with a CSS `translate` computed from `--rv-carousel-slide-size`; it is exact for uniform slides without gaps.
- No carousel code runs before the first interaction. The first pointer down, key press, focus or button press on the carousel starts the engine synchronously in its handler. A cold first `mousedown` / `touchstart` is handed to embla's drag handler, so the very first drag works.
- The handler code of the root and the viewport, and the code of every binding that reads the carousel state, is fetched when the carousel is visible. It runs only on an interaction, so the first press or drag needs no further download.
- A press whose click the page holds while earlier code loads still selects: the press waits for the held click.
- With `autoplay` / `autoScroll`, `plugins` or `onApi`, the engine starts when the carousel scrolls into view (a visible `clientEffect`: a deliberate preload). embla initialises plugins and API listeners on mount, so Fade, AutoHeight and tweens are in place before the first interaction.
- Classes that plugins add at init (ClassNames `is-snapped`) stay on a resumed page: adoption preserves tokens added after the runtime snapshots the server classes, while removing old binding-owned tokens if the class value changed. Later live class writes replace the class normally.

## Upstream

- Engine: embla-carousel 8.6.0, file by file (`libs/cdk/carousel/engine/`), with embla's test suite ported. Plugins: embla-carousel-autoplay, -auto-scroll, -auto-height, -fade and -class-names 8.6.0.
- Not ported: embla-carousel-wheel-gestures (a third-party package built on the `wheel-gestures` library, not part of embla).
- Additions:
  - the component parts and the W3C APG semantics;
  - the drag handler accepts a replayed first pointer down (`pointerDownEvent`), for resumed pages;
  - the motion core moved to `@rivetjs/cdk/motion`;
  - reduced motion (`prefers-reduced-motion: reduce`): movements land at once (embla has no reduced-motion handling).
