---
title: Virtualizer
description: Layout-driven virtualization (list, grid, waterfall layouts) ported from React Spectrum, with a server-rendered first window and no JS before the first scroll.
template: guide
status: experimental
related: [foundations/scrolling, foundations/collections, foundations/selection, foundations/keyboard-navigation]
---

`@rivetjs/cdk/virtualizer` ports the React Spectrum virtualizer: the react-stately engine (`Virtualizer`, `Layout`, `LayoutInfo`, `Rect`, `ReusableView`, overscan, scroll anchoring), its layouts (`ListLayout`, `GridLayout`, `WaterfallLayout`, `TableLayout`), and the react-aria `ScrollView` and item measurement. The `<Virtualizer>` component follows the react-aria-components `Virtualizer`: you pass a `layout` and `layoutOptions`, and only the views inside the visible rect (plus overscan and persisted keys) are in the DOM. It renders its own `items`, or it wraps a `ListBox`, `GridList`, `Menu`, `Tree` or `Table` (see [Collection components](#collection-components)).

- **Server**: the engine runs at `initialSize` and renders the first window; views are absolutely positioned.
- **Browser**: no library code runs until the first scroll or focus on the scroller (`preload="interaction"`). Then the engine starts from the scroller's real size and adopts the server rows, keyed by item key.
- **After that**: views come and go with scrolling, resizes go through a `ResizeObserver`, and estimated sizes are measured.

::example{id=virtualizer-list}

For a virtual scroll viewport in the Angular CDK style (fixed-size and autosize strategies, `scrollToIndex`), see [Scrolling](./scrolling.md).

## Anatomy

```html
<div id="rows" class="rv-Virtualizer" role="list" aria-label="Rows" tabindex="0"
     style="padding:0; overflow-y:auto; overflow-x:hidden; width:320px; height:240px">
  <div role="presentation" class="rv-Virtualizer-content" style="position:relative; width:320px; height:320000px">
    <div role="presentation" class="rv-Virtualizer-item" data-rv-view="0" data-rv-type="item"
         style="position:absolute; overflow:visible; contain:size layout style; top:0px; inset-inline-start:0px; width:320px; height:32px">
      <!-- children(item, view) -->
    </div>
    <!-- … one wrapper per rendered view; sections nest their header and rows -->
  </div>
</div>
```

| Part | Element | Default class | Attributes |
| --- | --- | --- | --- |
| Scroller | `div` | `rv-Virtualizer` (`class` replaces it) | `id`, `role`, `aria-label`, `aria-labelledby`, `tabindex`, `dir`; inline overflow and `padding: 0` from `scrollDirection`, merged under `style` |
| Content | `div role="presentation"` | `rv-Virtualizer-content` | inline `width` / `height` = the layout's content size; `pointer-events: none` while scrolling |
| View | `div role="presentation"` | `rv-Virtualizer-item` (`itemClass` replaces it) | `data-rv-view` (the key), `data-rv-type` (`item`, `section`, `header`, `loader`, …); inline position and size from the layout |

- Without `dir`, views use the logical `inset-inline-start`, so RTL works before JS. With `dir`, they use `left` / `right`.
- Nested views (section rows) are positioned relative to their parent view.
- The scroller gets an id from `createId()` when `id` is not given. The engine finds its element by that id.

## Import

```ts
import { Virtualizer, ListLayout, GridLayout, WaterfallLayout, Size } from "@rivetjs/cdk/virtualizer";
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `readonly T[] \| () => readonly T[]` | (required) | The data. An accessor re-renders the window when it changes. |
| `layout` | `LayoutInput<O>` | (required) | Layout class (`GridLayout`) or factory (`() => new GridLayout()`). Instantiated on the server and once in the browser. Never an instance. |
| `layoutOptions` | `O` | none | Options of the layout (JSON; see [Layouts](#layouts)). |
| `children` | `(item: () => T, view: () => VirtualView<T>) => …` | (required) | View content. `view().type` tells items from sections, headers and loaders. |
| `initialSize` | `{ width, height }` | `800 x 600` | Viewport size of the server window. Match the scroller's CSS size. |
| `scrollDirection` | `"vertical" \| "horizontal" \| "both"` | `"vertical"` | Scrollable axes (inline `overflow-*`). |
| `persistedKeys` | `Iterable<Key>` | none | Keys always rendered, even out of view. The last focused view is added automatically. |
| `isLoading` | `boolean \| () => boolean` | none | Whether more data is loading. `true` reserves the loader view's size. |
| `onLoadMore` | `() => void` | none | Called when the scroll position comes within `loadMoreOffset` viewports of the end. |
| `loadMoreOffset` | `number` | `1` | Distance from the end that triggers `onLoadMore`, in viewport heights. |
| `shouldObserveItemSize` | `boolean` | `false` | Re-measure a view when its content resizes (`ResizeObserver` on each view's children). |
| `dir` | `"ltr" \| "rtl"` | none | Physical view positions (`left` / `right`) and scrollLeft normalization. Without it: logical `inset-inline-start`, direction read from the DOM. |
| `getKey` | `(item, index) => Key` | `item.key ?? item.id`, or the item itself for strings / numbers | Item key: rows are keyed by it (`data-rv-view`). |
| `getType` | `(item) => string` | `item.type ?? "item"` | Node type. `"section"` nodes hold `getChildren(item)`. |
| `getChildren` | `(item) => Iterable<T>` | `item.children` | Children of a section (a `"header"` node and the rows). |
| `getTextValue` | `(item) => string` | `item.textValue ?? item.label ?? String(item)` | Text of the node. |
| `onScroll` | `(event: Event) => void` | none | Runs after the virtualizer's own scroll handler. |
| `id` | `string` | `createId()` | Scroller id. |
| `role` | `string` | none | Scroller role (`list`, `grid`, `listbox`, …). |
| `label` | `string` | none | `aria-label` of the scroller. |
| `labelledBy` | `string` | none | `aria-labelledby` of the scroller. |
| `tabIndex` | `number` | none | Make the scroller focusable (keyboard scrolling). |
| `class` | `string` | `"rv-Virtualizer"` | Scroller class. |
| `style` | `StyleObject` | none | Scroller inline style (sizing), merged over the overflow style. |
| `itemClass` | `string` | `"rv-Virtualizer-item"` | Class of every view wrapper. |
| Global DOM props | `GlobalDOMAttributes<HTMLDivElement>` | none | Forwarded to the scroller. See [DOM events and attributes](#dom-events-and-attributes). |

`view()` is a JSON descriptor (`VirtualView`):

| Field | Type | Description |
| --- | --- | --- |
| `key` | `Key` | Collection key. |
| `type` | `string` | `item`, `section`, `header`, `loader`, … |
| `item` | `T \| null` | The data item (`null` for loaders). |
| `index` | `number` | Index within its parent. |
| `level`, `parentKey` | `number`, `Key \| null` | Depth and parent (section rows). |
| `x`, `y`, `width`, `height` | `number` | Layout rect. |
| `estimated` | `boolean` | Size not measured yet. |
| `style` | `StyleObject` | Position style relative to the parent view. |
| `children` | `VirtualView<T>[]` | Child views (section header and rows). |

### Events

| Event | Type | When |
| --- | --- | --- |
| `onLoadMore` | `() => void` | Scrolled within `loadMoreOffset` viewports of the end. Not called again until `items` changes or `isLoading` resets. |
| `onScroll` | `(event: Event) => void` | Every scroll of the scroller, after the engine has handled it. |

## Layouts

| Layout | Options |
| --- | --- |
| `ListLayout` | `orientation` (`vertical`), `rowSize` (48) or `estimatedRowSize`, `headingSize` (48) or `estimatedHeadingSize`, `loaderSize` (48), `gap` (0), `padding` (0), `dropIndicatorThickness` (2); deprecated aliases `rowHeight`, `estimatedRowHeight`, `headingHeight`, `estimatedHeadingHeight`, `loaderHeight` |
| `GridLayout` | `minItemSize` (200 x 200), `maxItemSize` (Infinity), `preserveAspectRatio` (false), `minSpace` (18 x 18), `maxHorizontalSpace` (Infinity), `maxColumns` (Infinity), `dropIndicatorThickness` (2), `loaderHeight` (48), `direction` (`ltr`) |
| `WaterfallLayout` | `minItemSize` (200 x 200), `maxItemSize` (Infinity), `minSpace` (18 x 18), `maxHorizontalSpace` (Infinity), `maxColumns` (Infinity), `dropIndicatorThickness` (2), `loaderHeight` (48) |
| `TableLayout` | ListLayout options with `rowHeight`, `estimatedRowHeight`, `headingHeight`, `estimatedHeadingHeight`, `loaderHeight`, plus `columnWidths` (`Map`). For a wrapped `Table` (see [Collection components](#collection-components)) or the engine with a `TableCollection`. |

- Sizes in `layoutOptions` may be plain `{ width, height }` objects: the layouts read only `width` / `height`, and plain objects survive resume. The option types say `Size`, so plain objects need `as Size`.
- Drag and drop targets on every layout: `getDropTargetFromPoint`, `getDropTargetLayoutInfo`.
- `WaterfallLayout` is also a keyboard delegate: `getKeyRightOf`, `getKeyLeftOf`, `getKeyRange`.
- Custom layouts extend `Layout` and implement `getVisibleLayoutInfos`, `getLayoutInfo` and `getContentSize`. Optional: `update`, `updateItemSize`, `shouldInvalidateLayoutOptions`, `UNSTABLE_getScrollAnchorInfo`.

### Fixed rows

`rowSize` gives every row the same size, so the content size is known at once (`10000 x 32 = 320000px` above). The view wrapper has the row's size; make the row content `height: 100%`.

### Variable heights

`estimatedRowSize` renders unmeasured rows at the estimate. After the first scroll, each rendered view is measured (its natural height, the inline height reset while measuring) and the rows below move. `shouldObserveItemSize` keeps watching: a row whose content grows is measured again.

::example{id=virtualizer-variable}

### Sections

A node of type `"section"` holds its children: a `"header"` node and the rows. `headingSize` sizes the header. The section view wraps its children, and the children are positioned relative to it. `children` runs for every view, so return the content per `view().type`.

::example{id=virtualizer-sections}

### Grid

`GridLayout` fits `floor(width / (minItemSize.width + minSpace.width))` columns (at most `maxColumns`), grows the items up to `maxItemSize`, and spreads the remaining space. `preserveAspectRatio` keeps every row at the `minItemSize` ratio; without it, row heights are estimated and measured.

::example{id=virtualizer-grid}

### Waterfall

`WaterfallLayout` (masonry) uses equal-width columns and places each item in the shortest column. Heights are estimated from `minItemSize`, then measured. The content size grows as far items are measured.

::example{id=virtualizer-waterfall}

### Horizontal and RTL

`layoutOptions={{ orientation: "horizontal" }}` stacks views along x; pair it with `scrollDirection="horizontal"`. With `dir="rtl"` views are placed from the right, and the engine normalizes the browser's RTL `scrollLeft` (negative in Chromium, see `getRTLOffsetType`).

::example{id=virtualizer-horizontal}

## Data

### Reactive items

`items` can be an accessor: a filtered or sorted list re-renders the window, keeps rows of kept keys, and resizes the content. Keys come from `getKey`. The defaults are `key`, then `id`, then the primitive value.

::example{id=virtualizer-items}

### Load more

Give `onLoadMore` (and usually `isLoading`) to append a loader node (key `LOADER_KEY`, `"rv-virtualizer-loader"`, type `loader`) after the items. While `isLoading` is true, the loader view has `loaderSize`; otherwise its size is 0. `onLoadMore` fires when `scrollHeight - scrollTop - clientHeight` is less than `loadMoreOffset` viewport heights. It fires again only after `items` changes or loading ends.

::example{id=virtualizer-load-more}

## Collection components

`<CollectionVirtualizer>` wraps one collection component, as React Aria's `Virtualizer` does (a separate component from `<Virtualizer items>`, so pages with the standalone one ship none of the collection renderer). It provides a virtualized `CollectionRenderer`, so the component renders only the visible window of its collection.

```tsx
<CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32 }} initialSize={{ width: 278, height: 278 }}>
  <ListBox aria-label="People" items={people}>
    {(person) => <ListBoxItem id={person.id}>{person.name}</ListBoxItem>}
  </ListBox>
