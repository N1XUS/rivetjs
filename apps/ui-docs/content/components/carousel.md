---
title: Carousel
description: "Carousel: a slide show of content or images with previous / next buttons, dot or thumbnail pickers, autoplay and touch drag."
template: reference
status: experimental
related: [components/card, components/button]
---

`Carousel` shows one or more slides at a time and moves between them with buttons, dots, thumbnails, the keyboard, mouse or touch drag, or autoplay. The behaviour is [`@rivetjs/cdk/carousel`](site:cdk/components/carousel/) (a port of embla-carousel 8.6.0 + its Autoplay plugin, W3C APG carousel pattern); the look follows the other components (icon-only Buttons, pagination-style dots, surface radii, focus rings).

::example{id=carousel-basic}

## Import

```tsx
import { Carousel } from "@rivetjs/ui/carousel";
```

## Usage

```tsx
import { Carousel } from "@rivetjs/ui/carousel";

const SLIDES = ["One", "Two", "Three"];

export default function Gallery() {
  return (
    <Carousel aria-label="Gallery" tabs slideCount={SLIDES.length} class="w-80">
      <Carousel.Content>
        {SLIDES.map((name) => (
          <Carousel.Item>
            <div class="flex h-48 items-center justify-center rounded-3xl bg-surface-secondary">{name}</div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous />
      <Carousel.Next />
      <Carousel.Dots />
    </Carousel>
  );
}
```

- `slideCount`: the number of slides, so the server renders the slide labels ("1 of 3"), dots, counter and disabled states before the engine measures the page.
- `tabs`: W3C APG tabbed carousel. Set it with `Carousel.Dots` or `Carousel.Thumbnails`: slides become tab panels labelled by their tab.

## Anatomy

| Part                                 | Element                                            | `data-slot`                                  |
| ------------------------------------ | -------------------------------------------------- | -------------------------------------------- |
| `Carousel` / `.Root`                 | `div role=region`, class `carousel`                | `carousel`                                   |
| `Carousel.Content`                   | viewport `div` + track `div` (`carousel__content`) | `carousel-viewport` / `carousel-content`     |
| `Carousel.Item`                      | `div role=group` (`tabpanel` with `tabs`)          | `carousel-item`                              |
| `Carousel.Previous` / `.Next`        | icon-only `button` (Button classes)                 | `carousel-previous` / `carousel-next`        |
| `Carousel.RotationControl`           | icon-only `button` (pause / play)                  | `carousel-rotation-control`                  |
| `Carousel.Dots` / `.Dot`             | `div role=tablist` / `button role=tab`             | `carousel-dots` / `carousel-dot`             |
| `Carousel.Thumbnails` / `.Thumbnail` | `div role=tablist` / `button role=tab`             | `carousel-thumbnails` / `carousel-thumbnail` |
| `Carousel.Counter`                   | `span` "N / M"                                     | `carousel-counter`                           |

Controls are placed by a CSS grid on the root, wherever they are written: previous / next centred on the viewport edges, dots and thumbnails below (beside it when vertical), rotation control bottom-start and counter top-end over the viewport.

## Examples

### Loop

::example{id=carousel-loop}

### Multiple per view

Set the slide size with `--rv-carousel-slide-size` (on the root or an item); `slidesToScroll` moves several at a time.

::example{id=carousel-multiple}

### Vertical

`orientation="vertical"` needs a height: `--carousel-height` (default per size: 14 / 20 / 26rem).

::example{id=carousel-vertical}

### Autoplay

`autoplay` takes `true` or the Autoplay plugin options (`delay`, `stopOnInteraction`, `stopOnMouseEnter`, …). Rotation pauses while the pointer or focus is inside the carousel; `Carousel.RotationControl` stops and restarts it.

::example{id=carousel-autoplay}

### Dots

::example{id=carousel-dots}

### Thumbnails

`Carousel.Thumbnails` takes a function child `(index) => preview`; the selected thumbnail scrolls into view in the strip. `custom` renders your own `Carousel.Thumbnail` per index.

::example{id=carousel-thumbnails}

### With cards

::example{id=carousel-cards}

### Free drag

::example{id=carousel-free-drag}

