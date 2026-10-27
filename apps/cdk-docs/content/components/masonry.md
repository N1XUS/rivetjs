---
title: Masonry
description: "Headless masonry grid from @rivetjs/cdk: server-exact placement, measured reflow for unknown sizes, a virtualized mode, grid keys and selection."
template: guide
status: experimental
related: [components/bento, components/grid-list, components/lightbox, foundations/virtualizer, foundations/selection]
---

`Masonry` lays items out in columns of equal width, each item in the shortest column so far (photo walls, card feeds, mood boards), or in justified rows that fill the width (`layout="justified"`, Flickr / Google Photos). The rule: **sizes known → the server lays out**. When every item's size is known (an aspect ratio, `width` / `height` such as an `?image` import, or a fixed `height` for a text card), the server computes every position, in every breakpoint, and writes it as inline CSS: the page paints in its final layout and no masonry code runs at load. Unknown sizes are measured on the client (CSS columns paint first); in a mixed list the server lays out the known leading run and the client measures the rest. With `virtualize`, only the items in view are rendered.

Rivet addition: React Aria Components and Angular CDK have no masonry. The interaction model is React Aria's GridList (one tab stop, arrow keys, selection, actions); the virtualized mode uses the cdk `Virtualizer` with a `WaterfallLayout` subclass. [Bento](./bento.md) shares the same machinery for span tiles. `@rivetjs/ui/masonry` is the HeroUI-styled version.

::example{id=masonry-gallery}

## Anatomy

```html
<div class="rv-Masonry" data-rv-masonry data-layout="exact" style="container-type:inline-size">
  <div class="rv-Masonry-grid" role="grid" aria-label="Photos" tabindex="0" data-rv-grid
       style="--rv-w0:…;--rv-mw:…;position:relative;height:…">
    <div class="rv-Masonry-item" role="row" data-rv-item data-key="a" tabindex="-1" aria-selected="false"
         style="position:absolute;top:…;inset-inline-start:…;width:var(--rv-mw);aspect-ratio:1.5">
      <div role="gridcell">…your content…</div>
    </div>
    …
  </div>
  <div data-load-more hidden></div>
  <div class="rv-Masonry-loader" data-loading hidden>…</div>
</div>
```

| Element | Default class | Attributes |
| --- | --- | --- |
| root `div` | `rv-Masonry` | `data-rv-masonry`, `data-layout` (`exact` \| `justified` \| `mixed` \| `measure` \| `virtual`); inline `container-type: inline-size` (positions are relative to its width) |
| grid `div` | `rv-Masonry-grid` | `role="grid"` (or `list`), `aria-label`, `aria-multiselectable`, `tabindex="0"` until focus is inside, `data-measured` (measured mode, after the first reflow); inline grid variables and height |
| item `div` | `rv-Masonry-item` | `role="row"` (or `listitem`), `data-rv-item`, `data-key`, `tabindex="-1"`, `aria-selected`, `data-selected`, `aria-disabled` / `data-disabled`, `data-focused` / `data-focus-visible`; inline position |
| loader `div` | `rv-Masonry-loader` | `data-loading`; shown while `isLoading` |

## Import

```tsx
import { Masonry } from "@rivetjs/cdk/masonry";
// optional, for server-rendered pages: registers the grid variables as lengths (faster style recalc)
import "@rivetjs/cdk/masonry.css";
```

The pure layout functions (`placeColumns`, `placeJustified`, `rectsAt`, `resolveBreakpoints`, `masonrySizes`, …) are exported from the same subpath: the server and the client run the same code, and the handlers (`masonryKeyDown`, `reflowMeasured`, `watchMeasured`, …) from `@rivetjs/cdk/masonry/behaviour`.

## Items

`Masonry` is data-driven: pass `items` and a render function. The placement needs each item's size before anything renders, so there are no item parts in JSX.

```tsx
<Masonry items={photos} aria-label="Photos" getAspectRatio={(p) => p.width / p.height}>
  {(photo, state) => <img src={photo.src} alt={photo.alt} data-selected={state.isSelected()} />}
</Masonry>
```

