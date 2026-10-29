---
title: Table
description: Table from @rivetjs/cdk shows data in rows and columns with keyboard navigation, selection, sorting, column resizing, nested rows and infinite loading.
template: guide
status: experimental
related: [components/overview, components/grid-list, components/tree, components/checkbox, foundations/selection, foundations/collections]
---

`Table` renders a native `<table>` with grid semantics (`role="grid"`, or `role="treegrid"` with nested rows): `TableHeader` holds the `Column`s, `TableBody` the `Row`s, each `Row` one `Cell` per column. The server HTML holds every row with its `aria-selected` state; no Table code runs before the first interaction.

::example{id=table-basic}

## Anatomy

```html
<table id="files" role="grid" class="rv-Table" aria-label="Files" aria-multiselectable="true" tabindex="0">
  <thead role="rowgroup" class="rv-TableHeader">
    <tr role="row">
      <th id="files-select" role="columnheader" class="rv-Column" data-key="select" aria-colindex="1" tabindex="-1">
        <label slot="selection">…<input type="checkbox" aria-label="Select All" /></label>
      </th>
      <th id="files-name" role="columnheader" class="rv-Column" data-key="name" aria-colindex="2" tabindex="-1">Name</th>
    </tr>
  </thead>
  <tbody role="rowgroup" class="rv-TableBody">
    <tr role="row" class="rv-Row" data-key="games" aria-selected="false" aria-labelledby="files-games-name"
        data-selection-mode="multiple" data-level="1" style="--table-row-level:1" tabindex="-1">
      <td role="gridcell" class="rv-Cell" data-column-index="0" data-level="1" tabindex="-1">
        <label slot="selection">…<input id="files-games-checkbox" type="checkbox" aria-label="Select"
          aria-labelledby="files-games-checkbox files-games-name" /></label>
      </td>
      <td id="files-games-name" role="rowheader" class="rv-Cell" data-column-index="1" data-level="1" tabindex="-1">Games</td>
    </tr>
  </tbody>
</table>
<div id="files-sort-description" hidden></div>
<div id="files-sortable-description" hidden>sortable column</div>
```

