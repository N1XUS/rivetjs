// Rivet-authored Widget demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Widget } from "@rivetjs/ui/widget";
import { LineChart } from "@rivetjs/ui/chart";

export const head = { title: "Widget: With Line Chart" };

// #region demo
const MONTHS = [
  { month: "Jan", web: 3200, mobile: 1400 },
  { month: "Feb", web: 4100, mobile: 1620 },
  { month: "Mar", web: 3800, mobile: 1910 },
  { month: "Apr", web: 5200, mobile: 2050 },
  { month: "May", web: 6100, mobile: 2380 },
  { month: "Jun", web: 5800, mobile: 2610 },
];

export function WithLineChart() {
  return (
    <Widget id="widget-line" class="w-full max-w-2xl">
      <Widget.Header>
        <div class="flex flex-col">
          <Widget.Title>Active users</Widget.Title>
          <Widget.Description>Web vs. mobile</Widget.Description>
        </div>
        <Widget.Legend>
          <Widget.LegendItem color="var(--chart-1)">Web</Widget.LegendItem>
          <Widget.LegendItem color="var(--chart-2)">Mobile</Widget.LegendItem>
        </Widget.Legend>
      </Widget.Header>
      <Widget.Content>
        <LineChart
          data={MONTHS}
          index="month"
          series={[
            { key: "web", label: "Web" },
            { key: "mobile", label: "Mobile" },
          ]}
          showLegend={false}
          height={200}
          aria-label="Active users by platform"
        />
      </Widget.Content>
    </Widget>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithLineChart />
    </div>
  );
}
