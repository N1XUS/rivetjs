# @rivetjs/cdk/scrolling
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Angular CDK scrolling port: virtual scroll viewport (fixed + autosize strategies), ScrollDispatcher, ViewportRuler, CdkScrollable. Server renders the first range; the browser engine starts on first interaction (zero JS before).

## Entry points
- `@rivetjs/cdk/scrolling` -> `index.tsx` (explicit package.json entry):
  - components: `CdkVirtualScrollViewport`, `CdkVirtualForOf`, `CdkVirtualScrollableElement`; types `CdkVirtualScrollViewportProps`, `CdkVirtualForOfProps`, `CdkVirtualForOfContext`
  - state: `createVirtualScroll`, `createStrategy`, `contentTransform`, `VirtualScrollModel`; types `VirtualScrollOptions`, `VirtualScrollState`, `VirtualScrollCallbacks`, `Orientation` (re-exported from `../collections/types.ts`)
  - engine: `VirtualScrollViewport`, `virtualScrollViewport(state, el?, callbacks?)`, `scrollToIndex`, `scrollToOffset`
  - strategies: `FixedSizeVirtualScrollStrategy`, `AutoSizeVirtualScrollStrategy`, `ItemSizeAverager`, `rangesEqual`, `ListRange`, `VirtualScrollStrategy`, `VirtualScrollStrategyViewport`
  - services: `ScrollDispatcher` / `scrollDispatcher(doc?)`, `DEFAULT_SCROLL_TIME`, `ViewportRuler` / `viewportRuler(doc?)`, `DEFAULT_RESIZE_TIME`
  - scrollables: `CdkScrollable`, `CdkVirtualScrollable`, `CdkVirtualScrollableElementRef` (class `CdkVirtualScrollableElement` renamed to avoid the component name), `CdkVirtualScrollableWindow`
  - RTL: `RtlScrollAxisType`, `getRtlScrollAxisType`, `supportsScrollBehavior`, `_setRtlScrollAxisType` (test hook)
  - streams: `Emitter`, `stream`, `auditTime`, `distinct`, `filter`, types `Stream`, `Subscription`, `Observer`
- `@rivetjs/cdk/scrolling/behaviour` -> `behaviour.ts`: `viewportInteract(state, event?, callbacks?)` (lazy engine start)
- `@rivetjs/cdk/scrolling.css` -> `scrolling.css` (virtual-scroll-viewport.scss port)

## Layout
- `index.tsx` - barrel
- `viewport.tsx` - `<CdkVirtualScrollViewport>`, `<CdkVirtualForOf>`, `<CdkVirtualScrollableElement>`
- `state.ts` - serializable `VirtualScrollState` (signals: `items`, `range`, `totalSize`, `transform`, `offset`) + server `VirtualScrollModel` (runs the real strategy for the first range)
- `virtual-scroll-viewport.ts` - browser engine (Angular viewport + measuring half of virtual-for-of), one per state (WeakMap)
- `fixed-size-virtual-scroll.ts`, `auto-size-virtual-scroll.ts` (cdk-experimental), `virtual-scroll-strategy.ts` - strategies
- `scroll-dispatcher.ts`, `viewport-ruler.ts`, `scrollable.ts`, `rtl.ts` (from cdk/platform), `emitter.ts` (RxJS replacement, also used by drag-drop), `behaviour.ts`, `scrolling.css`
- tests: `tests/scrolling-unit.test.ts` (strategies, server model, streams), `tests/scrolling-engine.test.ts` (Angular specs in Chromium via `tests/fixtures/scrolling-mount.ts`), `tests/scrolling-browser.test.ts` (resumed story), `tests-components/dom-events-collections.test.ts` (global DOM props)
- story routes: `tests/app/src/routes/scrolling.tsx`, `scrolling-window.tsx`; `tests-components/app/src/routes/dom-events-collections.tsx`
- docs examples: `apps/cdk-docs/examples/scrolling-*/`