```tsx
<ResizableTableContainer>
  <Table>
    <TableHeader>
      <Column><Checkbox slot="selection" /></Column>
      <Column isRowHeader>
        <ColumnResizer />
      </Column>
    </TableHeader>
    <TableBody>
      <Row>
        <Cell><Checkbox slot="selection" /></Cell>
        <Cell />
      </Row>
      <TableLoadMoreItem />
    </TableBody>
    <TableFooter>
      <Row><Cell /></Row>
    </TableFooter>
  </Table>
</ResizableTableContainer>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `Table` | `table[role=grid]` (`treegrid` with `treeColumn`) | `rv-Table` | `id` (generated unless set; header and cell ids derive from it), `data-focused`, `data-focus-visible`. Hidden description `div`s follow the table (a `div` inside a table is moved by the HTML parser). |
| `TableHeader` | `thead[role=rowgroup]` > `tr[role=row]` | `rv-TableHeader` | `data-hovered`. |
| `Column` | `th[role=columnheader]` | `rv-Column` | Id `<table id>-<column key>`; `aria-sort` on sortable columns; `data-allows-sorting`, `data-sort-direction`, `data-resizing`, `data-hovered`, `data-pressed`, `data-focused`, `data-focus-visible`. |
| `ColumnResizer` | `div[role=presentation]` + visually hidden `input[type=range]` | `rv-ColumnResizer` | Inside a `Column` of a `ResizableTableContainer`; the input is labelled "Resizer". `data-resizing`, `data-resizable-direction`, `data-hovered`, `data-focused`, `data-focus-visible`. |
| `TableBody` | `tbody[role=rowgroup]` | `rv-TableBody` | `data-empty`. |
| `Row` | `tr[role=row]` | `rv-Row` | `data-key`; named by its row header cell (`aria-labelledby`). Style `--table-row-level`. |
| `Cell` | `td[role=gridcell]`, `td[role=rowheader]` in an `isRowHeader` column | `rv-Cell` | Row header id `<table id>-<row key>-<column key>`; `data-column-index`, `data-level`. |
| `Checkbox slot="selection"` | `label` + visually hidden `input` | `rv-Checkbox` | From `@rivetjs/cdk/checkbox`: in a `Column` the select-all box ("Select All", indeterminate on a partial selection), in a `Cell` the row's box ("Select" + the row). |
| `Button slot="chevron"` | `button` | `rv-Button` | In the `treeColumn` cell of a parent row: expands and collapses it (excluded from the tab order). |
| `TableFooter` | `tfoot[role=rowgroup]` | `rv-TableFooter` | Rows below the body (totals). |
| `TableLoadMoreItem` | sentinel `tr[inert]` + loading `tr[role=row]` | `rv-TableLoadingIndicator` | Calls `onLoadMore` when the sentinel scrolls near the viewport. |
| `ResizableTableContainer` | `div` | `rv-ResizableTableContainer` | Measures the scroll width; the table gets `table-layout: fixed` and each `th` a pixel `width`. |
| Empty state | `tr[role=row]` > `td[role=rowheader]` spanning every column | none | `renderEmptyState` content while the body has no rows. |

| Attribute | Where | Value |
| --- | --- | --- |
| `aria-multiselectable` | table | `"true"` with `selectionMode="multiple"` |
| `aria-selected`, `data-selected` | row (`data-selected` also on its cells) | `aria-selected` `"true"` / `"false"` on selectable rows; `data-selected="true"` when selected |
| `aria-disabled`, `data-disabled` | row, cells | disabled rows (`disabledKeys`, `isDisabled`) |
| `aria-sort` | column | `"ascending"`, `"descending"` or `"none"` on `allowsSorting` columns |
| `aria-describedby` | sortable column | the hidden "sortable column" description |
| `aria-level`, `aria-expanded`, `aria-posinset`, `aria-setsize` | row | treegrid rows |
| `data-expanded`, `data-has-child-items`, `data-level`, `data-tree-column` | row, cells | nested rows |
| `data-focused`, `data-focus-visible` | table, column, row, cell | focused element; with keyboard modality |
| `data-focus-visible-within` (row), `data-focus-visible-within-row` (cell) | | keyboard focus inside the row |
| `data-hovered`, `data-pressed` | column (sortable), row (selectable or actionable), cell | |
| `data-href`, `data-target`, `data-rel`, `data-download`, `data-ping`, `data-referrer-policy` | row | link rows (the row is not an `<a>`) |
| `tabindex` | table, column, row, cell | table `0` until a cell or row has been focused; then `0` on the focused element and `-1` on the others (roving) |

## Import

```ts
import {
  Table,
  TableHeader,
  Column,
  ColumnResizer,
  TableBody,
  TableFooter,
  Row,
  Cell,
  TableLoadMoreItem,
  ResizableTableContainer,
  tableOptions,
  type ColumnProps,
} from "@rivetjs/cdk/table";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { Collection } from "@rivetjs/cdk/collections/components";
import type { Key, Selection, SortDescriptor } from "@rivetjs/cdk/collections/types";
```

## Props

### Table

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `TableHeader`, `TableBody`, `TableFooter` | none | |
| `id` | `string` | generated | Header and row header ids derive from it. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | A table needs a name. |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | |
| `selectionBehavior` | `"toggle" \| "replace"` | `"toggle"` | `replace`: a press replaces the selection, arrows move it, :kbd[Ctrl] / :kbd[Cmd] adds. |
| `selectedKeys` | `Signal<Selection> \| Iterable<Key> \| "all"` | none | Controlled selection; a signal is written two-way. |
| `defaultSelectedKeys` | `Iterable<Key> \| "all"` | none | Initial selection (uncontrolled). |
| `onSelectionChange` | `(keys: Selection) => void` | none | |
| `disallowEmptySelection` | `boolean` | `false` | |
| `disabledKeys` | `Iterable<Key>` | none | Row keys. |
| `disabledBehavior` | `"all" \| "selection"` | `"all"` | `selection`: disabled rows stay focusable and run actions, but cannot be selected. |
| `sortDescriptor` | `SortDescriptor \| Signal<SortDescriptor \| null> \| null` | none | `{ column, direction }`; a signal is written two-way. |
| `onSortChange` | `(descriptor: SortDescriptor) => any` | none | |
| `expandedKeys` | `Signal<Set<Key>> \| Iterable<Key>` | none | Expanded parent rows; a signal is written two-way. |
| `defaultExpandedKeys` | `Iterable<Key>` | none | |
| `onExpandedChange` | `(keys: Set<Key>) => any` | none | |
| `treeColumn` | `Key` | none | The column that shows the hierarchy: turns the table into a `treegrid`. |
| `onRowAction` | `(key: Key) => void` | none | :kbd[Enter]; a press while nothing is selected (toggle) or the row is not selectable; a double click (replace). |
| `onCellAction` | `(key: Key) => void` | none | Same triggers on a cell; the key is the cell key. |
| `keyboardNavigationBehavior` | `"arrow" \| "tab"` | `"arrow"` | How focus reaches elements inside cells. |
| `escapeKeyBehavior` | `"clearSelection" \| "none"` | `"clearSelection"` | |
| `shouldSelectOnPressUp` | `boolean` | `false` | |
| `disallowTypeAhead` | `boolean` | `false` | |
| `class`, `style` | value or `(props: TableRenderProps) => value` | `rv-Table` | |
| `slot`, `ref` | | | `TableContext` slots. |
| global DOM props | `GlobalDOMAttributes` | none | See [DOM events and attributes](#dom-events-and-attributes). |

`TableRenderProps` (accessors): `isFocused()`, `isFocusVisible()`, `isDropTarget()` (always false), `state()`.

### TableHeader

| Prop | Type | Notes |
| --- | --- | --- |
| `children` | `Column`s, or `(column) => Column` with `columns` | |
| `columns` | `Iterable<T> \| () => Iterable<T>` | Dynamic columns (pass a `computed` to change them). |
| `dependencies` | `unknown[]` | RAC parity; ignored (signals re-render). |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | | |
| `class`, `style` | value or function of `{ isHovered() }` | Default `rv-TableHeader`. |
| `ref`, global DOM props | | On the `thead`. |

### Column

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | `Key` | Column key: the cells of each row map to the columns in order. |
| `isRowHeader` | `boolean` | Its cells are `rowheader`s and name the row. Set it on at least one column. |
| `allowsSorting` | `boolean` | A press or :kbd[Enter] sorts by the column (ascending first, then flips). |
| `textValue` | `string` | Accessible text when the children are not a string. |
| `width`, `defaultWidth` | `ColumnSize` (`number`, `` `${number}%` ``, `` `${number}fr` ``) or `null` | Controlled / initial width; only inside a `ResizableTableContainer`. |
| `minWidth`, `maxWidth` | `number \| \`${number}%\`` or `null` | Resize limits; only inside a `ResizableTableContainer`. |
| `focusMode` | `"child" \| "cell"` | `child` (default): focusing the header focuses its first focusable child (the resizer). |
| `allowsArrowNavigation` | `boolean` | Arrow keys inside the header even with `keyboardNavigationBehavior="tab"`. |
| `children` | content, or `(props: ColumnRenderProps) => content` | |
| `class`, `style` | value or function of the render props | Default `rv-Column`. |
| `ref`, global DOM props | | On the `th`. |

