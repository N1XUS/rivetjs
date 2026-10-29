// Rivet-authored PieChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { PieChart } from "@rivetjs/ui/pie-chart";

export const head = { title: "PieChart: Donut With Label" };

// #region demo
const BROWSERS = [
  { label: "Chrome", value: 62 },
  { label: "Safari", value: 21 },
  { label: "Firefox", value: 9 },
  { label: "Edge", value: 5 },
  { label: "Other", value: 3 },
];

export function DonutWithLabel() {
  return <PieChart id="pie-chart-donut-with-label" data={BROWSERS} innerRadius={0.68} centerLabel="Total share" valueFormatter={(v) => `${v}%`} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <DonutWithLabel />
    </div>
  );
}
