import { signal } from "@rivetjs/reactivity";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import type { Key, Selection } from "@rivetjs/cdk/types";
import { ListLayout, TableLayout, CollectionVirtualizer } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualized collections" };

interface Person {
  id: number;
  name: string;
  role: string;
}

const PEOPLE: Person[] = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}`, role: ["Engineer", "Designer", "Manager"][i % 3]! }));

const listed = (selection: Selection) => (selection === "all" ? "all" : [...selection].map(String).join(",") || "none");

export default function VirtualizedCollectionsStory() {
  const picked = signal<Selection>(new Set<Key>());
  const rows = signal<Selection>(new Set<Key>());
  return (
    <section>
      <h1>Virtualized collections</h1>
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32 }} initialSize={{ width: 240, height: 320 }}>
        <ListBox
          id="vlist"
          aria-label="People"
          items={PEOPLE}
          selectionMode="multiple"
          selectedKeys={picked}
          onSelectionChange={(keys) => picked.set(keys)}
          style={{ display: "block", width: "240px", height: "320px", overflow: "auto" }}
        >
          {(person: Person) => (
            <ListBoxItem id={person.id} textValue={person.name} style={{ height: "32px", "box-sizing": "border-box" }}>
              {person.name}
            </ListBoxItem>
          )}
        </ListBox>
      </CollectionVirtualizer>
      <p id="vlist-value">{listed(picked())}</p>
      <CollectionVirtualizer layout={TableLayout} layoutOptions={{ rowHeight: 32, headingHeight: 32 }} initialSize={{ width: 400, height: 320 }}>
        <Table
          id="vtable"
          aria-label="People table"
          selectionMode="multiple"
          selectedKeys={rows}
          onSelectionChange={(keys) => rows.set(keys)}
          style={{ display: "block", width: "400px", height: "320px", overflow: "auto" }}
        >
          <TableHeader>
            <Column id="name" isRowHeader>
              Name
            </Column>
            <Column id="role">Role</Column>
          </TableHeader>
          <TableBody items={PEOPLE}>
            {(person: Person) => (
              <Row id={person.id}>
                <Cell>{person.name}</Cell>
                <Cell>{person.role}</Cell>
              </Row>
            )}
          </TableBody>
        </Table>
      </CollectionVirtualizer>
      <p id="vtable-value">{listed(rows())}</p>
    </section>
  );
}
