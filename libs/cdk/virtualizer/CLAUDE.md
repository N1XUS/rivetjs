# @rivetjs/cdk/virtualizer
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

React Spectrum virtualizer port: react-stately engine + layouts (List, Grid, Table, Waterfall) and the react-aria / RAC `Virtualizer` component (ScrollView, VirtualizerItem). Server renders the first window; browser runs the engine from the first scroll / focus. Two modes: standalone (`items` + render function) and collection mode (RAC `CollectionRenderer`: `<CollectionVirtualizer layout={ListLayout}>` around ListBox (+ sections) / GridList / Menu / Tree, `GridLayout` around GridList, `TableLayout` around `Table`; COLLECTION-VIRT 2026-10-19, COLLECTION-VIRT-2 2026-10-19).

## Entry points
- `@rivetjs/cdk/virtualizer` -> `index.tsx` (explicit package.json entry): `Virtualizer`, `VirtualizerProps`, `CollectionVirtualizer`, `CollectionVirtualizerProps` + `export *` from `engine.ts`
- `engine.ts` (no component; importable from plain .ts / node - not a package subpath, reached via the barrel):
  - engine: `VirtualizerEngine` (= core `Virtualizer` class, renamed), `createVirtualizerState`, `Point`, `Size`, `Rect`, `LayoutInfo`, `Layout`, `ReusableView`, `RootView`, `ChildView`, `OverscanManager`, `isSetEqual`
  - layouts: `ListLayout`, `GridLayout`, `WaterfallLayout`, `TableLayout`, `TableColumnLayout`, `calculateColumnSizes`
  - collections: `ListCollection`, `createCollection`, `buildNodes`, `loaderNode`, `getChildNodes`, `createTableCollection`
  - scroll anchor: `ScrollAnchorTracker`, `captureScrollAnchor`, `computeScrollAnchorTarget`, `getEdgeSnapTarget`, `isNearEdge`, `resolveScrollAdjustment`
  - DOM: `createScrollView`, `getRTLOffsetType`, `getScrollLeft`, `setScrollLeft`, `layoutInfoToStyle`, `getSize`, `isElementVisible`, `measureItem`
  - model: `LOADER_KEY`, `initialWindow`, `projectViews`, `VirtualView`, `VirtualizerModel`; types `InvalidationContext`, `DropTarget`, `LayoutDelegate`, `Direction`, …
- `@rivetjs/cdk/virtualizer/behaviour` -> `behaviour.ts`: model + driver (`driverOf`, `visibleViews`, `viewKeys`, `viewOf`, `virtualizerScroll`, `virtualizerFocusIn`, `contentStyle`, `scrollerStyle`)

