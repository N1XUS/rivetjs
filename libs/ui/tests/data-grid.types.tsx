// Type-level suite (`tsc -p libs/ui` only): `DataGrid` accepts the cdk props + `variant`, typed columns (`accessorKey` of
// the row type, `cell` gets the row), Pro-named callbacks; errors: unknown variant, accessorKey not on the row, wrong
// selection mode.
import { DataGrid } from "../src/components/data-grid/index.ts";
import type { DataGridColumn, DataGridProps, DataGridSelection, DataGridSortDescriptor } from "../src/components/data-grid/index.ts";

interface User {
  id: string;
  name: string;
  age: number;
}
const data: User[] = [];
const columns: DataGridColumn<User>[] = [
  { id: "name", header: "Name", accessorKey: "name", allowsSorting: true, pinned: "start", width: 200 },
  { id: "age", header: ({ sortDirection }) => (sortDirection() === "ascending" ? "Age (ascending)" : "Age"), cell: (u) => <b>{u.age}</b>, align: "end" },
];
const props: DataGridProps<User> = { data, columns, variant: "secondary", "aria-label": "Users" };

export const ok = () => (
  <DataGrid<User>
    {...props}
    selectionMode="multiple"
    showSelectionCheckboxes
    onSelectionChange={(keys: DataGridSelection) => void keys}
    onSortChange={(d: DataGridSortDescriptor) => void d}
    allowsColumnResize
    onColumnResizeEnd={(w) => void w.get("name")}
    onRowAction={(key) => void key}
    onReorder={(e) => void e.items}
    virtualized
    rowHeight={42}
    verticalAlign="top"
    renderEmptyState={() => <p>none</p>}
    footer={<p>footer</p>}
    class="x"
  />
);

export const bad = () => (
  <>
    {/* @ts-expect-error unknown variant */}
    <DataGrid<User> data={data} columns={columns} variant="tertiary" />
    {/* @ts-expect-error unknown selection mode */}
    <DataGrid<User> data={data} columns={columns} selectionMode="many" />
  </>
);

// @ts-expect-error accessorKey must be a key of the row
export const badColumn: DataGridColumn<User> = { id: "x", accessorKey: "missing" };
