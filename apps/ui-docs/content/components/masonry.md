---
title: Masonry
description: "A masonry grid: items of different heights in columns of equal width, placed by the server when their sizes are known, with keys and selection."
template: reference
status: experimental
related: [components/bento, components/card, components/lightbox]
---

`Masonry` puts items of different heights in columns of equal width, each item in the shortest column (photo walls, card feeds, mood boards), or in justified rows that fill the width. The rule: **sizes known → the server lays out**. With an aspect ratio, `width` / `height` (an `?image` import) or a fixed `height` per item, the server places every item in every breakpoint and the page paints in its final layout. Items of unknown height are measured and placed on the client; in a mixed list the server places the known leading run.

Accessibility: the grid is a `role="grid"` with one tab stop; arrow keys move by visual position and the DOM order stays the data order, so screen readers read the items in their logical order. Name it with `aria-label`. `semantics="list"` renders a plain list for content that is only read.

## Usage

```tsx
import { Masonry } from "@rivetjs/ui/masonry";
```

::example{id=masonry-usage}

- Masonry is data-driven: pass `items` and a render function. Each item's aspect ratio comes from `aspectRatio`, or `width` / `height` (an `?image` descriptor has both), or `getAspectRatio(item)`; a text card of known height passes `getItemHeight(item)`.
- `columns` takes a number or a map from container width to column count (`{ 0: 2, 640: 3, 1024: 4 }`, the default). The width is the component's own width, not the viewport.
- `gap` is in px: one value or `[column, row]`, or a container-width map of those.
- `maxWidth` caps the root width in px; breakpoints at or above it never apply.
- Layout props (`columns`, `gap`, `rowHeight`, `maxWidth`, …) are live: a change re-places the items in place. `layout`, `virtualize`, `semantics` and the reader functions are read once at mount.
- An item without a size is measured in the browser, never drawn as a guessed square.
- Resumable: with known sizes nothing runs at load; the first key or click loads the handlers. On a resumed page the first `items` change re-creates the rows once.
- Rows are keyed by `id` (or `key`, or `getKey`): reorder and removal move the same nodes. Cloning every item on refetch re-renders every row; items without a key fall back to the index, so a reorder looks like changed items.
- Direct images and videos fill the item (`object-fit: cover`).

## Justified

::example{id=masonry-justified}

- `layout="justified"`: rows of a target `rowHeight` (px or a container-width map) scaled to fill the width exactly, as on Flickr and Google Photos (a port of flickr/justified-layout).
- `lastRow="fill"` (default) keeps the bottom edge flush; `"left"`, `"center"` or `"justify"` keep a shorter last row.
- `lastRow="fill"` falls back to `"left"` when the rebalanced rows would leave `minRowHeight` / `maxRowHeight` (a lone portrait stays at the row height).
- `rowHeightTolerance` (default 0.25), `minRowHeight` / `maxRowHeight` (0.5× / 2×): how far rows may stray from the target. The tolerance also spaces the width breakpoints; `maxWidth` stops them at the grid's maximum width.
- Items without a ratio wait hidden in a provisional row below the placed rows until their image (or box) is measured, then join the rows; lazy images past the row stay unloaded.
- Set `maxWidth` (the example uses 768): it bounds the width breakpoints (see Performance).

## Expand

::example{id=masonry-expand}

- `getSpan(item)` may return an accessor or a `Signal`: a live item control. A click toggles the card between one and two columns; only the items after it are re-placed, and they slide into place.
- `motion` sets the spring (`{ duration, friction }`) or turns the animation off (`false`); reduced motion always jumps.
- `handleRef` gives `relayout()`, `scrollToItem(key)` and `getPosition(key)`.
- `masonrySizes({ columns, gap, span, inset, maxWidth })` returns the `sizes` attribute for the image's srcset. Breakpoints are container widths, media queries viewport widths: the grid is `min(100vw − inset, maxWidth)` (`inset` = page padding outside the grid), so a breakpoint at `min` starts at viewport `min + inset`. Pass the card's current span for a per-card `sizes` (the example switches between one and two columns).

