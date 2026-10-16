// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/tanstack-table.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
// Not yet ported: TanStack Table has no Rivet adapter (`@tanstack/react-table` `useTable` / `flexRender`); the
// sorting + pagination row models are computed from signals instead, same markup.
import { computed, signal } from "@rivetjs/reactivity";
import type { SortDescriptor } from "@rivetjs/cdk/collections/types";
import { Chip } from "@rivetjs/ui/chip";
import { Pagination } from "@rivetjs/ui/pagination";
import { Table } from "@rivetjs/ui/table";

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

// --- Column Definitions (TanStack `columnHelper.accessor` stand-in) -------
const columns: { id: keyof User; header: string }[] = [
  { header: "Name", id: "name" },
  { header: "Role", id: "role" },
  { header: "Status", id: "status" },
  { header: "Email", id: "email" },
];

// --- Row models (TanStack sorted + paginated row model stand-in) ----------
const PAGE_SIZE = 4;

function sortRows(rows: User[], descriptor: SortDescriptor | null): User[] {
  if (!descriptor) return rows;
  const col = descriptor.column as keyof User;
  const sign = descriptor.direction === "descending" ? -1 : 1;

  return [...rows].sort((a, b) => sign * String(a[col]).localeCompare(String(b[col]), undefined, { numeric: true }));
}

// --- Component ------------------------------------------------------------
export function TanstackTable() {
  const sortDescriptor = signal<SortDescriptor | null>(null);
  const pageIndex = signal(0);

  const pageCount = Math.ceil(users.length / PAGE_SIZE);
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const rows = computed(() => sortRows(users, sortDescriptor()).slice(pageIndex() * PAGE_SIZE, (pageIndex() + 1) * PAGE_SIZE));
  const start = () => pageIndex() * PAGE_SIZE + 1;
  const end = () => Math.min((pageIndex() + 1) * PAGE_SIZE, users.length);

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="TanStack Table example" class="min-w-[600px]" sortDescriptor={sortDescriptor}>
          <Table.Header>
            {columns.map((column) => (
              <Table.Column allowsSorting id={column.id} isRowHeader={column.id === "name"}>
                {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{column.header}</Table.SortableColumnHeader>}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body items={rows}>
            {(user: User) => (
              <Table.Row id={user.id}>
                <Table.Cell>{user.name}</Table.Cell>
                <Table.Cell>{user.role}</Table.Cell>
                <Table.Cell>
                  <Chip color={statusColorMap[user.status]} size="sm" variant="soft">
                    {user.status}
                  </Chip>
                </Table.Cell>
                <Table.Cell>{user.email}</Table.Cell>
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
              <Pagination.Previous isDisabled={pageIndex() === 0} onPress={() => pageIndex.update((p: number) => p - 1)}>
                <Pagination.PreviousIcon />
                Prev
              </Pagination.Previous>
            </Pagination.Item>
            {pages.map((p) => (
              <Pagination.Item>
                <Pagination.Link isActive={p === pageIndex() + 1} onPress={() => pageIndex.set(p - 1)}>
                  {p}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next isDisabled={pageIndex() === pageCount - 1} onPress={() => pageIndex.update((p: number) => p + 1)}>
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
