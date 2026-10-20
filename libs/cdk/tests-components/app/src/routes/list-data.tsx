import { signal } from "@rivetjs/reactivity";
import { createListData } from "@rivetjs/cdk/data";
import { Collection } from "@rivetjs/cdk/collections/components";
import { Header } from "@rivetjs/cdk/header";
import { ListBox, ListBoxItem, ListBoxSection } from "@rivetjs/cdk/listbox";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import { ListLayout, CollectionVirtualizer } from "@rivetjs/cdk/virtualizer";

export const head = { title: "ListBox data" };

interface Animal {
  id: number;
  name: string;
}

// ROW-RERENDER: built-collection rows of a resumed page follow a node value change (cdk-docs `data-list`).
// The virtualized list's `initialSize` = its scroller's client box (240 × 192 + the cdk theme's 4px padding): a resumed
// page keeps the server window until its first interaction, a client render measures at mount (resume fuzz `/list-data`:
// an unsized scroller took the viewport width in the client render).
export default function ListDataStory() {
  const list = createListData<Animal>({
    initialItems: [
      { id: 1, name: "Aardvark" },
      { id: 2, name: "Kangaroo" },
      { id: 3, name: "Snake" },
    ],
  });
  const next = signal(4);
  // Sectioned: rows of the section's own (nested) For.
  const veg = signal(["Leek", "Kale"]);
  const many = createListData<Animal>({ initialItems: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: "Item " + (i + 1) })) });
  const people = signal([
    { id: "a", name: "Ada", role: "Engineer" },
    { id: "b", name: "Bob", role: "Designer" },
  ]);
  return (
    <section>
      <h1>ListBox data</h1>
      <ListBox id="ld-animals" aria-label="Animals" selectionMode="multiple" items={list.items}>
        {(animal: Animal) => (
          <ListBoxItem id={animal.id} textValue={animal.name}>
            {animal.name}
          </ListBoxItem>
        )}
      </ListBox>
      <button id="ld-shout" onClick={() => list.update(2, (prev) => ({ ...prev, name: prev.name.toUpperCase() }))}>
        Uppercase
      </button>
      <button id="ld-same" onClick={() => list.update(3, (prev) => ({ ...prev }))}>
        Same
      </button>
      <button
        id="ld-add"
        onClick={() => {
          const id = next();
          list.append({ id, name: `Animal ${id}` });
          next.set(id + 1);
        }}
      >
        Append
      </button>
      <ListBox id="ld-sections" aria-label="Sections">
        <ListBoxSection id="fruit">
          <Header>Fruit</Header>
          <ListBoxItem id="pear">Pear</ListBoxItem>
        </ListBoxSection>
        <ListBoxSection id="veg">
          <Header>Vegetables</Header>
          <Collection items={veg().map((name, i) => ({ id: "veg" + i, name }))}>
            {(item: { id: string; name: string }) => <ListBoxItem textValue={item.name}>{item.name}</ListBoxItem>}
          </Collection>
        </ListBoxSection>
      </ListBox>
      <button id="ld-veg" onClick={() => veg.set(["Leek", "KALE"])}>
        Rename kale
      </button>
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32 }} initialSize={{ width: 248, height: 200 }}>
        <ListBox id="ld-virtual" aria-label="Virtualized" items={many.items} style={{ display: "block", width: "240px", height: "192px", overflow: "auto" }}>
          {(item: Animal) => (
            <ListBoxItem id={item.id} textValue={item.name}>
              {item.name}
            </ListBoxItem>
          )}
        </ListBox>
      </CollectionVirtualizer>
      <button id="ld-virtual-shout" onClick={() => many.update(2, (prev) => ({ ...prev, name: prev.name.toUpperCase() }))}>
        Uppercase item 2
      </button>
      <Table id="ld-table" aria-label="People">
        <TableHeader>
          <Column isRowHeader>Name</Column>
          <Column>Role</Column>
        </TableHeader>
        <TableBody items={people}>
          {(person: { id: string; name: string; role: string }) => (
            <Row id={person.id}>
              <Cell>{person.name}</Cell>
              <Cell>{person.role}</Cell>
            </Row>
          )}
        </TableBody>
      </Table>
      <button id="ld-table-role" onClick={() => people.set([people()[0]!, { ...people()[1]!, role: "Manager" }])}>
        Promote Bob
      </button>
    </section>
  );
}
