---
title: DataGrid
description: "DataGrid from @rivetjs/cdk/data-grid is a headless, data-driven grid: sorting, selection, resizing, pinning, tree rows, reordering, virtualization."
template: guide
status: experimental
related: [components/table, foundations/selection, foundations/virtualizer, foundations/keyboard-navigation]
---

`DataGrid` renders rows from `data` and `columns` into one native `<table role="grid">` (`treegrid` with `getChildren`). Keyboard, focus, selection and sorting follow React Aria's table. [`Table`](table.md) exposes individually composed rows and cells; `DataGrid` is the data-first sibling built for large data: there is no collection build pass, the rows are one computed pipeline (filter, sort, tree, page), and `virtualized` renders only the rows in view.

::example{id=data-grid-basic}

## Features

- Columns from data: `accessorKey` text or a `cell(item)` render function, a `header` text or function of the sort state, `align`, `width` (px / `%` / `fr`), `minWidth` / `maxWidth`.
- Sorting on header press (stable, locale aware, numbers / dates / nulls last), `sortFn` per column, controlled server-side sorting.
- Selection: `single` / `multiple`, checkbox column with select-all, Shift ranges, Ctrl / Cmd + A, `toggle` / `replace` behaviour, disabled rows, `onRowAction`.
- Column resizing (pointer + keyboard), pinned columns (`pinned: "start" | "end"`, sticky offsets as CSS variables), tree rows (`getChildren`, expand / collapse), row reordering (`onReorder`: pointer drag and keyboard drag with announcements).
- Client-side `filter`, `page` / `pageSize`; `onLoadMore` sentinel row; empty state; footer.
- Fine-grained: rows are keyed by row key, so sorting moves rows, selecting updates attributes, scrolling a virtualized grid creates and drops only the rows entering and leaving the window.
- Resumable: the server renders every row (or the first window when `virtualized`); no grid code runs before an interaction, the handler chunks preload when the grid becomes visible.

## Anatomy

```html
<div class="rv-DataGrid" data-selection-mode="multiple" data-vertical-align="middle">
  <div class="rv-DataGrid-scroll" style="overflow:auto;position:relative">
    <table role="grid" class="rv-DataGrid-table" aria-rowcount="7" aria-colcount="3" tabindex="0" style="table-layout:fixed">
      <colgroup>…</colgroup>
      <thead class="rv-DataGrid-header">
        <tr role="row" aria-rowindex="1">
          <th role="columnheader" class="rv-DataGrid-column" data-column="__rv_select"><span role="checkbox" data-rv-select-all="" class="rv-DataGrid-checkbox"></span></th>
          <th role="columnheader" class="rv-DataGrid-column" data-column="name" aria-sort="ascending" data-allows-sorting="true" data-sort-direction="ascending">
            Planet
            <div role="separator" class="rv-DataGrid-resizer" data-rv-resizer="name"></div>
          </th>
        </tr>
      </thead>
      <tbody class="rv-DataGrid-body">
        <tr role="row" class="rv-DataGrid-row" data-key="3" aria-rowindex="2" aria-selected="false">
          <td role="gridcell" class="rv-DataGrid-cell" data-column="__rv_select"><span role="checkbox" data-rv-select="" class="rv-DataGrid-checkbox"></span></td>
          <td role="rowheader" class="rv-DataGrid-cell" data-column="name">Earth</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="rv-DataGrid-footer">…</div>
</div>
```

## Import

```tsx
import { DataGrid, dataGridRows, type DataGridColumn } from "@rivetjs/cdk/data-grid";
```

