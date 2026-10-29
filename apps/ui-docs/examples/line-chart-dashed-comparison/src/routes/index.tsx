// Rivet-authored LineChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { LineChart } from "@rivetjs/ui/chart";

export const head = { title: "LineChart: Dashed Comparison" };

// #region demo
const REVENUE = [
  { month: "Jan", current: 48, previous: 41 },
  { month: "Feb", current: 52, previous: 44 },
  { month: "Mar", current: 57, previous: 46 },
  { month: "Apr", current: 55, previous: 50 },
  { month: "May", current: 63, previous: 52 },
  { month: "Jun", current: 71, previous: 55 },
];

export function DashedComparison() {
  return (
    <LineChart
      id="line-chart-dashed-comparison"
      class="w-full max-w-2xl"
      data={REVENUE}
      index="month"
      series={[
        { key: "current", label: "This year" },
        { key: "previous", label: "Last year", color: "var(--muted)", dashed: true },
      ]}
      valueFormatter={(v) => `$${v}k`}
      aria-label="Revenue this year against last year"
      height={220}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <DashedComparison />
    </div>
  );
}
