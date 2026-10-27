---
title: Table
description: "Data tables with sorting, selection, expandable rows, column resizing and async loading."
template: reference
status: experimental
related: [components/pagination, components/checkbox]
---

`Table` displays data in rows and columns: a styled shell (`Table`, `ScrollContainer`, `Footer`) around the [cdk Table](site:cdk/components/table/) (React Aria Components port: keyboard grid navigation, row selection, sorting, expandable rows, column resizing, load-more sentinel), with the Rivet UI classes on every part.

Notes:

- `class`, not `className`. Render props are accessors (`({ sortDirection }) => …` passes `sortDirection` on; `Table.SortableColumnHeader` takes the value or the accessor; cell `({ isExpanded }) => isExpanded()`).
- React state → signals: `selectedKeys` / `sortDescriptor` / `expandedKeys` take two-way signals (`selectedKeys={selected}`), derived rows are a `computed` passed as `items` (`<Table.Body items={sortedUsers}>{(user) => …}</Table.Body>`).
- Data form (Rivet addition): `columns` + `items` on the root render the scroll container, content, header and rows; an `aria-label` alone wraps header + body children in the scroll container and content.
- Async Loading keeps the `Table.LoadMore` row mounted after the last page (`onLoadMore` returns early).

## Usage

```tsx
import { Table } from "@rivetjs/ui/table";
```

::example{id=table-basic}

## Anatomy

```tsx
import { Table } from "@rivetjs/ui/table";

export default () => (
  <Table>
    <Table.ScrollContainer>
      <Table.Content aria-label="Example table">
        <Table.Header>
          <Table.Column>Name</Table.Column>
          <Table.Column>Role</Table.Column>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Kate Moore</Table.Cell>
            <Table.Cell>CEO</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Content>
    </Table.ScrollContainer>
    <Table.Footer>{/* Optional footer content */}</Table.Footer>
  </Table>
);
```

## Examples

### Data

Rivet addition: give the root `columns` and `items` (plus `aria-label`) and it renders `Table.ScrollContainer` > `Table.Content` with the header and one row per item, the compound form's markup. A column with `allowsSorting` renders a `Table.SortableColumnHeader`; cdk Table props on the root (`sortDescriptor`, `selectionMode`, `onRowAction`, …) go to `Table.Content`, `class` stays on the root. `children` is an optional row renderer (`(item) => <Table.Row>…`; default: one cell per column with `item[column.id]`), `footer` a `Table.Footer`. With only an `aria-label`, `children` are the header and body. Use the compound parts to style the content (`min-w-*`), resize columns or virtualize.

::example{id=table-data}

### Secondary Variant

::example{id=table-secondary-variant}

### Async Loading

Use `Table.LoadMore` for infinite scrolling. It renders a sentinel row that triggers `onLoadMore` when scrolled into view.

::example{id=table-async-loading}

### Sorting

Columns can be made sortable using the `allowsSorting` prop on `Table.Column`. Use `sortDescriptor` and `onSortChange` on `Table.Content` to manage sort state. Wrap the label in `Table.SortableColumnHeader` and forward the `sortDirection` from the column's render prop to render the default ascending/descending indicator.

::example{id=table-sorting}

### Selection

Enable row selection with `selectionMode` on `Table.Content`. Use `Checkbox` with `slot="selection"` for select-all and per-row checkboxes.

::example{id=table-selection}

### Expandable Rows

Rows can be nested to display hierarchical data. Use the `treeColumn` prop to designate a column, and render a `Button` with `slot="chevron"` in that column’s cells so users can expand and collapse the row. Use the `expandedKeys` prop to control which rows are expanded.

::example{id=table-expandable-rows}

### Pagination

Use `Table.Footer` to add a pagination component below the table.

::example{id=table-pagination}

### Column Resizing

Wrap the table in `Table.ResizableContainer` and add `Table.ColumnResizer` inside each resizable column.

::example{id=table-column-resizing}

### Empty State

Use `renderEmptyState` on `Table.Body` to display a custom message when the table has no data.

::example{id=table-empty-state}

### Virtualization