- `items`: an array, an accessor or a `Signal`. Rows are keyed: an update re-places items without re-creating them, and only an item whose object changed re-renders (load more keeps the rendered images and the focus).
- `getKey(item, index)`: default `item.id`, then `item.key`, then the index.
- `getAspectRatio(item)`: width ÷ height. Default `item.aspectRatio`, then `item.width / item.height` (an `?image` descriptor has both). Return `null` for an unknown size: the item is measured in the browser, never drawn as a guessed square.
- `getItemHeight(item)`: a fixed height in px for an item without a ratio (a text card of known height). Default `item.height` when the item has no `width` / `aspectRatio`.
- `getSpan(item)`: columns the item covers (a number or a breakpoint map; justified rows: a width weight). Default `item.span`, else 1.
- The three readers may return an accessor or a `Signal`: the value is then a live item control (see [Controlling items](#controlling-items)).
- The render function gets the item and its state: `key`, `index()`, `isSelected()`, `isDisabled()` (accessors, read them in bindings).
- `extraItemHeight`: px added to every item below its media, such as a caption row of known height.

## Layout modes

| `layout` | When | What runs |
| --- | --- | --- |
| `"exact"` | every item's size is known | Nothing. The server writes each position as inline CSS: no layout shift, zero JavaScript. Items without a size are measured as in `auto` (a development warning names the count). |
| `"justified"` | rows instead of columns | Nothing, as `exact`: see [Justified rows](#justified-rows). |
| `"mixed"` (from `auto`) | a known leading run, then unknown sizes | The server places the known run; the rest paints as CSS columns under it and is measured like `measure`. |
| `"measure"` | some sizes are unknown | CSS columns paint first at the final column width; one client effect then watches the items: a `ResizeObserver` reports the container width and every item height, items the list adds or removes are picked up as they come, and one animation frame places everything (writes only, no layout reads). |
| `"auto"` (default) | | `exact` when every size is known, `mixed` when a leading run is, else `measure`. Read once at mount: an item without a size added later to an exact grid is placed as a square (with a development warning); use `measure` for lists that gain unsized items. |

`virtualize` (with `height`) replaces both with the cdk [Virtualizer](../foundations/virtualizer.md): exact sizes are never measured, unknown ones start square and take their measured height.

::example{id=masonry-feed}

::example{id=masonry-virtual}

## Justified rows

`layout="justified"` packs items into rows of a target height and scales each row so it fills the width exactly. The rows are decided at each breakpoint's reference width; every row height is then a linear function of the container width, so the server CSS fills the width at any width of the breakpoint.

- `rowHeight`: target row height in px, or a container-width map (`{ 0: 120, 640: 180 }`). Default 240.
- `rowHeightTolerance`: rows may be `rowHeight` ± this share. Default 0.25.
- `minRowHeight` / `maxRowHeight`: bounds for the edge cases (a very wide panorama, a lone portrait). Default 0.5× / 2× `rowHeight`; beyond them the item crops (`object-fit: cover`).
- `lastRow`: `"fill"` (default) rebalances the last two rows so the last one fills the width too and the bottom edge is flush, when the rebalanced rows stay inside `minRowHeight` / `maxRowHeight` (otherwise the widow stays `"left"`, as a lone portrait would crop); `"justify"`, `"left"`, `"center"` keep flickr's widow row at the previous row's height. A widow wider than the width at that height becomes a justified row (flickr lets it overflow).
- `getSpan` weights an item's width in its row.
- Breakpoints: the `rowHeight` map keys plus width splits spaced by the tolerance (each split widens the container by (1 + t) / (1 − t): 533, 889, 1481, 2469 px at 0.25), so a row never needs more than the tolerance to fill. `maxWidth` stops the splits at the grid's maximum width and bounds the last range, which keeps the CSS small.
- Items without a ratio are measured in the browser (an image's natural ratio once it loads, else the box), then the rows pack with them; the items after them wait too. Waiting items sit hidden in a provisional row of 1:1 placeholders below the placed rows (the grid height includes it, so content below does not jump); past 24 placeholders they wait beyond the inline end, where the grid clips them, so `loading="lazy"` images there load only once they move into the row. A changed item (a live span) re-packs the rows from its row on.

::example{id=masonry-justified}

## Columns

- `columns`: a number, or a map from container width to column count (`{ 0: 2, 640: 3, 1024: 4 }`, the default). The width is the root's own width (a container query), not the viewport.
- `minItemWidth` + `maxColumns` (default 4): as many columns as fit at that width.
- `gap`: px, one value or `[column, row]`, or a container-width map of those (`{ 0: 8, 768: [16, 24] }`). Default 16. Map keys add breakpoints.
- `maxWidth`: the root's maximum width in px (`max-width`); breakpoints at or above it never apply.
- Layout props are live: changing `columns`, `gap`, `rowHeight`, `maxWidth`, … re-places the items in place (rows kept). `layout`, `virtualize`, `semantics`, `selectionBehavior` and the reader functions are read once at mount (they decide the structure).
- `fit="both"`: stretches the last item of each column to the tallest column, so the bottom edge is flush (images crop with `object-fit: cover`).
- Each breakpoint assigns columns once, at a reference width (the middle of its range, or `referenceWidth`), so the server and the client agree. Between two breakpoints the picture scales; it does not reshuffle.

Breakpoints without a stylesheet: every position is a CSS `max()` over one term per breakpoint, and a term is masked out (pushed far negative) outside its width range. `@rivetjs/cdk/masonry.css` registers the variables (`@property`) so each masked width is computed once on the grid: without it the layout is the same and style recalculation is about 3 times slower for 1 000 items. The component registers the same variables from JavaScript when it renders on the client.

## Responsive

- Every breakpoint is in the server CSS: the grid switches columns, gaps and row heights by its own width with no JavaScript (container width, not the viewport).
- Measured mode reflows from one `ResizeObserver` on the root (content width from `contentBoxSize`) and on each measured item (`borderBoxSize`); there is no `window.resize` listener and no layout read after a write. Changes in one frame coalesce into one animation frame: read the sizes the observer reported, run the pure layout, write `transform`s and the grid height.
- Images: `masonrySizes({ columns, gap, span, inset, maxWidth })` returns the `sizes` attribute for an `?image` srcset. Breakpoints are container widths and `sizes` media queries are viewport widths, so the grid is described relative to the viewport: `min(100vw − inset, maxWidth)` (`inset`: px of the viewport outside the grid, such as page padding or a sidebar). A breakpoint at container width `min` starts at viewport `min + inset`; from `maxWidth + inset` on the width is a constant. `span` may be a map, or the current value of a live span (one `sizes` per card).

## Controlling items

A reader that returns an accessor or a `Signal` makes that value a live item control. Changing it re-places only what follows the changed item (one incremental relayout) and animates the move: the changed item animates its size, its neighbours slide (FLIP on the cdk [motion](../foundations/motion.md) spring).

```tsx
const expanded = signal<Key | null>(null);
<Masonry
  items={photos}
  getSpan={(photo) => () => (expanded() === photo.id ? 2 : 1)}
  onAction={(key) => expanded.set(expanded() === key ? null : key)}
>
  {(photo) => <img src={photo.src} alt={photo.alt} />}
</Masonry>;
```

- `getSpan` (columns; justified: width weight), `getAspectRatio`, `getItemHeight`: live when they return an accessor / `Signal`. A span set at render is laid out by the server.
- `motion`: `{ duration, friction }` of the spring, a [FLIP](../foundations/flip.md) driver (for example `layoutDriver(transition)` from `@rivetjs/motion/layout`: Motion's WAAPI engine, tweens or springs), or `false` to jump. `prefers-reduced-motion: reduce` always jumps.
- `handleRef`: `relayout()`, `scrollToItem(key)`, `getPosition(key)` (the item's box relative to the grid).
- Selection and keys work as before: navigation follows the new positions.

::example{id=masonry-expand}

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `T[] \| (() => T[]) \| Signal<T[]>` | — | Live. |
| `children` | `(item: T, state: MasonryItemState) => Content` | — | Item renderer. |
| `getKey` | `(item: T, index: number) => Key` | `id` / `key` / index | Read once (keys identify the rows). |
| `getAspectRatio` | `(item: T) => MaybeAccessor<number \| null>` | `aspectRatio` / `width ÷ height` | Live when it returns an accessor / Signal. |
| `getItemHeight` | `(item: T) => MaybeAccessor<number \| null>` | `height` (items without a ratio) | Live like `getAspectRatio`. |
| `getSpan` | `(item: T) => MaybeAccessor<number \| Record<number, number>>` | `span` / `1` | Live like `getAspectRatio`. |
| `extraItemHeight` | `number` | `0` | Live. |
| `layout` | `"auto" \| "exact" \| "measure" \| "justified"` | `"auto"` | Read once (structural). |
| `fit` | `"none" \| "both"` | `"none"` | Live. |
| `rowHeight` | `number \| Record<number, number>` | `240` | Justified. Live. |
| `rowHeightTolerance`, `minRowHeight`, `maxRowHeight` | `number` | `0.25`, 0.5× / 2× `rowHeight` | Justified. Live. |
| `lastRow` | `"fill" \| "justify" \| "left" \| "center"` | `"fill"` | Justified. Live. |
| `motion` | `boolean \| { duration?, friction? } \| FlipDriver` | `true` | Relayout animation (house spring, or a `@rivetjs/cdk/flip` driver). Live. |
| `handleRef` | `(handle: MasonryHandle) => void` or `{ current }` | — | `relayout`, `scrollToItem`, `getPosition`. |
| `columns` | `number \| Record<number, number>` | `{ 0: 2, 640: 3, 1024: 4 }` | Live. |
| `minItemWidth`, `maxColumns` | `number` | —, `4` | Live. |
| `gap` | `number \| [number, number]` or a map of those | `16` | Live. |
| `maxWidth` | `number` | — | Root `max-width` in px; bounds the last breakpoint. Live. |
| `referenceWidth` | `number` | middle of each range | Live. |
| `virtualize`, `height`, `initialSize` | `boolean`, `number \| string`, `{ width, height }` | — | Virtualized mode; `initialSize` sizes the server window. Read once. |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | Read once. |
| `selectionBehavior` | `"toggle" \| "replace"` | `"toggle"` | Read once. |
| `selectedKeys` / `defaultSelectedKeys` / `onSelectionChange` | `Selection` (`"all"` or a Set) | — | Value, accessor or two-way `Signal`. |
| `disabledKeys` | `Iterable<Key>` | — | Live. Skipped by the keys. |
| `disallowEmptySelection` | `boolean` | `false` | |
| `onAction` | `(key: Key) => void` | — | Enter, click (toggle behaviour while nothing is selected), double click (replace behaviour). |
| `onLoadMore`, `isLoading`, `renderLoader` | `() => void`, `boolean`, `() => Content` | — | Called when the end scrolls into view; `isLoading` is live. |
| `renderEmptyState` | `() => Content` | — | Shown when there are no items. |
| `semantics` | `"grid" \| "list"` | `"grid"` | `list`: no arrow keys or selection, tab through the item content. Read once. |
| `class`, `gridClass`, `itemClass`, `loaderClass`, `emptyClass` | `string` (`itemClass`: or `(state) => string`) | `rv-Masonry*` | A value replaces the default class. |
| `id`, `aria-label`, `aria-labelledby`, `aria-describedby` | `string` | — | On the grid element. |
| `style`, DOM attributes and events | | | On the root. |

## Keyboard and selection

| Key | Action |
| --- | --- |
| :kbd[Tab] | Into the grid (the last focused item) and out of it: one tab stop. |
| :kbd[ArrowUp] / :kbd[ArrowDown] | The nearest item above / below in the same column. |
| :kbd[ArrowLeft] / :kbd[ArrowRight] | The item beside it with the largest vertical overlap (RTL mirrored). |
| :kbd[PageUp] / :kbd[PageDown] | One viewport up / down. |
| :kbd[Home] / :kbd[End] | First / last item. |
| :kbd[Space] | Toggle the focused item. |
| :kbd[Enter] | `onAction`, or select when there is no action. |
| :kbd[Shift] + arrow, :kbd[Shift] + click | Extend the selection from the anchor (multiple). |
| :kbd[Ctrl] / :kbd[Cmd] + :kbd[A] | Select all (multiple). |
| :kbd[Escape] | Clear the selection (unless `disallowEmptySelection`). |

Navigation follows the visual position, not the array order. Selection follows React Aria: `toggle` behaviour toggles on click; with an `onAction` and nothing selected, a click runs the action. `replace` behaviour selects the focused item and runs the action on double click.

## Styling

| Selector | When |
| --- | --- |
| `.rv-Masonry[data-layout="measure"]` | Measured mode |
| `.rv-Masonry-grid[data-measured]` | Measured items have been placed |
| `.rv-Masonry-item[data-selected]` | Selected |
| `.rv-Masonry-item[data-focus-visible]` | Keyboard focus |
| `.rv-Masonry-item[data-disabled]` | In `disabledKeys` |
| `.rv-Masonry-loader[data-loading]` | `isLoading` |

Do not override the inline `position`, `top`, `inset-inline-start`, `width`, `aspect-ratio` or `transform` of the items: that is the layout. Style the content inside the item, or the item's colours, radius and rings.

## Accessibility

- `role="grid"` with rows and gridcells, or `role="list"` with `semantics="list"`. Name the grid with `aria-label` or `aria-labelledby`.
- One tab stop; the focused item gets `data-focus-visible` for keyboard focus. Selected items have `aria-selected="true"`.
- The DOM order is the data order, so a screen reader reads items in their logical order whatever their column.

## Resumability

- Exact and justified layouts: the server renders the final positions; a resumed page runs no masonry code and changes no node until the first key, click or focus. The root carries `preload="visible"`. A live span changed by that first click re-places on the resumed page (no hydration).
- Measured layout boots one client effect (the measuring observer); avoid it on pages that must stay idle by giving the items their sizes. Justified rows with items of unknown ratio boot one too (the ratio observer).
- On a resumed page, the first change of `items` re-creates the item rows (resume adoption keeps only rows whose render read no signals); later changes keep them. A test pins this gap.
- Rows are keyed (`getKey`, default `item.id`, then `item.key`, then the index): a reorder or a removal moves the same nodes. An immutable refetch that clones every item re-renders every row (a new object = a changed item); with the default index key (items without `id` / `key`), a reorder looks like changed items, so give items stable keys.
- Virtualized layout boots one client effect too: the first window is rendered at `initialSize` (default 800 × 600), and the effect starts the virtualizer at the real size when they differ.
- Handlers are delegated on the grid, the focus and anchor keys are resumable region state, and the item renderer is captured like any component child: follow the [resumability rules](site:docs/learn/resuming) for the functions you pass.

## Performance

- Server-placed layouts cost no client work: positions are inline CSS, the grid is `container-type: inline-size` (layout and style containment), items are `position: absolute` with a fixed width, and the grid height is set once.
- Measured mode: one `ResizeObserver`, sizes from the observer entries, one animation frame per change (read → pure layout → write), `transform: translate()` placement, no permanent `will-change`. The browser test asserts zero layout reads after the first write.
- A relayout after an item change re-places from the changed item on (the earlier columns, or the rows before its row, keep their state); unchanged items keep their style object, so nothing is written to them.
- Justified CSS size: each width split adds terms to every item's `max()`. Measured on 1 000 photos (tolerance 0.25): uncapped, 5 breakpoints = 13.8 terms / 667 B per item; `maxWidth={1400}`, 3 breakpoints = 8.0 terms / 431 B; `maxWidth={768}`, 2 breakpoints = 5.1 terms / 312 B. Uncapped justified costs about 2× an exact columns grid on resize (13.6 vs 6.7 ms for 1 000 items); with `maxWidth` ≤ 1400 it is 9.3 ms. Set `maxWidth` on justified grids.

Measured on a laptop (Chromium, 1 000 items, 3 breakpoints): server render 6–10 ms (columns or justified); measured reflow of 1 000 items 3–5 ms (within one frame); virtualized 10 000 items render about 10–40 at a time. The `masonry` suite of `apps/dom-bench` compares it with CSS columns, the round-robin columns of react-masonry-css and the measure-and-place algorithm of masonry.js.

## Upstream

None: Rivet-authored; the justified rows port flickr/justified-layout 4.1.0 (MIT; not ported: container padding, `maxNumRows`, `forceAspectRatio`, breakout rows, hidden widows). Not supported: typeahead, drag to reorder, sections. In the virtualized mode with unknown sizes, the keys reach rendered items only.