`ColumnRenderProps`: `isHovered()`, `isPressed()`, `isFocused()`, `isFocusVisible()`, `allowsSorting()`, `sortDirection()`, `isResizing()`, `sort(direction)`, `startResize()` (throws outside a `ResizableTableContainer`).

### ColumnResizer

| Prop | Type | Notes |
| --- | --- | --- |
| `aria-label` | `string` | Default "Resizer" (localized). |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | | |
| `children` | content, or a function of the render props | Rendered before the hidden input. |
| `class`, `style` | value or function of the render props | Default `rv-ColumnResizer`. |
| `ref`, global DOM props | | On the `div`. |

`ColumnResizerRenderProps`: `isHovered()`, `isFocused()`, `isFocusVisible()`, `isResizing()`, `resizableDirection()` (`"right"`, `"left"` or `"both"`). Throws when the table is not inside a `ResizableTableContainer`.

### ResizableTableContainer

| Prop | Type | Notes |
| --- | --- | --- |
| `onResizeStart` | `(widths: Map<Key, ColumnSize>) => void` | A resize started. |
| `onResize` | `(widths: Map<Key, ColumnSize>) => void` | Each resize step: feed the Column `width` props for controlled widths. |
| `onResizeEnd` | `(widths: Map<Key, ColumnSize>) => void` | A resize ended: store the widths. |
| `children` | the `Table` (and anything else) | |
| `class`, `style` | value | Default `rv-ResizableTableContainer`. |
| `ref`, global DOM props | | On the `div`. |

