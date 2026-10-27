---
title: DataGrid
description: "DataGrid: a data-driven table with sorting, selection, resizing, pinned columns, expandable rows, row reordering, async loading and virtualization."
template: reference
status: experimental
related: [components/checkbox, components/chip, components/empty-state]
---

`DataGrid` renders rows from `data` and `columns` (no compound parts) as an ARIA grid: keyboard navigation over rows and cells, selection, sorting, column resizing, pinned columns, expandable (tree) rows, row reordering, async loading and virtualization for large data. Behaviour is [`@rivetjs/cdk/data-grid`](site:cdk/components/data-grid/); the look is the Table's (`table*` classes) plus `data-grid*` classes.

::example{id=data-grid-basic}

## Import

```tsx
import { DataGrid } from "@rivetjs/ui/data-grid";
```

## Usage

```tsx
import { DataGrid } from "@rivetjs/ui/data-grid";

interface Member {
  id: number;
  name: string;
  role: string;
}

const MEMBERS: Member[] = [
  { id: 1, name: "Mara Quinn", role: "Engineer" },
  { id: 2, name: "Ilya Brandt", role: "Designer" },
];

export default function Members() {
  const columns = [
    { id: "name", header: "Name", accessorKey: "name" as const, allowsSorting: true },
    { id: "role", header: "Role", accessorKey: "role" as const },
  ];
  return <DataGrid<Member> aria-label="Members" data={MEMBERS} columns={columns} />;
}
```

- Row keys come from `getRowId` (default: `item.id`, then `item.key`, then the index).
- Define `columns` inside the component when they have `cell` / `header` functions: the compiler then registers those functions, so the grid can create rows on a resumed page. Plain-data columns can live at module level.
- `data`, `columns`, `filter`, `page`, `pageSize`, `isLoadingMore` and `disabledKeys` take a value, a Signal or an accessor: the grid updates in place.

## Anatomy

| Part                 | Element                                                    | Class                                            |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| root                 | `div` (`data-slot="data-grid"`)                            | `table-root data-grid table-root--<variant>`     |
| scroll container     | `div` (both axes, `height` when virtualized)               | `table__scroll-container data-grid__scroll-container` |
| content              | `table role=grid` (`treegrid` with `getChildren`)          | `table__content data-grid__content`              |
| header / column      | `thead` / `th role=columnheader` (sticky)                  | `table__header` / `table__column data-grid__column` |
| column resizer       | `div role=separator`                                       | `table__column-resizer`                          |
| body / row / cell    | `tbody` / `tr role=row` / `td role=gridcell` (`td role=rowheader`) | `table__body` / `table__row data-grid__row` / `table__cell data-grid__cell` |
| selection checkbox   | `span role=checkbox`                                       | `checkbox checkbox--primary data-grid__checkbox` |
| sort indicator       | `span` + lucide `ChevronUp`                                | `table__sortable-column-indicator data-grid__sort-indicator` |
| expand toggle        | `button` + lucide `ChevronRight`                           | `data-grid__expand`                              |
| drag handle          | `button` + lucide `GripVertical`                           | `data-grid__drag-handle`                         |
| footer               | `div` below the scroll container                           | `table__footer`                                  |

## Column Definitions

| Field | What |
| --- | --- |
| `id` | Column key (sorting, widths, `data-column`). |
| `header` | Text, or a function of `{ sortDirection }` (an accessor). |
| `accessorKey` | Row field shown as text (default `id`). |
| `cell(item, column)` | Custom content. |
| `isRowHeader` | Row header cell (`td role=rowheader`); default: the first data column. |
| `allowsSorting` / `sortFn` | Sortable on header press / custom compare. |
| `allowsResizing` / `width` / `minWidth` / `maxWidth` | Resizing (with `allowsColumnResize`) and widths: px, `%` or `fr`. |
| `align` | `start` / `center` / `end`. |
| `pinned` | `start` / `end`: sticky while the others scroll. |
| `headerClass` / `cellClass` | Extra classes. |

### Custom Cell Rendering

::example{id=data-grid-custom-cells}

### Custom Header Rendering

::example{id=data-grid-custom-header}

## Row Selection

`selectionMode` `single` / `multiple`, `showSelectionCheckboxes` (select-all in the header for `multiple`), `selectedKeys` (value or two-way Signal) / `defaultSelectedKeys` / `onSelectionChange`, `disabledKeys`, `selectionBehavior` `toggle` (default) / `replace`. Shift extends a range, Ctrl / Cmd + A selects all, Escape clears.

