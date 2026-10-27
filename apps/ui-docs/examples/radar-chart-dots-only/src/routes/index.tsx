// Rivet-authored RadarChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { RadarChart } from "@rivetjs/ui/radar-chart";

export const head = { title: "RadarChart: Dots Only" };

// #region demo
const SKILLS = [
  { skill: "Design", alice: 86, bruno: 64 },
  { skill: "Frontend", alice: 78, bruno: 90 },
  { skill: "Backend", alice: 52, bruno: 82 },
  { skill: "Testing", alice: 70, bruno: 58 },
  { skill: "Writing", alice: 92, bruno: 48 },
  { skill: "Ops", alice: 40, bruno: 76 },
];

export function DotsOnly() {
  return (
    <RadarChart
      id="radar-chart-dots-only"
      data={SKILLS}
      index="skill"
      gridType="circle"
      series={[{ key: "alice", label: "Alice", fill: false, stroke: false, dots: true }]}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <DotsOnly />
    </div>
  );
}
