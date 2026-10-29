// Rivet-authored demo (DataGrid is a Rivet addition, own data).
import { signal } from "@rivetjs/reactivity";
import { DataGrid } from "@rivetjs/ui/data-grid";
import { Segment } from "@rivetjs/ui/segment";

export const head = { title: "DataGrid: Alignment" };

interface Line {
  id: number;
  item: string;
  note: string;
  qty: number;
  amount: number;
}

const LINES: Line[] = [
  { id: 1, item: "Standing desk", note: "Oak top, 160 × 80 cm, assembled on delivery", qty: 2, amount: 1180 },
  { id: 2, item: "Monitor arm", note: "Dual arm", qty: 4, amount: 356 },
  { id: 3, item: "Desk lamp", note: "Warm white, dimmable, with a USB-C port in the base", qty: 6, amount: 294 },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
type VerticalAlign = "top" | "middle" | "bottom";

// #region demo
export function DataGridAlignment() {
  const verticalAlign = signal<VerticalAlign>("middle");
  const columns = [
    { id: "item", header: "Item", accessorKey: "item" as const, isRowHeader: true },
    { id: "note", header: "Note", cell: (line: Line) => <span class="block whitespace-normal">{line.note}</span>, width: 220 },
    { id: "qty", header: "Qty", accessorKey: "qty" as const, align: "center" as const },
    { id: "amount", header: "Amount", cell: (line: Line) => money.format(line.amount), align: "end" as const },
  ];
  return (
    <div class="flex flex-col items-start gap-3">
      <Segment aria-label="Vertical alignment" size="sm" selectedKey={verticalAlign()} onSelectionChange={(key) => verticalAlign.set(key as VerticalAlign)}>
        <Segment.Item id="top">Top</Segment.Item>
        <Segment.Item id="middle">Middle</Segment.Item>
        <Segment.Item id="bottom">Bottom</Segment.Item>
      </Segment>
      <DataGrid<Line> id="dg-align" aria-label="Order lines" data={LINES} columns={columns} verticalAlign={verticalAlign()} class="w-[600px]" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridAlignment />
    </div>
  );
}
