---
title: Scrolling
description: "Angular CDK scrolling for Rivet: virtual scroll viewport (fixed-size and autosize strategies), ScrollDispatcher, CdkScrollable, ViewportRuler, RTL helpers."
template: guide
status: experimental
related: [foundations/virtualizer, foundations/overlays, foundations/utilities]
---

`@rivetjs/cdk/scrolling` provides a virtual scroll viewport that renders only the items in view, with the fixed-size strategy and the experimental autosize strategy, plus the scroll utilities behind it (`ScrollDispatcher`, `CdkScrollable`, `ViewportRuler`, RTL scroll normalization). The components share a state object created by `createVirtualScroll`.

- **Server**: `createVirtualScroll` runs the real strategy against a measurement model (scroll offset 0, `initialViewportSize`, estimated item sizes) and renders the first range.
- **Browser**: no library code runs until the first `scroll`, `wheel`, `pointerdown`, `focusin` or `keydown` on the viewport. That interaction creates the viewport engine, which takes over from the server range.
- Styles: import `@rivetjs/cdk/scrolling.css` (the CDK's viewport styles).

::example{id=scrolling-fixed}

For layout-driven virtualization (grids, masonry, sections, measured rows) see [Virtualizer](./virtualizer.md).

## Anatomy

```html
<div id="fixed" class="cdk-virtual-scroll-viewport cdk-virtual-scrollable cdk-virtual-scroll-orientation-vertical viewport"
     data-rv-virtual-viewport="" aria-label="Items">
  <div class="cdk-virtual-scroll-content-wrapper" style="transform: translateY(0px)">
    <template data-rv-vfor="fixed"></template>
    <div class="row">Item #0</div>
    <!-- … the rendered range -->
    <template data-rv-vfor-end=""></template>
  </div>
  <div class="cdk-virtual-scroll-spacer" style="height: 400000px"></div>
</div>
```

| Part | Element | Classes | Notes |
| --- | --- | --- | --- |
| Viewport | `div` | `cdk-virtual-scroll-viewport`, `cdk-virtual-scrollable` (only when it scrolls itself), `cdk-virtual-scroll-orientation-vertical` / `-horizontal`, then `class` | `id` = `state.id`, `aria-label` = `label`, `data-rv-virtual-viewport` |
| Content wrapper | `div` | `cdk-virtual-scroll-content-wrapper` | `transform: translateY(<offset>px)` (or `translateX`; negative in RTL) |
| Row markers | `template` | | `data-rv-vfor="<id>"` / `data-rv-vfor-end`: the engine measures the rows between them. |
| Spacer | `div` | `cdk-virtual-scroll-spacer` | `height` (or `width`) = total content size. |
| Scrollable ancestor | `div` | `cdk-virtual-scrollable`, then `class` | `CdkVirtualScrollableElement`: `data-rv-virtual-scrollable` |

- `.cdk-virtual-scrollable` sets `contain: strict`, so the viewport needs an explicit size.
- Each row should have one root element: the engine measures rows by their root nodes.

## Import

```ts
import { createVirtualScroll, CdkVirtualScrollViewport, CdkVirtualForOf, scrollToIndex } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";
```

## createVirtualScroll

`createVirtualScroll(options)` returns the `VirtualScrollState` that `CdkVirtualScrollViewport`, `CdkVirtualForOf` and `CdkVirtualScrollableElement` share. Call it in the component and keep it in a `const`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `Signal<readonly T[]> \| readonly T[]` | (required) | The data (Angular `cdkVirtualForOf`). A signal is live: length changes re-render. |
| `itemSize` | `number` | `20` | Fixed item size in px (Angular `itemSize`). Ignored with `autosize`. |
| `autosize` | `boolean` | `false` | The autosize strategy (cdk-experimental `autosize`) for items of unknown size. |
| `minBufferPx` | `number` | `100` | Minimum buffer beyond the viewport in px; below it more items render. |
| `maxBufferPx` | `number` | `200` | Buffer to render when rendering more, in px. Must be `>= minBufferPx` (throws otherwise). |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | Scroll axis. |
| `appendOnly` | `boolean` | `false` | Keep rendered items in the DOM after they scroll out. |
| `scrollable` | `"self" \| "window" \| "element"` | `"self"` | Scroll container: the viewport, the window (Angular `scrollWindow`), or the nearest `CdkVirtualScrollableElement` ancestor. |
| `templateCacheSize` | `number` | none | Accepted for parity (`cdkVirtualForTemplateCacheSize`); rows are keyed, nothing is cached. |
| `initialViewportSize` | `number` | `0` | Viewport size in px assumed for the server range (`0`: just the buffer). Match the CSS size. |
| `id` | `string` | `createId()` | Viewport element id. |

The state (`VirtualScrollState<T>`):

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Viewport id. |
| `items` | `Signal<readonly T[]>` | The data (an array is wrapped in a signal). |
| `range` | `Signal<ListRange>` | Rendered range: rows `[start, end)` are in the DOM. |
| `totalSize` | `Signal<number>` | Total content size in px (the spacer). |
| `transform` | `Signal<string>` | Content wrapper transform. |
| `offset` | `Signal<number>` | Offset of the rendered content in px. |
| `itemSize`, `autosize`, `minBufferPx`, `maxBufferPx`, `orientation`, `appendOnly`, `scrollable` | | The resolved options. |

## CdkVirtualScrollViewport

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `state` | `VirtualScrollState<T>` | (required) | From `createVirtualScroll`. |
| `children` | `(item: () => T, context: CdkVirtualForOfContext) => …` or content | none | A row template (Angular `<div *cdkVirtualFor>` directly in the viewport). Or content holding a `CdkVirtualForOf` under a native element (`<ul>`, `<tbody>`). |
| `trackBy` | `(index: number, item: T) => unknown` | the item | Row identity for a row-template child (absolute index). |
| `class` | `string` | none | Appended to the `cdk-virtual-scroll-*` classes. |
| `label` | `string` | none | `aria-label` of the viewport. |
| `onScrolledIndexChange` | `(index: number) => void` | none | Index of the first visible item (fixed strategy only; Angular `scrolledIndexChange`). |
| `onRenderedRangeChange` | `(range: ListRange) => void` | none | Rendered range changes (Angular `renderedRangeStream`). |
| Global DOM props | `GlobalDOMAttributes<HTMLDivElement>` | none | Forwarded to the viewport. See [DOM events and attributes](#dom-events-and-attributes). |

`CdkVirtualForOfContext` (row context; accessors, Angular `CdkVirtualForOfContext`):

| Field | Type | Description |
| --- | --- | --- |
| `index` | `() => number` | Absolute index in the data. |
| `count` | `() => number` | Number of items. |
| `first`, `last` | `() => boolean` | First / last item of the data. |
| `even`, `odd` | `() => boolean` | Index parity. |

### Events

| Event | Type | When |
| --- | --- | --- |
| `onScrolledIndexChange` | `(index: number) => void` | The first visible index changes (fixed strategy; queued in a microtask). Not available with `autosize`. |
| `onRenderedRangeChange` | `(range: ListRange) => void` | The engine renders a new range (not called for the server range). |

## CdkVirtualForOf

Renders the rendered range of `state.items` as keyed rows. Place it under a native element so it gets its own update region (`<ul>`, `<tbody>`, `<div>`). Directly inside the viewport, pass the row template as the viewport's child instead.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `state` | `VirtualScrollState<T>` | (required) | The viewport's state. |
| `trackBy` | `(index: number, item: T) => unknown` | the item | Item identity (absolute index). |
| `children` | `(item: () => T, context: CdkVirtualForOfContext) => …` | (required) | Row template, one root element per row. |

## Fixed-size strategy

With `itemSize`, the range is computed from the scroll offset alone. The first visible index is `floor(offset / itemSize)`. Rows are rendered from the first visible index minus the buffer, and the total size is `items.length * itemSize`. Each row must be exactly `itemSize` px along the scroll axis (borders and margins included).

## Autosize strategy

`autosize: true` (cdk-experimental) renders items of unknown size. It averages the measured size of the rendered rows (`ItemSizeAverager`, 50 px before any sample) to estimate the rest, and corrects the offset a little on each scroll when scrolling back. `scrollToIndex` and `onScrolledIndexChange` are not supported with autosize (they throw, as upstream).

::example{id=scrolling-autosize}

## Scrolling programmatically

`scrollToIndex(state, index, behavior?)` and `scrollToOffset(state, offset, behavior?)` work from any event handler. They create the viewport's engine on first use. `behavior` is a `ScrollBehavior` (`"auto"` or `"smooth"`). In horizontal RTL the offset is measured from the start (right) edge.

::example{id=scrolling-scroll-to}

## Rendered range and data changes

`onRenderedRangeChange` reports each new range. `state.range()` is a signal you can read in the page. When `items` is a signal, growing or shrinking it updates the spacer and keeps the range valid.

::example{id=scrolling-range-events}

## Horizontal and RTL

`orientation: "horizontal"` virtualizes along x: the spacer gets a `width` and the wrapper uses `translateX`. Lay rows out in a row yourself (for example `display: flex` on the wrapper). Inside `dir="rtl"`, the content is translated negatively and the `start` offset is measured from the right.

::example{id=scrolling-horizontal}

## appendOnly

`appendOnly` keeps rows rendered once they have been shown: the range always starts at 0 and the wrapper is never translated. Use it when rows are expensive to create and the list is not huge.

::example{id=scrolling-append-only}

## Scroll containers

### A scrolling ancestor

`scrollable: "element"` lets an ancestor scroll the list together with other content (Angular `cdkVirtualScrollingElement`). Wrap it in `CdkVirtualScrollableElement` and pass the states of the viewports it contains: its `scroll` event starts their engines. The viewport measures its offset inside the ancestor.

| Prop | Type | Description |
| --- | --- | --- |
| `states` | `readonly VirtualScrollState<any>[]` | Viewports scrolled by this element. |
| `id`, `class` | `string` | Element id; class appended to `cdk-virtual-scrollable`. |
| `children` | content | The content, including the viewports. |
| Global DOM props | `GlobalDOMAttributes<HTMLDivElement>` | Forwarded; `onScroll` runs after its own handler. |

::example{id=scrolling-element}

### The window

`scrollable: "window"` virtualizes against the page scroll (Angular `scrollWindow`). The viewport does not scroll itself: it is as tall as its content, and a document `scroll` listener starts the engine.

::example{id=scrolling-window}

### Tables

`CdkVirtualForOf` under a `<tbody>` renders only the rendered range of `<tr>` rows. The table moves with the content wrapper.

::example{id=scrolling-table}

## ScrollDispatcher and CdkScrollable

`scrollDispatcher(document?)` returns the per-document `ScrollDispatcher` (the Angular root service). `new CdkScrollable(element).init()` registers an element with it (the Angular `cdkScrollable` directive). Call `destroy()` to deregister. Both are browser-side: create them in an event handler or an effect.

| `ScrollDispatcher` member | Description |
| --- | --- |
| `register(target)` / `deregister(target)` | Add / remove a scrollable; its scroll events are re-emitted by `scrolled()`. |
| `scrolled(auditTimeInMs = 20)` | Stream of the scrolled target (or `undefined` for the document). `0`: no throttle. A global `document` scroll listener exists while subscribed. On the server it completes at once. |
| `ancestorScrolled(element, auditTimeInMs?)` | Like `scrolled()`, only for registered ancestors of `element` (and the document). |
| `getAncestorScrollContainers(element)` | Registered containers that contain `element`. |
| `scrollContainers` | `Map` of registered targets and their subscriptions. |
| `destroy()` | Remove the listener, deregister everything, complete `scrolled()`. |

| `CdkScrollable` member | Description |
| --- | --- |
| `new CdkScrollable(element, { dir?, dispatcher? })` | `dir`: a direction or accessor (default: read from the `dir` ancestry). `dispatcher`: default the document's. |
| `init()` / `destroy()` | Start listening and register / stop and deregister (Angular `ngOnInit` / `ngOnDestroy`). |
| `elementScrolled()` | Stream of the element's scroll events. |
| `getElementRef()` | `{ nativeElement }`. |
| `scrollTo(options)` | `ExtendedScrollToOptions`: `top` / `bottom`, `left` / `right` (physical), `start` / `end` (logical), `behavior`. |
| `measureScrollOffset(edge)` | Distance from `top`, `bottom`, `left`, `right`, `start` or `end`, normalized for RTL. |
| `dir` | `{ value: "ltr" \| "rtl" }`. |

`CdkVirtualScrollable` (abstract, adds `measureViewportSize(orientation)` and `measureBoundingClientRectWithScrollOffset(edge)`), `CdkVirtualScrollableElementRef` (the class behind `CdkVirtualScrollableElement`) and `CdkVirtualScrollableWindow` are the scroll containers of virtual scroll viewports.

::example{id=scrolling-dispatcher}

## RTL scroll normalization

Browsers disagree on `scrollLeft` in RTL containers. `getRtlScrollAxisType()` probes once and returns `RtlScrollAxisType.NORMAL`, `NEGATED` (Chromium, as the example shows) or `INVERTED`. `CdkScrollable.scrollTo` and `measureScrollOffset` use it, so `start` / `end` mean the same thing everywhere. `supportsScrollBehavior()` tells whether `scrollTo({ behavior })` works.

::example{id=scrolling-rtl}

## ViewportRuler

`viewportRuler(document?)` returns the per-document `ViewportRuler`.

| Member | Description |
| --- | --- |
| `getViewportSize()` | `{ width, height }` of the window (cached while `change()` has subscribers). |
| `getViewportScrollPosition()` | `{ top, left }` page scroll (from the document element's rect). `{0, 0}` on the server. |
| `getViewportRect()` | `{ top, left, bottom, right, width, height }`. |
| `change(throttleTime = 20)` | Stream of `resize` / `orientationchange` events, throttled. Window listeners exist while subscribed. |
| `destroy()` | Remove listeners, complete `change()`. |

`DEFAULT_RESIZE_TIME` (20) and `DEFAULT_SCROLL_TIME` (20) are the default throttles.

::example{id=scrolling-viewport-ruler}

## DOM events and attributes

`CdkVirtualScrollViewport` and `CdkVirtualScrollableElement` accept the global DOM props of `libs/cdk/utils/dom-props.ts` and forward them to their element. These are mouse, pointer, touch, wheel, animation and transition events (with their `…Capture` variants), and `dir`, `lang`, `hidden`, `inert` and `translate`.

- The viewport owns `onScroll`, `onWheel` and `onPointerDown`: its handler (which starts the engine) runs first, then yours. It also listens to `focusin` and `keydown`.
- `CdkVirtualScrollableElement` owns `onScroll` the same way.
- `on*Capture` handlers do not resume yet.

::example{id=scrolling-dom-events}

## Styling

| Selector | Element |
| --- | --- |
| `.cdk-virtual-scroll-viewport` | The viewport (`display: block; position: relative`). |
| `.cdk-virtual-scrollable` | The scrolling element (`overflow: auto; contain: strict`): the viewport, or a `CdkVirtualScrollableElement`. |
| `.cdk-virtual-scroll-orientation-vertical` / `-horizontal` | The viewport, by orientation. |
| `.cdk-virtual-scroll-content-wrapper` | The translated row container. |
| `.cdk-virtual-scroll-spacer` | The element that sizes the scroll area. |

- `@rivetjs/cdk/scrolling.css` is required: it positions the wrapper and the spacer. In Tailwind, import it into the `rivet` layer: `@import "@rivetjs/cdk/scrolling.css" layer(rivet);`.
- The fixed-size strategy needs rows of exactly `itemSize`; style rows with a fixed height (margins included).

### Tailwind

::example{id=scrolling-tailwind}

### Plain CSS

::example{id=scrolling-css}

## Accessibility

- The viewport is a plain `div` with `aria-label`. Put list semantics on your content (`<ul role="list">` with `CdkVirtualForOf`, or `role="list"` / `listitem` on rows).
- In Chromium the viewport is keyboard-focusable as a scroller when its rows have no focusable content, so :kbd[ArrowDown], :kbd[PageDown], :kbd[Home] and :kbd[End] scroll it. There is no `tabIndex` prop.
- Only the rendered range is in the accessibility tree. Set `aria-setsize` / `aria-posinset` from the row context when the full size should be announced.

## Resumability

- **Before interaction**: the server range is plain HTML. The viewport resumes on `scroll`, `wheel`, `pointerdown`, `focusin` and `keydown`; `scrollable: "window"` adds a document `scroll` listener.
- `createVirtualScroll` must run in the component; keep the state in a `const`. Callbacks are component props (`onScrolledIndexChange`, `onRenderedRangeChange`), not state options.
- Row templates are render functions; `trackBy` can be any function.
- `items` is written into the page with the component's state: keep it compact.

### Known limitations

- **Autosize engine started at offset 0**: when the autosize viewport is first woken by focus, a key, a pointer down or a wheel before it has scrolled, the server range equals the engine's first range, so the strategy never measures the rendered content. Later scrolls then do not update the range. Waking it with a scroll to a non-zero offset (a scrollbar drag, or setting `scrollTop`) works. The autosize example does that.

## Strategies and engine API

| Export | Kind | Description |
| --- | --- | --- |
| `FixedSizeVirtualScrollStrategy` | class | `new FixedSizeVirtualScrollStrategy(itemSize, minBufferPx, maxBufferPx)`; `updateItemAndBufferSize(...)`, `scrolledIndexChange`. |
| `AutoSizeVirtualScrollStrategy`, `ItemSizeAverager` | classes | Autosize strategy (`updateBufferSize`) and its size estimate (`getAverageItemSize`, `addSample`, `reset`). |
| `VirtualScrollStrategy`, `VirtualScrollStrategyViewport` | types | Strategy contract and the viewport API a strategy drives. |
| `createStrategy(state)` | function | The strategy for a state's options. |
| `ListRange`, `rangesEqual` | type, function | `{ start, end }` (end exclusive) and equality. |
| `VirtualScrollModel` | class | The server measurement model (offset 0, estimated sizes) that `createVirtualScroll` runs. |
| `contentTransform(orientation, offset, rtl?, toEnd?)` | function | The wrapper transform string. |
| `virtualScrollViewport(state, element?, callbacks?)` | function | The engine of a viewport (`VirtualScrollViewport`), created and attached on first call in the browser. |
| `VirtualScrollViewport` | class | Angular `CdkVirtualScrollViewport` methods: `scrollToIndex`, `scrollToOffset`, `getRenderedRange`, `getDataLength`, `getViewportSize`, `measureScrollOffset`, `measureViewportOffset`, `measureRenderedContentSize`, `measureRangeSize`, `checkViewportSize`, `setTotalContentSize`, `setRenderedRange`, `setRenderedContentOffset`, `renderedRangeStream`, `renderedContentOffset`, `scrolledIndexChange`, `destroy`. |
| `scrollToIndex`, `scrollToOffset` | functions | Scroll a state's viewport. |
| `Emitter`, `stream`, `auditTime`, `distinct`, `filter` | class, functions | Minimal push streams replacing RxJS (types `Stream`, `Subscription`, `Observer`). |
| `RtlScrollAxisType`, `getRtlScrollAxisType`, `supportsScrollBehavior`, `_setRtlScrollAxisType` | const, functions | RTL scroll detection (the last one is a test hook). |
| Types | | `VirtualScrollOptions`, `VirtualScrollState`, `VirtualScrollCallbacks`, `Orientation`, `CdkVirtualScrollViewportProps`, `CdkVirtualForOfProps`, `CdkVirtualForOfContext`, `ExtendedScrollToOptions`, `ScrollableOptions`, `ScrollEdge`, `ScrollDispatcherTarget`, `ViewportScrollPosition`. |

## Upstream

- Angular Components `src/cdk/scrolling`: `CdkVirtualScrollViewport`, `CdkVirtualForOf`, `CdkFixedSizeVirtualScroll`, `CdkVirtualScrollableElement`, `CdkVirtualScrollableWindow`, `CdkScrollable`, `ScrollDispatcher`, `ViewportRuler`, `virtual-scroll-viewport.scss`.
- `src/cdk-experimental/scrolling`: `AutoSizeVirtualScrollStrategy`, `ItemSizeAverager`.
- `src/cdk/platform/features/scrolling`: `getRtlScrollAxisType`, `supportsScrollBehavior`.
- Deviations:
  - No DI or NgZone. The directives' inputs are `createVirtualScroll` options, the viewport and its rows share state explicitly, and services are per-document functions.
  - RxJS is replaced by `Stream` (`Emitter`, `auditTime`).
  - The engine is created lazily on the first interaction, never on the server. The server range comes from the strategy run against a measurement model.
  - Rows are keyed (`trackBy`, default the item); there is no template cache.

## Not yet supported

- `DataSource` / Observable data for `cdkVirtualForOf` (arrays and signals only).
- Changing `itemSize`, `minBufferPx` or `maxBufferPx` after creation (the options are fixed in the state; `FixedSizeVirtualScrollStrategy.updateItemAndBufferSize` exists on the strategy).
- `scrolledIndexChange` and `scrollToIndex` with `autosize` (as upstream).
- A `tabIndex` prop on the viewport, and keyboard navigation between rows.
- The `ScrollingModule` / directive forms: `cdkScrollable` is `new CdkScrollable(element).init()`.
