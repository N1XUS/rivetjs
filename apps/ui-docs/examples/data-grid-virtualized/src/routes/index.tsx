// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set inspired by HeroUI Pro's public docs, own data).
import { DataGrid } from "@rivetjs/ui/data-grid";

export const head = { title: "DataGrid: Virtualization" };

interface Reading {
  id: number;
  sensor: string;
  value: number;
  site: string;
}

const READINGS: Reading[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i,
  sensor: `S-${String(i).padStart(5, "0")}`,
  value: Math.round(((i * 7919) % 1000) / 10),
  site: ["Oslo", "Lyon", "Porto", "Graz"][i % 4]!,
}));

// #region demo
export function DataGridVirtualized() {
  const columns = [
    { id: "sensor", header: "Sensor", accessorKey: "sensor" as const, allowsSorting: true },
    { id: "site", header: "Site", accessorKey: "site" as const, allowsSorting: true },
    { id: "value", header: "Value", accessorKey: "value" as const, allowsSorting: true, align: "end" as const },
  ];
  return (
    <DataGrid<Reading>
      aria-label="Sensor readings"
      data={READINGS}
      columns={columns}
      virtualized
      rowHeight={40}
      height={400}
      selectionMode="multiple"
      showSelectionCheckboxes
      class="w-[560px]"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridVirtualized />
    </div>
  );
}
