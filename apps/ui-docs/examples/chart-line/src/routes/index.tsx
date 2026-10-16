// Rivet-authored Chart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { LineChart } from "@rivetjs/ui/chart";

export const head = { title: "Chart: Line" };

// #region demo
const MRR = [
  { month: "Jan", plan: 18200, actual: 17600 },
  { month: "Feb", plan: 19400, actual: 19900 },
  { month: "Mar", plan: 20600, actual: 20100 },
  { month: "Apr", plan: 21800, actual: 23200 },
  { month: "May", plan: 23000, actual: 24800 },
  { month: "Jun", plan: 24200, actual: 26100 },
];

export function Line() {
  return (
    <LineChart
      id="chart-line"
      class="w-full max-w-2xl"
      data={MRR}
      index="month"
      curve="linear"
      series={[
        { key: "actual", label: "Actual MRR" },
        { key: "plan", label: "Plan", color: "var(--muted)" },
      ]}
      valueFormatter={(v) => `$${Math.round(v / 1000)}k`}
      aria-label="Monthly recurring revenue against plan"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <Line />
    </div>
  );
}
