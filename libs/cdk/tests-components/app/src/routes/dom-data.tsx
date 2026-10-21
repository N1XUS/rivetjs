import { signal } from "@rivetjs/reactivity";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";
import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";

export const head = { title: "DOM data" };

interface Customer {
  id: number;
  name: string;
  mail: string;
}

// DOM-DATA (`resume: { domData: true }` builds, `dom-data.test.ts`): built-collection rows whose item strings the rows
// show as an element's whole text. With domData the item lists travel as `D` entries read back from the rows; the
// actions show what a resumed handler reads from the captured items (deep equal to the server data).
export default function DomDataStory() {
  const customers: Customer[] = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Customer ${i + 1} Holdings & Co`,
    mail: `customer.${i + 1}@example.com`,
  }));
  const contacts: Customer[] = customers.slice(0, 6).map((c) => ({ ...c, id: c.id + 100, name: `Contact of ${c.name}` }));
  const picked = signal("-");
  return (
    <section>
      <h1>DOM data</h1>
      <ListBox
        id="dd-customers"
        aria-label="Customers"
        selectionMode="single"
        items={customers}
        onAction={(key) => picked.set(JSON.stringify(customers.find((c) => c.id === key)))}
      >
        {(c: Customer) => (
          <ListBoxItem id={c.id} textValue={c.name}>
            {c.name}
          </ListBoxItem>
        )}
      </ListBox>
      <GridList id="dd-contacts" aria-label="Contacts" items={contacts} onAction={(key) => picked.set(JSON.stringify(contacts.find((c) => c.id === key)))}>
        {(c: Customer) => (
          <GridListItem id={c.id} textValue={c.name}>
            {c.name}
          </GridListItem>
        )}
      </GridList>
      <button id="dd-all" onClick={() => picked.set(JSON.stringify([customers, contacts]))}>
        All
      </button>
      <p id="dd-picked">{picked()}</p>
    </section>
  );
}