A table can be virtualized through [Virtualizer](https://react-aria.adobe.com/Virtualizer), enabling efficient rendering of large datasets by displaying only the rows visible within the viewport.

Wrap `Table.Content` in the [cdk Virtualizer](site:cdk/foundations/virtualizer/#collection-components) with a `TableLayout` (`@rivetjs/cdk/virtualizer`). The table then renders `div`s with grid roles, and its header row is sticky. Give `Table.Content` a fixed size and set `initialSize` to it: the server renders the first window at that size. Column resizing does not apply to a virtualized table yet.

::example{id=table-virtualization}

### TanStack Table

The Table works as a rendering layer on top of headless table libraries.
This example uses [TanStack Table](https://tanstack.com/table) for column
definitions, sorting, and pagination — while Rivet UI handles styling and
accessibility.

:::warning
Not yet ported: TanStack Table has no Rivet adapter (`@tanstack/react-table`); the demo computes the same sorted + paginated rows from signals
:::

::example{id=table-tanstack-table}

### Custom Cells

::example{id=table-custom-cells}

### Keyboard

The table is one tab stop (a grid, as in React Aria): Tab enters at the focused row and the next Tab leaves the table.

- Arrow Up / Down move between rows; Home / End and Page Up / Down jump.
- Arrow Right / Left move from the row into its cells and back; a cell with a button, link or menu trigger is reached this way, then Tab (or Enter on the control itself) uses it. Enter on the cell does not press a control inside it.
- Space toggles the focused row's selection; Shift + arrows extend it; Ctrl / Cmd + A selects all; Escape clears it.
- Enter runs the row action (`onRowAction`) when the table has one.
- A row context menu (right click, Shift+F10, the context-menu key): see [ContextMenu: Table and List Rows](/components/context-menu/#table-and-list-rows).

## Customization

### Tailwind CSS

::example{id=table-custom-styles}

### Global CSS

To customize the Table component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .table-root {
    @apply relative grid w-full overflow-clip;
  }

  .table__header {
    @apply bg-gray-100;
  }

  .table__column {
    @apply px-4 py-2.5 text-left text-xs font-medium text-gray-600;
  }

  .table__row {
    @apply bg-white border-b border-gray-200;
  }

  .table__cell {
    @apply px-4 py-3 text-sm;
  }

  .table__footer {
    @apply flex items-center px-4 py-2.5;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Table component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/table.css)):

#### Base Classes
- `.table-root` - Root container (named `table-root` instead of `table` because `table` is a built-in Tailwind CSS utility class for `display: table`)
- `.table__scroll-container` - Horizontal scroll wrapper with custom scrollbar
- `.table__content` - The `<table>` element
- `.table__header` - Header row (`<thead>`)
- `.table__column` - Column header cell (`<th>`)
- `.table__body` - Body section (`<tbody>`)
- `.table__row` - Row element (`<tr>`)
- `.table__cell` - Data cell (`<td>`)
- `.table__footer` - Footer container (outside table)

#### Advanced Classes
- `.table__column-resizer` - Drag handle for column resizing
- `.table__resizable-container` - Wrapper enabling column resizing
- `.table__load-more` - Sentinel row for infinite scrolling
- `.table__load-more-content` - Styled container for the loading indicator

#### Variant Classes
- `.table-root--primary` - Gray background container with card-style body (default)
- `.table-root--secondary` - No background, standalone rounded headers

### Interactive States

The Table supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` (row background change)
- **Selected**: `[data-selected="true"]` (row highlight)
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` (inset focus ring on rows, columns, and cells)
- **Disabled**: `:disabled` or `[aria-disabled="true"]` (reduced opacity)
- **Sortable**: `[data-allows-sorting="true"]` (interactive cursor on columns)
- **Dragging**: `[data-dragging="true"]` (reduced opacity; drag and drop not wired in the cdk Table yet)
- **Drop Target**: `[data-drop-target="true"]` (accent background; drag and drop not wired in the cdk Table yet)

## API Reference

### Table

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"primary" \| "secondary"` | `"primary"` | Visual variant. Primary has a gray background container; secondary is flat with transparent rows. |
| `class` | `string` | - | Additional CSS classes for the root container |
| `children` | `Content \| (item: T) => Content` | - | Table content (ScrollContainer, Footer, etc.); data form: the header + body (no `columns`) or a row renderer |
| `columns` | `Iterable<{ id; name; isRowHeader?; allowsSorting?; textValue? }>` | - | Data form: the columns (header + default cells) |
| `items` | `Iterable<T>` | - | Data form: the rows |
| `footer` | `Content` | - | Data form: `Table.Footer` content |
| `aria-label`, `sortDescriptor`, `selectionMode`, … | cdk Table props | - | Data form: passed to `Table.Content` |

### Table.ScrollContainer

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Table.Content element |

### Table.Content

Inherits from [cdk Table](site:cdk/components/table/).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `aria-label` | `string` | - | Accessible label for the table |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | Selection behavior |
| `selectedKeys` | `Selection \| Signal<Selection>` | - | Selected keys (a `Signal` is two-way) |
| `onSelectionChange` | `(keys: Selection) => void` | - | Selection change handler |
| `sortDescriptor` | `SortDescriptor \| Signal<SortDescriptor \| null>` | - | Current sort state (a `Signal` is two-way) |
| `onSortChange` | `(descriptor: SortDescriptor) => void` | - | Sort change handler |
| `class` | `string` | - | Additional CSS classes |

### Table.Header

Inherits from [cdk TableHeader](site:cdk/components/table/).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `T[]` | - | Dynamic column data for render prop pattern |
| `children` | `Content \| (column: T) => Content` | - | Static columns or render prop |

### Table.Column

Inherits from [cdk Column](site:cdk/components/table/).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | - | Column identifier |
| `allowsSorting` | `boolean` | `false` | Whether the column is sortable |
| `isRowHeader` | `boolean` | `false` | Whether this column is a row header |
| `defaultWidth` | `string \| number` | - | Default width for resizable columns |
| `minWidth` | `number` | - | Minimum width for resizable columns |
| `children` | `Content \| (values: ColumnRenderProps) => Content` | - | Column content or render prop with sort direction |

### Table.Body

Inherits from [cdk TableBody](site:cdk/components/table/).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `T[]` | - | Dynamic row data for render prop pattern |
| `renderEmptyState` | `() => Content` | - | Content to display when the table is empty |
| `children` | `Content \| (item: T) => Content` | - | Static rows or render prop |

### Table.Row

Inherits from [cdk Row](site:cdk/components/table/).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string \| number` | - | Row identifier |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Row cells |

### Table.Cell

Inherits from [cdk Cell](site:cdk/components/table/).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Cell content |

### Table.SortableColumnHeader

Renders a sortable column label with an ascending/descending indicator. Use it inside a `Table.Column` render-prop callback and forward the `sortDirection` value.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sortDirection` | `"ascending" \| "descending" \| (() => SortDirection \| undefined)` | - | Current sort direction (value or accessor). Pass through from the `Table.Column` render prop. |
| `showIndicator` | `boolean` | `true` | Whether to render the sort indicator icon when a direction is set. |
| `indicator` | `Content` | - | Custom indicator element. Overrides the default chevron and receives a `data-direction` attribute. |
| `class` | `string` | - | Additional CSS classes for the wrapper. |
| `children` | `Content` | - | Column label content |

### Table.Footer

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Footer content (e.g., pagination) |

### Table.ColumnResizer

Inherits from [cdk ColumnResizer](site:cdk/components/table/).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes |

### Table.ResizableContainer

Inherits from [cdk ResizableTableContainer](site:cdk/components/table/).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Table.Content element |

### Table.LoadMore

Inherits from [cdk TableLoadMoreItem](site:cdk/components/table/).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isLoading` | `boolean \| (() => boolean)` | `false` | Whether data is currently loading (value or accessor / signal) |
| `onLoadMore` | `() => void` | - | Handler called when the sentinel row is visible |
| `children` | `Content` | - | Loading indicator content |

### Table.LoadMoreContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Loading indicator content (e.g., Spinner) |

### Table.Collection

Re-exported from the cdk `Collection` (`@rivetjs/cdk/collections/components`; React Aria `Collection` port). Used to render dynamic cells within rows alongside static cells (e.g., checkboxes).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `T[]` | - | Collection items |
| `children` | `(item: T) => Content` | - | Render prop for each item |

### TableLayout

`TableLayout` and `CollectionVirtualizer` come from `@rivetjs/cdk/virtualizer`. The options go in the `CollectionVirtualizer`'s `layoutOptions`.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `rowHeight` | `number \| undefined` | 48 | The fixed height of a row in px. |
| `estimatedRowHeight` | `number \| undefined` | — | The estimated height of a row, when row heights are variable. |
| `headingHeight` | `number \| undefined` | 48 | The fixed height of a section header in px. |
| `estimatedHeadingHeight` | `number \| undefined` | — | The estimated height of a section header, when the height is variable. |
| `loaderHeight` | `number \| undefined` | 48 | The fixed height of a loader element in px. This loader is specifically for "load more" elements rendered when loading more rows at the root level or inside nested row/sections. |
| `dropIndicatorThickness` | `number \| undefined` | 2 | The thickness of the drop indicator. |
| `gap` | `number \| undefined` | 0 | The gap between items. |
| `padding` | `number \| undefined` | 0 | The padding around the list. |

::api{symbol="@rivetjs/ui/table#TableRoot"}

## Related Components

- [Pagination](/components/pagination/): Page navigation with composable page links and controls.
- [Checkbox](/components/checkbox/): Binary choice input control.
- [Chip](/components/chip/): Compact elements for tags and filters.
- [Avatar](/components/avatar/): Display user profile images.
- [Button](/components/button/): Allows a user to perform an action.
- [Spinner](/components/spinner/): Loading indicator.
