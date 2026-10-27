// Rivet-authored ChartTooltip demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";

export const head = { title: "ChartTooltip: Chart Colors" };

// #region demo
export function ChartColors() {
  return (
    <ChartTooltip>
      <ChartTooltip.Header>March 2026</ChartTooltip.Header>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--chart-1)" />
        <ChartTooltip.Label>Direct</ChartTooltip.Label>
        <ChartTooltip.Value>38%</ChartTooltip.Value>
      </ChartTooltip.Item>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--chart-2)" />
        <ChartTooltip.Label>Search</ChartTooltip.Label>
        <ChartTooltip.Value>27%</ChartTooltip.Value>
      </ChartTooltip.Item>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--chart-3)" />
        <ChartTooltip.Label>Social</ChartTooltip.Label>
        <ChartTooltip.Value>18%</ChartTooltip.Value>
      </ChartTooltip.Item>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--chart-4)" />
        <ChartTooltip.Label>Email</ChartTooltip.Label>
        <ChartTooltip.Value>11%</ChartTooltip.Value>
      </ChartTooltip.Item>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--chart-5)" />
        <ChartTooltip.Label>Referral</ChartTooltip.Label>
        <ChartTooltip.Value>6%</ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ChartColors />
    </div>
  );
}
