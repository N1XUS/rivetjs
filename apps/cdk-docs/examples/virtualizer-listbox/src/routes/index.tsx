import { signal } from "@rivetjs/reactivity";
import { ListBox, ListBoxItem, type Selection } from "@rivetjs/cdk/listbox";
import { ListLayout, CollectionVirtualizer } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: ListBox" };

interface Person {
  id: number;
  name: string;
}

const people: Person[] = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}` }));

// #region demo
export default function People() {
  const selected = signal<Selection>(new Set());
  const text = () => {
    const keys = selected();
    return keys === "all" ? "all" : [...keys].join(", ") || "none";
  };
  return (
    <section class="stack">
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32 }} initialSize={{ width: 278, height: 278 }}>
        <ListBox
          id="people"
          aria-label="People"
          items={people}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={(keys) => selected.set(keys)}
        >
          {(person: Person) => (
            <ListBoxItem id={person.id} textValue={person.name}>
              {person.name}
            </ListBoxItem>
          )}
        </ListBox>
      </CollectionVirtualizer>
      <output id="people-value">Selected: {text()}</output>
    </section>
  );
}
// #endregion
