// Rivet-authored BarChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { BarChart } from "@rivetjs/ui/chart";
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";

export const head = { title: "BarChart: Custom Tooltip" };

// #region demo
const PLAN_MINUTES = 3000;

const BUILDS = [
  { month: "Jan", linux: 1120, macos: 640 },
  { month: "Feb", linux: 1290, macos: 710 },
  { month: "Mar", linux: 1410, macos: 690 },
  { month: "Apr", linux: 1580, macos: 820 },
  { month: "May", linux: 1660, macos: 905 },
  { month: "Jun", linux: 1840, macos: 960 },
];

export function CustomTooltip() {
  return (
    <BarChart
      id="bar-chart-custom-tooltip"
      class="w-full max-w-2xl"
      data={BUILDS}
      index="month"
      stacked
      series={[
        { key: "linux", label: "Linux" },
        { key: "macos", label: "macOS" },
      ]}
      valueFormatter={(v) => `${v} min`}
      aria-label="Build minutes by runner"
      tooltip={(point) => {
        const used = point.items.reduce((sum, item) => sum + item.value, 0);
        return (
          <ChartTooltip>
            <ChartTooltip.Header>{point.label}: build minutes</ChartTooltip.Header>
            {point.items.map((item) => (
              <ChartTooltip.Item>
                <ChartTooltip.Indicator color={item.color} />
                <ChartTooltip.Label>{item.name}</ChartTooltip.Label>
                <ChartTooltip.Value>{item.formatted}</ChartTooltip.Value>
              </ChartTooltip.Item>
            ))}
            <ChartTooltip.Item class="border-t border-separator pt-1">
              <ChartTooltip.Label>Plan used</ChartTooltip.Label>
              <ChartTooltip.Value>{Math.round((used / PLAN_MINUTES) * 100)}%</ChartTooltip.Value>
            </ChartTooltip.Item>
          </ChartTooltip>
        );
      }}
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
