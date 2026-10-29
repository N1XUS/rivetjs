// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set scoped from public docs of commercial UI kits, own data).
import { computed, signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { DataGrid } from "@rivetjs/ui/data-grid";
import type { DataGridSelection } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Bulk actions" };

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
export function DataGridBulkActions() {
  const rows = signal(MEMBERS);
  const selected = signal<DataGridSelection>(new Set());
  const count = computed(() => (selected() === "all" ? rows().length : (selected() as Set<number>).size));
  const columns = [
    { id: "name", header: "Name", accessorKey: "name" as const },
    { id: "team", header: "Team", accessorKey: "team" as const },
  ];
  return (
    <div class="flex w-[520px] flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <span id="data-grid-bulk-count" class="text-sm text-muted">
          {count()} selected
        </span>
        <div class="flex gap-2">
          <Button size="sm" variant="secondary" isDisabled={() => count() === 0} onPress={() => selected.set(new Set())}>
            Clear
          </Button>
          <Button
            size="sm"
            variant="danger"
            isDisabled={() => count() === 0}
            onPress={() => {
              const sel = selected();
              rows.set(sel === "all" ? [] : rows().filter((m) => !sel.has(m.id)));
              selected.set(new Set());
            }}
          >
            Archive
          </Button>
        </div>
      </div>
      <DataGrid<Member> aria-label="Members" data={rows} columns={columns} selectionMode="multiple" showSelectionCheckboxes selectedKeys={selected} />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridBulkActions />
    </div>
  );
}