### TableBody, TableFooter

| Part | Props |
| --- | --- |
| `TableBody` | `items` (`Iterable<T>` or accessor) + `(item) => Row`, or static `Row`s / `Collection` children; `idScope`; `dependencies` (ignored); `renderEmptyState(props)`; `class` / `style` (value or function of `{ isEmpty(), isDropTarget() }`, default `rv-TableBody`); `ref`; global DOM props. |
| `TableFooter` | `items` + row renderer, or static `Row`s; `class` (default `rv-TableFooter`); `style`; `ref`; global DOM props. Each footer row needs as many cells as columns (use `colSpan`). |

### Row

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | `Key` | Defaults to the item's `id` / `key` inside `items`. |
| `value` | `T` | The item object (set inside `items`). |
| `columns` | `Iterable<T> \| () => Iterable<T>` | With dynamic columns: `{(column) => <Cell>…</Cell>}` renders one cell per column. |
| `children` | `Cell`s, or `(column) => Cell` with `columns`; nested `Row`s (in a `Collection`) for expandable rows | |
| `textValue` | `string` | Typeahead text. |
| `isDisabled` | `boolean` | |
| `disabledBehavior` | `"all" \| "selection"` | Overrides the Table's for this row. |
| `onAction` | `() => void` | Runs before `onRowAction`. |
| `hasChildItems` | `boolean` | A parent row even before its children are loaded. |
| `href`, `hrefLang`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `routerOptions` | | Link row. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | | |
| `onPressStart`, `onPressEnd`, `onPressChange`, `onPress`, `onPressUp` | | Chained with the row's press handling. |
| `dependencies` | `unknown[]` | RAC parity; ignored. |
| `class`, `style` | value or function of the render props | Default `rv-Row`; the default style sets `--table-row-level`. |
| `ref`, global DOM props (no `onClick`) | | On the `tr`. |

`RowRenderProps`: `id` (value), `isHovered()`, `isPressed()`, `isSelected()`, `isFocused()`, `isFocusVisible()`, `isFocusVisibleWithin()`, `isDisabled()`, `selectionMode()`, `selectionBehavior()`, `isExpanded()`, `hasChildItems()`, `level()`, `state()`, plus `allowsDragging()`, `isDragging()`, `isDropTarget()` (always false: no drag and drop yet).

### Cell

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | `Key` | |
| `textValue` | `string` | Typeahead text; defaults to the cell's text. |
| `colSpan` | `number` | Columns the cell spans. |
| `focusMode` | `"child" \| "cell"` | `child`: focusing the cell focuses its first focusable child. Default `"child"` with `"arrow"` navigation, `"cell"` with `"tab"`. |
| `allowsArrowNavigation` | `boolean` | Arrow keys inside the cell even with `keyboardNavigationBehavior="tab"`. |
| `children` | content, or `(props: CellRenderProps) => content` | |
| `class`, `style` | value or function of the render props | Default `rv-Cell`. |
| `ref`, global DOM props | | On the `td`. |

`CellRenderProps`: `id`, `isPressed()`, `isFocused()`, `isFocusVisible()`, `isHovered()`, `isSelected()` / `isDisabled()` (of the row), `isFocusVisibleWithinRow()`, `columnIndex()`, `isTreeColumn()`, `isExpanded()`, `hasChildItems()`, `level()`.

### TableLoadMoreItem

