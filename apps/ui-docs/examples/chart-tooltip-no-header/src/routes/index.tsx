// Rivet-authored ChartTooltip demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";

export const head = { title: "ChartTooltip: No Header" };

// #region demo
export function NoHeader() {
  return (
    <ChartTooltip>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--chart-1)" />
        <ChartTooltip.Label>Revenue</ChartTooltip.Label>
        <ChartTooltip.Value>$12,400</ChartTooltip.Value>
      </ChartTooltip.Item>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--chart-2)" />
        <ChartTooltip.Label>Expenses</ChartTooltip.Label>
        <ChartTooltip.Value>$8,150</ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <NoHeader />
    </div>
  );
}
