// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set inspired by HeroUI Pro's public docs, own data).
import { DataGrid } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Usage" };

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
export function DataGridBasic() {
  const columns = [
    { id: "name", header: "Name", accessorKey: "name" as const, isRowHeader: true },
    { id: "role", header: "Role", accessorKey: "role" as const },
    { id: "team", header: "Team", accessorKey: "team" as const },
  ];
  return <DataGrid<Member> aria-label="Team members" data={MEMBERS} columns={columns} class="w-[560px]" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridBasic />
    </div>
  );
}