## Upstream
- angular/components `src/cdk/scrolling/{virtual-scroll-viewport,virtual-for-of,virtual-scroll-strategy,fixed-size-virtual-scroll,scroll-dispatcher,viewport-ruler,scrollable,virtual-scrollable*}.ts`, `virtual-scroll-viewport.{html,scss}`, `src/cdk-experimental/scrolling/auto-size-virtual-scroll.ts`, `src/cdk/platform/features/scrolling.ts` (MIT, © Google LLC)
- Deviations (headers): no DI / NgZone - per-document lazy singletons (`scrollDispatcher()`, `viewportRuler()`); RxJS -> `Stream` (emitter.ts); directive inputs -> `createVirtualScroll` options (itemSize 20, minBufferPx 100, maxBufferPx 200; autosize 100/200); strategies are plain objects (no token); ViewportRuler window listeners added on first `change()` subscription (Angular: construction); Angular change-detection loop kept as microtask steps; scrollables are plain classes (`new CdkScrollable(el)` + `init()` / `destroy()`), direction from `dir` attributes; RTL server -> NORMAL

## Rules / invariants
- State shared explicitly between viewport and `CdkVirtualForOf` (children render before parent: no DI)
- Engine never on server; created on first scroll / wheel / pointerdown / focusin / keydown (`viewportInteract`); window scrolling uses a `document:onScroll` listener on a hidden span
- `OWNED` = `onScroll, onWheel, onPointerDown` (viewport.tsx:17); `SCROLLABLE_OWNED` = `onScroll` (:18): engine wake first, then user handler
- Callbacks (`onScrolledIndexChange`, `onRenderedRangeChange`) are component props, not state options: a `const` with inline functions is re-created on the client from its symbol and would detach the state's signals (state.ts:60-63)
- Scrolled index handover (2026-10-08): the engine keeps the latest index (`_scrolledIndex`) and delivers it in a microtask (`deliverScrolledIndex`); `virtualScrollViewport()` handing over new callbacks delivers an index they missed (an API `scrollToIndex` before the component's callbacks attached — resumed page, scrolling-scroll-to). Test `tests/scrolling-engine.test.ts` "callbacks handed over after an API scroll".
- Row template child (`children` is a function) renders straight in the content wrapper between `<template data-rv-vfor>` markers; otherwise `CdkVirtualForOf` under a native element (`<ul>`, `<tbody>`) gets its own update region
- Rows keyed by `trackBy(absoluteIndex, item)` or item identity; `templateCacheSize` accepted for parity only
- Markup: `.cdk-virtual-scroll-viewport` (+ `cdk-virtual-scrollable`, `cdk-virtual-scroll-orientation-*`), `data-rv-virtual-viewport`, `.cdk-virtual-scroll-content-wrapper` (inline `transform`), `.cdk-virtual-scroll-spacer` (inline size); scrollable element `data-rv-virtual-scrollable`
- `initialViewportSize` sets the server-rendered range (default 0: buffer only)
- Spread elements read every prop up front (viewport.tsx:50, :171)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/scrolling-unit.test.ts libs/cdk/tests/scrolling-engine.test.ts libs/cdk/tests/scrolling-browser.test.ts`
- `npx vitest run --project cdk-components libs/cdk/tests-components/dom-events-collections.test.ts`

## Gotchas
- `CdkVirtualScrollViewport` tells a row template (`(item, context) => …`) from plain content with `typeof children === "function" && !isSlot(children)` (`viewport.tsx`); plain content renders via `renderSlot`
- Layout depends on `scrolling.css` classes (positioning, overflow, contain) - import `@rivetjs/cdk/scrolling.css`; unlike the package rule, these behaviour styles are class-keyed (Angular-faithful)
- Viewport sets `onFocusIn` / `onKeyDown` after `{...dom}` but they are not in `OWNED` - user handlers for those may be overridden (viewport.tsx:17 vs :85-86; verify)
- A `For` inside a conditional gets no update region (queued compiler work) - row-template `For` must stay directly in the wrapper (viewport.tsx:89-90)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../virtualizer/CLAUDE.md](../virtualizer/CLAUDE.md) (React Spectrum alternative), [../drag-drop/CLAUDE.md](../drag-drop/CLAUDE.md) (uses emitter / viewport-ruler)
- `apps/cdk-docs/content/foundations/scrolling.md`
