// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set scoped from public docs of commercial UI kits, own data).
import { Icon } from "@rivetjs/kit/icon";
import { DataGrid } from "@rivetjs/ui/data-grid";
import { CalendarDays, UserRound } from "lucide";

export const head = { title: "DataGrid: Custom Header Rendering" };

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
export function DataGridCustomHeader() {
  const columns = [
    {
      id: "name",
      accessorKey: "name" as const,
      allowsSorting: true,
      header: () => (
        <span class="inline-flex items-center gap-1.5">
          <Icon icon={UserRound} class="size-3.5" aria-hidden="true" />
          Name
        </span>
      ),
    },
    {
      id: "joined",
      accessorKey: "joined" as const,
      allowsSorting: true,
      header: ({ sortDirection }: { sortDirection: () => "ascending" | "descending" | undefined }) => (
        <span class="inline-flex items-center gap-1.5">
          <Icon icon={CalendarDays} class="size-3.5" aria-hidden="true" />
          {sortDirection() === "descending" ? "Joined (newest first)" : sortDirection() === "ascending" ? "Joined (oldest first)" : "Joined"}
        </span>
      ),
    },
  ];
  return <DataGrid<Member> aria-label="Custom headers" data={MEMBERS} columns={columns} class="w-[520px]" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridCustomHeader />
    </div>
  );
}
