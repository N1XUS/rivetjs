// TANSTACK — TanStack Table story (`/table-tanstack`): `@rivetjs/ui/table-tanstack` `createTable` (TanStack Table v9 on
// signals) rendered with the ui Table + Pagination, as the ui-docs `table-tanstack-table` demo: sorting through
// `sortingAtom(sortDescriptor)` (two-way with the header), pages through a `PaginationState` signal (`#tt-page` echoes
// it), status cells from a `flexRender` cell template (Chip). `#tt` = table root, `#tt-grid` = the grid.
import { signal } from "@rivetjs/reactivity";
import type { SortDescriptor } from "@rivetjs/cdk/collections/types";
import { Chip } from "@rivetjs/ui/chip";
import { Pagination } from "@rivetjs/ui/pagination";
import { Table } from "@rivetjs/ui/table";
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  createTable,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_text,
  sortingAtom,
  tableFeatures,
  type PaginationState,
} from "@rivetjs/ui/table-tanstack";

interface Member {
  id: number;
  name: string;
  role: string;
  status: "Active" | "Inactive";
}

const members: Member[] = [
  { id: 1, name: "Kate", role: "CEO", status: "Active" },
  { id: 2, name: "John", role: "CTO", status: "Active" },
  { id: 3, name: "Sara", role: "CMO", status: "Inactive" },
  { id: 4, name: "Abel", role: "CFO", status: "Active" },
  { id: 5, name: "Mira", role: "COO", status: "Inactive" },
];

const features = tableFeatures({
  paginatedRowModel: createPaginatedRowModel(),
  rowPaginationFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
});
const columnHelper = createColumnHelper<typeof features, Member>();
const columns = columnHelper.columns([
  columnHelper.accessor("name", { header: "Name" }),
  columnHelper.accessor("role", { header: "Role" }),
  columnHelper.accessor("status", {
    cell: (info) => (
      <Chip color={info.getValue() === "Active" ? "success" : "danger"} size="sm" variant="soft">
        {info.getValue()}
      </Chip>
    ),
    header: "Status",
  }),
]);

export default function TableTanstackStories() {
  const sortDescriptor = signal<SortDescriptor | null>(null);
  const pagination = signal<PaginationState>({ pageIndex: 0, pageSize: 3 });
  const table = createTable({
    columns,
    data: members,
    features,
    getRowId: (row) => String(row.id),
    state: { pagination, sorting: sortingAtom(sortDescriptor) },
  });
  const pages = Array.from({ length: table.getPageCount() }, (_, i) => i + 1);
  return (
    <main class="grid gap-6 p-6">
      <h1>TanStack Table</h1>
      <Table id="tt">
        <Table.ScrollContainer>
          <Table.Content id="tt-grid" aria-label="Members" sortDescriptor={sortDescriptor}>
            <Table.Header>
              {table.getHeaderGroups()[0]!.headers.map((header) => (
                <Table.Column allowsSorting id={header.column.id} isRowHeader={header.column.id === "name"}>
                  {({ sortDirection }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </Table.SortableColumnHeader>
                  )}
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
        </Table.ScrollContainer>
        <Table.Footer>
          <Pagination size="sm">
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous isDisabled={!table.getCanPreviousPage()} onPress={() => table.previousPage()}>
                  <Pagination.PreviousIcon />
                  Prev
                </Pagination.Previous>
              </Pagination.Item>
              {pages.map((p) => (
                <Pagination.Item>
                  <Pagination.Link isActive={p === pagination().pageIndex + 1} onPress={() => table.setPageIndex(p - 1)}>
                    {p}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next isDisabled={!table.getCanNextPage()} onPress={() => table.nextPage()}>
                  Next
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </Table.Footer>
      </Table>
      <output id="tt-page">{pagination().pageIndex}</output>
      <output id="tt-sort">{sortDescriptor() ? `${String(sortDescriptor()!.column)} ${sortDescriptor()!.direction}` : "none"}</output>
    </main>
  );
}