## Responsive

- Every breakpoint (columns, gaps, row heights) is in the server CSS: the grid follows its own width without JavaScript.
- Measured items reflow from one `ResizeObserver` in one animation frame per change, with no layout reads after a write and no `window.resize` listener.
- `fit="both"` stretches the last item of each column so the bottom edge is flush.

## Feed with load more

::example{id=masonry-feed}

- Items without a size switch the layout to measured: CSS columns paint first, then the items are measured and placed (one `ResizeObserver`, no layout reads; items added later are placed too).
- `onLoadMore` runs when the end comes into view; `isLoading` shows `renderLoader` below the grid.
- `semantics="list"` gives a `role="list"`: no arrow keys, Tab moves through the content of the cards.

## Selection

::example{id=masonry-selection}

- `selectionMode` (`"single"` or `"multiple"`) with `selectedKeys` (a value, an accessor or a two-way `Signal`) and `onSelectionChange`.
- Selected items get a ring (`[data-selected]`), keyboard focus the focus ring (`[data-focus-visible]`).
- `onAction(key)` runs on Enter, and on a click while nothing is selected.

## Large collections

`virtualize` with a `height` renders only the items in view (the cdk Virtualizer). 10 000 items render about 40 at a time; keys and selection reach items outside the window.

## Performance

