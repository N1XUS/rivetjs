// Rivet-authored Table demo (Rivet addition: data-driven root; same rows as the HeroUI sorting demo).
import { computed, signal } from "@rivetjs/reactivity";
import type { SortDescriptor } from "@rivetjs/cdk/collections/types";
import { Table } from "@rivetjs/ui/table";

export const head = { title: "Table: Data" };

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
  { email: "emily@acme.com", id: 5, name: "Emily Davis", role: "Product Manager", status: "Inactive" },
];

const columns = [
  { id: "name", name: "Name", isRowHeader: true, allowsSorting: true },
  { id: "role", name: "Role", allowsSorting: true },
  { id: "status", name: "Status" },
  { id: "email", name: "Email" },
];

export function Data() {
  const sortDescriptor = signal<SortDescriptor | null>({ column: "name", direction: "ascending" });
  const sortedUsers = computed(() => {
    const descriptor = sortDescriptor();
    if (!descriptor) return users;
    const col = descriptor.column as keyof User;
    const sign = descriptor.direction === "descending" ? -1 : 1;
    return [...users].sort((a, b) => sign * String(a[col]).localeCompare(String(b[col])));
  });

  return <Table aria-label="Team members" class="w-full max-w-2xl" columns={columns} items={sortedUsers()} sortDescriptor={sortDescriptor} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Data />
    </div>
  );
}
