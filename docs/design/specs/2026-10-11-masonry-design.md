# Masonry + Bento design (`@rivetjs/cdk/masonry`, `@rivetjs/ui/masonry`)

Status: approved by lane brief MASONRY 2026-10-11 (orchestrator); refinements below are the lane's rulings.
Rivet-authored: no upstream in React Aria / RAC / Angular CDK; HeroUI v3.2.6 has none (ui wrapper clean-room, HeroUI tokens).
Semantics follow RA GridList (`role="grid"` > `row` > `gridcell`, `layout="grid"` 2D keys, selection modes); virtualized
mode reuses the cdk `Virtualizer` engine (react-stately port) with `WaterfallLayout`.

## Goals
- Pinterest-style masonry (cards, image mosaics) and bento grids (dashboard tiles, feature highlights).
- Server-exact: known item sizes → final placement in the SSR markup: zero CLS, zero JS to paint, nothing boots on a
  resumed page until an interaction (exact mode).
- Responsive without a stylesheet: Rivet JSX has no `<style>` content (CSP), so breakpoints are inline CSS math.
- Perf: server placement of 1,000 items < 1 ms; measured client reflow of 1,000 items in one frame (< 16 ms).

## API (data-driven, like `data-grid`)
Ruling: items are data + one render function, not JSX `Masonry.Item` parts — server placement needs every ratio / span
before any item renders, and a collection build pass would double the work. Per-item layout data comes from accessors.
```tsx
<Masonry items={photos} getAspectRatio={(p) => p.width / p.height} columns={{ 0: 2, 640: 3, 1024: 4 }} gap={12}
  selectionMode="multiple" onAction={(key) => open(key)} aria-label="Photos">
  {(photo, item) => <img src={photo.src} alt={photo.alt} />}
</Masonry>
<Bento items={tiles} columns={{ 0: 2, 768: 4 }} rowHeight={140} gap={16} getColSpan={(t) => t.w} getRowSpan={(t) => t.h}>
  {(tile) => <Card {...tile} />}
</Bento>
```
Shared props (`MasonryBaseProps`): `items` (array | accessor | Signal), `children(item, state)` (`state`: `key`, `index()`,
`isSelected()`, `isDisabled()`), `getKey` (default `id` → `key` → index), `columns` (number | `{ minWidth: count }`
container-width map; default `{ 0: 2, 640: 3, 1024: 4 }`), `minItemWidth` + `maxColumns` (derived map), `gap` (number |
`[column, row]`, default 16), `selectionMode` / `selectionBehavior` / `selectedKeys` (value | Signal | accessor) /
`defaultSelectedKeys` / `onSelectionChange` / `disabledKeys` / `disallowEmptySelection`, `onAction(key)`,
`onLoadMore` / `isLoading` / `renderLoader`, `renderEmptyState`, `semantics` (`"grid"` default | `"list"`), `aria-*`, `id`,
`class` / `style` / `gridClass` / `itemClass` (string | `(state) => string`), every `GlobalDOMAttributes` (root).
- Masonry: `getAspectRatio(item)` (default `aspectRatio`, else `width / height`; `null` = unknown), `extraItemHeight`
  (px added to every item: caption rows), `layout` (`"auto"` | `"exact"` | `"measure"`), `virtualize` + `height` +
  `initialSize` + `overscan`.
- Bento: `getColSpan` / `getRowSpan` (number | breakpoint map; default `colSpan` / `rowSpan` fields, 1; clamped to the
  column count), `rowHeight` (px, default 160 | `{ aspectRatio }` = column width / ratio | `"auto"`), `pack`
  (`"dense"` default | `"skyline"`).

## DOM
```html
<div class="rv-Masonry" data-rv-masonry data-layout="exact" style="container-type:inline-size">   (root: container)
  <div role="grid" class="rv-Masonry-grid" tabindex="0" aria-multiselectable style="position:relative;height:…;--rv-w0:…">
    <div role="row" class="rv-Masonry-item" data-key="a" aria-selected tabindex="-1" style="position:absolute;…">
      <div role="gridcell">…children(item, state)…</div></div> …
  </div>
  <div class="rv-Masonry-loader" data-load-more>…renderLoader()…</div>
</div>
```
`semantics="list"`: `role="list"` / `role="listitem"` (no gridcell, no arrow keys, no selection). Bento: same tree with
`rv-Bento*` classes, `aria-rowindex` / `aria-colindex` + `aria-rowspan`-free spans (placement is known).

