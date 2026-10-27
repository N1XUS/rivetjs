// Rivet-authored ComposedChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ComposedChart } from "@rivetjs/ui/composed-chart";

export const head = { title: "ComposedChart: Usage" };

// #region demo
const SALES = [
  { month: "Jan", online: 4200, retail: 2400, target: 7000, visits: 3100 },
  { month: "Feb", online: 5100, retail: 2800, target: 7200, visits: 3900 },
  { month: "Mar", online: 4700, retail: 3100, target: 7500, visits: 3500 },
  { month: "Apr", online: 6100, retail: 3000, target: 8000, visits: 4600 },
  { month: "May", online: 6600, retail: 3500, target: 8400, visits: 5200 },
  { month: "Jun", online: 7200, retail: 3700, target: 8800, visits: 5800 },
];

export function Basic() {
  return (
    <ComposedChart
      id="composed-chart-basic"
      class="w-full max-w-xl"
      data={SALES}
      index="month"
      series={[
        { key: "online", label: "Online", type: "bar" },
        { key: "target", label: "Target", type: "line" },
      ]}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
