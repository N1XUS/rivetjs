# libs/cdk/resizable

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`@rivetjs/cdk/resizable` — port of react-resizable-panels 4.14.3 (MIT, © Brian Vaughn): resizable panel groups / split panes (WAI-ARIA window splitter). No React Aria / Angular CDK equivalent.

## Files

- `engine/**` — upstream `lib/global/**` (non-test) + helpers (`utils/`, `vendor/stacking-order.ts` = upstream fork of stacking-order 2.0.0, `components/group/*` sort / storage-key helpers, `components/{group,panel}/types.ts` framework-free types). Kept as upstream (framework-free); only `.ts` import specifiers, React / csstype types removed (`global/types.ts`, `global/cursor/getCursorStyle.ts`), `utils/parseNumericStyleValue.ts` dropped (React-only). Do not edit for Rivet reasons — adapt in `mount.ts`.
- `mount.ts` — effect bodies of upstream Group / Panel / ResizeSeparator / useResizePreviews / ResizePreview / SeparatorClone / SeparatorOverlayRenderer: `GroupState` / `PanelRecord` / `SeparatorRecord` (serializable records the components push during render), `ensureGroup` (mount / re-mount when DOM members changed, `MutationObserver` childList → `requestMount`), `activateGroup` / `groupPointerDown` / `separatorKeyDown` (resumed boot + replay), `panelMethods` / `groupMethods` (imperative handles), DOM-built resize previews.
- `index.tsx` — public API: `Group`, `Panel`, `Separator`, `SeparatorOverlay`, `GroupContext`, `useGroupRef`, `usePanelRef`, `useGroupCallbackRef`, `usePanelCallbackRef`, `useDefaultLayout`, `cookieStorage` (Rivet), `isCoarsePointer`, types.

## API (upstream v4 names)

- `Group`: `orientation` (`horizontal` default), `defaultLayout` (id → %), `onLayoutChange` (every change, also during drags), `onLayoutChanged` (committed; `meta.isUserInteraction`), `groupRef`, `disabled`, `disableCursor`, `resizePreviewMode` (`"separator"` previews), `resizeTargetMinimumSize`, `elementRef`, `class` / `style`.
- `Panel`: `id`, `defaultSize`, `minSize`, `maxSize`, `collapsible`, `collapsedSize`, `collapsedThreshold`, `groupResizeBehavior`, `disabled`, `onResize(size, id, prevSize)`, `panelRef`; sizes = number (px) / `"30%"` / `"200px"` / `"2rem"` / `"10vw"` …; unitless string = %.
- `Separator`: `id`, `disabled`, `disableDoubleClick`, `preview` (function), `class` / `style`; `data-separator` = `inactive` / `hover` / `active` / `focus` / `disabled`; `aria-valuenow` etc. after mount. Must be a direct child of its Group.
- `useDefaultLayout({ id, storage?, panelIds?, debounceSaveMs?, onlySaveAfterUserInteractions? })` → `{ defaultLayout: accessor, onLayoutChange, onLayoutChanged }`; key `react-resizable-panels:<id>` (upstream). Storage default = `localStorage` (client only, `@rivetjs/cdk/storage` `webStorage`). Reads / writes go through `readStorage` / `writeStorage` (COLD-FIX-B 2026-10-27): a throwing storage (iOS private mode `QuotaExceededError`, blocked cookies) keeps the layout in memory, no `console.error` (upstream logs one per failed save).
- `cookieStorage(cookieHeader | cookieMap)` (Rivet): server-readable storage (`ssr: true`) → server renders the stored layout, no client restore effect.

## Rivet rulings (2026-10-08)

- v4 names kept (`Group` / `Panel` / `Separator`, `orientation`, `defaultLayout`, `onLayoutChange(d)`), incl. `use*` hook names (cdk "no `use*`" rule waived: they are the upstream public API).
- SSR: `defaultLayout` → `flex-grow`, else `defaultSize` → `flex-basis` (unitless → `%`; upstream emits invalid unitless flex-basis), else `flex-grow: 1` — no layout shift.
- Resumed page: nothing boots at load (no `fx`; `preload="visible"` on group + separators). Boot: separator `pointerover` / `focus` → mount; `keydown` → mount + replay; group `pointerdown` → mount when on its own separator / non-mouse / group without separators, replayed once per event in a microtask (nested groups). Imperative handle calls mount on demand.
- `useDefaultLayout` with browser-only storage restores the stored layout in an idle `clientEffect` (sets `data-boot`); `cookieStorage` skips it.
- Marker attributes `data-group` / `data-panel` render `"true"`; default classes `rv-ResizableGroup` / `rv-ResizablePanel` (inner element) / `rv-ResizableSeparator`.
- Separator `tabindex` is a lowercase spread key (resumed spread diff rule).
- User `onPointerDown` / `onFocus` / `onBlur` / `onKeyDown` / `onPointerOver` chained (upstream overrides focus / blur).

## Tests

- `tests/resizable/**` (project `cdk-browser`, Chromium): upstream engine suite mirrored from `lib/**/*.test.ts` + `lib/{global,utils}/test/*` helpers + `setup.ts` (upstream `vitest.setup.ts`, imported by each file). 408 tests. `utils/test/events.ts` = browser EventEmitter stand-in; `isViableHitTarget` `:modal` fallback mocks the throw (Chromium supports `:modal`).
- `tests/resizable.browser.test.tsx` (client render: mount + keyboard), `tests/resizable-ssr.test.ts` (markup, sizes, cookie layout, serialization).
- `tests-components/resizable.test.ts` + story `/resizable` (+ `resizable.server.ts` cookie loader): cold page boots nothing, cold focus + arrow keys, cold hover + CDP mouse drag, nested vertical group, imperative collapse, cookie round trip.

## Gaps

- `Grid` / `Cell` / `Gridline` (v4.14 2D grid layouts, `useDefaultGridLayout`) not ported.
- Upstream component suites (`Group.test.tsx`, `Panel.test.tsx`, `Separator.test.tsx`, `useDefaultLayout.test.tsx`, `ResizePreview.test.tsx`; React Testing Library) not ported yet — behaviour covered by the engine suite + the Rivet tests above.
- Resumed page: implicit panel-edge hover cursor (groups without separators) appears only after the first pointer down.
- Props read once: `orientation`, `resizePreviewMode`, panel sizes / `collapsible`, `id` (upstream re-registers on change); accessors for `disabled` / `disableCursor` / `defaultLayout`.

- ID-RESUME (2026-10-27): generated Group / Panel / Separator ids use the shared `resumedId()` keyed-signal helper. Separators' `aria-controls` (`aria().valueControls`) and the panel records keep the server ids when parts adopt independently; explicit ids and upstream resize behaviour stay unchanged.