| Prop | Type | Notes |
| --- | --- | --- |
| `onLoadMore` | `() => any` | The sentinel came within `scrollOffset` of the scroll container's viewport. |
| `isLoading` | `boolean` or accessor | Shows the children. |
| `scrollOffset` | `number` | Fraction of the scroll container's height; default `1`. |
| `children` | content | Loading content (in a cell spanning every column). |
| `class`, `style` | value | Default `rv-TableLoadingIndicator`; the style sets `--table-row-level`. |
| `ref`, global DOM props | | On the loading `tr`. |

### tableOptions and contexts

| Export | What |
| --- | --- |
| `tableOptions()` | RAC `useTableOptions()`: `{ selectionMode, selectionBehavior, disallowEmptySelection, allowsDragging }` of the enclosing Table, for reusable `Column` / `Row` wrappers (show a checkbox column only when `selectionMode === "multiple"` and `selectionBehavior === "toggle"`). |
| `TableContext` | Props for the Tables inside a component, optionally per `slot`. |
| `TableStateContext` | Accessor of the enclosing Table's state view (`useContext(TableStateContext)!()`). |
| `TableColumnResizeStateContext` | Accessor of the column resize state; `null` outside a `ResizableTableContainer`. |
| `RowFocusContext` | `{ isFocusVisibleWithinRow() }` of the enclosing row. |

`Key` is `string | number`; `Selection` is `"all" | Set<Key>`; `SortDescriptor` is `{ column: Key; direction: "ascending" | "descending" }`.

### Events

| Event | Fires |
| --- | --- |
| `onSelectionChange(keys)` | A press, :kbd[Space], :kbd[Enter] without an action, a selection checkbox, arrows with `replace`, :kbd[Ctrl]+:kbd[A], :kbd[Escape]. |
| `onRowAction(key)` / row `onAction()` | :kbd[Enter]; a press while nothing is selected (toggle) or the row is not selectable; a double click (replace). |
| `onCellAction(key)` | The same, on a focused cell. |
| `onSortChange(descriptor)` | A press or :kbd[Enter] on an `allowsSorting` column. |
| `onExpandedChange(keys)` | The chevron button, :kbd[ArrowRight] / :kbd[ArrowLeft] on a parent row. |
| `onResizeStart`, `onResize`, `onResizeEnd` | Dragging a `ColumnResizer`, or resizing it with the keyboard. |
| `onLoadMore()` | The `TableLoadMoreItem` sentinel came near the viewport. |
| row press / hover events | On that row. |

## Content

Columns and rows can be static, or come from data: `TableHeader columns`, `TableBody items` and `Row columns` take arrays or accessors with a render function. Pass a `computed` (or a signal) to change them: this example toggles a column and appends rows. A `TableFooter` adds rows below the body; its cells must cover every column (here with `colSpan`).

::example{id=table-dynamic}

### Expandable rows

Set `treeColumn` to the column that shows the hierarchy and nest child `Row`s (render them with `<Collection items={…}>` inside the parent row, after its cells). The table becomes a `treegrid`; parent rows get `aria-expanded`. A `Button slot="chevron"` in the tree column cell toggles the row, and :kbd[ArrowRight] / :kbd[ArrowLeft] on the row expand and collapse it. Indent the cell with the `--table-row-level` variable.

::example{id=table-expandable}

### Asynchronous loading

Put a `TableLoadMoreItem` after the rows inside `TableBody` (the rows in a `Collection items={…}`), and give the table a scroll container. Its sentinel calls `onLoadMore` as it nears the end of the viewport; its children show while `isLoading`.

::example{id=table-load-more}

### Links

A row with `href` is a link: the row stays a `tr[role="row"]` with `data-href` / `data-target`. With `selectionMode="none"` a press and :kbd[Enter] open it (through the `RouterProvider` when one is set). With selection, a press selects and :kbd[Enter] or a double click (`replace`) opens the link.

::example{id=table-links}

### Empty state

`renderEmptyState` on `TableBody` renders one row with a cell spanning every column while the body has no rows; the body gets `data-empty`.

::example{id=table-empty}

## Selection and actions

`selectionMode` enables single or multiple selection; pass a `selectedKeys` signal to own it, or `defaultSelectedKeys`. Put a `Checkbox slot="selection"` in the first column header (select all) and in each row's first cell. `onRowAction` handles row actions: with `selectionBehavior="toggle"` (default), a press runs the action while nothing is selected and toggles once something is; with `replace`, a press replaces the selection and :kbd[Enter] / double click run the action. Disabled rows are skipped by the keyboard and cannot be selected.

