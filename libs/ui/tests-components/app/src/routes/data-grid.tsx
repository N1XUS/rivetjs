// DataGrid (Rivet addition) on a resumed page: `#dg` 6 people (sortable Name / Age, multiple selection with checkboxes,
// resizable columns, `onRowAction` writes `#dg-action`), `#dg-virtual` 10 000 virtualized rows (400 px high, 40 px rows),
// `#dg-pinned` 320 px wide with pinned start / end columns (row 2 selected) and `#dg-secondary` the secondary variant
// virtualized (visual regressions: frame corners while scrolled, opaque pinned cells, resizer inside the frame).
// Columns are component-local (their `cell` functions are resumable); the data is module-level plain data.
import { signal } from "@rivetjs/reactivity";
import { DataGrid } from "@rivetjs/ui/data-grid";
import type { DataGridSelection } from "@rivetjs/ui/data-grid";

interface Person {
  id: number;
  name: string;
  age: number;
  team: string;
}
const PEOPLE: Person[] = [
  { id: 1, name: "Mara Quinn", age: 41, team: "Platform" },
  { id: 2, name: "Ilya Brandt", age: 29, team: "Design" },
  { id: 3, name: "Tomasz Ek", age: 35, team: "Platform" },
  { id: 4, name: "Noor Haddad", age: 52, team: "Finance" },
  { id: 5, name: "Celia Varga", age: 24, team: "Design" },
  { id: 6, name: "Bo Lindqvist", age: 38, team: "Support" },
];
const MANY = Array.from({ length: 10_000 }, (_, i) => ({ id: i, name: `Item ${i}`, age: (i * 7) % 90, team: ["Platform", "Design", "Finance"][i % 3]! }));

export default function DataGridStories() {
  const selected = signal<DataGridSelection>(new Set());
  const action = signal("");
  const columns = [
    { id: "name", header: "Name", accessorKey: "name" as const, allowsSorting: true, width: 220 },
    { id: "age", header: "Age", accessorKey: "age" as const, allowsSorting: true, align: "end" as const, width: 100 },
    { id: "team", header: "Team", cell: (p: Person) => <span class="team">{p.team}</span> },
  ];
  const virtualColumns = [
    { id: "name", header: "Name", accessorKey: "name" as const, allowsSorting: true },
    { id: "age", header: "Age", accessorKey: "age" as const, allowsSorting: true },
    { id: "team", header: "Team", accessorKey: "team" as const },
  ];
  const pinnedColumns = [
    { id: "name", header: "Name", accessorKey: "name" as const, width: 140, pinned: "start" as const },
    { id: "age", header: "Age", accessorKey: "age" as const, width: 160 },
    { id: "team", header: "Team", accessorKey: "team" as const, width: 160 },
    { id: "edit", header: "Edit", width: 80, pinned: "end" as const, cell: (p: Person) => <span class="edit">#{p.id}</span> },
  ];
  return (
    <main style={{ padding: "16px", maxWidth: "720px" }}>
      <DataGrid<Person>
        id="dg"
        aria-label="People"
        data={PEOPLE}
        columns={columns}
        selectionMode="multiple"
        showSelectionCheckboxes
        selectedKeys={selected}
        allowsColumnResize
        onRowAction={(key) => action.set(String(key))}
      />
      <p id="dg-selected">{selected() === "all" ? "all" : [...(selected() as Set<number>)].join(",")}</p>
      <p id="dg-action">{action()}</p>
      <DataGrid<Person>
        id="dg-virtual"
        aria-label="Many"
        data={MANY}
        columns={virtualColumns}
        virtualized
        rowHeight={40}
        height={400}
        selectionMode="multiple"
      />
      <DataGrid<Person>
        id="dg-pinned"
        aria-label="Pinned"
        data={PEOPLE}
        columns={pinnedColumns}
        selectionMode="multiple"
        defaultSelectedKeys={new Set([2])}
        style={{ width: "320px" }}
      />
      <DataGrid<Person>
        id="dg-secondary"
        aria-label="Many (secondary)"
        variant="secondary"
        data={MANY}
        columns={virtualColumns}
        virtualized
        rowHeight={40}
        height={240}
      />
    </main>
  );
}
