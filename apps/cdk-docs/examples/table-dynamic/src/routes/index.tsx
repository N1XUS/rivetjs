import { computed, signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Cell, Column, Row, Table, TableBody, TableFooter, TableHeader } from "@rivetjs/cdk/table";

export const head = { title: "Table: dynamic content" };

interface Invoice {
  id: number;
  title: string;
  status: string;
  paymentMethod: string;
  price: number;
}

const columns = [
  { id: "title", name: "Title", isRowHeader: true },
  { id: "status", name: "Status" },
  { id: "paymentMethod", name: "Payment Method" },
  { id: "price", name: "Price" },
];

const initialRows: Invoice[] = [
  { id: 1, title: "Website Design", status: "Paid", paymentMethod: "Credit Card", price: 1200 },
  { id: 2, title: "Logo Creation", status: "Pending", paymentMethod: "PayPal", price: 350 },
  { id: 3, title: "SEO Optimization", status: "Overdue", paymentMethod: "Bank Transfer", price: 800 },
];

// One module-level formatter: `toLocaleString(locale, options)` builds a new Intl.NumberFormat on every call.
const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd = (n: number) => usdFormat.format(n);
const th = "border-b border-slate-200 px-3 py-1.5 text-left font-semibold";
const td = "px-3 py-1.5";

// #region demo
export default function Invoices() {
  const shown = signal(new Set(["title", "status", "paymentMethod", "price"]));
  const visibleColumns = computed(() => columns.filter((c) => shown().has(c.id)));
  const rows = signal(initialRows);
  const total = computed(() => rows().reduce((sum, row) => sum + row.price, 0));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(shown());
    if (on) next.add(id);
    else next.delete(id);
    shown.set(next);
  };
  return (
    <section class="m-4 grid justify-items-start gap-2 text-sm">
      <fieldset class="flex gap-3">
        <legend class="sr-only">Show columns</legend>
        <label class="flex items-center gap-1">
          <input id="show-status" type="checkbox" checked onChange={(e) => toggle("status", (e.target as HTMLInputElement).checked)} /> Status
        </label>
        <label class="flex items-center gap-1">
          <input id="show-payment" type="checkbox" checked onChange={(e) => toggle("paymentMethod", (e.target as HTMLInputElement).checked)} /> Payment Method
        </label>
      </fieldset>
      <Table id="invoices" aria-label="Invoices" class="border-collapse">
        <TableHeader columns={visibleColumns}>
          {(column: (typeof columns)[number]) => (
            <Column isRowHeader={column.isRowHeader} class={th}>
              {column.name}
            </Column>
          )}
        </TableHeader>
        <TableBody items={rows}>
          {(item: Invoice) => (
            <Row columns={visibleColumns}>
              {(column: (typeof columns)[number]) => (
                <Cell class={td}>{column.id === "price" ? usd(item.price) : String(item[column.id as keyof Invoice])}</Cell>
              )}
            </Row>
          )}
        </TableBody>
        <TableFooter>
          <Row id="total" class="border-t border-slate-200 font-semibold">
            <Cell colSpan={visibleColumns().length - 1} class={td}>
              Total
            </Cell>
            <Cell class={td}>{usd(total())}</Cell>
          </Row>
        </TableFooter>
      </Table>
      <Button
        id="add-row"
        class="rounded-md border border-slate-300 px-2 py-1"
        onPress={() => rows.set([...rows(), { id: rows().length + 1, title: "New Invoice", status: "Pending", paymentMethod: "Credit Card", price: 250 }])}
      >
        Add row
      </Button>
    </section>
  );
}
// #endregion
