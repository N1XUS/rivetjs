// Rivet-authored BarChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { BarChart } from "@rivetjs/ui/chart";

export const head = { title: "BarChart: Comparison" };

// #region demo
const QUARTERS = [
  { quarter: "Q1", previous: 182, current: 214 },
  { quarter: "Q2", previous: 205, current: 238 },
  { quarter: "Q3", previous: 221, current: 229 },
  { quarter: "Q4", previous: 264, current: 311 },
];

export function Comparison() {
  return (
    <BarChart
      id="bar-chart-comparison"
      class="w-full max-w-xl"
      data={QUARTERS}
      index="quarter"
      series={[
        { key: "previous", label: "2025", color: "var(--muted)" },
        { key: "current", label: "2026", color: "var(--chart-1)" },
      ]}
      valueFormatter={(v) => `$${v}k`}
      aria-label="Quarterly revenue, 2026 against 2025"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <Comparison />
    </div>
  );
}
