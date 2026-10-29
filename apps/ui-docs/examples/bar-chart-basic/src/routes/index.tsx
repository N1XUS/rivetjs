// Rivet-authored BarChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { BarChart } from "@rivetjs/ui/chart";

export const head = { title: "BarChart: Usage" };

// #region demo
const WEEK = [
  { day: "Mon", orders: 124 },
  { day: "Tue", orders: 156 },
  { day: "Wed", orders: 141 },
  { day: "Thu", orders: 189 },
  { day: "Fri", orders: 232 },
  { day: "Sat", orders: 278 },
  { day: "Sun", orders: 203 },
];

export function Basic() {
  return (
    <BarChart
      id="bar-chart-basic"
      class="w-full max-w-2xl"
      data={WEEK}
      index="day"
      series={[{ key: "orders", label: "Orders" }]}
      aria-label="Orders per day this week"
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
