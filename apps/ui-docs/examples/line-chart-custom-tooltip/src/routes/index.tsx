// Rivet-authored LineChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { LineChart } from "@rivetjs/ui/chart";
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";

export const head = { title: "LineChart: With Custom Tooltip" };

// #region demo
const TARGET_MS = 250;

const LATENCY = [
  { hour: "00:00", p50: 92, p95: 188 },
  { hour: "04:00", p50: 88, p95: 176 },
  { hour: "08:00", p50: 104, p95: 231 },
  { hour: "12:00", p50: 121, p95: 274 },
  { hour: "16:00", p50: 116, p95: 248 },
  { hour: "20:00", p50: 98, p95: 205 },
];

export function CustomTooltip() {
  return (
    <LineChart
      id="line-chart-custom-tooltip"
      class="w-full max-w-2xl"
      data={LATENCY}
      index="hour"
      series={[
        { key: "p50", label: "p50" },
        { key: "p95", label: "p95" },
      ]}
      valueFormatter={(v) => `${v} ms`}
      aria-label="API latency by hour"
      tooltip={(point) => {
        const p95 = point.items.find((item) => item.key === "p95")?.value ?? 0;
        return (
          <ChartTooltip indicator="line">
            <ChartTooltip.Header>{point.label} UTC</ChartTooltip.Header>
            {point.items.map((item) => (
              <ChartTooltip.Item>
                <ChartTooltip.Indicator color={item.color} />
                <ChartTooltip.Label>{item.name}</ChartTooltip.Label>
                <ChartTooltip.Value>{item.formatted}</ChartTooltip.Value>
              </ChartTooltip.Item>
            ))}
            <ChartTooltip.Item class="border-t border-separator pt-1">
              <ChartTooltip.Label>Target {TARGET_MS} ms</ChartTooltip.Label>
              <ChartTooltip.Value class={p95 <= TARGET_MS ? "text-success" : "text-danger"}>{p95 <= TARGET_MS ? "Met" : "Missed"}</ChartTooltip.Value>
            </ChartTooltip.Item>
          </ChartTooltip>
        );
      }}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <CustomTooltip />
    </div>
  );
}
