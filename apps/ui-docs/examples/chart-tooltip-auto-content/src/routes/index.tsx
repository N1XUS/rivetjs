// Rivet-authored ChartTooltip demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { BarChart } from "@rivetjs/ui/chart";
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";

export const head = { title: "ChartTooltip: Auto Content" };

// #region demo
const DATA = [
  { month: "Jan", visits: 4200, signups: 520 },
  { month: "Feb", visits: 4800, signups: 610 },
  { month: "Mar", visits: 5100, signups: 590 },
  { month: "Apr", visits: 5600, signups: 700 },
];

export function AutoContent() {
  return (
    <BarChart
      id="ct-auto"
      class="w-full max-w-xl"
      data={DATA}
      index="month"
      series={[
        { key: "visits", label: "Visits" },
        { key: "signups", label: "Signups" },
      ]}
      tooltip={(point) => (
        <ChartTooltip.Content label={point.label} payload={point.items.map((item) => ({ name: item.name, value: item.formatted, color: item.color }))} />
      )}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <AutoContent />
    </div>
  );
}
