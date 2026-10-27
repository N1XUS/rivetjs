// Rivet-authored RadialChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { RadialChart } from "@rivetjs/ui/radial-chart";

export const head = { title: "RadialChart: Usage" };

// #region demo
const GOALS = [
  { label: "Move", value: 82 },
  { label: "Exercise", value: 64 },
  { label: "Stand", value: 91 },
];

export function Basic() {
  return <RadialChart id="radial-chart-basic" data={GOALS} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
