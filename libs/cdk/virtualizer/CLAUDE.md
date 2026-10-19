# @rivetjs/cdk/virtualizer
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

React Spectrum virtualizer port: react-stately engine + layouts (List, Grid, Table, Waterfall) and the react-aria / RAC `Virtualizer` component (ScrollView, VirtualizerItem). Server renders the first window; browser runs the engine from the first scroll / focus.

## Entry points
- `@rivetjs/cdk/virtualizer` -> `index.tsx` (explicit package.json entry): `Virtualizer`, `VirtualizerProps` + `export *` from `engine.ts`
- `engine.ts` (no component; importable from plain .ts / node - not a package subpath, reached via the barrel):
  - engine: `VirtualizerEngine` (= core `Virtualizer` class, renamed), `createVirtualizerState`, `Point`, `Size`, `Rect`, `LayoutInfo`, `Layout`, `ReusableView`, `RootView`, `ChildView`, `OverscanManager`, `isSetEqual`
  - layouts: `ListLayout`, `GridLayout`, `WaterfallLayout`, `TableLayout`, `TableColumnLayout`, `calculateColumnSizes`
  - collections: `ListCollection`, `createCollection`, `buildNodes`, `loaderNode`, `getChildNodes`, `createTableCollection`
  - scroll anchor: `ScrollAnchorTracker`, `captureScrollAnchor`, `computeScrollAnchorTarget`, `getEdgeSnapTarget`, `isNearEdge`, `resolveScrollAdjustment`
  - DOM: `createScrollView`, `getRTLOffsetType`, `getScrollLeft`, `setScrollLeft`, `layoutInfoToStyle`, `getSize`, `isElementVisible`, `measureItem`
  - model: `LOADER_KEY`, `initialWindow`, `projectViews`, `VirtualView`, `VirtualizerModel`; types `InvalidationContext`, `DropTarget`, `LayoutDelegate`, `Direction`, …
- `@rivetjs/cdk/virtualizer/behaviour` -> `behaviour.ts`: model + driver (`driverOf`, `visibleViews`, `viewKeys`, `viewOf`, `virtualizerScroll`, `virtualizerFocusIn`, `contentStyle`, `scrollerStyle`)

## Layout
- `index.tsx` - barrel; `virtualizer.tsx` - `<Virtualizer>` + nested `VirtualizerChildren`
- `behaviour.ts` - serializable `VirtualizerModel`, server first window (`initialWindow`), browser driver (one per scroller element, lazy WeakMap; created detached — `runWithOwner(null, …)` — because `createRoot` attaches to the current owner and the first caller may be the rows' `For` `each` binding (`visibleViews` on a resumed page), which disposed the driver's effects on its next run: cdk-docs `virtualizer-items` cold scroll + filter kept dead engine effects, 2026-10-19; story `#filtered` + `tests/virtualizer-browser.test.ts` "reactive items")
- `state.ts` - `createVirtualizerState` (useVirtualizerState; one render effect; holds class instances, browser/test only)
- `virtualizer-core.ts`, `layout.ts`, `layout-info.ts`, `reusable-view.ts`, `overscan-manager.ts`, `scroll-anchor.ts`, `point.ts`, `size.ts`, `rect.ts`, `utils.ts`, `types.ts` - react-stately virtualizer
- `list-layout.ts`, `grid-layout.ts`, `waterfall-layout.ts`, `table-layout.ts`, `table-column-layout.ts` - react-stately layouts / table utils
- `collection.ts`, `table-collection.ts` - minimal Node / Collection adapters from plain arrays
- `dom.ts` - ScrollView / VirtualizerItem / RTL helpers
- tests: `tests/virtualizer-engine.test.ts` (LayoutInfo, GridLayout, virtualized RAC ListBox / GridList / Table / Menu cases), `tests/virtualizer-scroll-anchor.test.ts`, `tests/virtualizer-browser.test.ts` (resumed story), `tests-components/dom-events-collections.test.ts`
- story routes: `tests/app/src/routes/virtualizer.tsx`, `tests-components/app/src/routes/dom-events-collections.tsx`
- docs examples: `apps/cdk-docs/examples/virtualizer-*/`

