import { signal } from "@rivetjs/reactivity";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";

export const head = { title: "DOM data 1000" };

interface Customer {
  id: number;
  name: string;
  mail: string;
}

// `/dom-data`'s ListBox at 1000 customers (DOM-DATA rows: the names are the rows' whole text).
export default function DomData1000() {
  const customers: Customer[] = Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    name: `Customer ${i + 1} Holdings & Co`,
    mail: `customer.${i + 1}@example.com`,
  }));
  const picked = signal("-");
  return (
    <section>
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
      <p id="dd-picked">{picked()}</p>
    </section>
  );
}
