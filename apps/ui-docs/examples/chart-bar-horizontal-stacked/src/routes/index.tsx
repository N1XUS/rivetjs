// Rivet-authored Chart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { BarChart } from "@rivetjs/ui/chart";

export const head = { title: "Chart: Horizontal stacked bars" };

// #region demo
const PLANS = [
  { plan: "Starter", monthly: 320, yearly: 140 },
  { plan: "Team", monthly: 540, yearly: 410 },
  { plan: "Business", monthly: 260, yearly: 380 },
  { plan: "Enterprise", monthly: 60, yearly: 190 },
];

export function HorizontalStackedBars() {
  return (
    <BarChart
      id="chart-bar-horizontal-stacked"
      class="w-full max-w-2xl"
      data={PLANS}
      index="plan"
      orientation="horizontal"
      stacked
      categoryWidth="5.5rem"
      series={[
        { key: "monthly", label: "Monthly" },
        { key: "yearly", label: "Yearly" },
      ]}
      aria-label="Subscriptions by plan and billing period"
      height={220}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <HorizontalStackedBars />
    </div>
  );
}