## Upstream
- react-spectrum `react-stately/src/virtualizer/*`, `react-stately/src/layout/{ListLayout,GridLayout,WaterfallLayout,TableLayout}.ts`, `react-stately/src/table/{TableColumnLayout,TableUtils}.ts`, `react-stately/src/list/ListCollection.ts`, `react-aria/src/virtualizer/{Virtualizer,ScrollView,VirtualizerItem,useVirtualizerItem,utils}`, RAC `Virtualizer.tsx` (Apache-2.0, © Adobe); RTL offset detection from react-window (MIT)
- Deviations (headers): `Rect.intersects` and `getVisibleLayoutInfos` have no jsdom shortcut; view key counter per instance (no module state); `createVirtualizerState` uses signals + one effect; `createScrollView` = useScrollView as a plain controller (no flushSync); collections built from plain arrays (no JSX builder); table collection = one header row, no nested columns; TableColumnLayout without dev warning; drop target types local

## Rules / invariants
- Model is plain signals + JSON + resumable functions; engine instances (classes) live only in the browser - never put them in serializable state
- `layout` prop is a resumable factory (`() => new ListLayout()`), called on server and on first scroll; `layoutOptions` JSON
- `items`: array or accessor (`() => list()`); row accessors given to `children` are local functions (R2 resumability)
- Scroller: `preload="interaction"`, `onScroll` -> `virtualizerScroll`, `onFocusIn` -> `virtualizerFocusIn`; `OWNED` = `onScroll, dir` (virtualizer.tsx:30); caller `onScroll` runs after the virtualizer's
- Views: `div[role=presentation]` with `data-rv-view=<key>`, `data-rv-type=<type>`, absolute `style`; nested children rendered by `VirtualizerChildren`
- Classes: `rv-Virtualizer` (`class`), `rv-Virtualizer-content`, `rv-Virtualizer-item` (`itemClass`)
- `initialSize` (default 800 x 600) must match the scroller's CSS size for a correct server window
- Focused key persisted automatically; `persistedKeys` always rendered; loader sentinel key `LOADER_KEY` when `isLoading` / `onLoadMore`
- Spread element reads every prop up front (virtualizer.tsx:113)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/virtualizer-engine.test.ts libs/cdk/tests/virtualizer-scroll-anchor.test.ts libs/cdk/tests/virtualizer-browser.test.ts`
- `npx vitest run --project cdk-components libs/cdk/tests-components/dom-events-collections.test.ts`

## Gotchas
- Nested views (sections, table rows) render behind a `computed` boolean (`nested()`), not `view().children.length ? …`: the ternary re-ran on every layout pass and re-created nested rows (resumed page: "Missing resumable element" from their stale server bindings) — `tests/virtualizer-sections.browser.test.tsx`. `viewOf` returns a removed row's last descriptor from a per-model cache; the driver's projection seeds it with the views it replaces (`remember`, behaviour.ts), else a resumed page's first scroll / click (no row accessor ran yet) threw `Cannot read properties of undefined (reading 'type')` (same test file)
- `collection.ts` / `table-collection.ts` are stopgaps: headers say replace with `@rivetjs/cdk/collections` once "the cdk-collections branch lands" (collection.ts:4-5, table-collection.ts:3-4) - collections now exist; migration pending
- Scroller sets `onFocusIn` after `{...dom}` but it is not in `OWNED` - user `onFocusIn` may be overridden (virtualizer.tsx:30 vs :136; verify)
- `state.ts` state holds class instances - never serialize / pass across resume

## See also
- [../CLAUDE.md](../CLAUDE.md), [../scrolling/CLAUDE.md](../scrolling/CLAUDE.md) (Angular CDK alternative), [../collections/CLAUDE.md](../collections/CLAUDE.md)
- `apps/cdk-docs/content/foundations/virtualizer.md`
