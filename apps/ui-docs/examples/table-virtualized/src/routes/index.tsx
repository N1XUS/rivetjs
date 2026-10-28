import { signal } from "@rivetjs/reactivity";
import { Table } from "@rivetjs/ui/table";
import type { SortDescriptor } from "@rivetjs/cdk/collections/types";

export const head = { title: "Table: Virtualized" };

// #region demo
const rows = Array.from({ length: 10000 }, (_, id) => ({
  id: String(id),
  name: `Member ${String(id + 1).padStart(5, "0")}`,
  role: id % 2 ? "Designer" : "Engineer",
}));
const columns = [
  { id: "name", name: "Name", isRowHeader: true, allowsSorting: true },
  { id: "role", name: "Role" },
];

export function Virtualized() {
  const sort = signal<SortDescriptor | null>(null);
  return (
    <Table
      virtualized
      aria-label="10,000 members"
      class="w-fit max-w-full"
      columns={columns}
      items={sort()?.direction === "descending" ? [...rows].reverse() : rows}
      selectionMode="single"
      sortDescriptor={sort}
      rowHeight={48}
      headingHeight={40}
      initialSize={{ width: 600, height: 320 }}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Virtualized />
    </div>
  );
}
