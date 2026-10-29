// Rivet-authored RadialChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { RadialChart } from "@rivetjs/ui/radial-chart";

export const head = { title: "RadialChart: With Legend" };

// #region demo
const GOALS = [
  { label: "Move", value: 82 },
  { label: "Exercise", value: 64 },
  { label: "Stand", value: 91 },
];

export function WithLegend() {
  return <RadialChart id="radial-chart-with-legend" data={GOALS} showLegend valueFormatter={(v) => `${v}%`} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithLegend />
    </div>
  );
}
