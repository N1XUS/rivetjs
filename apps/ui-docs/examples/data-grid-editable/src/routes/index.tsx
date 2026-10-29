// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set scoped from public docs of commercial UI kits, own data).
import { signal } from "@rivetjs/reactivity";
import { DataGrid } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Editable cells" };

interface Item {
  id: number;
  sku: string;
  title: string;
  stock: number;
}

// #region demo
export function DataGridEditable() {
  const items = signal<Item[]>([
    { id: 1, sku: "NW-1001", title: "Desk lamp", stock: 14 },
    { id: 2, sku: "NW-1002", title: "Cable tray", stock: 120 },
    { id: 3, sku: "NW-1003", title: "Monitor arm", stock: 8 },
  ]);
  const total = () => items().reduce((sum, item) => sum + item.stock, 0);
  const columns = [
    { id: "sku", header: "SKU", accessorKey: "sku" as const, width: 120 },
    {
      id: "title",
      header: "Title",
      cell: (item: Item) => (
        <input
          class="input input--primary w-full"
          aria-label={`Title of ${item.sku}`}
          value={item.title}
          onChange={(e) => items.set(items().map((x) => (x.id === item.id ? { ...x, title: (e.currentTarget as HTMLInputElement).value } : x)))}
        />
      ),
    },
    {
      id: "stock",
      header: "Stock",
      width: 120,
      cell: (item: Item) => (
        <input
          class="input input--primary w-full"
          type="number"
          aria-label={`Stock of ${item.sku}`}
          value={String(item.stock)}
          onChange={(e) => items.set(items().map((x) => (x.id === item.id ? { ...x, stock: Number((e.currentTarget as HTMLInputElement).value) } : x)))}
        />
      ),
    },
  ];
  return (
    <div class="flex w-[560px] flex-col gap-3">
      <DataGrid<Item> aria-label="Inventory" data={items} columns={columns} verticalAlign="middle" />
      <p id="data-grid-editable-total" class="text-sm text-muted">
        Total stock: {total()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridEditable />
    </div>
  );
}
