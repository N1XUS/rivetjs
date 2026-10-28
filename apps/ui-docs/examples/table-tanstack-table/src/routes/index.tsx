// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/tanstack-table.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `@tanstack/react-table` `useReactTable` / `flexRender` → `@rivetjs/ui/table-tanstack` `createTable` /
// `flexRender` (TanStack Table v9 on signals); React state → signals (the sort descriptor shared with the Table header
// through `sortingAtom`, the page in a `PaginationState` signal).
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
  sortFn_alphanumeric,
  sortFn_text,
  sortingAtom,
  tableFeatures,
  type PaginationState,
} from "@rivetjs/ui/table-tanstack";

export const head = { title: "Table: TanStack Table" };

// #region demo
// --- Data -----------------------------------------------------------------
interface User {
  id: number;
  name: string;
  role: string;
  status: "Active" | "Inactive" | "On Leave";
  email: string;
}

const statusColorMap: Record<string, "success" | "danger" | "warning"> = {
  Active: "success",
  Inactive: "danger",
  "On Leave": "warning",
};

const users: User[] = [
  { email: "kate@acme.com", id: 1, name: "Kate Moore", role: "CEO", status: "Active" },
  { email: "john@acme.com", id: 2, name: "John Smith", role: "CTO", status: "Active" },
  { email: "sara@acme.com", id: 3, name: "Sara Johnson", role: "CMO", status: "On Leave" },
  { email: "michael@acme.com", id: 4, name: "Michael Brown", role: "CFO", status: "Active" },
  {
    email: "emily@acme.com",
    id: 5,
    name: "Emily Davis",
    role: "Product Manager",
    status: "Inactive",
  },
  { email: "davis@acme.com", id: 6, name: "Davis Wilson", role: "Lead Designer", status: "Active" },
  {
    email: "olivia@acme.com",
    id: 7,
    name: "Olivia Martinez",
    role: "Frontend Engineer",
    status: "Active",
  },
  {
    email: "james@acme.com",
    id: 8,
    name: "James Taylor",
    role: "Backend Engineer",
    status: "Active",
  },
];

// --- Table features (sorting + pagination row models) ----------------------
const features = tableFeatures({
  paginatedRowModel: createPaginatedRowModel(),
  rowPaginationFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});

// --- Column Definitions ---------------------------------------------------
const columnHelper = createColumnHelper<typeof features, User>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", { header: "Name" }),
  columnHelper.accessor("role", { header: "Role" }),
  columnHelper.accessor("status", {
    cell: (info) => (
      <Chip color={statusColorMap[info.getValue()]} size="sm" variant="soft">
        {info.getValue()}
      </Chip>
    ),
    header: "Status",
  }),
  columnHelper.accessor("email", { header: "Email" }),
]);

// --- Component ------------------------------------------------------------
const PAGE_SIZE = 4;

export function TanstackTable() {
  const sortDescriptor = signal<SortDescriptor | null>(null);
  const pagination = signal<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });

  const table = createTable({
    columns,
    data: users,
    features,
    getRowId: (row) => String(row.id),
    state: { pagination, sorting: sortingAtom(sortDescriptor) },
  });

  const pages = Array.from({ length: table.getPageCount() }, (_, i) => i + 1);
  const start = () => pagination().pageIndex * PAGE_SIZE + 1;
  const end = () => Math.min((pagination().pageIndex + 1) * PAGE_SIZE, users.length);

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="TanStack Table example" class="min-w-[600px]" sortDescriptor={sortDescriptor}>
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
          <Pagination.Summary>
            {start()} to {end()} of {users.length} results
          </Pagination.Summary>
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
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TanstackTable />
    </div>
  );
}
