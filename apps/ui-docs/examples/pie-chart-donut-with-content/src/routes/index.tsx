// Rivet-authored PieChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { PieChart } from "@rivetjs/ui/pie-chart";

export const head = { title: "PieChart: Donut With Content" };

// #region demo
const BROWSERS = [
  { label: "Chrome", value: 62 },
  { label: "Safari", value: 21 },
  { label: "Firefox", value: 9 },
  { label: "Edge", value: 5 },
  { label: "Other", value: 3 },
];

export function DonutWithContent() {
  return (
    <PieChart id="pie-chart-donut-with-content" data={BROWSERS} innerRadius={0.68} paddingAngle={2} centerLabel="sessions">
      12.4k
    </PieChart>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <DonutWithContent />
    </div>
  );
}