The pure pipeline and helpers (`dataGridRows`, `sortItems`, `compareValues`, `nextSortDescriptor`, selection helpers, `columnCssWidths`, `pinnedOffsets`, `virtualWindow`, `reorderItems`) are exported too, for server-side data preparation or custom grids.

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `data` | `T[]` / Signal / accessor | — | Top-level rows (live). |
| `columns` | `DataGridColumn<T>[]` / Signal / accessor | — | Display order (live). Column fields: `id`, `header`, `accessorKey`, `cell`, `isRowHeader`, `allowsSorting`, `sortFn`, `allowsResizing`, `width`, `minWidth`, `maxWidth`, `align`, `pinned`, `headerClass`, `cellClass`. |
| `getRowId` | `(item, index) => Key` | `item.id ?? item.key ?? index` | Row key. |
| `aria-label` / `aria-labelledby` / `aria-describedby` / `id` | `string` | — | On the `<table>`. |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | |
| `selectedKeys` / `defaultSelectedKeys` / `onSelectionChange` | `Selection` (Set or `"all"`) | empty | Value, two-way Signal or accessor. |
| `selectionBehavior` | `"toggle" \| "replace"` | `"toggle"` | React Aria semantics. |
| `showSelectionCheckboxes` | `boolean` | `false` | Checkbox column (+ select-all for `multiple`). |
| `disabledKeys` | `Iterable<Key>` / accessor | — | Not selectable, no action. |
| `disallowEmptySelection` | `boolean` | `false` | |
| `sortDescriptor` / `defaultSortDescriptor` / `onSortChange` | `SortDescriptor \| null` | `null` | Controlled = data arrives sorted. |
| `sortMode` | `"client" \| "manual"` | client when uncontrolled | Who sorts. |
| `allowsColumnResize` / `onColumnResize` / `onColumnResizeEnd` | `boolean` / `(widths: Map) => void` | `false` | |
| `onReorder` | `(event: DataGridReorderEvent<T>) => void` | — | Adds the drag-handle column. |
| `onRowAction` | `(key) => void` | — | Enter / click (toggle mode with an empty selection) / double-click (replace mode). |
| `renderEmptyState` / `footer` | `() => Content` / `Content` | — | |
| `onLoadMore` / `isLoadingMore` / `loadMoreContent` | `() => void` / `boolean` (live) / `Content` | — | Sentinel row after the body. |
| `virtualized` / `rowHeight` / `headingHeight` / `height` / `overscan` | `boolean` / `number` | `false` / 42 / 36 / 480 / 8 | |
| `getChildren` / `treeColumn` / `expandedKeys` / `defaultExpandedKeys` / `onExpandedChange` / `treeIndent` | | — / row header / empty / 20 | Tree rows. |
| `filter` / `pageSize` / `page` | `(item) => boolean` / `number` (live) | — | Client-side pipeline. |
| `verticalAlign` | `"top" \| "middle" \| "bottom"` | `"middle"` | `data-vertical-align` on the root. |
| `renderCheckbox` / `renderSortIndicator` / `renderExpandIcon` / `renderDragHandle` | render functions | — | Get accessors (`isSelected()`, `direction()`, `isExpanded()`). |
| `strings` | `Partial<DataGridStrings>` | English | Labels and announcements. |
| class props | `string` | `rv-DataGrid*` | See Styling. |

## Virtualization

`virtualized` renders the visible window plus `overscan` rows (default 8) between two spacer rows, with a fixed `rowHeight` (default 42 px) in a scroll container of `height` (default 480). `aria-rowcount` / `aria-rowindex` describe the full set; keyboard navigation (arrows, Page Up / Down, Ctrl + Home / End) scrolls the focused row into view first.

::example{id=data-grid-virtual}

## Styling

Headless: default `rv-DataGrid*` classes (`class`, `contentClass`, `scrollContainerClass`, `headerClass`, `columnClass`, `bodyClass`, `rowClass`, `cellClass`, `footerClass`, `checkboxClass`, `resizerClass`, `expandButtonClass`, `dragHandleClass`, `emptyClass`, `loadMoreClass`, `dropIndicatorClass` replace them) and state attributes: rows `data-selected` / `data-disabled` / `data-dragging` / `data-level`, cells `data-column` / `data-pinned` / `data-pinned-edge` / `data-tree-column`, columns `data-allows-sorting` / `data-sort-direction` / `data-resizing`, root `data-scrolled-start` / `data-scrolled-end` / `data-virtualized`. Checkbox, sort indicator, expand icon and drag handle content come from `renderCheckbox`, `renderSortIndicator`, `renderExpandIcon`, `renderDragHandle` (accessors for live state). Layout-critical styles are inline: `table-layout: fixed`, sticky header and pinned cells, row heights, spacer rows, resizer `touch-action`; the scroll container carries `--rv-dg-header-height` (the `headingHeight` px) for styles that frame the body below the sticky header.

The styled version is `@rivetjs/ui/data-grid` (HeroUI table look).

## Keyboard navigation

| Key | Action |
| --- | --- |
| Tab | Into the grid (last focused cell or row), out of it. |
| Arrow keys | Move between rows / cells / focusable content in a cell; ArrowRight / ArrowLeft expand / collapse tree rows. |
| Home / End, Ctrl + Home / End | First / last cell of the row, first / last row. |
| Page Up / Page Down | One viewport up / down. |
| Space / Shift + arrows / Ctrl + A / Escape | Select, extend, select all, clear. |
| Enter | `onRowAction` (or select), sort on a header, start resizing on a resizer. |
| Typing | Typeahead on the row-header column. |

## Accessibility

ARIA grid / treegrid with `aria-multiselectable`, `aria-sort`, `aria-rowcount` / `aria-colcount` / `aria-rowindex`, `aria-level` / `aria-posinset` / `aria-setsize` / `aria-expanded` for tree rows, `role=separator` resizers with `aria-valuenow`; one tab stop with roving focus. Keyboard reordering is announced through the live announcer.

::api{symbol="@rivetjs/cdk/data-grid#DataGridProps"}
