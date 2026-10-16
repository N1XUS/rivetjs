// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set inspired by HeroUI Pro's public docs, own data).
import { signal } from "@rivetjs/reactivity";
import { DataGrid } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Column resizing" };

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
export function DataGridResizing() {
  const widths = signal("");
  const columns = [
    { id: "name", header: "Name", accessorKey: "name" as const, width: 180, minWidth: 120, maxWidth: 320 },
    { id: "email", header: "Email", accessorKey: "email" as const, width: 240 },
    { id: "role", header: "Role", accessorKey: "role" as const, allowsResizing: false },
  ];
  return (
    <div class="flex w-[640px] flex-col gap-3">
      <DataGrid<Member>
        aria-label="Resizable columns"
        data={MEMBERS}
        columns={columns}
        allowsColumnResize
        onColumnResizeEnd={(map) => widths.set([...map].map(([id, w]) => `${id} ${Math.round(w)}px`).join(", "))}
      />
      <p class="text-sm text-muted">{widths() || "Drag a column edge"}</p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridResizing />
    </div>
  );
}
