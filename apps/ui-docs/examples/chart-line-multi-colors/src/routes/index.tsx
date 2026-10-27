// Rivet-authored Chart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { LineChart } from "@rivetjs/ui/chart";

export const head = { title: "Chart: Line colors" };

// #region demo
const LATENCY = [
  { hour: "00:00", eu: 82, us: 96, apac: 141 },
  { hour: "04:00", eu: 78, us: 104, apac: 133 },
  { hour: "08:00", eu: 95, us: 99, apac: 128 },
  { hour: "12:00", eu: 110, us: 88, apac: 150 },
  { hour: "16:00", eu: 104, us: 92, apac: 162 },
  { hour: "20:00", eu: 90, us: 118, apac: 139 },
];

export function LineColors() {
  return (
    <LineChart
      id="chart-line-multi-colors"
      class="w-full max-w-2xl"
      data={LATENCY}
      index="hour"
      series={[
        { key: "eu", label: "Europe", color: "var(--chart-3)" },
        { key: "us", label: "Americas", color: "var(--chart-4)" },
        { key: "apac", label: "Asia Pacific", color: "var(--chart-6)" },
      ]}
      valueFormatter={(v) => `${v} ms`}
      aria-label="Median latency by region"
      height={220}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <LineColors />
    </div>
  );
}
