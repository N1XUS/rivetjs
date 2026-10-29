// Rivet-authored demo (`@rivetjs/cdk/data-grid`: feature set scoped from public docs of commercial UI kits, independent implementation).
import { signal } from "@rivetjs/reactivity";
import { DataGrid, type Selection } from "@rivetjs/cdk/data-grid";

export const head = { title: "DataGrid" };

interface Planet {
  id: number;
  name: string;
  moons: number;
  distance: number;
}

const PLANETS: Planet[] = [
  { id: 1, name: "Mercury", moons: 0, distance: 0.39 },
  { id: 2, name: "Venus", moons: 0, distance: 0.72 },
  { id: 3, name: "Earth", moons: 1, distance: 1 },
  { id: 4, name: "Mars", moons: 2, distance: 1.52 },
  { id: 5, name: "Jupiter", moons: 95, distance: 5.2 },
  { id: 6, name: "Saturn", moons: 146, distance: 9.54 },
];

// #region demo
export default function DataGridBasic() {
  const selected = signal<Selection>(new Set());
  const columns = [
    { id: "name", header: "Planet", accessorKey: "name" as const, allowsSorting: true, width: 200 },
    { id: "moons", header: "Moons", accessorKey: "moons" as const, allowsSorting: true, align: "end" as const },
    { id: "distance", header: "Distance (AU)", accessorKey: "distance" as const, allowsSorting: true, align: "end" as const },
  ];
  return (
    <div>
      <DataGrid<Planet>
        aria-label="Planets"
        data={PLANETS}
        columns={columns}
        selectionMode="multiple"
        showSelectionCheckboxes
        selectedKeys={selected}
        allowsColumnResize
      />
      <p id="planets-selected">{selected() === "all" ? "All selected" : `${(selected() as Set<number>).size} selected`}</p>
    </div>
  );
}
// #endregion
