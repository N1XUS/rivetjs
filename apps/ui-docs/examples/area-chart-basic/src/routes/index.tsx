// Rivet-authored AreaChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { AreaChart } from "@rivetjs/ui/chart";

export const head = { title: "AreaChart: Usage" };

// #region demo
const REVENUE = [
  { month: "Jan", revenue: 18400 },
  { month: "Feb", revenue: 21900 },
  { month: "Mar", revenue: 20300 },
  { month: "Apr", revenue: 26800 },
  { month: "May", revenue: 31200 },
  { month: "Jun", revenue: 34650 },
];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

export function Basic() {
  return (
    <AreaChart
      id="area-chart-basic"
      class="w-full max-w-2xl"
      data={REVENUE}
      index="month"
      series={[{ key: "revenue", label: "Revenue" }]}
      valueFormatter={(v) => usd.format(v)}
      aria-label="Monthly revenue"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <Basic />
    </div>
  );
}
