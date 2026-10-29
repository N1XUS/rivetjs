// Rivet-authored Kpi demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { AreaChart } from "@rivetjs/ui/chart";
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";
import { Kpi } from "@rivetjs/ui/kpi";

export const head = { title: "Kpi: With Chart Tooltip" };

// #region demo
const REVENUE = [
  { day: "Oct 20", value: 18400 },
  { day: "Oct 21", value: 21150 },
  { day: "Oct 22", value: 19820 },
  { day: "Oct 23", value: 24310 },
  { day: "Oct 24", value: 23090 },
  { day: "Oct 25", value: 27640 },
  { day: "Oct 26", value: 29980 },
];
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function WithChartTooltip() {
  return (
    <Kpi id="kpi-chart-tooltip" class="w-full max-w-80">
      <Kpi.Header>
        <Kpi.Title>Revenue</Kpi.Title>
      </Kpi.Header>
      <Kpi.Content>
        <Kpi.Value value={164390} formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
        <Kpi.Trend trend="up">12.4%</Kpi.Trend>
      </Kpi.Content>
      <Kpi.Chart>
        <AreaChart
          data={REVENUE}
          index="day"
          series={[{ key: "value", label: "Revenue" }]}
          height={112}
          showLegend={false}
          showGrid={false}
          showXAxis={false}
          showYAxis={false}
          valueFormatter={(value) => usd.format(value)}
          aria-label="Daily revenue, last 7 days"
          tooltip={(point) => (
            <ChartTooltip>
              <ChartTooltip.Header>{point.label}</ChartTooltip.Header>
              {point.items.map((item) => (
                <ChartTooltip.Item>
                  <ChartTooltip.Indicator color={item.color} />
                  <ChartTooltip.Label>{item.name}</ChartTooltip.Label>
                  <ChartTooltip.Value>{item.formatted}</ChartTooltip.Value>
                </ChartTooltip.Item>
              ))}
            </ChartTooltip>
          )}
        />
      </Kpi.Chart>
    </Kpi>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithChartTooltip />
    </div>
  );
}