::example{id=table-selection}

## Sorting

Mark columns with `allowsSorting` and pass `sortDescriptor` (a signal is written two-way) or handle `onSortChange`. Sort the rows yourself: derive `items` with a `computed`. Pressing a sorted column flips its direction. The `sortDirection()` render prop drives an indicator.

::example{id=table-sorting}

## Column resizing

Wrap the table in a `ResizableTableContainer` and put a `ColumnResizer` in each resizable `Column`. `defaultWidth` / `width` take pixels, percentages or `fr`; `minWidth` / `maxWidth` bound the drag. Drag the resizer, or focus it (:kbd[ArrowUp] from a body cell to the header focuses the resizer of a resizable column), press :kbd[Enter] and use :kbd[ArrowLeft] / :kbd[ArrowRight]; :kbd[Enter], :kbd[Space], :kbd[Escape] or :kbd[Tab] end the resize.

::example{id=table-resizing}

### Resize events

`onResizeStart`, `onResize` and `onResizeEnd` on the container receive every column's width as a `Map`. For controlled widths, store the map from `onResize` and pass each column's `width`.

## Keyboard navigation

With `keyboardNavigationBehavior="arrow"` (default), arrow keys move between cells and into their focusable elements. With `"tab"`, cells take focus themselves (`focusMode="cell"`) and :kbd[Tab] moves into the focused cell's elements; arrows and typing inside a text field stay in the field.

::example{id=table-keyboard}

## DOM events and attributes

Every part takes the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`): `Table` props land on the `table`, `TableHeader` on the `thead`, `Column` on the `th`, `ColumnResizer` on its `div`, `TableBody` / `TableFooter` on the `tbody` / `tfoot`, `Row` on the `tr`, `Cell` on the `td`, `ResizableTableContainer` on its `div`, `TableLoadMoreItem` on the loading row.

Owned events (the part's behaviour runs first, yours after): the table handles `onKeyDown`, `onFocusIn`, `onFocusOut`, `onMouseDown` and `onScroll`; `TableHeader` `onPointerEnter` / `onPointerLeave`; `Column`, `Cell` and `ColumnResizer` `onPointerDown`, `onPointerUp`, `onPointerEnter`, `onPointerLeave`, `onClick` (and `onMouseDown`, `onDragStart`); a row `onPointerDown`, `onPointerUp`, `onPointerCancel`, `onPointerEnter`, `onPointerLeave`, `onDblClick`, `onKeyDown`, `onKeyUp`, `onDragStart`, and `onClick` is reserved for the row's press (not forwarded, as in RAC). `on…Capture` handlers do not resume yet.

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-Table[data-focused]`, `[data-focus-visible]` | the table element has focus | `focused:`, `data-focus-visible:` |
| `.rv-Column[data-allows-sorting]`, `[data-sort-direction="ascending"]` | sortable / sorted column | `data-allows-sorting:`, `data-[sort-direction=ascending]:` |
| `.rv-Column[data-resizing]`, `.rv-ColumnResizer[data-resizing]`, `[data-resizable-direction]` | resizing | `data-resizing:`, `data-[resizable-direction=left]:` |
| `.rv-Row[data-selected]`, `[aria-selected="true"]` | selected row | `data-selected:`, `aria-selected:` |
| `.rv-Row[data-disabled]` | disabled row | `data-disabled:` |
| `.rv-Row[data-hovered]`, `[data-pressed]` | hovered / pressed row | `data-hovered:`, `data-pressed:` |
| `.rv-Row[data-focus-visible]`, `.rv-Cell[data-focus-visible]` | keyboard focus | `data-focus-visible:` |
| `.rv-Row[data-expanded]`, `[data-has-child-items]`, `[data-level]` | nested rows | `data-expanded:`, `data-has-child-items:` |
| `.rv-TableBody[data-empty]` | empty body | `data-empty:` |
| `--table-row-level` | row level (1 = top) | `pl-[calc(var(--table-row-level)*1rem)]` |

