// Rivet-authored demo (`@rivetjs/cdk/data-grid`: feature set scoped from public docs of commercial UI kits, independent implementation).
import { DataGrid } from "@rivetjs/cdk/data-grid";

export const head = { title: "DataGrid: virtualized" };

interface Row {
  id: number;
  label: string;
  value: number;
}

const ROWS: Row[] = Array.from({ length: 100_000 }, (_, i) => ({ id: i, label: `Row ${i}`, value: (i * 7919) % 10_000 }));

// #region demo
export default function DataGridVirtual() {
  const columns = [
    { id: "label", header: "Label", accessorKey: "label" as const, allowsSorting: true },
    { id: "value", header: "Value", accessorKey: "value" as const, allowsSorting: true, align: "end" as const },
  ];
  return <DataGrid<Row> aria-label="100 000 rows" data={ROWS} columns={columns} virtualized rowHeight={36} height={360} />;
}
// #endregion
