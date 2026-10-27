// Rivet-authored Widget demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Widget } from "@rivetjs/ui/widget";
import { BarChart } from "@rivetjs/ui/chart";

export const head = { title: "Widget: With Bar Chart" };

// #region demo
const MONTHS = [
  { month: "Jan", web: 3200, mobile: 1400 },
  { month: "Feb", web: 4100, mobile: 1620 },
  { month: "Mar", web: 3800, mobile: 1910 },
  { month: "Apr", web: 5200, mobile: 2050 },
  { month: "May", web: 6100, mobile: 2380 },
  { month: "Jun", web: 5800, mobile: 2610 },
];

export function WithBarChart() {
  return (
    <Widget id="widget-bar" class="w-full max-w-2xl">
      <Widget.Header>
        <div class="flex flex-col">
          <Widget.Title>Signups by platform</Widget.Title>
          <Widget.Description>Stacked, per month</Widget.Description>
        </div>
        <Widget.Legend>
          <Widget.LegendItem color="var(--chart-1)">Web</Widget.LegendItem>
          <Widget.LegendItem color="var(--chart-2)">Mobile</Widget.LegendItem>
        </Widget.Legend>
      </Widget.Header>
      <Widget.Content>
        <BarChart
          data={MONTHS}
          index="month"
          stacked
          series={[
            { key: "web", label: "Web" },
            { key: "mobile", label: "Mobile" },
          ]}
          showLegend={false}
          height={200}
          aria-label="Signups by platform"
        />
      </Widget.Content>
    </Widget>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithBarChart />
    </div>
  );
}
