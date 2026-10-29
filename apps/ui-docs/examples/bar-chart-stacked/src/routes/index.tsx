// Rivet-authored BarChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { BarChart } from "@rivetjs/ui/chart";

export const head = { title: "BarChart: Stacked" };

// #region demo
const MONTHS = [
  { month: "Jan", direct: 3200, referral: 1400, social: 620 },
  { month: "Feb", direct: 4100, referral: 1620, social: 700 },
  { month: "Mar", direct: 3800, referral: 1910, social: 860 },
  { month: "Apr", direct: 5200, referral: 2050, social: 940 },
  { month: "May", direct: 6100, referral: 2380, social: 1210 },
  { month: "Jun", direct: 5800, referral: 2610, social: 1330 },
];

export function Stacked() {
  return (
    <BarChart
      id="bar-chart-stacked"
      class="w-full max-w-2xl"
      data={MONTHS}
      index="month"
      stacked
      series={[
        { key: "direct", label: "Direct" },
        { key: "referral", label: "Referral" },
        { key: "social", label: "Social" },
      ]}
      aria-label="Visits by source, stacked"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <Stacked />
    </div>
  );
}
