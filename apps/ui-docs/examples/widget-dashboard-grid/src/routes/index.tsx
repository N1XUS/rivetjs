// Rivet-authored Widget demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Widget } from "@rivetjs/ui/widget";
import { BarChart, DonutChart } from "@rivetjs/ui/chart";
import { NumberValue } from "@rivetjs/ui/number-value";

export const head = { title: "Widget: Dashboard Grid" };

// #region demo
const MONTHS = [
  { month: "Jan", web: 3200, mobile: 1400 },
  { month: "Feb", web: 4100, mobile: 1620 },
  { month: "Mar", web: 3800, mobile: 1910 },
  { month: "Apr", web: 5200, mobile: 2050 },
  { month: "May", web: 6100, mobile: 2380 },
  { month: "Jun", web: 5800, mobile: 2610 },
];

export function DashboardGrid() {
  return (
    <div id="widget-grid" class="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-3">
      {[
        { title: "Revenue", value: 48210 },
        { title: "Customers", value: 1284 },
        { title: "Open tickets", value: 23 },
      ].map((kpi) => (
        <Widget>
          <Widget.Header>
            <Widget.Title>{kpi.title}</Widget.Title>
          </Widget.Header>
          <Widget.Content class="text-2xl font-semibold">
            <NumberValue value={kpi.value} isTabular />
          </Widget.Content>
        </Widget>
      ))}
      <Widget class="md:col-span-2">
        <Widget.Header>
          <div class="flex flex-col">
            <Widget.Title>Signups</Widget.Title>
            <Widget.Description>Per month</Widget.Description>
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
            series={[
              { key: "web", label: "Web" },
              { key: "mobile", label: "Mobile" },
            ]}
            showLegend={false}
            height={200}
            aria-label="Signups per month"
          />
        </Widget.Content>
      </Widget>
      <Widget>
        <Widget.Header>
          <div class="flex flex-col">
            <Widget.Title>Plans</Widget.Title>
            <Widget.Description>Active subscriptions</Widget.Description>
          </div>
        </Widget.Header>
        <Widget.Content class="flex justify-center">
          <DonutChart
            data={[
              { key: "pro", label: "Pro", value: 620 },
              { key: "team", label: "Team", value: 410 },
              { key: "free", label: "Free", value: 254 },
            ]}
            size={150}
            aria-label="Subscriptions by plan"
          />
        </Widget.Content>
      </Widget>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh p-6">
      <DashboardGrid />
    </div>
  );
}
