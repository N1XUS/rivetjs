import { computed, signal } from "@rivetjs/reactivity";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { Cell, Column, ColumnResizer, ResizableTableContainer, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import type { Key, Selection, SortDescriptor } from "@rivetjs/cdk/types";

export const head = { title: "Table" };

interface Pet {
  id: string;
  name: string;
  kind: string;
  age: number;
}

const PETS: Pet[] = [
  { id: "p1", name: "Milo", kind: "Cat", age: 4 },
  { id: "p2", name: "Bella", kind: "Dog", age: 2 },
  { id: "p3", name: "Coco", kind: "Parrot", age: 7 },
];

export default function TableStory() {
  const sort = signal<SortDescriptor | null>(null);
  const selected = signal<Selection>(new Set<Key>());
  const action = signal("none");
  const widths = signal("");
  const pets = computed(() => {
    const s = sort();
    if (!s) return PETS;
    const sorted = [...PETS].sort((a, b) => {
      const x = a[s.column as keyof Pet];
      const y = b[s.column as keyof Pet];
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return s.direction === "descending" ? sorted.reverse() : sorted;
  });
  return (
    <section>
      <h1>Table</h1>
      <Table
        id="tbl-pets"
        aria-label="Pets"
        selectionMode="multiple"
        selectedKeys={selected}
        sortDescriptor={sort}
        onRowAction={(key) => action.set(String(key))}
      >
        <TableHeader>
          <Column id="select">
            <Checkbox slot="selection" />
          </Column>
          <Column id="name" isRowHeader allowsSorting>
            Name
          </Column>
          <Column id="kind" allowsSorting>
            Kind
          </Column>
          <Column id="age" allowsSorting>
            Age
          </Column>
        </TableHeader>
        <TableBody items={pets} renderEmptyState={() => "No pets"}>
          {(pet: Pet) => (
            <Row id={pet.id}>
              <Cell>
                <Checkbox slot="selection" />
              </Cell>
              <Cell>{pet.name}</Cell>
              <Cell>{pet.kind}</Cell>
              <Cell>{String(pet.age)}</Cell>
            </Row>
          )}
        </TableBody>
      </Table>
      <output id="tbl-selected">{selected() === "all" ? "all" : [...(selected() as Set<Key>)].join(",")}</output>
      <output id="tbl-sort">{sort() ? `${String(sort()!.column)} ${sort()!.direction}` : "none"}</output>
      <output id="tbl-action">{action()}</output>

      <ResizableTableContainer onResizeEnd={(w) => widths.set([...w.entries()].map(([k, v]) => `${String(k)}=${String(v)}`).join(","))}>
        <Table id="tbl-resize" aria-label="Resizable">
          <TableHeader>
            <Column id="a" isRowHeader defaultWidth={200}>
              A
              <ColumnResizer />
            </Column>
            <Column id="b">B</Column>
          </TableHeader>
          <TableBody>
            <Row id="r1">
              <Cell>a1</Cell>
              <Cell>b1</Cell>
            </Row>
          </TableBody>
        </Table>
      </ResizableTableContainer>
      <output id="tbl-widths">{widths()}</output>

      <Table id="tbl-empty" aria-label="Empty">
        <TableHeader>
          <Column isRowHeader>Name</Column>
        </TableHeader>
        <TableBody renderEmptyState={() => "Nothing here"}>{[]}</TableBody>
      </Table>
    </section>
  );
}
