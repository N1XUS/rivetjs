// Rivet-authored Chart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { AreaChart } from "@rivetjs/ui/chart";

export const head = { title: "Chart: Area" };

// #region demo
const MONTHS = [
  { month: "Jan", direct: 3200, referral: 1400, social: 620 },
  { month: "Feb", direct: 4100, referral: 1620, social: 700 },
  { month: "Mar", direct: 3800, referral: 1910, social: 860 },
  { month: "Apr", direct: 5200, referral: 2050, social: 940 },
  { month: "May", direct: 6100, referral: 2380, social: 1210 },
  { month: "Jun", direct: 5800, referral: 2610, social: 1330 },
];

export function Area() {
  return (
    <AreaChart
      id="chart-area"
      class="w-full max-w-2xl"
      data={MONTHS}
      index="month"
      series={[
        { key: "direct", label: "Direct" },
        { key: "referral", label: "Referral" },
        { key: "social", label: "Social" },
      ]}
      aria-label="Visits by source"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <Area />
    </div>
  );
}