`class` / `style` replace the default class names (or compute them from the render props); the attributes stay.

### Tailwind

::example{id=table-tailwind}

### Plain CSS

::example{id=table-css}

`@rivetjs/cdk/theme.css` has no Table rules yet: style the parts yourself.

## Custom markup

`@rivetjs/cdk/table/behaviour` (react-aria `useTable…`) and `@rivetjs/cdk/grid/behaviour` (react-aria `useGrid…`, shared with other grids) are the layers `Table` is built on:

| Export | What it does |
| --- | --- |
| `tableGridProps(props, state, element)`, `tableProps(props, state, hasTabbableChild?)` | Grid attributes and the table keyboard delegate wiring. |
| `tableColumnHeaderProps(props, state)`, `tableColumnHeaderPress`, `tableColumnHeaderPressable`, `tableColumnSortableDescription` | Column header attributes (`aria-sort`, description) and the sort press. |
| `tableRowProps(props, state, locale?)`, `tableRowKeyDown`, `tableRowExpandPress` | Row attributes, the expand keys and the chevron press. |
| `tableHeaderRowProps`, `tableCellProps`, `tableRowGroupProps` | Header row, cell and row group attributes. |
| `tableSelectionCheckboxProps`, `tableSelectionCheckboxChange`, select-all checkbox props | The selection checkboxes. |
| `tableKeyboardDelegate(props, state, element)`, `tableSortDescription` | Keyboard delegate and the sort announcement. |
| `getColumnHeaderId`, `getCellId`, `getRowLabelledBy`, `normalizeKey` | The derived ids. |
| `tableColumnResizeProps(props, state)`, `focusColumnResizer(column)` (`@rivetjs/cdk/table` column resize) | Resizer and hidden range input props (react-aria `useTableColumnResize`). |
| `gridCellProps`, `gridCellKeyDown`, `gridCellKeyDownCapture`, `gridShared`, … (`grid/behaviour`) | Cell focus modes, child navigation and the shared grid options. |

## Accessibility

- `role="grid"` (or `treegrid`) on a native `table`; name it with `aria-label` or `aria-labelledby`. `aria-multiselectable` for multiple selection.
- Rows are `role="row"` named by their row header cells: mark at least one column `isRowHeader`.
- Sortable columns carry `aria-sort` and a hidden "sortable column" description; a sort change is announced.
- One tab stop: the table until a cell or row is focused, then the focused element.
- The selection checkboxes are labelled "Select All" and "Select" + the row's name; the resizer input "Resizer" (or `aria-label`).

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowDown], :kbd[ArrowUp] | Next or previous row (the same column when a cell is focused); from the first body row up into the header. With `replace`, the selection follows. |
| :kbd[ArrowRight], :kbd[ArrowLeft] | From a row to its first / last cell, between cells, and from the first cell back to the row; parent rows of a treegrid expand / collapse. Mirrored in right-to-left text. |
| :kbd[Home], :kbd[End] | First or last cell of the row; with :kbd[Ctrl], the first or last row. |
| :kbd[PageDown], :kbd[PageUp] | One visible page down or up in a scrolling table. |
| Letters | Typeahead on the row header text (unless `disallowTypeAhead`). |
| :kbd[Space] | Select or toggle the focused row. |
| :kbd[Enter] | `onRowAction` / `onCellAction` when set, else select; sorts a focused sortable column; starts / ends a keyboard resize on a resizer. Links open. |
| :kbd[Shift]+arrow, :kbd[Shift]+:kbd[Space] | Multiple: select the range from the anchor. |
| :kbd[Ctrl]+:kbd[A] (:kbd[Cmd]+:kbd[A] on Mac) | Multiple: select all. |
| :kbd[Escape] | Clear the selection (unless `escapeKeyBehavior="none"` or `disallowEmptySelection`); ends a resize. |
| :kbd[Tab] | `tab` behaviour: into the focused cell's elements, then out of the table. |

## Resumability

- The server renders every row with its final `aria-selected`, `aria-sort`, `aria-expanded` and `tabindex`, and the selection checkboxes checked. No Table code runs before the first interaction.
- Built collection: the table's code loads on the first interaction and rebuilds the collection from the parts; unchanged rows keep their DOM.
- For derived `items` / `columns`, pass a `computed` (or a signal).
- `on…Capture` handlers do not resume yet.

