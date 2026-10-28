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

Additional exported parts: `Table.Root`.

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

Set `virtualized` on the data form or on `Table.Content` to render only the visible rows, overscan and focused row. The opt-in loads a separate helper using the [cdk CollectionVirtualizer and TableLayout](site:cdk/foundations/virtualizer/#collection-components); ordinary tables keep their existing markup and do not load the virtualizer.

`rowHeight` and `headingHeight` default to 48 px. `initialSize` defaults to `{ width: 800, height: 600 }` and sets both the server window and the default scroll viewport. On `Table.Content`, `style` can override the viewport; keep `initialSize` aligned with its dimensions to avoid a jump on first interaction. Use fixed heights that fit the cell content. The table renders `div`s with grid roles and a sticky header. Selection, sorting and keyboard navigation remain CDK Table behaviour: with row focus, ArrowDown moves to the next row, End to the last row and Home to the first; with cell focus, Home/End move within the row. After clicking a cell, Home then ArrowLeft enters row focus. Column resizing does not apply to virtualized tables yet.

::example{id=table-virtualized}

For compound tables, put the same props on the content:

```tsx
<Table>
  <Table.ScrollContainer>
    <Table.Content virtualized rowHeight={48} headingHeight={40} initialSize={{ width: 600, height: 320 }} aria-label="Members">
      <Table.Header>
        <Table.Column id="name" isRowHeader>Name</Table.Column>
      </Table.Header>
      <Table.Body items={members}>
        {(member) => <Table.Row id={member.id}><Table.Cell>{member.name}</Table.Cell></Table.Row>}
      </Table.Body>
    </Table.Content>
  </Table.ScrollContainer>
</Table>
```

The explicit CDK composition remains available for advanced layout options:

::example{id=table-virtualization}

### TanStack Table

The Table works as a rendering layer on top of headless table libraries.
This example uses [TanStack Table](https://tanstack.com/table) for column
definitions, sorting, and pagination — while Rivet UI handles styling and
accessibility.

`@rivetjs/ui/table-tanstack` is the Rivet adapter for TanStack Table v9 (in place of `@tanstack/react-table`). Install the optional peer `@tanstack/table-core` (^9.3.1); apps that never import the subpath need neither.

- `createTable(options)` = `useReactTable` / `useTable`: TanStack `TableOptions` (`features`, `columns`, `data`, `getRowId`, …) on signals. Every read of the table (`getRowModel()`, `getHeaderGroups()`, `getCanNextPage()`, `atoms.sorting.get()`) tracks in bindings, so a sort re-runs only what reads the sorted rows. Call it in the component body.
- `data` / `columns` take an array or an accessor (`data: () => rows()`): a new array reprocesses the rows.
- `state.<slice>` takes a plain value (controlled, with `on<Slice>Change`), an accessor, a two-way `Signal` (the table writes it: `state: { pagination }`, no change handler) or an atom. `sortingAtom(sortDescriptor)` turns the Table's `sortDescriptor` signal into the `sorting` slice: a header press sorts the rows, `table.setSorting(…)` updates the header.
- `flexRender(columnDef.header, header.getContext())` / `flexRender(columnDef.cell, cell.getContext())` (or `<FlexRender cell={cell} />`): a template function returns text or JSX.
- Resumable pages: keep the state that must survive in signals of your component (`sortDescriptor`, `pagination`) and pass them in `state`; the table instance holds functions, is never serialized and is rebuilt when the component resumes. `toSortDescriptor` / `toSorting` convert between the two sort shapes.
- The subpath re-exports `@tanstack/table-core` (features, row models, `createColumnHelper`, sort functions, types).

```tsx
import { signal } from "@rivetjs/reactivity";
import type { SortDescriptor } from "@rivetjs/cdk/collections/types";
import { Table } from "@rivetjs/ui/table";
import {
  createColumnHelper,
  createSortedRowModel,
  createTable,
  flexRender,
  rowSortingFeature,
  sortFn_text,
  sortingAtom,
  tableFeatures,
} from "@rivetjs/ui/table-tanstack";

interface User {
  id: number;
  name: string;
}

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns: { text: sortFn_text } });
const columnHelper = createColumnHelper<typeof features, User>();
const columns = columnHelper.columns([columnHelper.accessor("name", { header: "Name" })]);

export function Users(props: { users: User[] }) {
  const sortDescriptor = signal<SortDescriptor | null>(null);
  const table = createTable({ columns, data: props.users, features, getRowId: (user) => String(user.id), state: { sorting: sortingAtom(sortDescriptor) } });
  return (
    <Table.Content aria-label="Users" sortDescriptor={sortDescriptor}>
      <Table.Header>
        {table.getHeaderGroups()[0]!.headers.map((header) => (
          <Table.Column allowsSorting id={header.column.id} isRowHeader>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </Table.Column>
        ))}
      </Table.Header>
      <Table.Body items={() => table.getRowModel().rows}>
        {(row: ReturnType<typeof table.getRowModel>["rows"][number]) => (
          <Table.Row id={row.id}>
            {row.getAllCells().map((cell) => (
              <Table.Cell>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>
            ))}
          </Table.Row>
        )}
      </Table.Body>
    </Table.Content>
  );
}
```

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

### Static tables (zero JavaScript)

A table that only shows data renders as a plain HTML table and ships no JavaScript, before or after an interaction ([Usage](#usage), [Secondary Variant](#secondary-variant) and [Tailwind CSS](#tailwind-css) above are static). The build proves the call site: the root and every part inside it pass only these props, with plain values (literals, module constants, `.map` items):

- `Table`: `class`, `variant`, `id`, `aria-*` / `data-*`; the data form's `columns` (none with `allowsSorting`), `items` (an array) and `footer`.
- `Table.ScrollContainer`, `Table.Footer`: `class`, `id`. `Table.Content`: `class`, `id`, `aria-label` / `aria-labelledby` / `aria-describedby`. `Table.Header`, `Table.Body`: `class`.
- `Table.Column`: `class`, `isRowHeader`, `id`, `textValue`. `Table.Row`: `class`, `id`, `textValue`. `Table.Cell`: `class`, `colSpan`, `id`, `textValue`.
- Other components inside only when they read no context and have no state of their own (an `Icon`); cell text may come from the calling component's signals (that component keeps it live).

Markup there: `table` / `thead` / `tbody` / `tr`, column headers `th scope="col"`, the cells of `isRowHeader` columns `th scope="row"`, the other cells `td`; same classes and `data-slot`s, hover from `:hover`. It is a data table, not a grid: no `role="grid"`, no tab stop, no arrow-key cell navigation; screen readers read it with their table commands (WAI-ARIA keeps static data tables as tables; the grid pattern is for interactive cells).

The grid path (the cdk Table, keyboard above) is used as soon as a site has any of: `selectionMode` / `selectedKeys` / `onSelectionChange`, `sortDescriptor` / `onSortChange` / `allowsSorting`, `onRowAction` / `onCellAction` / row `href` / `onAction`, `disabledKeys` / `isDisabled`, `expandedKeys` / `treeColumn` / nested rows, `keyboardNavigationBehavior`, render props or `items` with a row function (`<Table.Body items={…}>{(item) => …}</Table.Body>`), a signal or computed as a prop value, a spread, `Table.Collection` / `Table.SortableColumnHeader` / `Table.ColumnResizer` / `Table.ResizableContainer` / `Table.LoadMore`, `virtualized` / `rowHeight` / `headingHeight` / `initialSize`, a Virtualizer, or another component that reads a context. Limits: the proof is per component (a grid table in the same component keeps its static siblings on the grid path), and a Table part called outside a `<Table>` JSX element anywhere in the app (a row helper function or a wrapper component) turns the static path off for every table in that build: write row renderers inline (see [Expandable Rows](#expandable-rows)). App CSS that targets the grid attributes (`[role=gridcell]`, `[data-key]`) does not match static tables. See the framework guide "Native automata".

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

The component’s parts emit these additional `data-slot` values: `table-scroll-container`, `table-content`, `table-header`, `table-body`, `table-row`, `table-cell`, `table-footer`, `table-resizable-container`, `table-column-resizer`, `table-load-more`, `table-load-more-content`, `table-sortable-column-indicator`, `table-sortable-column-header`.

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

See the [full module API](/api/rivetjs/ui/table/) for every named export and part prop type.

### Table

| Prop                                               | Type                                                               | Default     | Description                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------ |
| `variant`                                          | `"primary" \| "secondary"`                                         | `"primary"` | Visual variant. Primary has a gray background container; secondary is flat with transparent rows.            |
| `class`                                            | `string`                                                           | -           | Additional CSS classes for the root container                                                                |
| `children`                                         | `Content \| (item: T) => Content`                                  | -           | Table content (ScrollContainer, Footer, etc.); data form: the header + body (no `columns`) or a row renderer |
| `columns`                                          | `Iterable<{ id; name; isRowHeader?; allowsSorting?; textValue? }>` | -           | Data form: the columns (header + default cells)                                                              |
| `items`                                            | `Iterable<T>`                                                      | -           | Data form: the rows                                                                                          |
| `footer`                                           | `Content`                                                          | -           | Data form: `Table.Footer` content                                                                            |
| `aria-label`, `sortDescriptor`, `selectionMode`, … | cdk Table props                                                    | -           | Data form: passed to `Table.Content`                                                                         |
| `virtualized` | `boolean` | `false` | Window rows using a dynamically loaded CDK TableLayout helper. |
| `rowHeight` | `number` | `48` | Fixed row height in px when virtualized. |
| `headingHeight` | `number` | `48` | Fixed header height in px when virtualized. |
| `initialSize` | `{ width: number; height: number }` | `{ width: 800, height: 600 }` | Server window and default scroll viewport dimensions in px. |

### Table.ScrollContainer

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | Table.Content element  |

### Table.Content

Inherits from [cdk Table](site:cdk/components/table/).

| Prop                | Type                                               | Default  | Description                                |
| ------------------- | -------------------------------------------------- | -------- | ------------------------------------------ |
| `aria-label`        | `string`                                           | -        | Accessible label for the table             |
| `selectionMode`     | `"none" \| "single" \| "multiple"`                 | `"none"` | Selection behavior                         |
| `selectedKeys`      | `Selection \| Signal<Selection>`                   | -        | Selected keys (a `Signal` is two-way)      |
| `onSelectionChange` | `(keys: Selection) => void`                        | -        | Selection change handler                   |
| `sortDescriptor`    | `SortDescriptor \| Signal<SortDescriptor \| null>` | -        | Current sort state (a `Signal` is two-way) |
| `onSortChange`      | `(descriptor: SortDescriptor) => void`             | -        | Sort change handler                        |
| `class`             | `string`                                           | -        | Additional CSS classes                     |
| `virtualized` | `boolean` | `false` | Window rows using a dynamically loaded CDK TableLayout helper. |
| `rowHeight` | `number` | `48` | Fixed row height in px when virtualized. |
| `headingHeight` | `number` | `48` | Fixed header height in px when virtualized. |
| `initialSize` | `{ width: number; height: number }` | `{ width: 800, height: 600 }` | Server window and default scroll viewport dimensions in px. |

### Table.Header

Inherits from [cdk TableHeader](site:cdk/components/table/).

| Prop       | Type                                | Default | Description                                 |
| ---------- | ----------------------------------- | ------- | ------------------------------------------- |
| `columns`  | `T[]`                               | -       | Dynamic column data for render prop pattern |
| `children` | `Content \| (column: T) => Content` | -       | Static columns or render prop               |

### Table.Column

Inherits from [cdk Column](site:cdk/components/table/).

| Prop            | Type                                                | Default | Description                                       |
| --------------- | --------------------------------------------------- | ------- | ------------------------------------------------- |
| `id`            | `string`                                            | -       | Column identifier                                 |
| `allowsSorting` | `boolean`                                           | `false` | Whether the column is sortable                    |
| `isRowHeader`   | `boolean`                                           | `false` | Whether this column is a row header               |
| `defaultWidth`  | `string \| number`                                  | -       | Default width for resizable columns               |
| `minWidth`      | `number`                                            | -       | Minimum width for resizable columns               |
| `children`      | `Content \| (values: ColumnRenderProps) => Content` | -       | Column content or render prop with sort direction |

### Table.Body

Inherits from [cdk TableBody](site:cdk/components/table/).

| Prop               | Type                              | Default | Description                                |
| ------------------ | --------------------------------- | ------- | ------------------------------------------ |
| `items`            | `T[]`                             | -       | Dynamic row data for render prop pattern   |
| `renderEmptyState` | `() => Content`                   | -       | Content to display when the table is empty |
| `children`         | `Content \| (item: T) => Content` | -       | Static rows or render prop                 |

### Table.Row

Inherits from [cdk Row](site:cdk/components/table/).

| Prop       | Type               | Default | Description            |
| ---------- | ------------------ | ------- | ---------------------- |
| `id`       | `string \| number` | -       | Row identifier         |
| `class`    | `string`           | -       | Additional CSS classes |
| `children` | `Content`          | -       | Row cells              |

### Table.Cell

Inherits from [cdk Cell](site:cdk/components/table/).

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | Cell content           |

### Table.SortableColumnHeader

Renders a sortable column label with an ascending/descending indicator. Use it inside a `Table.Column` render-prop callback and forward the `sortDirection` value.

| Prop            | Type                                                                | Default | Description                                                                                        |
| --------------- | ------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `sortDirection` | `"ascending" \| "descending" \| (() => SortDirection \| undefined)` | -       | Current sort direction (value or accessor). Pass through from the `Table.Column` render prop.      |
| `showIndicator` | `boolean`                                                           | `true`  | Whether to render the sort indicator icon when a direction is set.                                 |
| `indicator`     | `Content`                                                           | -       | Custom indicator element. Overrides the default chevron and receives a `data-direction` attribute. |
| `class`         | `string`                                                            | -       | Additional CSS classes for the wrapper.                                                            |
| `children`      | `Content`                                                           | -       | Column label content                                                                               |

### Table.Footer

| Prop       | Type      | Default | Description                       |
| ---------- | --------- | ------- | --------------------------------- |
| `class`    | `string`  | -       | Additional CSS classes            |
| `children` | `Content` | -       | Footer content (e.g., pagination) |

### Table.ColumnResizer

Inherits from [cdk ColumnResizer](site:cdk/components/table/).

| Prop    | Type     | Default | Description            |
| ------- | -------- | ------- | ---------------------- |
| `class` | `string` | -       | Additional CSS classes |

### Table.ResizableContainer

Inherits from [cdk ResizableTableContainer](site:cdk/components/table/).

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | Table.Content element  |

### Table.LoadMore

Inherits from [cdk TableLoadMoreItem](site:cdk/components/table/).

| Prop         | Type                         | Default | Description                                                    |
| ------------ | ---------------------------- | ------- | -------------------------------------------------------------- |
| `isLoading`  | `boolean \| (() => boolean)` | `false` | Whether data is currently loading (value or accessor / signal) |
| `onLoadMore` | `() => void`                 | -       | Handler called when the sentinel row is visible                |
| `children`   | `Content`                    | -       | Loading indicator content                                      |

### Table.LoadMoreContent

| Prop       | Type      | Default | Description                               |
| ---------- | --------- | ------- | ----------------------------------------- |
| `class`    | `string`  | -       | Additional CSS classes                    |
| `children` | `Content` | -       | Loading indicator content (e.g., Spinner) |

### Table.Collection

Re-exported from the cdk `Collection` (`@rivetjs/cdk/collections/components`; React Aria `Collection` port). Used to render dynamic cells within rows alongside static cells (e.g., checkboxes).

| Prop       | Type                   | Default | Description               |
| ---------- | ---------------------- | ------- | ------------------------- |
| `items`    | `T[]`                  | -       | Collection items          |
| `children` | `(item: T) => Content` | -       | Render prop for each item |

### TableLayout

`TableLayout` and `CollectionVirtualizer` come from `@rivetjs/cdk/virtualizer`. The options go in the `CollectionVirtualizer`'s `layoutOptions`.

| Name                     | Type                  | Default | Description                                                                                                                                                                       |
| ------------------------ | --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rowHeight`              | `number \| undefined` | 48      | The fixed height of a row in px.                                                                                                                                                  |
| `estimatedRowHeight`     | `number \| undefined` | —       | The estimated height of a row, when row heights are variable.                                                                                                                     |
| `headingHeight`          | `number \| undefined` | 48      | The fixed height of a section header in px.                                                                                                                                       |
| `estimatedHeadingHeight` | `number \| undefined` | —       | The estimated height of a section header, when the height is variable.                                                                                                            |
| `loaderHeight`           | `number \| undefined` | 48      | The fixed height of a loader element in px. This loader is specifically for "load more" elements rendered when loading more rows at the root level or inside nested row/sections. |
| `dropIndicatorThickness` | `number \| undefined` | 2       | The thickness of the drop indicator.                                                                                                                                              |
| `gap`                    | `number \| undefined` | 0       | The gap between items.                                                                                                                                                            |
| `padding`                | `number \| undefined` | 0       | The padding around the list.                                                                                                                                                      |

::api{symbol="@rivetjs/ui/table#TableRoot"}

### TanStack adapter

`@rivetjs/ui/table-tanstack` (optional peer `@tanstack/table-core`), see [TanStack Table](#tanstack-table).

| Export                           | Description                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `createTable(options)`           | TanStack table on signals; `data` / `columns` value or accessor, `state` slices value / accessor / Signal / atom |
| `flexRender(template, context)`  | Header / cell / footer template: a function is called with the context, other values returned as is              |
| `FlexRender`                     | `<FlexRender cell={cell} />`, `header={header}`, `footer={footer}`                                               |
| `sortingAtom(sortDescriptor)`    | The `sorting` slice over a Table `sortDescriptor` signal (two-way)                                               |
| `toSortDescriptor` / `toSorting` | TanStack `SortingState` to Table `SortDescriptor` and back (first entry)                                         |
| `signalAtom(signal)`             | A TanStack atom over a Rivet signal                                                                              |
| `rivetReactivity()`              | The table-core reactivity bindings (writable atom = signal, readonly atom = computed)                            |

::api{symbol="@rivetjs/ui/table-tanstack#createTable"}

## Accessibility

The cdk Table implements grid keyboard navigation and selection. Give the table an accessible name, use column headers, and provide `textValue` for rows with rich content. Label selection and action controls; keep sort state and empty/loading feedback understandable without color.

## Related Components

- [Pagination](/components/pagination/): Page navigation with composable page links and controls.
- [Checkbox](/components/checkbox/): Binary choice input control.
- [Chip](/components/chip/): Compact elements for tags and filters.
- [Avatar](/components/avatar/): Display user profile images.
- [Button](/components/button/): Allows a user to perform an action.
- [Spinner](/components/spinner/): Loading indicator.
