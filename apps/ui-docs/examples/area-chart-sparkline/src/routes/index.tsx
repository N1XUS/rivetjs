// Rivet-authored AreaChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Sparkline } from "@rivetjs/ui/chart";
import { TrendChip } from "@rivetjs/ui/trend-chip";

export const head = { title: "AreaChart: Sparkline" };

// #region demo
const METRICS = [
  { name: "Requests", value: "1.28M", change: "8.4%", trend: "up" as const, color: "var(--chart-1)", points: [42, 48, 45, 53, 51, 60, 64, 61, 70] },
  { name: "Errors", value: "0.21%", change: "0.04%", trend: "down" as const, color: "var(--chart-5)", points: [31, 28, 33, 26, 24, 27, 22, 20, 19] },
  {
    name: "p95 latency",
    value: "182 ms",
    change: "6 ms",
    trend: "up" as const,
    color: "var(--chart-4)",
    points: [160, 158, 166, 171, 169, 175, 178, 176, 182],
  },
];

export function Sparklines() {
  return (
    <ul id="area-chart-sparkline" class="flex w-full max-w-md flex-col divide-y divide-separator">
      {METRICS.map((metric) => (
        <li class="flex items-center gap-4 py-3">
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm text-muted">{metric.name}</span>
            <span class="text-lg font-semibold tabular-nums">{metric.value}</span>
          </div>
          <TrendChip trend={metric.trend} isInverted={metric.name !== "Requests"}>
            {metric.change}
          </TrendChip>
          <div class="w-28">
            <Sparkline
              data={metric.points.map((value, i) => ({ hour: i, value }))}
              index="hour"
              series={[{ key: "value", label: metric.name, color: metric.color }]}
              minValue={Math.min(...metric.points) * 0.8}
              height={36}
              aria-label={`${metric.name}, last 9 hours`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Sparklines />
    </div>
  );
}
