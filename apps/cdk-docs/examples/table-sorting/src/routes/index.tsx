import { computed, signal } from "@rivetjs/reactivity";
import { ArrowUp } from "lucide";
import { Cell, Column, Row, Table, TableBody, TableHeader, type ColumnProps } from "@rivetjs/cdk/table";
import type { SortDescriptor } from "@rivetjs/cdk/collections/types";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Table: sorting" };

interface Pokemon {
  id: number;
  name: string;
  type: string;
  level: number;
}

const rows: Pokemon[] = [
  { id: 1, name: "Charizard", type: "Fire, Flying", level: 67 },
  { id: 2, name: "Blastoise", type: "Water", level: 56 },
  { id: 3, name: "Venusaur", type: "Grass, Poison", level: 83 },
  { id: 4, name: "Pikachu", type: "Electric", level: 100 },
];

const th =
  "border-b border-slate-200 px-3 py-1.5 text-left font-semibold outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-sky-500";
const td = "px-3 py-1.5";

/** A sortable column header: the label and an arrow that follows the sort direction. */
function SortableColumn(props: ColumnProps & { label: string }) {
  return (
    <Column {...props} allowsSorting class={th + " cursor-pointer data-[hovered]:bg-slate-50"}>
      {({ sortDirection }) => (
        <span class="flex items-center gap-1">
          {props.label}
          <Icon
            icon={ArrowUp}
            size={14}
            class={sortDirection() === undefined ? "invisible" : sortDirection() === "descending" ? "rotate-180 transition-transform" : "transition-transform"}
          />
        </span>
      )}
    </Column>
  );
}

// #region demo
export default function SortableTable() {
  const sort = signal<SortDescriptor | null>({ column: "name", direction: "ascending" });
  const sorted = computed(() => {
    const s = sort();
    if (!s) return rows;
    const key = s.column as keyof Pokemon;
    return rows.toSorted((a, b) => (a[key] < b[key] ? -1 : 1) * (s.direction === "descending" ? -1 : 1));
  });
  return (
    <section class="m-4 grid gap-2 text-sm">
      <Table id="pokemon" aria-label="Favorite pokemon" sortDescriptor={sort} class="border-collapse">
        <TableHeader>
          <SortableColumn id="name" isRowHeader label="Name" />
          <SortableColumn id="type" label="Type" />
          <SortableColumn id="level" label="Level" />
        </TableHeader>
        <TableBody items={sorted}>
          {(item: Pokemon) => (
            <Row>
              <Cell class={td}>{item.name}</Cell>
              <Cell class={td}>{item.type}</Cell>
              <Cell class={td}>{String(item.level)}</Cell>
            </Row>
          )}
        </TableBody>
      </Table>
      <p id="pokemon-sort">Sorted by: {sort() ? `${String(sort()!.column)} ${sort()!.direction}` : "none"}</p>
    </section>
  );
}
// #endregion
