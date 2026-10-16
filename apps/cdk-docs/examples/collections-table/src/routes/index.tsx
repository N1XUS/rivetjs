import { computed, signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { CollectionBuilder } from "@rivetjs/cdk/collections/builder";
import { Cell, Column, Row, TableBody, TableCollection, TableHeader, ariaSort, nextSortDescriptor, tableBuilderContext } from "@rivetjs/cdk/collections/table";
import type { CollectionElement, Key, SortDescriptor } from "@rivetjs/cdk/collections/types";
import { ChevronDown, ChevronUp } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Table collection and sorting" };

interface Planet {
  id: number;
  name: string;
  moons: number;
  [column: string]: string | number;
}

const columns = [
  { key: "name", name: "Planet", isRowHeader: true },
  { key: "moons", name: "Moons" },
];
const planets: Planet[] = [
  { id: 1, name: "Mars", moons: 2 },
  { id: 2, name: "Jupiter", moons: 95 },
  { id: 3, name: "Earth", moons: 1 },
];

const tableOf = (items: Planet[]) => {
  // The builder mixes column and row values: type it loosely, as React Stately does.
  const context = tableBuilderContext<any>();
  const nodes = new CollectionBuilder<any>().build(
    {
      children: [
        TableHeader({
          columns,
          children: (column: (typeof columns)[number]) =>
            Column({ key: column.key, isRowHeader: column.isRowHeader, allowsSorting: true, children: column.name }),
        }),
        TableBody({
          items,
          children: (planet: Planet): CollectionElement<any> =>
            Row({ key: planet.id, children: (columnKey: Key) => Cell({ children: String(planet[columnKey as string]) }) }),
        }),
      ],
    },
    context,
  );
  return new TableCollection<any>(nodes as Iterable<never>, null, context);
};

// #region demo
export default function Planets() {
  const sort = signal<SortDescriptor | null>(null);
  // Plain data derived from the collection, re-derived when the sort changes.
  const table = computed(() => {
    const descriptor = sort();
    const items = [...planets];
    if (descriptor) {
      const sign = descriptor.direction === "ascending" ? 1 : -1;
      items.sort((a, b) => (a[descriptor.column as string]! > b[descriptor.column as string]! ? sign : -sign));
    }
    const collection = tableOf(items);
    return {
      columns: collection.columns.map((column) => ({ key: column.key, name: column.textValue })),
      rows: [...collection].map((row) => ({ key: row.key, cells: [...collection.getChildren(row.key)].map((cell) => cell.textValue) })),
      rowHeader: [...collection.rowHeaderColumnKeys].join(","),
    };
  });
  return (
    <section class="m-4 grid gap-2 text-sm">
      <table id="planets" class="w-72 border-collapse">
        <thead>
          <tr>
            <For each={() => table().columns} by={(column) => column.key}>
              {(column) => (
                <th id={"col-" + String(column().key)} aria-sort={ariaSort(sort(), column().key)} class="border-b border-slate-300 text-left">
                  <button type="button" class="font-semibold" onClick={() => sort.set(nextSortDescriptor(sort(), column().key))}>
                    {column().name}{" "}
                    {sort()?.column === column().key ? (
                      sort()!.direction === "ascending" ? (
                        <Icon icon={ChevronUp} size={14} />
                      ) : (
                        <Icon icon={ChevronDown} size={14} />
                      )
                    ) : (
                      ""
                    )}
                  </button>
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody id="rows">
          <For each={() => table().rows} by={(row) => row.key}>
            {(row) => (
              <tr>
                <For each={() => row().cells} by={(cell) => cell}>
                  {(cell) => <td>{cell()}</td>}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <p id="row-header" class="text-slate-600">
        rowHeaderColumnKeys: {table().rowHeader}
      </p>
    </section>
  );
}
// #endregion
