// Lane `data-grid`: @rivetjs/cdk/data-grid (headless), multiple selection with checkboxes, two sortable columns.
import { signal } from "@rivetjs/reactivity";
import { render } from "@rivetjs/runtime/dom";
import { DataGrid, type DataGridColumn, type Selection, type SortDescriptor } from "@rivetjs/cdk/data-grid";
import { people, type GridBench, type Person } from "./shape.ts";

const columns: DataGridColumn<Person>[] = [
  { id: "name", header: "Name", accessorKey: "name", allowsSorting: true, width: 220 },
  { id: "email", header: "Email", accessorKey: "email", width: 280 },
  { id: "role", header: "Role", accessorKey: "role", width: 140 },
  { id: "team", header: "Team", accessorKey: "team", width: 140 },
  { id: "age", header: "Age", accessorKey: "age", allowsSorting: true, width: 80, align: "end" },
  { id: "salary", header: "Salary", accessorKey: "salary", allowsSorting: true, width: 120, align: "end" },
];

let dispose: (() => void) | null = null;
const query = signal("");
const sort = signal<SortDescriptor | null>(null);
const selected = signal<Selection>(new Set());

const host = () => document.querySelector<HTMLElement>("#host")!;
const bench: GridBench = {
  mount(rows, virtual) {
    const data = people(rows);
    query.set("");
    sort.set(null);
    selected.set(new Set());
    dispose = render(
      () => (
        <DataGrid
          aria-label="People"
          data={data}
          columns={columns}
          selectionMode="multiple"
          showSelectionCheckboxes
          selectedKeys={selected}
          sortDescriptor={sort}
          sortMode="client"
          filter={(p) => !query() || p.name.includes(query())}
          virtualized={virtual}
          height={virtual ? 600 : undefined}
          rowHeight={36}
        />
      ),
      host(),
    );
    return bench.bodyRows();
  },
  sort() {
    const s = sort();
    sort.set({ column: "age", direction: s?.direction === "ascending" ? "descending" : "ascending" });
  },
  filter(q) {
    query.set(q);
  },
  selectAll() {
    selected.set("all");
  },
  scrollTo(top) {
    const el = bench.scroller();
    el.scrollTop = top;
    el.dispatchEvent(new Event("scroll"));
  },
  scroller: () => host().querySelector<HTMLElement>(".rv-DataGrid-scroll")!,
  bodyRows: () => host().querySelectorAll("tbody > tr[data-key]").length,
  dispose() {
    dispose?.();
    dispose = null;
    host().textContent = "";
  },
};
(window as unknown as { gridBench: GridBench }).gridBench = bench;
