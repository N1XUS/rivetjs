// Fixtures for dom-rows.test.ts: live collections / list rows whose content is read later by an insertion
// (DOM v2 accessors, function rows re-rendered in their own effect). Module-level signals are driven by the test.
import { createContext, signal } from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/dom";
import { Autocomplete } from "@rivetjs/cdk/autocomplete";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";
import { Collection } from "../../../../cdk/collections/components.tsx";

interface Item {
  id: string;
  name: string;
}
export const query = signal("");
export const items = signal<Item[]>([{ id: "a", name: "A" }]);
const Ctx = createContext("outer");

/** Live-mode options hide themselves through the Autocomplete `filter` (a `<Show>` accessor per option). */
export function Filtered() {
  return (
    <Autocomplete inputValue={query} filter={(text: string, input: string) => text.toLowerCase().startsWith(input.toLowerCase())}>
      <ListBox aria-label="Commands">
        <ListBoxItem id="save">Save</ListBoxItem>
        <ListBoxItem id="split">Split</ListBoxItem>
        <ListBoxItem id="close">Close</ListBoxItem>
      </ListBox>
    </Autocomplete>
  );
}

/** `items` on the host and through a `Collection` (a `<For>` accessor inside the collection providers). */
export function HostItems() {
  return (
    <ListBox aria-label="Items" items={items}>
      {(item: Item) => <ListBoxItem>{item.name}</ListBoxItem>}
    </ListBox>
  );
}
export function CollectionItems() {
  return (
    <ListBox aria-label="Items">
      <Collection items={items}>{(item: Item) => <ListBoxItem>{item.name}</ListBoxItem>}</Collection>
    </ListBox>
  );
}

/** A row whose content is a function returning a runtime `Provider`, re-run when its item changes. */
export function RangeRows() {
  return (
    <ul>
      <For each={items} by={(item: Item) => item.id}>
        {(item: () => Item) => () => {
          const value = item();
          return (
            <Provider token={Ctx} value={value.name}>
              <li>{value.name}</li>
            </Provider>
          );
        }}
      </For>
    </ul>
  );
}
