// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set scoped from public docs of commercial UI kits, own data).
import { computed, signal } from "@rivetjs/reactivity";
import { DataGrid } from "@rivetjs/ui/data-grid";
import type { DataGridSortDescriptor } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Server-side sorting" };

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  team: string;
  status: "active" | "invited" | "suspended";
  joined: string;
}

const MEMBERS: Member[] = [
  { id: 1, name: "Mara Quinn", email: "mara@northwind.dev", role: "Staff engineer", team: "Platform", status: "active", joined: "2021-03-14" },
  { id: 2, name: "Ilya Brandt", email: "ilya@northwind.dev", role: "Product designer", team: "Design", status: "active", joined: "2022-07-01" },
  { id: 3, name: "Tomasz Ek", email: "tomasz@northwind.dev", role: "SRE", team: "Platform", status: "invited", joined: "2024-01-22" },
  { id: 4, name: "Noor Haddad", email: "noor@northwind.dev", role: "Controller", team: "Finance", status: "active", joined: "2019-11-05" },
  { id: 5, name: "Celia Varga", email: "celia@northwind.dev", role: "Researcher", team: "Design", status: "suspended", joined: "2023-05-30" },
  { id: 6, name: "Bo Lindqvist", email: "bo@northwind.dev", role: "Support lead", team: "Support", status: "active", joined: "2020-09-18" },
];

// #region demo
export function DataGridServerSorting() {
  const sort = signal<DataGridSortDescriptor | null>({ column: "joined", direction: "descending" });
  const loading = signal(false);
  // Stand-in for a request: the "server" returns the rows already sorted.
  const rows = signal(MEMBERS.slice().sort((a, b) => b.joined.localeCompare(a.joined)));
  const status = computed(() => (loading() ? "Loading…" : `Sorted by ${sort()?.column} (${sort()?.direction})`));
  const columns = [
    { id: "name", header: "Name", accessorKey: "name" as const, allowsSorting: true },
    { id: "joined", header: "Joined", accessorKey: "joined" as const, allowsSorting: true },
  ];
  return (
    <div class="flex w-[520px] flex-col gap-3">
      <DataGrid<Member>
        aria-label="Server-sorted members"
        data={rows}
        columns={columns}
        sortDescriptor={sort}
        onSortChange={(next) => {
          loading.set(true);
          setTimeout(() => {
            const key = next.column as "name" | "joined";
            const sign = next.direction === "ascending" ? 1 : -1;
            rows.set(MEMBERS.slice().sort((a, b) => sign * a[key].localeCompare(b[key])));
            loading.set(false);
          }, 300);
        }}
      />
      <p id="data-grid-server-sorting-status" class="text-sm text-muted">
        {status()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridServerSorting />
    </div>
  );
}
