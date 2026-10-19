// Lane `cdk-table`: the RAC-faithful @rivetjs/cdk/table (collection build, not wrapped in a Virtualizer), same columns / features:
// multiple selection with checkboxes, client sort + filter through computed items (RAC docs pattern).
import { computed, signal } from "@rivetjs/reactivity";
import { render } from "@rivetjs/runtime/dom";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import type { Selection, SortDescriptor } from "@rivetjs/cdk/collections/types";
import { people, type GridBench, type Person } from "./shape.ts";

let dispose: (() => void) | null = null;
const query = signal("");
const sort = signal<SortDescriptor | null>(null);
const selected = signal<Selection>(new Set());
const data = signal<Person[]>([]);
const collator = new Intl.Collator("en-US", { numeric: true });
const items = computed(() => {
  const q = query();
  let rows = q ? data().filter((p) => p.name.includes(q)) : data();
  const s = sort();
  if (s) {
    const key = s.column as keyof Person;
    const sign = s.direction === "descending" ? -1 : 1;
    rows = [...rows].sort(
      (a, b) => sign * (typeof a[key] === "number" ? (a[key] as number) - (b[key] as number) : collator.compare(String(a[key]), String(b[key]))),
    );
  }
  return rows;
});

const host = () => document.querySelector<HTMLElement>("#host")!;
const bench: GridBench = {
  mount(rows) {
    data.set(people(rows));
    query.set("");
    sort.set(null);
    selected.set(new Set());
    dispose = render(
      () => (
        <div class="scroll" style={{ overflow: "auto", height: "600px" }}>
          <Table aria-label="People" selectionMode="multiple" selectedKeys={selected} sortDescriptor={sort} onSortChange={(d: SortDescriptor) => sort.set(d)}>
            <TableHeader>
              <Column>
                <Checkbox slot="selection" />
              </Column>
              <Column id="name" isRowHeader allowsSorting>
                Name
              </Column>
              <Column id="email">Email</Column>
              <Column id="role">Role</Column>
              <Column id="team">Team</Column>
              <Column id="age" allowsSorting>
                Age
              </Column>
              <Column id="salary" allowsSorting>
                Salary
              </Column>
            </TableHeader>
            <TableBody items={items}>
              {(p: Person) => (
                <Row id={p.id}>
                  <Cell>
                    <Checkbox slot="selection" />
                  </Cell>
                  <Cell>{p.name}</Cell>
                  <Cell>{p.email}</Cell>
                  <Cell>{p.role}</Cell>
                  <Cell>{p.team}</Cell>
                  <Cell>{p.age}</Cell>
                  <Cell>{p.salary}</Cell>
                </Row>
              )}
            </TableBody>
          </Table>
        </div>
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
  scroller: () => host().querySelector<HTMLElement>(".scroll")!,
  bodyRows: () => host().querySelectorAll("tbody > tr").length,
  dispose() {
    dispose?.();
    dispose = null;
    host().textContent = "";
  },
};
(window as unknown as { gridBench: GridBench }).gridBench = bench;
