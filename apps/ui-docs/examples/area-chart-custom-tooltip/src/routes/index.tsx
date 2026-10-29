// Rivet-authored AreaChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { AreaChart } from "@rivetjs/ui/chart";
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";

export const head = { title: "AreaChart: Custom Tooltip" };

// #region demo
const SIGNUPS = [
  { month: "Jan", organic: 820, paid: 410 },
  { month: "Feb", organic: 940, paid: 520 },
  { month: "Mar", organic: 1010, paid: 480 },
  { month: "Apr", organic: 1240, paid: 610 },
  { month: "May", organic: 1390, paid: 700 },
  { month: "Jun", organic: 1520, paid: 760 },
];

const number = new Intl.NumberFormat("en-US");

export function CustomTooltip() {
  return (
    <AreaChart
      id="area-chart-custom-tooltip"
      class="w-full max-w-2xl"
      data={SIGNUPS}
      index="month"
      series={[
        { key: "organic", label: "Organic" },
        { key: "paid", label: "Paid" },
      ]}
      aria-label="Sign-ups by channel"
      tooltip={(point) => (
        <ChartTooltip indicator="line">
          <ChartTooltip.Header>{point.label} 2026</ChartTooltip.Header>
          {point.items.map((item) => (
            <ChartTooltip.Item>
              <ChartTooltip.Indicator color={item.color} />
              <ChartTooltip.Label>{item.name}</ChartTooltip.Label>
              <ChartTooltip.Value>{item.formatted}</ChartTooltip.Value>
            </ChartTooltip.Item>
          ))}
          <ChartTooltip.Item class="border-t border-separator pt-1">
            <ChartTooltip.Label>Total</ChartTooltip.Label>
            <ChartTooltip.Value>{number.format(point.items.reduce((sum, item) => sum + item.value, 0))}</ChartTooltip.Value>
          </ChartTooltip.Item>
        </ChartTooltip>
      )}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <CustomTooltip />
    </div>
  );
}
