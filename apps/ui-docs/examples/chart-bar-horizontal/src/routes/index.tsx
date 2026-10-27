// Rivet-authored Chart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { BarChart } from "@rivetjs/ui/chart";

export const head = { title: "Chart: Horizontal bars" };

// #region demo
const BROWSERS = [
  { browser: "Chrome", visits: 4820 },
  { browser: "Safari", visits: 2310 },
  { browser: "Edge", visits: 1240 },
  { browser: "Firefox", visits: 960 },
  { browser: "Other", visits: 410 },
];

export function HorizontalBars() {
  return (
    <BarChart
      id="chart-bar-horizontal"
      class="w-full max-w-2xl"
      data={BROWSERS}
      index="browser"
      orientation="horizontal"
      series={[{ key: "visits", label: "Visits" }]}
      aria-label="Visits by browser"
      height={220}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <HorizontalBars />
    </div>
  );
}