## Layout
- `index.tsx` - barrel; `virtualizer.tsx` - `<Virtualizer items>` + nested `VirtualizerChildren` (imports nothing from `collections/`: Masonry and items users carry no collection renderer — a dispatching overload cost masonry-expand +19.7 KB min page JS, reverted at intake 2026-10-19); `collection-renderer.tsx` - `<CollectionVirtualizer>` (+ `CollectionVirtualizerProps`): builds a plain `VirtualizerLink` (layout, options, initialSize, dir, root model) and provides `rendererOf(link)` as `CollectionRendererContext`
- `collection-renderer.tsx` - collection mode (RAC Virtualizer.tsx `CollectionRoot` / `CollectionBranch`): `rendererOf(link)` (memo per link; PascalCase factory `VirtualizerRenderer` so its object-literal arrows resume over `link` only), `VirtualizerRoot` / `VirtualizerBranch` Fors (one helper `viewRows`, called inside the region read that creates the For — the Root's For sits in its own `_rBind` site, so the baseline must be taken there; ROW-RERENDER 2026-10-20: `each` = `resumedKeys(source, serverRows(source, order, parentType), order)`, rows read `rowKey(key)`: an adopted view whose node changed since the server window is re-created, `../collections/CLAUDE.md` "Resumed rows") carry `lazy={() => leafViews(views)}` (LAZY-T6: not lazy when a view is a section or has grandchildren, e.g. the Table root window = header + body parts; the body rows For below is the lazy one), `VirtualizerRoot` (host model: `source` = host collection accessor, `focus` = host focused key, `scrollRef`), `VirtualizerBranch` (child views of a part's view: sections, table rows / cells), `VirtualizerView` (wrapper + node part + renderer `Provider`), layout delegate (`layoutRect` / `layoutVisibleRect` / `layoutContentSize`: Page Up / Down), `virtualizerLinkScroll` (host forwards scroll events via `renderer.onScroll`)
- `behaviour.ts` - serializable `VirtualizerModel` (collection mode: `source` / `focus` / `scrollRef`), `rowOrder` (stable DOM order while focus is inside the scroller), `startWhenMounted` (client-only render: engine starts in a microtask once the scroller is connected), server first window (`initialWindow`), browser driver (one per scroller element, lazy WeakMap; created detached — `runWithOwner(null, …)` — because `createRoot` attaches to the current owner and the first caller may be the rows' `For` `each` binding (`visibleViews` on a resumed page), which disposed the driver's effects on its next run: cdk-docs `virtualizer-items` cold scroll + filter kept dead engine effects, 2026-10-19; story `#filtered` + `tests/virtualizer-browser.test.ts` "reactive items")
- `state.ts` - `createVirtualizerState` (useVirtualizerState; one render effect; holds class instances, browser/test only)
- `virtualizer-core.ts`, `layout.ts`, `layout-info.ts`, `reusable-view.ts`, `overscan-manager.ts`, `scroll-anchor.ts`, `point.ts`, `size.ts`, `rect.ts`, `utils.ts`, `types.ts` - react-stately virtualizer
- `list-layout.ts`, `grid-layout.ts`, `waterfall-layout.ts`, `table-layout.ts`, `table-column-layout.ts` - react-stately layouts / table utils
- `collection.ts`, `table-collection.ts` - minimal Node / Collection adapters from plain arrays
- `dom.ts` - ScrollView / VirtualizerItem / RTL helpers
- tests: `tests/virtualizer-engine.test.ts` (LayoutInfo, GridLayout, virtualized RAC ListBox / GridList / Table / Menu cases), `tests/virtualizer-scroll-anchor.test.ts`, `tests/virtualizer-browser.test.ts` (resumed story), `tests-components/dom-events-collections.test.ts`
- collection mode tests: `tests/{listbox,table,grid-list,menu,tree}.browser.test.tsx` ("should support virtualizer" / "<X> virtualizer", RAC ports), `tests-components/virtualized-collections.test.ts` (resumed: server window, cold scroll / click / ArrowDown ×30 / select / End / Home / PageDown on ListBox, ListBox sections, GridList, Menu, Tree, Table)
- story routes: `tests/app/src/routes/virtualizer.tsx`, `tests-components/app/src/routes/dom-events-collections.tsx`, `tests-components/app/src/routes/virtualized-collections.tsx`
- docs examples: `apps/cdk-docs/examples/virtualizer-*/`

