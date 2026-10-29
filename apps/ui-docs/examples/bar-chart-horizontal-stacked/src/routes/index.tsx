// Rivet-authored BarChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { BarChart } from "@rivetjs/ui/chart";

export const head = { title: "BarChart: Horizontal stacked bars" };

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
      id="bar-chart-horizontal-stacked"
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