## Testing

`@rivetjs/testing/user` ships the ported `TableTester` (React Aria test-utils): `user.createTester("Table", { root, interactionType? })`, then `getTable()`, `getRowGroups()`, `getColumns()`, `getRows({ element? })`, `getSelectedRows()`, `getFooterRows()`, `getRowHeaders()`, `getCells({ element? })`, `findRow({ indexOrText })`, `findCell({ text })`, `toggleRowSelection({ row, checkboxSelection?, needsLongPress?, selectionBehavior? })`, `toggleSelectAll()`, `toggleSort({ column })`, `toggleRowExpansion({ row })`, `triggerColumnHeaderAction({ column, action })` and `triggerRowAction({ row, needsDoubleClick? })`.

```tsx
import { signal } from "@rivetjs/reactivity";
import { render } from "@rivetjs/runtime/testing";
import { User } from "@rivetjs/testing/user";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import type { Key, Selection } from "@rivetjs/cdk/collections/types";

const picked = signal<Selection>(new Set<Key>());
render(() => (
  <Table id="pets" aria-label="Pets" selectionMode="multiple" selectedKeys={picked}>
    <TableHeader>
      <Column isRowHeader>Name</Column>
    </TableHeader>
    <TableBody>
      <Row id="cat"><Cell>Cat</Cell></Row>
      <Row id="dog"><Cell>Dog</Cell></Row>
    </TableBody>
  </Table>
));
const table = new User({ interactionType: "keyboard" }).createTester("Table", { root: document.getElementById("pets")! });
await table.toggleRowSelection({ row: "Dog" });
expect([...(picked() as Set<Key>)]).toEqual(["dog"]);
```

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Table`, `TableHeader`, `Column`, `ColumnResizer`, `TableBody`, `TableFooter`, `Row`, `Cell`, `TableLoadMoreItem`, `ResizableTableContainer`, `tableOptions`, contexts | RAC `Table.tsx` (`useTableOptions` → `tableOptions`) |
| `@rivetjs/cdk/table/behaviour` | react-aria `useTable`, `useTableColumnHeader`, `useTableRow`, `useTableHeaderRow`, `useTableCell`, `useTableSelectionCheckbox`, `useTableSelectAllCheckbox`, `useTableColumnResize` |
| `@rivetjs/cdk/grid/behaviour` | react-aria `useGrid`, `useGridRow`, `useGridCell` |
| state, keyboard | react-stately `useTableState`, `useTableColumnResizeState`, `TableKeyboardDelegate` |

Deviations:

- Render props are accessors; `class` is RAC `className`; `TableStateContext` / `TableColumnResizeStateContext` hold accessors of the state.
- Ids derive from the table id (`<table>-<column>`, `<table>-<row>-<column>`), so the server and the client agree without a counter.
- `aria-colcount` / `aria-rowindex` are only set on virtualized tables (`<CollectionVirtualizer layout={TableLayout}>`).
- `dependencies` is accepted and ignored: signals re-render.
- No `SharedElementTransition` around the rows.

## Not yet supported

- Drag and drop (`dragAndDropHooks`, drop indicators, `slot="drag"` button); column resizing inside a `CollectionVirtualizer`.
- The `render` (DOM render) prop.
- `SelectionIndicator` inside a row (needs a `SharedElementTransition`; it throws).

## Common mistakes

- **No row header.** Without an `isRowHeader` column, rows have no name.
- **Cell count.** Each row (footer rows too) needs one cell per column: use `colSpan`.
- **Sorting without sorting the data.** `sortDescriptor` only marks the column; derive the sorted `items` with a `computed`.
- **Resizing without the container.** `ColumnResizer` and `startResize()` throw outside a `ResizableTableContainer`; `width` props are ignored there too.
- **Mixing `items` and static children.** `TableLoadMoreItem` next to dynamic rows needs `<Collection items={…}>` as a sibling.
- **Changing the Set in place.** Set a new Set on the `selectedKeys` / `expandedKeys` signal; check for `"all"` before spreading.
