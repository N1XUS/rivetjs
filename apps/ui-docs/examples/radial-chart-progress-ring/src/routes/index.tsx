// Rivet-authored RadialChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { RadialChart } from "@rivetjs/ui/radial-chart";

export const head = { title: "RadialChart: Progress Ring" };

// #region demo
export function ProgressRing() {
  return (
    <RadialChart
      id="radial-chart-progress-ring"
      data={[{ label: "Uploaded", value: 45 }]}
      size={160}
      innerRadius={0.74}
      outerRadius={0.94}
      centerLabel="uploaded"
    >
      45%
    </RadialChart>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ProgressRing />
    </div>
  );
}
