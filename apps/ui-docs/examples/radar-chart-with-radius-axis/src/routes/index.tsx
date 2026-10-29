// Rivet-authored RadarChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { RadarChart } from "@rivetjs/ui/radar-chart";

export const head = { title: "RadarChart: With Radius Axis" };

// #region demo
const SKILLS = [
  { skill: "Design", alice: 86, bruno: 64 },
  { skill: "Frontend", alice: 78, bruno: 90 },
  { skill: "Backend", alice: 52, bruno: 82 },
  { skill: "Testing", alice: 70, bruno: 58 },
  { skill: "Writing", alice: 92, bruno: 48 },
  { skill: "Ops", alice: 40, bruno: 76 },
];

export function WithRadiusAxis() {
  return <RadarChart id="radar-chart-with-radius-axis" data={SKILLS} index="skill" maxValue={100} showRadiusAxis series={[{ key: "bruno", label: "Bruno" }]} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithRadiusAxis />
    </div>
  );
}
