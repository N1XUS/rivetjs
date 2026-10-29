// Rivet-authored PieChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { PieChart } from "@rivetjs/ui/pie-chart";
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";

export const head = { title: "PieChart: Custom Tooltip" };

// #region demo
const BROWSERS = [
  { label: "Chrome", value: 62 },
  { label: "Safari", value: 21 },
  { label: "Firefox", value: 9 },
  { label: "Edge", value: 5 },
  { label: "Other", value: 3 },
];

export function CustomTooltip() {
  return (
    <PieChart
      id="pie-chart-custom-tooltip"
      data={BROWSERS}
      tooltip={(point) => (
        <ChartTooltip indicator="line">
          <ChartTooltip.Header>Browser share</ChartTooltip.Header>
          {point.items.map((item) => (
            <ChartTooltip.Item>
              <ChartTooltip.Indicator color={item.color} />
              <ChartTooltip.Label>{item.name}</ChartTooltip.Label>
              <ChartTooltip.Value>{item.formatted}%</ChartTooltip.Value>
            </ChartTooltip.Item>
          ))}
        </ChartTooltip>
      )}
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CustomTooltip />
    </div>
  );
}
