// Rivet-authored RadialChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { RadialChart } from "@rivetjs/ui/radial-chart";

export const head = { title: "RadialChart: Gauge" };

// #region demo
export function Gauge() {
  return (
    <RadialChart
      id="radial-chart-gauge"
      data={[{ label: "CPU", value: 68, color: "var(--warning)" }]}
      startAngle={210}
      endAngle={-30}
      innerRadius={0.66}
      outerRadius={0.9}
      centerLabel="CPU load"
    >
      68%
    </RadialChart>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Gauge />
    </div>
  );
}
