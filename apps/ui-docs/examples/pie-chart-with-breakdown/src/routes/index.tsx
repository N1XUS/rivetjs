// Rivet-authored PieChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { PieChart } from "@rivetjs/ui/pie-chart";

export const head = { title: "PieChart: With Breakdown" };

// #region demo
const BROWSERS = [
  { label: "Chrome", value: 62 },
  { label: "Safari", value: 21 },
  { label: "Firefox", value: 9 },
  { label: "Edge", value: 5 },
  { label: "Other", value: 3 },
];

export function WithBreakdown() {
  return <PieChart id="pie-chart-with-breakdown" data={BROWSERS} innerRadius={0.6} paddingAngle={2} legend="breakdown" valueFormatter={(v) => `${v}%`} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithBreakdown />
    </div>
  );
}
