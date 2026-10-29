// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set scoped from public docs of commercial UI kits, own data).
import { DataGrid } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Footer" };

interface Line {
  id: number;
  item: string;
  qty: number;
  price: number;
}

const LINES: Line[] = [
  { id: 1, item: "Standing desk", qty: 2, price: 480 },
  { id: 2, item: "Task chair", qty: 4, price: 260 },
  { id: 3, item: "Desk lamp", qty: 6, price: 45 },
];
const TOTAL = LINES.reduce((sum, l) => sum + l.qty * l.price, 0);

// #region demo
export function DataGridFooter() {
  const columns = [
    { id: "item", header: "Item", accessorKey: "item" as const },
    { id: "qty", header: "Qty", accessorKey: "qty" as const, align: "end" as const, width: 80 },
    { id: "price", header: "Price", cell: (l: Line) => `$${l.price}`, align: "end" as const, width: 110 },
  ];
  return (
    <DataGrid<Line>
      aria-label="Order lines"
      data={LINES}
      columns={columns}
      class="w-[480px]"
      footer={
        <div class="flex w-full justify-between text-sm">
          <span class="text-muted">3 lines</span>
          <span id="data-grid-footer-total" class="font-medium">
            Total ${TOTAL}
          </span>
        </div>
      }
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridFooter />
    </div>
  );
}
