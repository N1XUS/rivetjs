// Rivet-authored AreaChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { AreaChart } from "@rivetjs/ui/chart";

export const head = { title: "AreaChart: Stacked" };

// #region demo
const STORAGE = [
  { month: "Jan", media: 120, documents: 64, backups: 210 },
  { month: "Feb", media: 138, documents: 70, backups: 214 },
  { month: "Mar", media: 151, documents: 73, backups: 232 },
  { month: "Apr", media: 172, documents: 81, backups: 240 },
  { month: "May", media: 190, documents: 86, backups: 251 },
  { month: "Jun", media: 214, documents: 92, backups: 266 },
];

export function Stacked() {
  return (
    <AreaChart
      id="area-chart-stacked"
      class="w-full max-w-2xl"
      data={STORAGE}
      index="month"
      stacked
      series={[
        { key: "backups", label: "Backups", color: "var(--chart-3)" },
        { key: "documents", label: "Documents", color: "var(--chart-2)" },
        { key: "media", label: "Media", color: "var(--chart-1)" },
      ]}
      valueFormatter={(v) => `${v} GB`}
      aria-label="Storage used by file type"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <Stacked />
    </div>
  );
}
