// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set inspired by HeroUI Pro's public docs, own data).
import { DataGrid } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Expandable rows" };

interface Unit {
  id: string;
  name: string;
  head: string;
  people: number;
  children?: Unit[];
}

const ORG: Unit[] = [
  {
    id: "eng",
    name: "Engineering",
    head: "Mara Quinn",
    people: 42,
    children: [
      { id: "eng-platform", name: "Platform", head: "Tomasz Ek", people: 18, children: [{ id: "eng-platform-sre", name: "SRE", head: "Ana Ruiz", people: 6 }] },
      { id: "eng-apps", name: "Applications", head: "Lev Petrov", people: 24 },
    ],
  },
  { id: "design", name: "Design", head: "Ilya Brandt", people: 9, children: [{ id: "design-research", name: "Research", head: "Celia Varga", people: 3 }] },
  { id: "finance", name: "Finance", head: "Noor Haddad", people: 5 },
];

// #region demo
export function DataGridExpandable() {
  const columns = [
    { id: "name", header: "Unit", accessorKey: "name" as const },
    { id: "head", header: "Head", accessorKey: "head" as const },
    { id: "people", header: "People", accessorKey: "people" as const, align: "end" as const },
  ];
  return (
    <DataGrid<Unit>
      aria-label="Organisation"
      data={ORG}
      columns={columns}
      getChildren={(unit) => unit.children}
      defaultExpandedKeys={["eng"]}
      class="w-[560px]"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridExpandable />
    </div>
  );
}