::example{id=data-grid-selection}

## Sorting

### Uncontrolled (client-side)

::example{id=data-grid-sorting}

### Controlled (server-side)

A controlled `sortDescriptor` means the data arrives sorted: the grid shows `data` as given and calls `onSortChange`. Set `sortMode="client"` to keep sorting in the grid with a controlled descriptor.

::example{id=data-grid-server-sorting}

### Custom Sort Function

::example{id=data-grid-custom-sort}

## Column Resizing

::example{id=data-grid-resizing}

## Pinned Columns

::example{id=data-grid-pinned}

## Drag and Drop

`onReorder` adds a drag-handle column. Drag a row (or the selected rows) with the pointer, or focus a handle, press Enter or Space, move with the arrow keys, Enter drops, Escape cancels (announced to screen readers). The event carries the moved `keys`, the `target` (`{ key, dropPosition }`) and the reordered `items`.

::example{id=data-grid-reorder}

## Expandable Rows

::example{id=data-grid-expandable}

## Editable Cells

::example{id=data-grid-editable}

## Empty State

::example{id=data-grid-empty}

## Async Loading

::example{id=data-grid-async}

## Alignment

A column's `align` (`start`, `center`, `end`) aligns its header and cells. `verticalAlign` on the grid (`top`, `middle` default, `bottom`; `data-vertical-align` on the root) places short cells against a taller, wrapped one.

::example{id=data-grid-alignment}

## Virtualization

`virtualized` renders the rows in view plus `overscan` (default 8) between two spacer rows, with a fixed `rowHeight` (default 42) and `height` (default 480). `aria-rowcount` / `aria-rowindex` describe the full set; keyboard navigation scrolls the focused row into view.

::example{id=data-grid-virtualized}

## Bulk Actions

::example{id=data-grid-bulk-actions}

## Examples

### Team Members

::example{id=data-grid-team-members}

### Servers

::example{id=data-grid-servers}

## Footer

::example{id=data-grid-footer}

## CSS Classes

- Variants: `table-root--primary` (default: the table is a surface card on the secondary background) and `table-root--secondary` (flat rows).
- Root attributes: `data-vertical-align` (`top` / `middle` / `bottom`), `data-selection-mode`, `data-virtualized`, `data-scrolled-start` / `data-scrolled-end` (pinned-edge shadows).
- Row attributes: `data-selected`, `data-disabled`, `data-dragging`, `data-level`; cells: `data-column`, `data-pinned`, `data-pinned-edge`, `data-tree-column`; columns: `data-allows-sorting`, `data-sort-direction`, `data-resizing`.
- Class props: `class`, `contentClass`, `scrollContainerClass`, `footerClass` (Pro: `className`, `contentClassName`, `scrollContainerClassName`, `footerClassName`) plus `headerClass`, `columnClass`, `bodyClass`, `rowClass`, `cellClass`, `checkboxClass`, `resizerClass`, `expandButtonClass`, `dragHandleClass`, `emptyClass`, `loadMoreClass`, `dropIndicatorClass`.

## Motion

CSS transitions only: the sort indicator fades in and turns for descending, the expand chevron turns, the checkbox draws its check. All of them are off with `prefers-reduced-motion: reduce`.

## Accessibility

ARIA grid (treegrid with `getChildren`) following React Aria's table: one tab stop; arrow keys move between rows, cells and focusable cell content; Home / End, Ctrl + Home / End, Page Up / Down; typeahead on the row-header column; Space selects, Enter runs `onRowAction`; ArrowRight / ArrowLeft expand and collapse tree rows; column resizers take arrow keys after Enter on a header.

## API Reference

::api{symbol="@rivetjs/ui/data-grid#DataGridProps"}

## Notes

- Independent implementation of the public feature set; no Pro code, styles or demos.
- Class props are `class` / `*Class` (Rivet), not `className` / `*ClassName`.
- `header` functions get `sortDirection` as an accessor (`sortDirection()`).
- `dragAndDropHooks` (React Aria drag and drop between collections) is not supported: `onReorder` covers reordering within the grid.
- A controlled `sortDescriptor` defaults to `sortMode="manual"` (data arrives sorted); Rivet adds `sortMode`, `filter`, `page` / `pageSize`, `height`, `overscan` and the `render*` props.