## Upstream
- react-spectrum `react-stately/src/virtualizer/*`, `react-stately/src/layout/{ListLayout,GridLayout,WaterfallLayout,TableLayout}.ts`, `react-stately/src/table/{TableColumnLayout,TableUtils}.ts`, `react-stately/src/list/ListCollection.ts`, `react-aria/src/virtualizer/{Virtualizer,ScrollView,VirtualizerItem,useVirtualizerItem,utils}`, RAC `Virtualizer.tsx` (Apache-2.0, © Adobe); RTL offset detection from react-window (MIT)
- Deviations (headers): ListLayout `buildSection` never skips a section header child (a cold-started engine lays out from the scrolled rect; upstream starts at 0); `Rect.intersects` and `getVisibleLayoutInfos` have no jsdom shortcut; view key counter per instance (no module state); `createVirtualizerState` uses signals + one effect; `createScrollView` = useScrollView as a plain controller (no flushSync); collections built from plain arrays (no JSX builder); table collection = one header row, no nested columns; TableColumnLayout without dev warning; drop target types local

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
- Collection mode: `layout` = a class or factory (`LayoutInput<O>`, engine.ts), never an instance (it would be serialized). Host contract (`../collections/components.tsx`): `CollectionRoot({ collection: accessor, scrollRef, focusedKey })`, host forwards its scroller `scroll` to `renderer.onScroll`, sets `isVirtualized` on selection options (no scroll restore / scrollIntoView by the selectable collection), aria-posinset / setsize on items (per section: `itemPosition`, `../collections/nodes.ts`), aria-rowcount / rowindex on tables + grid lists. Hosts that navigate (ListBox, GridList, Menu) build their collection (`builtCollectionOf(instanceKey, content)`, `../collections/components.tsx`); Tree already builds. Menu: DOM-collection adapter gets `state.virtual = { collection, layoutDelegate }` (`../_adapters/selection.ts`: manager over the built collection, focus waits for the row to render — `whenRendered`); the popover / menu element is the scroller
- Parts below the host resolve the renderer from `link` (`rendererOf`), never from context: a resumed page re-creates a part's `CollectionBranch` binding without the server's providers (default renderer → table rows without cells)
- Row DOM order = layout order, except while DOM focus is inside the scroller: kept keys keep their order, new keys append (`rowOrder`). The runtime `For` reconcile moves kept nodes with `replaceChild`, which blurs the focused option (fast ArrowDown lost focus); the view holding DOM focus is persisted too (`persistedOf` → `activeViewKey`)
- `driverOf` needs `scroller.isConnected` (client-only first pass has a detached scroller)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/virtualizer-engine.test.ts libs/cdk/tests/virtualizer-scroll-anchor.test.ts libs/cdk/tests/virtualizer-browser.test.ts`
- `npx vitest run --project cdk-components libs/cdk/tests-components/dom-events-collections.test.ts libs/cdk/tests-components/virtualized-collections.test.ts`
- `npx vitest run --project cdk-browser libs/cdk/tests/listbox.browser.test.tsx libs/cdk/tests/table.browser.test.tsx libs/cdk/tests/grid-list.browser.test.tsx libs/cdk/tests/menu.browser.test.tsx libs/cdk/tests/tree.browser.test.tsx -t virtualizer`

## Gotchas
- Nested views (sections, table rows) render behind a `computed` boolean (`nested()`), not `view().children.length ? …`: the ternary re-ran on every layout pass and re-created nested rows (resumed page: "Missing resumable element" from their stale server bindings) — `tests/virtualizer-sections.browser.test.tsx`. `viewOf` returns a removed row's last descriptor from a per-model cache; the driver's projection seeds it with the views it replaces (`remember`, behaviour.ts), else a resumed page's first scroll / click (no row accessor ran yet) threw `Cannot read properties of undefined (reading 'type')` (same test file)
- `collection.ts` / `table-collection.ts` are stopgaps: headers say replace with `@rivetjs/cdk/collections` once "the cdk-collections branch lands" (collection.ts:4-5, table-collection.ts:3-4) - collections now exist; migration pending
- Scroller sets `onFocusIn` after `{...dom}` but it is not in `OWNED` - user `onFocusIn` may be overridden (virtualizer.tsx:30 vs :136; verify)
- `state.ts` state holds class instances - never serialize / pass across resume
- Collection mode resumability: a host closure built as a conditional arrow (`v ? () => … : undefined`) or assigned by index (`attrs[k] = () => …`) is not a `_rFn` and fails silently or with "function is not serializable" on resume — use local const arrows / object-literal arrows (`Object.assign(attrs, { … })`)
- Not covered: Table column resizing inside a Virtualizer, a Virtualizer around a Select / ComboBox popover ListBox (an Autocomplete-filtered popover ListBox works: ui-docs `autocomplete-virtualization`, server window + cold wheel + filter + select; keyboard virtual focus after `fill` is broken there without the Virtualizer too), load-more items in virtualized GridList / Tree / Menu
- Section headers: ListLayout keeps a header rendered while any row of its section is visible (`isVisible` includes `header`); no `position: sticky` (RAC sets none on ListLayout either)
- Content has `pointer-events: none` for ~300 ms after a scroll (isScrolling): tests clicking right after a scroll wait
- `initialSize` must be the scroll container's client box (padding included, scrollbar excluded): a resumed page keeps the server window at `initialSize` until its first interaction, a client render measures at mount (story `/virtualized-collections`: 240 × 320 lists with the theme's 4px padding = 248 × 328; fuzz finding 2026-10-19).
- Open (runtime, fuzz pin `/virtualized-collections` recreated): a section view's nested `For` (`VirtualizerBranch`) reads `views` on the server inside the root `For`'s row, so the first engine start re-creates the section and its rows on a resumed page.

## See also
- [../CLAUDE.md](../CLAUDE.md), [../scrolling/CLAUDE.md](../scrolling/CLAUDE.md) (Angular CDK alternative), [../collections/CLAUDE.md](../collections/CLAUDE.md)
- `apps/cdk-docs/content/foundations/virtualizer.md`
