// Rivet-authored ChartTooltip demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";

export const head = { title: "ChartTooltip: Inactive" };

// #region demo
export function Inactive() {
  return (
    <div class="flex flex-col items-center gap-2 text-sm text-muted">
      <ChartTooltip active={false}>
        <ChartTooltip.Header>Hidden</ChartTooltip.Header>
      </ChartTooltip>
      <span id="ct-inactive">The tooltip above renders nothing.</span>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Inactive />
    </div>
  );
}
