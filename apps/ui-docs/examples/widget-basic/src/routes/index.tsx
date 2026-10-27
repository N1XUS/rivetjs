// Rivet-authored Widget demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Widget } from "@rivetjs/ui/widget";
import { AreaChart } from "@rivetjs/ui/chart";

export const head = { title: "Widget: Usage" };

// #region demo
const MONTHS = [
  { month: "Jan", web: 3200, mobile: 1400 },
  { month: "Feb", web: 4100, mobile: 1620 },
  { month: "Mar", web: 3800, mobile: 1910 },
  { month: "Apr", web: 5200, mobile: 2050 },
  { month: "May", web: 6100, mobile: 2380 },
  { month: "Jun", web: 5800, mobile: 2610 },
];

export function Basic() {
  return (
    <Widget id="widget-basic" class="w-full max-w-2xl">
      <Widget.Header>
        <div class="flex flex-col">
          <Widget.Title>Sessions</Widget.Title>
          <Widget.Description>Last 6 months</Widget.Description>
        </div>
        <Widget.Legend>
          <Widget.LegendItem color="var(--chart-1)">Web</Widget.LegendItem>
          <Widget.LegendItem color="var(--chart-2)">Mobile</Widget.LegendItem>
        </Widget.Legend>
      </Widget.Header>
      <Widget.Content>
        <AreaChart
          data={MONTHS}
          index="month"
          series={[
            { key: "web", label: "Web" },
            { key: "mobile", label: "Mobile" },
          ]}
          showLegend={false}
          height={200}
          aria-label="Sessions by platform"
        />
      </Widget.Content>
      <Widget.Footer>Updated 5 minutes ago</Widget.Footer>
    </Widget>
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
