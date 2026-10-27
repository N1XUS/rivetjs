// Rivet-authored RadialChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { RadialChart } from "@rivetjs/ui/radial-chart";

export const head = { title: "RadialChart: Gauge Grid" };

// #region demo
const METRICS = [
  { label: "CPU", value: 68, color: "var(--chart-1)" },
  { label: "Memory", value: 44, color: "var(--chart-2)" },
  { label: "Disk", value: 81, color: "var(--chart-4)" },
];

export function GaugeGrid() {
  return (
    <div id="radial-chart-gauge-grid" class="grid grid-cols-3 gap-6">
      {METRICS.map((m) => (
        <RadialChart data={[m]} size={120} startAngle={210} endAngle={-30} innerRadius={0.68} outerRadius={0.92} centerLabel={m.label}>
          {`${m.value}%`}
        </RadialChart>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <GaugeGrid />
    </div>
  );
}
