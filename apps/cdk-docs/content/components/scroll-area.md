---
title: ScrollArea
description: ScrollArea from @rivetjs/cdk/scroll-area keeps native scrolling and draws custom, stylable scrollbars that mirror it (Radix UI port).
template: guide
status: experimental
related: [foundations/scrolling, foundations/bidi, foundations/observers]
---

`ScrollArea` augments native scrolling for custom, cross-browser styling. The viewport scrolls natively: wheel, touch, keyboard and scroll anchoring stay the browser's. The native scrollbars are hidden. Custom scrollbars mirror the viewport's scroll metrics: the thumb size comes from the viewport-to-content ratio and its position from the scroll offset. You can drag the thumb, click the track, or turn the wheel over a scrollbar. This is a port of [Radix UI Primitives ScrollArea](https://www.radix-ui.com/primitives/docs/components/scroll-area) 1.3.0.

::example{id=scroll-area-basic}

## Features

- Scrolling stays native: the browser does it, with all its usual behaviour.
- Native scrollbars are hidden; the custom ones take any styling.
- Four visibility types, the same as the macOS scrollbar preferences: `auto`, `always`, `scroll`, `hover`.
- Thumb drag, track click, and the wheel over a scrollbar.
- RTL, from `dir` or a `<Dir>` ancestor.
- Resumable: the server renders the content, and it scrolls natively. `hover` / `scroll` areas load no JavaScript until the pointer enters, a scroll or a focus reaches them; `auto` / `always` areas measure when they come into view.

## Anatomy

```html
<div dir="ltr" class="rv-ScrollArea" style="position:relative;--rv-scroll-area-corner-width:0px;--rv-scroll-area-corner-height:0px">
  <div data-rv-scroll-area-viewport="" class="rv-ScrollAreaViewport" style="scrollbar-width:none;overflow-x:hidden;overflow-y:scroll">
    <div class="rv-ScrollAreaContent" style="min-width:100%;display:table">…content…</div>
  </div>
  <div data-orientation="vertical" data-state="visible" class="rv-ScrollAreaScrollbar" style="position:absolute;top:0;right:0;bottom:var(--rv-scroll-area-corner-height);--rv-scroll-area-thumb-height:40px">
    <div data-state="visible" class="rv-ScrollAreaThumb" style="width:var(--rv-scroll-area-thumb-width);height:var(--rv-scroll-area-thumb-height);transform:translate3d(0, 0px, 0)"></div>
  </div>
  <div data-orientation="horizontal" data-state="visible" class="rv-ScrollAreaScrollbar">…</div>
  <div class="rv-ScrollAreaCorner" style="width:10px;height:10px;position:absolute;right:0;bottom:0"></div>
</div>
```

| Part | Element | Default class | Data attributes |
| --- | --- | --- | --- |
| `ScrollArea` (`Root`) | `<div dir>` | `rv-ScrollArea` | — |
| `ScrollAreaViewport` (`Viewport`) | `<div>` | `rv-ScrollAreaViewport` | `data-rv-scroll-area-viewport` |
| `ScrollAreaContent` (`Content`) | `<div>`, implicit unless `disableImplicitContentElement` | `rv-ScrollAreaContent` | — |
| `ScrollAreaScrollbar` (`Scrollbar`) | `<div>` | `rv-ScrollAreaScrollbar` | `data-orientation`, `data-state` |
| `ScrollAreaThumb` (`Thumb`) | `<div>` | `rv-ScrollAreaThumb` | `data-state` |
| `ScrollAreaCorner` (`Corner`) | `<div>`, while both scrollbars render (not with `type="scroll"`) | `rv-ScrollAreaCorner` | — |

## Import

```ts
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner } from "@rivetjs/cdk/scroll-area";
// or the Radix part names
import * as ScrollAreaParts from "@rivetjs/cdk/scroll-area"; // ScrollAreaParts.Root, .Viewport, .Content, .Scrollbar, .Thumb, .Corner
```

```tsx
<ScrollArea>
  <ScrollAreaViewport>…</ScrollAreaViewport>
  <ScrollAreaScrollbar orientation="vertical">
    <ScrollAreaThumb />
  </ScrollAreaScrollbar>
  <ScrollAreaScrollbar orientation="horizontal">
    <ScrollAreaThumb />
  </ScrollAreaScrollbar>
  <ScrollAreaCorner />
</ScrollArea>
```

## API

Every part renders a `<div>` and accepts every `<div>` attribute and event (Radix `Primitive.div`). Each part also takes `class` (it replaces the default `rv-*` class), `style`, `ref` (a `ref()` signal, a callback or `{ current }`), `render` (see [Render](#render)) and `children`.

### ScrollArea

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `type` | `"auto" \| "always" \| "scroll" \| "hover"` | `"hover"` | Scrollbar visibility; see [Types](#types). |
| `scrollHideDelay` | `number` | `600` | With `scroll` / `hover`: milliseconds before the scrollbars hide after the user stops interacting. |
| `dir` | `"ltr" \| "rtl"` | the nearest `<Dir>`, else `"ltr"` | Reading direction; rendered as the `dir` attribute. |

| CSS variable (set on the root) | Value |
| --- | --- |
| `--rv-scroll-area-corner-width` | width of the vertical scrollbar while the corner renders (`0px` otherwise) |
| `--rv-scroll-area-corner-height` | height of the horizontal scrollbar while the corner renders |

### ScrollAreaViewport

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `nonce` | `string` | `<meta name="csp-nonce">` | CSP nonce of the `<style>` with the `::-webkit-scrollbar` rule. |
| `disableImplicitContentElement` | `boolean` | `false` | Renders the children directly; put a `<ScrollAreaContent>` inside yourself (Radix: the implicit wrapper goes away in the next major). |

The viewport gets `overflow-x` / `overflow-y: scroll` on an axis that has a scrollbar, `hidden` on the others. Before the area is active (server, resumed page) both axes are `scroll`.

### ScrollAreaContent

The measured content. It has `min-width: 100%; display: table`, so it matches the size of its children on both axes and a change in scroll size re-measures the thumbs. The viewport renders it for you unless it has `disableImplicitContentElement`.

### ScrollAreaScrollbar

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | |
| `forceMount` | `true` | none | Keeps it mounted while hidden (`data-state="hidden"`), e.g. for animation libraries. With `type="hover"` the overflow still decides, as in Radix. |

| Data attribute | Values |
| --- | --- |
| `data-orientation` | `vertical` / `horizontal` |
| `data-state` | `visible` / `hidden` |

| CSS variable (set on the scrollbar) | Value |
| --- | --- |
| `--rv-scroll-area-thumb-height` (vertical) / `--rv-scroll-area-thumb-width` (horizontal) | thumb length: `(scrollbar − padding) × viewport / content`, at least 18 px |

### ScrollAreaThumb

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `forceMount` | `true` | none | Mounted even when nothing overflows (`data-state="hidden"`). |

`data-state`: `visible` while the content overflows the viewport, else `hidden`. The thumb is moved with `transform: translate3d(…)`.

### ScrollAreaCorner

Renders where the scrollbars meet, while both render, and sizes itself from them. It is not rendered with `type="scroll"`.

## Types

`type` sets when scrollbars are visible:

| `type` | Scrollbars visible |
| --- | --- |
| `auto` | while the content overflows on that axis |
| `always` | always, overflow or not (rendered on the server) |
| `scroll` | while the user scrolls on that axis or the pointer is over the scrollbar; hidden `scrollHideDelay` ms after |
| `hover` (default) | while the pointer is over the scroll area, and the content overflows; hidden `scrollHideDelay` ms after it leaves |

::example{id=scroll-area-types}

A hidden scrollbar unmounts. If its `data-state="hidden"` style starts a CSS animation, it stays mounted until the animation ends (Radix `Presence`).

## Horizontal scrolling and the corner

Add a horizontal scrollbar, plus a `ScrollAreaCorner` to fill the square where the two meet. The scrollbars leave room for the corner through the `--rv-scroll-area-corner-*` variables on the root.

::example{id=scroll-area-tailwind}

## Direction

With `dir="rtl"` (or inside `<Dir dir="rtl">` from `@rivetjs/cdk/bidi-dir`), the vertical scrollbar sits on the left. The horizontal thumb starts at the right and follows the negative `scrollLeft` of RTL scrolling.

## Render

`render` replaces a part's `<div>` with your own element. This is the Rivet form of Radix `asChild`, and every part supports it. It receives the part's attributes: `ref`, `class`, `style` (with the behaviour-critical declarations), `data-*`, handlers and `children`, with reactive entries as accessors. Spread them onto the element you return. Write `render` as an inline arrow so it stays resumable.

```tsx
<ScrollAreaViewport render={(props) => <section {...(props as {})} />}>…</ScrollAreaViewport>
```

## DOM events and attributes

- Every attribute and event you pass lands on the part's element.
- `ScrollAreaScrollbar` handles `onPointerDown` / `onPointerMove` / `onPointerUp` (thumb drag and track click) and, with `type="scroll"`, `onPointerEnter` / `onPointerLeave`. `ScrollAreaThumb` handles `onPointerDown` / `onPointerUp`.
- Your handler runs first. Call `event.preventDefault()` to skip the part's own (Radix `composeEventHandlers`).
- `ScrollArea` also handles `onPointerEnter` / `onWheel` / `onFocusIn`, and `ScrollAreaViewport` handles `onScroll`, to activate the area on a resumed page. Yours run first; these never skip.
- The wheel over a scrollbar uses a non-passive `document` listener: inside the scroll range it scrolls the viewport and prevents the page scroll.

## Styling

Style the `rv-*` classes, or your own `class`, together with `data-orientation` / `data-state`. Size the thumb with `flex: 1` inside a `display: flex` scrollbar (`flex-direction: column` for horizontal). Its length comes from the `--rv-scroll-area-thumb-*` variable, which the thumb's inline `width` / `height` read. Positioning, the overflow axes and the hidden native scrollbars are inline styles, so your classes cannot break them.

```css
.rv-ScrollAreaScrollbar {
  display: flex;
  padding: 2px;
  user-select: none;
  touch-action: none;
}
.rv-ScrollAreaScrollbar[data-orientation="vertical"] {
  width: 10px;
}
.rv-ScrollAreaScrollbar[data-orientation="horizontal"] {
  flex-direction: column;
  height: 10px;
}
.rv-ScrollAreaThumb {
  flex: 1;
  border-radius: 10px;
  background: #64748b;
}
```

The native scrollbars are hidden by inline `scrollbar-width: none`. One nonce'd stylesheet per document adds `[data-rv-scroll-area-viewport]::-webkit-scrollbar { display: none }` for WebKit versions without `scrollbar-width`.

## Accessibility

The scrolling stays the browser's. Keyboard scrolling (arrows, :kbd[PageDown], :kbd[Space], :kbd[Home] / :kbd[End]) works when the viewport or an element inside it has focus. Screen readers and find-in-page work too. The custom scrollbars are presentational `<div>`s for pointer users: they have no role and are not focusable, as in Radix. For keyboard-only users, give the viewport `tabindex="0"` and an `aria-label` when nothing inside it is focusable. In most cases native scrolling styled with CSS is enough; use `ScrollArea` when you need more control over the scrollbars than CSS gives.

## Resumability

- The server renders the root, viewport and content. Both overflow axes are `scroll` there, so the content scrolls natively before any script runs. `type="always"` scrollbars render too, without thumbs; `hover` / `scroll` / `auto` scrollbars do not.
- On a resumed page the area is inactive and runs no scroll-area code. It activates on the first `pointerenter`, `wheel` or `focusin` on the root, or `scroll` of the viewport. `auto` / `always` areas also activate when the root comes into view, because their first frame depends on measuring. On activation the scrollbars render, enable their axes, measure and show the thumbs. From then on the behaviour is Radix's.
- The activating event is not lost. A `hover` area activated by the pointer shows its scrollbars at once. A `scroll` area activated by a scroll shows the scrolled axis.
- The activation handlers resume with `preload="visible"`: their code is fetched when the area comes into view and runs only on the activating event. On a slow network (150 ms RTT, 4x CPU), the first hover shows the thumb in about 0.12 s; with nothing fetched before the event it took about 1.5 s. With `render` on the root or the viewport, put `preload="visible"` on your element to keep this.
- Part state (visibility, measures, presence) is component-owned, so it survives the part's first run in the browser.
- Handlers you pass follow the usual rule: inline arrows or local consts.

## Upstream

- Port of `@radix-ui/react-scroll-area` 1.3.0 (Root, Viewport, Content, Scrollbar, Thumb, Corner), with `@radix-ui/react-presence` for the scrollbar / thumb exit animations. Radix's `scroll-area.test.tsx` is ported in `libs/cdk/tests/scroll-area.browser.test.tsx`.
- Deviations:
  - The CSS variables are renamed: `--radix-scroll-area-thumb-width` / `-height` / `-corner-width` / `-corner-height` → `--rv-scroll-area-*`. The viewport attribute `data-radix-scroll-area-viewport` → `data-rv-scroll-area-viewport`.
  - The native-scrollbar hiding is inline on the viewport, plus one nonce'd `::-webkit-scrollbar` stylesheet per document, inserted on the client. Radix renders a `<style>` next to every viewport; Rivet JSX has no `<style>` content.
  - `asChild` → `render`. The `asChild` single-child warning has no equivalent.
  - The thumb records where the pointer grabbed it in a bubbling `pointerdown`, not `onPointerDownCapture`. Capture handlers do not resume yet. It still runs before the scrollbar's handler.
  - The thumb's scroll-tracking animation-frame loop stops when the thumb unmounts. Radix leaves it running.
  - With `type="scroll"`, the scroll-end timer is not cleared on unmount, so a part that resume re-creates keeps its timer.
  - `type`, `dir`, `scrollHideDelay`, `orientation`, `forceMount` and `nonce` are read when the part is created.
  - Until a resumed area activates, both viewport axes scroll (Radix: `hidden` until the scrollbars mount). An axis without a scrollbar switches to `hidden` on activation and keeps any offset it scrolled to.
  - A client render is active from the start, so it matches Radix exactly.
  - The Radix `DirectionProvider` is the cdk `<Dir>`.