- Known sizes: positions are inline CSS from the server; a resize or an item change writes only the items whose box changed.
- Justified CSS size grows with the width breakpoints. On 1 000 photos (tolerance 0.25): uncapped, 5 breakpoints = 13.8 terms / 667 B per item; `maxWidth={1400}`, 3 breakpoints = 8.0 terms / 431 B; `maxWidth={768}`, 2 breakpoints = 5.1 terms / 312 B.
- Uncapped justified costs about 2× an exact grid on resize (13.6 vs 6.7 ms for 1 000 items); `maxWidth` ≤ 1400 brings it to 9.3 ms. Set `maxWidth` on justified grids.

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.masonry` - The root (an inline-size container).
- `.masonry__grid` - The grid element.
- `.masonry__item` - One item surface: rounded corners, media fill, focus and selected rings.
- `.masonry__loader` - The loader row.
- `.masonry__empty` - The empty-state row.

The stylesheet also registers the grid variables with `@property`, which makes style recalculation about 3 times faster for 1 000 items.

### CSS Variables

| Variable           | Default                       | Description         |
| ------------------ | ----------------------------- | ------------------- |
| `--masonry-radius` | `min(24px, var(--radius-3xl))` | Item corner radius |

### Data Attributes

- `[data-slot="masonry"]` on the root; `[data-layout]`: `exact`, `justified`, `mixed`, `measure` or `virtual`.
- Item: `[data-selected]`, `[data-focus-visible]`, `[data-disabled]`. Loader: `[data-loading]`.

## API Reference

### Masonry

| Prop                 | Type                                                | Default                     | Description                                                   |
| -------------------- | --------------------------------------------------- | --------------------------- | ------------------------------------------------------------- |
| `items`              | `T[]` \| `() => T[]` \| `Signal<T[]>`               | -                           | The items (live)                                              |
| `children`           | `(item: T, state: MasonryItemState) => Content`     | -                           | Item renderer                                                 |
| `getKey`             | `(item: T, index: number) => Key`                   | `id` / `key` / index        | Item key                                                      |
| `getAspectRatio`     | `(item: T) => number \| null` (or an accessor)      | `aspectRatio` / `width ÷ height` | Width ÷ height; `null` = unknown (measured)              |
| `getItemHeight`      | `(item: T) => number \| null` (or an accessor)      | `height`                    | Fixed px height of an item without a ratio                    |
| `getSpan`            | `(item: T) => number` (or an accessor)              | `span` / `1`                | Columns spanned (justified: width weight); live with an accessor |
| `extraItemHeight`    | `number`                                            | `0`                         | px added below every item (a caption row)                     |
| `referenceWidth`     | `number`                                            | middle of each range        | Container width the columns are assigned at                   |
| `maxWidth`           | `number`                                            | -                           | Root max width in px; bounds the last breakpoint              |
| `layout`             | `"auto"` \| `"exact"` \| `"measure"` \| `"justified"` | `"auto"`                 | Server-placed when sizes are known                            |
| `fit`                | `"none"` \| `"both"`                                | `"none"`                    | Stretch column ends to a flush bottom                         |
| `rowHeight`          | `number` \| `Record<number, number>`                | `240`                       | Justified target row height                                   |
| `rowHeightTolerance`, `minRowHeight`, `maxRowHeight` | `number`                      | `0.25`, 0.5× / 2×           | Justified row height bounds                                   |
| `lastRow`            | `"fill"` \| `"justify"` \| `"left"` \| `"center"`     | `"fill"`                    | Justified last row                                            |
| `motion`             | `boolean` \| `{ duration?, friction? }`             | `true`                      | Relayout animation                                            |
| `handleRef`          | `(handle: MasonryHandle) => void`                   | -                           | `relayout`, `scrollToItem`, `getPosition`                     |
| `columns`            | `number` \| `Record<number, number>`                | `{ 0: 2, 640: 3, 1024: 4 }` | Column count, or per container width                          |
| `minItemWidth`       | `number`                                            | -                           | Derive the columns from a minimum width (with `maxColumns`)   |
| `gap`                | `number` \| `[number, number]` (or a map)           | `16`                        | Gaps in px                                                    |
| `virtualize`         | `boolean`                                           | `false`                     | Render only the items in view (needs `height`)                |
| `height`             | `number` \| `string`                                | -                           | Scroll viewport height when virtualized                       |
| `selectionMode`      | `"none"` \| `"single"` \| `"multiple"`              | `"none"`                    | Selection                                                     |
| `selectionBehavior`  | `"toggle"` \| `"replace"`                           | `"toggle"`                  | Click toggles, or replaces                                    |
| `selectedKeys`       | `Selection` \| `Signal<Selection>`                  | -                           | Selected keys (`"all"` or a Set)                              |
| `onSelectionChange`  | `(keys: Selection) => void`                         | -                           | Selection changed                                             |
| `disabledKeys`       | `Iterable<Key>`                                     | -                           | Items that cannot be focused or selected                      |
| `onAction`           | `(key: Key) => void`                                | -                           | Enter / click action                                          |
| `onLoadMore`         | `() => void`                                        | -                           | The end came into view                                        |
| `isLoading`          | `boolean`                                           | `false`                     | Shows `renderLoader`                                          |
| `renderLoader`       | `() => Content`                                     | -                           | Loader content                                                |
| `renderEmptyState`   | `() => Content`                                     | -                           | Shown without items                                           |
| `semantics`          | `"grid"` \| `"list"`                                | `"grid"`                    | Grid with keys and selection, or a plain list                 |
| `class`, `gridClass`, `itemClass`, `loaderClass`, `emptyClass` | `string` (`itemClass`: or `(state) => string`) | - | Additional CSS classes                    |

### Keyboard

| Key                                      | Action                                    |
| ---------------------------------------- | ----------------------------------------- |
| :kbd[ArrowUp] / :kbd[ArrowDown]          | Item above / below in the column          |
| :kbd[ArrowLeft] / :kbd[ArrowRight]       | Item beside it                            |
| :kbd[Home] / :kbd[End]                   | First / last item                         |
| :kbd[Space]                              | Toggle selection                          |
| :kbd[Enter]                              | Action                                    |
| :kbd[Shift] + arrow                      | Extend the selection                      |
| :kbd[Ctrl] / :kbd[Cmd] + :kbd[A]         | Select all                                |
| :kbd[Escape]                             | Clear the selection                       |

## Related Components

- [Bento](/components/bento/): Tiles with column and row spans.
- [Card](/components/card/): Content surface for feed items.
- [Lightbox](/components/lightbox/): Open a photo full screen.