### API access

`onApi` receives the embla API once the engine runs (on a resumed page, when the carousel becomes visible): call `scrollTo`, `scrollPrev`, `scrollNext` from your own controls and follow `select` events.

::example{id=carousel-api-access}

## Embla examples

Every predefined example of [embla-carousel](https://www.embla-carousel.com/examples/predefined/) 8.6.0, in its order, on the ui Carousel. Default, Loop, Drag Free, Y-axis and Thumbnails are the example at the top, [Loop](#loop), [Free drag](#free-drag), [Vertical](#vertical) and [Thumbnails](#thumbnails) above; the headless versions are on the [cdk carousel page](site:cdk/components/carousel/#examples).

### Basic examples

#### Right to left

`direction="rtl"` under `dir="rtl"`: the track, the chevrons and the arrow keys mirror.

::example{id=carousel-rtl}

#### Slides to scroll

`slidesToScroll="auto"` groups as many slides as fit into one snap (two at 50%), so there are five dots for ten slides.

::example{id=carousel-slides-to-scroll}

#### Align

70% slides, centred (the default `align`), with `containScroll={false}`: the first and last snaps leave space at the edges.

::example{id=carousel-align}

#### Variable widths

Each item sets its own `--rv-carousel-slide-size`; embla measures every slide.

::example{id=carousel-variable-widths}

#### Slides per view

One slide, two from `sm` and three from `lg`: the slide size changes per breakpoint and embla re-measures on resize.

::example{id=carousel-slides-per-view}

### Plugin examples

#### Autoplay

`autoplay={{ playOnInit: false, delay: 3000 }}` with a Start / Stop rotation control. `onApi` listens to `autoplay:timerset` and restarts a progress bar for the time until the next slide.

::example{id=carousel-autoplay-progress}

#### Auto scroll

`autoScroll` scrolls continuously once started; the rotation control starts and stops it.

::example{id=carousel-auto-scroll}

#### Auto height

The AutoHeight plugin (`@rivetjs/cdk/carousel/auto-height`) sets the track height to the tallest slide of the selected snap. Align the items to the start (`items-start` on `Carousel.Content`).

::example{id=carousel-auto-height}

#### Fade

The Fade plugin (`@rivetjs/cdk/carousel/fade`) stacks the slides and cross-fades them instead of scrolling.

::example{id=carousel-fade}

#### Class names

The ClassNames plugin (`@rivetjs/cdk/carousel/class-names`) toggles `is-snapped`, `is-in-view`, `is-draggable`, … on the slides and the viewport. The `data-*` attributes of the parts do the same without a plugin.

::example{id=carousel-class-names}

### Tween examples

`onApi` hands over the embla API; the tweens listen to `scroll` and style each slide by its distance to the selected snap.

#### Parallax

::example{id=carousel-parallax}

#### Scale

::example{id=carousel-scale}

#### Opacity

::example{id=carousel-opacity}

### Miscellaneous examples

#### Progress

A render function child reads `state.scrollProgress()`.

::example{id=carousel-progress}

#### Lazy load

A slide renders its image once it has been in view (`slidesInView`, accumulated); a `Spinner` holds its place.

::example{id=carousel-lazy-load}

#### Infinite scroll

Reaching the last slide loads five more (mocked, up to 20). A custom `watchSlides` re-initialises embla and carries the scroll state over, so a flick keeps its momentum.

::example{id=carousel-infinite-scroll}

#### iOS picker

Vertical, drag-free carousels with embla's translate switched off, drawn as 3D wheels from the scroll progress.

::example{id=carousel-ios-picker}

#### iOS picker loop

::example{id=carousel-ios-picker-loop}

## shadcn/ui examples

The demos of the [shadcn/ui Carousel](https://ui.shadcn.com/docs/components/carousel) page (also embla-based) on the ui Carousel. shadcn's `CarouselPrevious` / `CarouselNext` sit outside the track: `placement="outside"`.

### Demo

::example{id=carousel-shadcn-demo}

### Sizes

shadcn sets `basis-*` on the items; here `--rv-carousel-slide-size` per breakpoint (`md:[--rv-carousel-slide-size:50%] lg:[--rv-carousel-slide-size:33.333%]`).

::example{id=carousel-shadcn-sizes}

### Spacing

shadcn pairs `-ml-*` on the content with `pl-*` on the items; here one variable, `--carousel-gap`.

::example{id=carousel-shadcn-spacing}

### Orientation

`orientation="vertical"` with a `--carousel-height` (shadcn: `h-[200px]` on the content).

::example{id=carousel-shadcn-orientation}

### Options

shadcn's `opts` are the root props here: `align="start"`, `loop`, `dragFree`, … (every embla option).

### API and events

shadcn's `setApi` is `onApi`: it receives the embla API once the engine runs; `api.on("select", …)` follows the selection.

::example{id=carousel-shadcn-api}

### Plugins

shadcn passes `plugins={[Autoplay({ delay: 2000 })]}` and stops / resets it on mouse enter / leave. `autoplay` takes the plugin options; hover already pauses it (W3C APG). Other plugins go in `plugins={() => [ … ]}`.

::example{id=carousel-shadcn-plugin}

### RTL

::example{id=carousel-shadcn-rtl}

## Variants

`carouselVariants` slots: `base`, `viewport`, `content`, `item`, `control`, `previous`, `next`, `rotationControl`, `dots`, `dot`, `thumbnails`, `thumbnail`, `counter`.

- `size`: `sm` | `md` (default) | `lg` — gap, radius, dot and thumbnail size, control button size, vertical height.
- `placement`: `inside` (default; controls over the viewport on the overlay surface, a disabled one fades out) | `outside` (controls beside the viewport).
- `orientation`: `horizontal` (default) | `vertical` (embla `axis: "y"`, up / down chevrons).

Control props: `variant` (Button variant, default `tertiary`) and `size` (default: the carousel's) on `Previous` / `Next` / `RotationControl`.

## CSS variables

| Variable                                             | Default (md)                   | What                                         |
| ---------------------------------------------------- | ------------------------------ | -------------------------------------------- |
| `--rv-carousel-slide-size`                           | `100%`                         | Slide size along the axis (cdk, flex basis). |
| `--carousel-gap`                                     | `1rem`                         | Space between slides.                        |
| `--carousel-radius`                                  | `min(32px, var(--radius-3xl))` | Viewport radius.                             |
| `--carousel-height`                                  | `20rem`                        | Viewport height when vertical.               |
| `--carousel-dot-size` / `--carousel-dot-active-size` | `0.5rem` / `1.5rem`            | Dot / active pill width.                     |
| `--carousel-thumbnail-size`                          | `4rem`                         | Thumbnail size.                              |

## Motion

Slides move with the embla engine (scroll body physics, `duration`, `dragFree`, `skipSnaps`), not CSS transitions. On a resumed page the engine starts on the first interaction (pointer, focus, key), or when the carousel becomes visible if it autoplays or has `plugins` / `onApi` (Fade, AutoHeight and tweens style the slides from the start); until then the server markup is the first snap.

With `prefers-reduced-motion: reduce` (from the cdk) the slides jump instead of animating: buttons, dots, keys, autoplay and the drag release. While you drag, the track still follows the pointer. A change of the setting applies to the next movement.

## Accessibility

W3C APG carousel: `role=region` + `aria-roledescription="carousel"` (give it `aria-label`), slides `aria-roledescription="slide"` labelled "N of M", previous / next labelled "Previous slide" / "Next slide" and disabled at the ends. With `tabs`, dots / thumbnails are a tab list (arrow keys, Home / End) and slides are tab panels. Autoplay pauses on hover and focus; the rotation control is labelled "Stop automatic slide show" / "Start automatic slide show". Arrow keys on the carousel move one snap.

::api{symbol="@rivetjs/ui/carousel#CarouselRootProps"}

## Notes

- Styles: `styles/components/carousel.css`.
- Icons: lucide `ChevronLeft` / `ChevronRight` / `ChevronUp` / `ChevronDown` (flipped for RTL), `Pause` / `Play`.

## Behaviour source

Behaviour: [embla-carousel](https://www.embla-carousel.com) 8.6.0 (MIT) via `@rivetjs/cdk/carousel`.
