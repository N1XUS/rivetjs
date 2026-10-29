// Rivet-authored BarChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { BarChart } from "@rivetjs/ui/chart";

export const head = { title: "BarChart: Grouped bars" };

// #region demo
const TEAMS = [
  { team: "Platform", q1: 42, q2: 51, q3: 47 },
  { team: "Growth", q1: 35, q2: 38, q3: 49 },
  { team: "Design", q1: 22, q2: 30, q3: 28 },
  { team: "Support", q1: 30, q2: 27, q3: 33 },
];

export function GroupedBars() {
  return (
    <BarChart
      id="bar-chart-grouped"
      class="w-full max-w-2xl"
      data={TEAMS}
      index="team"
      series={[
        { key: "q1", label: "Q1" },
        { key: "q2", label: "Q2" },
        { key: "q3", label: "Q3" },
      ]}
      aria-label="Shipped tickets per team and quarter"
      height={220}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <GroupedBars />
    </div>
  );
}
