// Rivet-authored PieChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { PieChart } from "@rivetjs/ui/pie-chart";

export const head = { title: "PieChart: Nested Donut" };

// #region demo
const BROWSERS = [
  { label: "Chrome", value: 62 },
  { label: "Safari", value: 21 },
  { label: "Firefox", value: 9 },
  { label: "Edge", value: 5 },
  { label: "Other", value: 3 },
];

const LAST_YEAR = [
  { label: "Chrome", value: 58 },
  { label: "Safari", value: 24 },
  { label: "Firefox", value: 11 },
  { label: "Edge", value: 4 },
  { label: "Other", value: 3 },
];

export function NestedDonut() {
  return (
    <PieChart
      id="pie-chart-nested-donut"
      size={220}
      innerRadius={0.35}
      paddingAngle={1}
      rings={[
        { label: "2026", data: BROWSERS },
        { label: "2025", data: LAST_YEAR },
      ]}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <NestedDonut />
    </div>
  );
}
