---
title: Bento
description: "Headless bento grid from @rivetjs/cdk: tiles with column and row spans packed on the server (dense or skyline), responsive spans, grid keys and selection."
template: guide
status: experimental
related: [components/masonry, components/grid-list, foundations/selection]
---

`Bento` is a uniform grid of tiles that span several columns and rows: dashboards, feature highlights, portfolio boards. The packing runs on the server and the tiles are positioned with inline CSS, so the page paints in its final layout and nothing runs at load. With `rowHeight="auto"` the browser lays the tiles out as a native CSS grid sized by their content.

Rivet addition: no React Aria / Angular CDK counterpart. `Bento` shares the collection, selection, keyboard and render-function model of [Masonry](./masonry.md) (both come from `@rivetjs/cdk/masonry`). `@rivetjs/ui/masonry` exports the HeroUI-styled version.

::example{id=bento-dashboard}

## Anatomy

```html
<div class="rv-Bento" data-rv-masonry data-layout="dense" style="container-type:inline-size">
  <div class="rv-Bento-grid" role="grid" aria-label="Dashboard" tabindex="0" data-rv-grid style="--rv-w0:…;position:relative;height:…">
    <div class="rv-Bento-item" role="row" data-rv-item data-key="revenue" tabindex="-1" aria-rowindex="1"
         style="position:absolute;top:0px;inset-inline-start:0px;width:…;height:230px">
      <div role="gridcell" aria-colindex="1">…</div>
    </div>
  </div>
</div>
```

The classes are `rv-Bento`, `rv-Bento-grid`, `rv-Bento-item`, `rv-Bento-loader`; the data attributes are those of [Masonry](./masonry.md#anatomy). `data-layout` is the packing: `dense`, `skyline` or `auto`.

## Import

```tsx
import { Bento } from "@rivetjs/cdk/masonry";
```

## Tiles

```tsx
<Bento items={tiles} columns={{ 0: 2, 640: 4 }} rowHeight={120} aria-label="Dashboard">
  {(tile) => <Card {...tile} />}
</Bento>
```

- `getColSpan(item)` / `getRowSpan(item)`: default `item.colSpan` / `item.rowSpan`, else 1. A span is a number or a map from container width to span (`{ 0: 1, 640: 2 }`). Spans wider than the grid are clamped to the column count.
- `columns`: a number or a width map. Default 4.
- `rowHeight`: px per row (default 160), `{ aspectRatio }` (rows as tall as a column is wide ÷ the ratio), or `"auto"`.
- `gap`: px, one value or `[column, row]`. Default 16.
- `pack`:
  - `"dense"` (default): row by row, every tile in the first free place that fits, holes filled by later tiles. It is the same placement as CSS `grid-auto-flow: row dense`.
  - `"skyline"`: each tile drops into the lowest column run that fits, leftmost first, without backfilling earlier rows. It keeps the visual order closer to the reading order.

The packing never changes the DOM order: the keys and screen readers follow the item order, `aria-rowindex` / `aria-colindex` give the visual cell (with a single column count).

::example{id=bento-features}

`rowHeight="auto"`: a native CSS grid (`grid-auto-flow: dense`) where each row is as tall as its content. Spans resolve at the smallest breakpoint, so a tile spans at most the smallest column count.

## Props

`Bento` takes the shared props of [Masonry](./masonry.md#props) (`items`, `children`, `getKey`, `columns`, `minItemWidth`, `maxColumns`, `gap`, selection, `disabledKeys`, `onAction`, `onLoadMore`, `isLoading`, `renderLoader`, `renderEmptyState`, `semantics`, classes, `aria-*`) plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `getColSpan` | `(item: T) => number \| Record<number, number>` | `item.colSpan` / 1 | Read once (the reader). |
| `getRowSpan` | `(item: T) => number \| Record<number, number>` | `item.rowSpan` / 1 | Read once (the reader). |
| `rowHeight` | `number \| { aspectRatio: number } \| "auto"` | `160` | Live (px / aspect); switching to or from `"auto"` is read once (native grid vs placed tiles). |
| `pack` | `"dense" \| "skyline"` | `"dense"` | Ignored with `rowHeight="auto"` (the browser packs dense). Live. |
| `maxWidth` | `number` | — | Root `max-width` in px; breakpoints at or above it never apply. Live. |

## Keyboard, styling, accessibility

As [Masonry](./masonry.md#keyboard-and-selection): one tab stop, arrow keys by visual position across spans, Space / Enter / Shift / Ctrl+A / Escape for selection and actions. Style the `rv-Bento*` classes and `data-selected` / `data-focus-visible` / `data-disabled`; do not override the inline position and size of the tiles.

## Resumability

The packing and the positions come from the server; a resumed page runs no bento code before the first interaction; its code is fetched when the browser is idle after the load, or on intent ([preloading](site:docs/guides/performance/preloading/)).

## Upstream

None: Rivet-authored. Not supported: drag to reorder, tiles that resize with their content outside `rowHeight="auto"`.
