// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/pagination.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { computed, signal } from "@rivetjs/reactivity";
import { Pagination } from "@rivetjs/ui/pagination";
import { Table } from "@rivetjs/ui/table";

export const head = { title: "Table: Pagination" };

// #region demo

const columns = [
  { id: "name", name: "Name" },
  { id: "role", name: "Role" },
  { id: "status", name: "Status" },
  { id: "email", name: "Email" },
];

const users = [
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

const ROWS_PER_PAGE = 4;

export function PaginationDemo() {
  const page = signal(1);
  const totalPages = Math.ceil(users.length / ROWS_PER_PAGE);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  const paginatedItems = computed(() => {
    const start = (page() - 1) * ROWS_PER_PAGE;

    return users.slice(start, start + ROWS_PER_PAGE);
  });

  const start = () => (page() - 1) * ROWS_PER_PAGE + 1;
  const end = () => Math.min(page() * ROWS_PER_PAGE, users.length);

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Table with pagination" class="min-w-[600px]">
          <Table.Header columns={columns}>
            {(column: (typeof columns)[number]) => <Table.Column isRowHeader={column.id === "name"}>{column.name}</Table.Column>}
          </Table.Header>
          <Table.Body items={paginatedItems}>
            {(user: (typeof users)[number]) => (
              <Table.Row>
                <Table.Collection items={columns}>
                  {(column: (typeof columns)[number]) => <Table.Cell>{user[column.id as keyof typeof user]}</Table.Cell>}
                </Table.Collection>
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
              <Pagination.Previous isDisabled={page() === 1} onPress={() => page.update((p: number) => Math.max(1, p - 1))}>
                <Pagination.PreviousIcon />
                Prev
              </Pagination.Previous>
            </Pagination.Item>
            {pages.map((p) => (
              <Pagination.Item>
                <Pagination.Link isActive={p === page()} onPress={() => page.set(p)}>
                  {p}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next isDisabled={page() === totalPages} onPress={() => page.update((p: number) => Math.min(totalPages, p + 1))}>
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
      <PaginationDemo />
    </div>
  );
}
