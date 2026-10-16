---
title: Bento
description: "A bento grid: tiles that span columns and rows, packed by the server into a gap-free grid, with keys, selection and actions."
template: reference
status: experimental
related: [components/masonry, components/card, components/kpi]
---

`Bento` is a grid of tiles that span several columns and rows: dashboards, feature sections, portfolios. The server packs the tiles (like CSS grid's dense flow) and writes their positions, so nothing shifts and no script runs at load.

Accessibility: the same grid model as [Masonry](/components/masonry/): one tab stop, arrow keys by visual position across spans, the DOM order stays the data order. Name it with `aria-label`.

## Usage

```tsx
import { Bento } from "@rivetjs/ui/masonry";
```

::example{id=bento-usage}

- Each tile spans `colSpan` columns and `rowSpan` rows (or `getColSpan` / `getRowSpan`); a span is a number or a map from container width to span.
- `rowHeight` sets the row height in px (default 160) or `{ aspectRatio }` (square-ish rows that scale with the width).
- `pack="dense"` (default) fills holes with later tiles; `pack="skyline"` keeps the visual order closer to the reading order.
- Put a [Card](/components/card/) or any content in the render function; the tile is the focusable, selectable surface.

## Feature highlights

::example{id=bento-features}

`rowHeight="auto"` lets the browser lay the tiles out as a native CSS grid, each row as tall as its content. Spans resolve at the smallest column count.

## Styling Reference

### CSS Classes

- `.bento` - The root.
- `.bento__grid` - The grid element.
- `.bento__item` - One tile: rounded corners, focus and selected rings.
- `.bento__loader` / `.bento__empty` - Loader and empty-state rows.

### CSS Variables

| Variable         | Default                        | Description         |
| ---------------- | ------------------------------ | ------------------- |
| `--bento-radius` | `min(28px, var(--radius-3xl))` | Tile corner radius |

### Data Attributes

- `[data-slot="bento"]` on the root; `[data-layout]`: `dense`, `skyline` or `auto`.
- Tile: `[data-selected]`, `[data-focus-visible]`, `[data-disabled]`, `aria-rowindex` / `aria-colindex` (one column count).

## API Reference

### Bento

`Bento` takes the props of [Masonry](/components/masonry/#api-reference) except the masonry sizing (`getAspectRatio`, `extraItemHeight`, `layout`, `virtualize`), plus:

| Prop         | Type                                              | Default         | Description                        |
| ------------ | ------------------------------------------------- | --------------- | ---------------------------------- |
| `getColSpan` | `(item: T) => number \| Record<number, number>`   | `item.colSpan`  | Columns a tile spans               |
| `getRowSpan` | `(item: T) => number \| Record<number, number>`   | `item.rowSpan`  | Rows a tile spans                  |
| `columns`    | `number` \| `Record<number, number>`              | `4`             | Column count, or per container width |
| `rowHeight`  | `number` \| `{ aspectRatio: number }` \| `"auto"` | `160`           | Row height                         |
| `pack`       | `"dense"` \| `"skyline"`                          | `"dense"`       | Packing                            |

## Related Components

- [Masonry](/components/masonry/): Items of different heights in columns.
- [Card](/components/card/): Content surface for tiles.
- [KPI](/components/kpi/): Metric tiles.
