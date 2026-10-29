// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set scoped from public docs of commercial UI kits, own data).
import { Avatar } from "@rivetjs/ui/avatar";
import { Chip } from "@rivetjs/ui/chip";
import { DataGrid } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Custom Cell Rendering" };

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
const STATUS_COLOR = { active: "success", invited: "accent", suspended: "danger" } as const;

// #region demo
export function DataGridCustomCells() {
  const columns = [
    {
      id: "name",
      header: "Member",
      cell: (m: Member) => (
        <div class="flex items-center gap-3">
          <Avatar size="sm">
            <Avatar.Fallback>{m.name.slice(0, 1)}</Avatar.Fallback>
          </Avatar>
          <div class="flex flex-col">
            <span class="font-medium">{m.name}</span>
            <span class="text-xs text-muted">{m.email}</span>
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (m: Member) => (
        <Chip size="sm" variant="soft" color={STATUS_COLOR[m.status]}>
          {m.status}
        </Chip>
      ),
    },
    { id: "joined", header: "Joined", accessorKey: "joined" as const, align: "end" as const },
  ];
  return <DataGrid<Member> aria-label="Members with avatars" data={MEMBERS} columns={columns} class="w-[600px]" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridCustomCells />
    </div>
  );
}
