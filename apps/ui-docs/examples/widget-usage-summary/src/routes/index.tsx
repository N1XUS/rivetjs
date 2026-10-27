// Rivet-authored Widget demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Widget } from "@rivetjs/ui/widget";
import { ProgressCircle } from "@rivetjs/ui/progress-circle";

export const head = { title: "Widget: Usage Summary" };

// #region demo
const USAGE = [
  { label: "Storage", used: "38 GB of 50 GB", value: 76, color: "warning" },
  { label: "Bandwidth", used: "120 GB of 500 GB", value: 24, color: "accent" },
  { label: "Build minutes", used: "2,950 of 3,000", value: 98, color: "danger" },
] as const;

export function UsageSummary() {
  return (
    <Widget id="widget-usage" class="w-full max-w-md">
      <Widget.Header>
        <Widget.Title>Plan usage</Widget.Title>
        <Widget.Description>Resets in 9 days</Widget.Description>
      </Widget.Header>
      <Widget.Content class="flex flex-col divide-y divide-separator py-1">
        {USAGE.map((row) => (
          <div class="flex items-center gap-3 py-3">
            <ProgressCircle aria-label={row.label} value={row.value} color={row.color} size="sm">
              <ProgressCircle.Track>
                <ProgressCircle.TrackCircle />
                <ProgressCircle.FillCircle />
              </ProgressCircle.Track>
            </ProgressCircle>
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="text-sm font-medium">{row.label}</span>
              <span class="text-xs text-muted">{row.used}</span>
            </div>
            <span class="text-sm font-medium tabular-nums">{row.value}%</span>
          </div>
        ))}
      </Widget.Content>
    </Widget>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <UsageSummary />
    </div>
  );
}
