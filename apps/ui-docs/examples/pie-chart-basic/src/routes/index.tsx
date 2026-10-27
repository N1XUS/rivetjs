// Rivet-authored PieChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { PieChart } from "@rivetjs/ui/pie-chart";

export const head = { title: "PieChart: Usage" };

// #region demo
const BROWSERS = [
  { label: "Chrome", value: 62 },
  { label: "Safari", value: 21 },
  { label: "Firefox", value: 9 },
  { label: "Edge", value: 5 },
  { label: "Other", value: 3 },
];

export function Basic() {
  return <PieChart id="pie-chart-basic" data={BROWSERS} labels="percent" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