## Placement (pure, `masonry/layout.ts`, DOM-free, shared server / client / virtual layout)
- Breakpoints: `columns` map → sorted `[{ min, n }]` (min rounded to px; first min forced to 0). `minItemWidth m` →
  `n` columns from `n·m + (n−1)·gap` px, `n ≤ maxColumns` (default 4).
- Column width per breakpoint `w_b = (W − (n_b − 1)·gapX) / n_b`, `W` = root content width = `100cqw` (root is an
  `inline-size` container; children resolve `cqw` against it).
- Masonry greedy (shortest column, ties → lowest index): item height `h = α·w + β` (exact: `α = 1/ratio`,
  `β = extraItemHeight`; measured: `α = 0`, `β = px`). Each column keeps `A = Σα`, `B = Σ(β + gapY)`; the item gets
  `col`, `top = A·w + B`; columns compare at a deterministic reference width per breakpoint (midpoint of its range,
  ≥ 320 px; override `referenceWidth`), so the assignment is identical on server and client and never reflows on
  resize (positions scale; only gap weighting is approximated).
- Bento packers on a cell grid (`n_b` columns, rows of `rowHeight`): `dense` = first fit in row-major order (backfills
  holes = CSS `grid-auto-flow: row dense`, checked against Chromium's own placement in a browser test); `skyline` =
  lowest-then-leftmost drop on the column skyline (no backfill under wide tiles: visual order follows reading order).
  Spans clamp to `n_b`. Output `{ row, col, rowSpan, colSpan }` per breakpoint + total rows.

## Breakpoints without a stylesheet (masked `max()`)
- Root grid defines per breakpoint `--rv-w<b>` = `w_b − M_b`, `M_b = clamp(0px, (min_b − 100cqw)·1e9, 1e9px) +
  clamp(0px, (100cqw − min_{b+1} + 0.01px)·1e9, 1e9px)`: exact column width inside the breakpoint's range, ≈ −1e9 px
  outside (container widths are 1/64 px multiples; the 0.01 px shift keeps both edges exact).
- Every geometry value is linear in `w`: item `top = max(calc(A_b·var(--rv-w<b>) + B_b − var(--rv-m<b>)) …)`, likewise
  `inset-inline-start`, width (`--rv-mw = max(var(--rv-w0), …)`), Bento heights / tops; `max()` picks the active
  breakpoint, inactive terms are ≈ −1e9. One breakpoint → plain `calc()` (no masks). Logical `inset-inline-start` =
  RTL for free. Cost: ~100 B / item / breakpoint before compression (repetitive: br ≈ 8×).
- Measured first paint: CSS multi-column (`column-width: calc(var(--rv-mw) − 0.01px)` = exactly `n_b` columns at the
  final column width, `break-inside: avoid`), so measured heights equal final heights and the reflow only moves items.

## Modes
- `exact` (auto when every ratio is known): server placement, styles inline, items `aspect-ratio` (or `height:
  calc(w/ratio + extra)`); no effect, nothing boots (`preload="visible"` root: handler chunks fetched on view).
- `measure` (any unknown ratio): CSS columns first paint, then one `clientEffect` (`visible`): read root width + all
  item heights (one layout), greedy in px, write `transform: translate()` + width per item and the grid height (one
  write phase); ResizeObserver on root + items → one rAF-batched relayout (reads, then writes; never interleaved).
- `virtualize`: cdk `Virtualizer` with `MasonryLayout` (extends `WaterfallLayout`: exact rects from `layout.ts` when
  ratios are known; stock estimate + `updateItemSize` measurement otherwise); server renders the `initialSize` window.

## Interaction (delegated on the grid; `behaviour.ts`, no per-item closures)
- One tab stop: grid `tabIndex=0` until focus is inside (focus → last focused / first item), items `tabIndex=-1`.
- Arrows = visual 2D navigation over item rects (DOM rects at key time; virtual: `layout.ts` rects): Up / Down nearest
  item above / below with horizontal overlap; Left / Right nearest in the adjacent column by vertical overlap
  (WaterfallLayout `getKeyRightOf` metric); Home / End (± Ctrl) first / last; PageUp / PageDown one viewport.
- Selection (RA useSelectableItem): Space toggles; click toggles (`toggle`) or replaces (`replace`, Ctrl / Cmd toggles);
  Shift + click / Shift + arrow range in reading order from the anchor; Ctrl / Cmd + A all; Escape clears (unless
  `disallowEmptySelection`); Enter / double click (replace) → `onAction`, click → `onAction` when `selectionMode="none"`.
- `data-focused` / `data-focus-visible` written by handlers; `data-selected` / `aria-selected` / `data-disabled` bound.

## Resumability
- Handlers inline arrows over a plain context object; module defaults referenced inside arrows; `.ts` modules never
  import `@rivetjs/runtime/dom` (`clientEffect` + `For` live in `index.tsx`); keyed `For` rows (`by` key) adopt server rows.
- Placement + style strings are one computed over items (cut-off per row by key); exact mode registers no effect.

## Perf targets / measurement
- `layout.ts`: 1,000 items × 3 breakpoints placement + style strings < 1 ms (Node, `masonry-layout` probe); SSR 1,000
  items render time recorded; dom-bench `masonry` scenario: mount 1k exact, measured reflow 1k (< 16 ms), select-all.
- Note vs masonry.js (DOM reads per item + absolute px, JS required, CLS), react-masonry-css (column buckets: round-robin
  order, no shortest-column), CSS columns (column-major reading order), CSS `grid-lanes` (not baseline yet).

## Test plan
- node `tests/masonry-layout.test.ts`: breakpoints, greedy determinism, reference widths, Bento dense / skyline, spans,
  CSS terms; `tests/masonry-ssr.test.ts`: resume-mode markup, styles, ARIA, list semantics, serializes.
- Chromium `tests/masonry.browser.test.tsx`: exact positions at 3 widths (CSS math = JS), measured reflow + resize,
  keyboard 2D, selection, onAction, load more, Bento dense = native CSS grid dense placement, virtualized 10k.
- Resumed story `tests-components/masonry.test.ts`: nothing boots, keys + selection after resume.

## Gaps (accepted)
- No typeahead, no drag reorder (drag-drop is list-based; WaterfallLayout drops are "on" only), no sections.
- Virtualized + unknown sizes: arrow keys move among rendered views only.

## Phase 2 (2026-10-11, coordinator rulings)

- Rule: sizes known → the server lays out in ALL modes (columns, justified, Bento): ratio, `width` / `height` (`?image`), or `getItemHeight`; server CSS per breakpoint; client re-places with the same pure functions. Unknown → measured; mixed list → known prefix server-placed (`data-layout="mixed"`), suffix measured under it.
- `geometry.ts`: all layouts emit per-breakpoint linear boxes (`k·u + c`, max term sets pruned over the unit range); one CSS writer.
- Justified rows (`justified.ts`): flickr/justified-layout 4.1.0 port (MIT, NOTICE); `rowHeight` (Responsive), tolerance, min / max, `lastRow` fill (default, flush) / justify / left / center; `JUSTIFIED_SPLITS` keep row heights near target; virtual mode supported.
- Spans (`getSpan`), `fit="both"`, per-breakpoint `gap` (`--rv-gx`), `masonrySizes` for `?image` srcset.
- Item controls: accessor readers → incremental re-place (CHECKPOINT 32), unchanged items keep their style object; FLIP on cdk Motion1D (`motion` options / `false`, reduced motion jumps); `handleRef` relayout / scrollToItem / getPosition.
- Measured mode: one RO (root `contentBoxSize`, items `borderBoxSize`) + MutationObserver, one rAF read → layout → write, zero layout reads after the first write.
- Pending (battery stop): dom-bench justified + resize Layout count, timed bench report `docs/benchmarks/2026-10-11-masonry.md`.