</CollectionVirtualizer>
```

| Component | Layout | Notes |
| --- | --- | --- |
| `ListBox` | `ListLayout` | Options get `aria-posinset` / `aria-setsize`. Sections render with their header; positions count per section. |
| `GridList` | `ListLayout`, `GridLayout` | Rows get `aria-rowindex`, the grid `aria-rowcount` / `aria-colcount`. With `GridLayout`, set `layout="grid"`: arrow keys move by row and column. |
| `Menu` | `ListLayout` | Items get `aria-posinset` / `aria-setsize`. In a popover, the menu element is the scroll container: give `.rv-Menu` the size of `initialSize`. Submenus are not covered. |
| `Tree` | `ListLayout` | The layout runs over the flattened rows (expanded items only). Expanding or collapsing re-lays out the window. |
| `Table` | `TableLayout` | Renders `div`s with grid roles instead of `table` / `tr` / `td` (RAC `useElementType`). The header row is sticky. Rows get `aria-rowindex`. |

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | the collection component | (required) | One `ListBox`, `GridList`, `Menu`, `Tree` or `Table`. |
| `layout` | `LayoutInput<O>` | (required) | `ListLayout` / `GridLayout` / `TableLayout` (class or factory). |
| `layoutOptions` | `O` | none | JSON layout options, e.g. `{ rowHeight: 32 }`. |
| `initialSize` | `{ width, height }` | `800 x 600` | Size of the server window. Use the component's client size (inside borders, padding included): a resumed page keeps it until the first interaction. |
| `dir` | `"ltr" \| "rtl"` | none | Physical view positions; without it, logical `inset-inline-start`. |

- The component's own element is the scroll container. Give it a size and `overflow: auto`.
- Spacing comes from the layout (`gap`, `padding`). The view wrappers are absolutely positioned.
- Focus: the focused item stays rendered (a persisted key), and keyboard navigation scrolls it into view. :kbd[PageUp] / :kbd[PageDown] use the layout's rects. :kbd[Home] / :kbd[End] reach the ends of the whole collection.
- Selection, `onAction` and typeahead work as without the Virtualizer. They act on the whole collection, not only the rendered window.
- Resumed pages: the server renders the first window at `initialSize`. The engine starts on the first scroll or focus move, and the server rows are adopted by key.
- DOM order is not visual order. Kept rows keep their DOM position while focus is inside, so a focused option is never moved.

- Not covered yet: a `ListBox` in a `Select` / `ComboBox` popover (a popover `ListBox` filtered by `Autocomplete` virtualizes), load-more items (`*LoadMoreItem`) inside a virtualized collection, Table column resizing.

::example{id=virtualizer-listbox}

::example{id=virtualizer-listbox-sections}

::example{id=virtualizer-grid-list}

::example{id=virtualizer-menu}

::example{id=virtualizer-tree}

::example{id=virtualizer-table}

## Scrolling and focus

- The component has no `scrollToItem` API. Set `scrollTop` / `scrollLeft` on the scroller element, and its scroll event renders the new window.
- `persistedKeys` stay rendered at their layout position, wherever the scroll position is.
- The last view that received focus (`focusin` inside a view) is persisted too, so focus is not lost when it scrolls out.
- The content has `pointer-events: none` while scrolling (300 ms after the last scroll event).

::example{id=virtualizer-scroll}

## DOM events and attributes

`Virtualizer` accepts the global DOM props of `libs/cdk/utils/dom-props.ts` and forwards them to the **scroller** element. These are mouse, pointer, touch, wheel, animation and transition events (with their `…Capture` variants), and `lang`, `hidden`, `inert` and `translate`.

- `onScroll` runs after the virtualizer's own handler (the engine has already updated).
- `dir` is a regular prop of the component (view positions), not forwarded as-is.
- The virtualizer listens to `scroll` and `focusin` itself. View wrappers take no props; put handlers on your row content.
- `on*Capture` handlers do not resume yet.

::example{id=virtualizer-dom-events}

## Styling

| Selector | Element |
| --- | --- |
| `.rv-Virtualizer` | Scroller (replaced by `class`). |
| `.rv-Virtualizer-content` | Sized content element. |
| `.rv-Virtualizer-item` | Every view wrapper (replaced by `itemClass`). |
| `[data-rv-type="item" \| "section" \| "header" \| "loader"]` | View wrapper by type. |
| `[data-rv-view="<key>"]` | One view by key. |

- The component ships no CSS. Position, size, overflow and `padding: 0` are inline styles. Spacing comes from the layout (`gap`, `padding`, `minSpace`), not from CSS margins.
- The rendered DOM order is not the visual order: avoid `:nth-child` zebra stripes, use `view().index`.

### Tailwind

`class` and `itemClass` take utility classes, and the `data-rv-type` attribute works with `data-[rv-type=…]:` variants.

::example{id=virtualizer-tailwind}

### Plain CSS

::example{id=virtualizer-css}

## Accessibility

- The scroller is a plain `div`. Give it a `role` (`list`, `grid`, …) and a `label` / `labelledBy`, and set the matching roles (`listitem`, `gridcell`, …) on your row content. View wrappers are `role="presentation"`.
- With `tabIndex={0}` the scroller is focusable and the browser's keyboard scrolling works: :kbd[ArrowDown] / :kbd[ArrowUp], :kbd[PageDown] / :kbd[PageUp], :kbd[Home] / :kbd[End], :kbd[Space].
- Only the rendered window is in the accessibility tree. Set `aria-setsize` / `aria-posinset` (or `aria-rowcount` / `aria-rowindex`) on your rows from `view().index` when screen readers should announce the full size.
- The component has no keyboard navigation between items and no selection. For those, see [Keyboard navigation](./keyboard-navigation.md) and [Selection](./selection.md).

## Resumability

- **Before interaction**: the server window is plain HTML. The scroller has `preload="interaction"`; the first `scroll` or `focusin` loads the engine.
- **First scroll**: the engine starts from the scroller's real size (`clientWidth` / `clientHeight`) and scroll position, adopts the server rows by key (same DOM nodes), and measures estimated views.
- `layout` and `children` must be resumable: inline arrows or local consts. The layout instance itself is never serialized.
- `items`, `layoutOptions`, `persistedKeys` and the server window are sent in resume state. Keep items compact, or derive them from an accessor.
- A resumed binding keeps its kind: a view that renders an element on the server must keep rendering an element. Toggle `hidden` on a loader instead of switching between `null` and an element.

### Known limitations

- A first scroll that jumps past the whole server window before any smaller scroll (for example :kbd[End] or dragging the scrollbar to the bottom) logs errors: `Cannot read properties of undefined` from rows of the server window being removed. The window still renders. The examples scroll a little first.
- If the engine starts because `items` changed (before any scroll or focus), later `items` changes are not followed. Start it with a scroll or focus first, as the reactive items example does.

## Engine without the component

Everything outside the component is framework-free and imported from `@rivetjs/cdk/virtualizer` (also importable from plain `.ts` / Node through `engine.ts`).

| Export | Kind | Description |
| --- | --- | --- |
| `VirtualizerEngine` | class | The react-stately `Virtualizer`: `render(options)`, `getVisibleLayoutInfos()`, `getVisibleView(key)`, `keyAtPoint(point)`, `updateItemSize(key, size)`, `invalidate(context)`, `isPersistedKey(key)`; `contentSize`, `visibleRect`, `size`, `collection`, `layout`, `persistedKeys`. |
| `VirtualizerOptions` | type | Engine constructor options (`collection`, `layout`, `delegate`). |
| `createVirtualizerState(options)` | function | `useVirtualizerState` with signals: `visibleViews()`, `setVisibleRect`, `size` / `setSize`, `contentSize()`, `isScrolling()`, `startScrolling` / `endScrolling`, `dispose`. Options: `renderView`, `layout`, `collection`, `onVisibleRectChange`, `persistedKeys`, `layoutOptions`, `allowsWindowScrolling`, `initialVisibleRect`. |
| `createScrollView(element, options)` | function | `useScrollView` as a controller: `onScroll(event)`, `updateSize()`, `isScrolling`, `dispose()`. Supports `allowsWindowScrolling`. |
| `Layout` | abstract class | Base of the layouts. |
| `ListLayout`, `GridLayout`, `WaterfallLayout`, `TableLayout` | classes | Layouts (option types `ListLayoutOptions`, `GridLayoutOptions`, `WaterfallLayoutOptions`, `TableLayoutProps`; `LayoutNode`). |
| `TableColumnLayout`, `calculateColumnSizes` | class, function | Column sizing (`width`, `minWidth`, `maxWidth`, `defaultWidth`; px, `%`, `"1fr"`). Types `ColumnSize`, `TableColumnLayoutOptions`. |
| `LayoutInfo` | class | Layout of one view: `type`, `key`, `parentKey`, `rect`, `estimatedSize`, `isSticky`, `opacity`, `transform`, `zIndex`, `allowOverflow`. |
| `Rect`, `Size`, `Point` | classes | Geometry (`RectCorner` type). |
| `ReusableView`, `RootView`, `ChildView` | classes | Engine views. |
| `OverscanManager` | class | Overscan in the scroll direction. |
| `ScrollAnchorTracker`, `captureScrollAnchor`, `computeScrollAnchorTarget`, `getEdgeSnapTarget`, `isNearEdge`, `resolveScrollAdjustment` | class, functions | Scroll anchoring across relayouts (types `ScrollAnchor`, `ScrollAnchorInfo`). |
| `createCollection`, `ListCollection`, `buildNodes`, `loaderNode`, `getChildNodes` | functions, class | Local collection adapter (types `Collection`, `CollectionOptions`, `Node`). |
| `createTableCollection` | function | Table collection from column and row arrays (types `TableCollection`, `GridNode`, `TableColumn`). |
| `initialWindow(model)`, `projectViews(...)`, `LOADER_KEY` | functions, const | The component's server window and view projection (types `VirtualView`, `VirtualizerModel`). |
| `layoutInfoToStyle`, `measureItem`, `getSize`, `isElementVisible` | functions | DOM helpers. |
| `getScrollLeft`, `setScrollLeft`, `getRTLOffsetType` | functions | RTL-normalized `scrollLeft` (type `RTLOffsetType`). |
| `isSetEqual` | function | Set equality. |
| Types | | `InvalidationContext`, `VirtualizerDelegate`, `VirtualizerRenderOptions`, `DropTarget`, `DropPosition`, `ItemDropTarget`, `RootDropTarget`, `DropTargetDelegate`, `LayoutDelegate`, `Orientation`, `Direction`, `VirtualizerState`, `VirtualizerStateOptions`, `ScrollView`, `ScrollViewOptions`. |

## Upstream

- react-stately `virtualizer/*` (`Virtualizer`, `Layout`, `LayoutInfo`, `Rect`, `Size`, `Point`, `ReusableView`, `OverscanManager`, `ScrollAnchor`, `useVirtualizerState`) and `layout/*` (`ListLayout`, `GridLayout`, `WaterfallLayout`, `TableLayout`, `TableColumnLayout`).
- react-aria `virtualizer/*` (`Virtualizer`, `ScrollView`, `useVirtualizerItem`, RTL `scrollLeft` utilities) and the react-aria-components `Virtualizer` (`layout` + `layoutOptions`).
- Deviations:
  - Rows are keyed by item key and kept while in view. DOM nodes are not recycled across different items.
  - Rows hold the server-rendered `estimated` size until the first scroll measures them.
  - `layout` is a class or a factory, never an instance, and `layoutOptions` are JSON.
  - The collection adapter is local (plain item arrays, `getType` / `getChildren`). It will move to `@rivetjs/cdk/collections`.

## Not yet supported

- A `ListBox` in a `Select` / `ComboBox` popover, load-more items inside a virtualized collection, `Table` column resizing, `GridLayout` / `WaterfallLayout` for a wrapped ListBox.
- Window scrolling (`allowsWindowScrolling`) in `<Virtualizer>`. `createScrollView` and `createVirtualizerState` support it.
- A `scrollToItem` / scroll-into-view API on the standalone `<Virtualizer>` (wrapped collection components scroll their focused item in).
- Drag and drop rendering (drop indicators). The layouts compute drop targets.
