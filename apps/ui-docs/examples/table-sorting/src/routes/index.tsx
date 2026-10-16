// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/sorting.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { computed, signal } from "@rivetjs/reactivity";
import type { SortDescriptor } from "@rivetjs/cdk/collections/types";
import { Table } from "@rivetjs/ui/table";

export const head = { title: "Table: Sorting" };

// #region demo

interface User {
  id: number;
  name: string;
  role: string;
  status: string;
  email: string;
}

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
];

export function Sorting() {
  const sortDescriptor = signal<SortDescriptor | null>({
    column: "name",
    direction: "ascending",
  });

  const sortedUsers = computed(() => {
    const descriptor = sortDescriptor();
    if (!descriptor) return users;
    return [...users].sort((a, b) => {
      const col = descriptor.column as keyof User;
      const first = String(a[col]);
      const second = String(b[col]);
      let cmp = first.localeCompare(second);

      if (descriptor.direction === "descending") {
        cmp *= -1;
      }

      return cmp;
    });
  });

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Sortable table" class="min-w-[600px]" sortDescriptor={sortDescriptor}>
          <Table.Header>
            <Table.Column allowsSorting isRowHeader id="name">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Name</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="role">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Role</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="status">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Status</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="email">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Email</Table.SortableColumnHeader>}
            </Table.Column>
          </Table.Header>
          <Table.Body items={sortedUsers}>
            {(user: User) => (
              <Table.Row id={user.id}>
                <Table.Cell>{user.name}</Table.Cell>
                <Table.Cell>{user.role}</Table.Cell>
                <Table.Cell>{user.status}</Table.Cell>
                <Table.Cell>{user.email}</Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sorting />
    </div>
  );
}
