// Rivet-authored LineChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Card } from "@rivetjs/ui/card";
import { LineChart } from "@rivetjs/ui/chart";
import { TrendChip } from "@rivetjs/ui/trend-chip";

export const head = { title: "LineChart: Stats With Chart" };

// #region demo
const STATS = [
  { label: "Visitors", value: "12,480", change: "9.2%", trend: "up" as const },
  { label: "Page views", value: "41,302", change: "4.7%", trend: "up" as const },
  { label: "Bounce rate", value: "36.1%", change: "1.8%", trend: "down" as const, inverted: true },
];

const WEEK = [
  { day: "Mon", visitors: 1520, returning: 610 },
  { day: "Tue", visitors: 1740, returning: 690 },
  { day: "Wed", visitors: 1690, returning: 720 },
  { day: "Thu", visitors: 1910, returning: 780 },
  { day: "Fri", visitors: 2080, returning: 820 },
  { day: "Sat", visitors: 1630, returning: 590 },
  { day: "Sun", visitors: 1910, returning: 700 },
];

export function StatsWithChart() {
  return (
    <Card id="line-chart-stats-with-chart" class="w-full max-w-2xl">
      <Card.Header>
        <Card.Title>Site traffic</Card.Title>
        <Card.Description>Last 7 days</Card.Description>
      </Card.Header>
      <Card.Content class="gap-6">
        <dl class="grid grid-cols-3 gap-4">
          {STATS.map((stat) => (
            <div class="flex flex-col gap-1">
              <dt class="text-sm text-muted">{stat.label}</dt>
              <dd class="m-0 flex flex-wrap items-center gap-2">
                <span class="text-xl font-semibold tabular-nums">{stat.value}</span>
                <TrendChip trend={stat.trend} isInverted={stat.inverted}>
                  {stat.change}
                </TrendChip>
              </dd>
            </div>
          ))}
        </dl>
        <LineChart
          data={WEEK}
          index="day"
          series={[
            { key: "visitors", label: "All visitors" },
            { key: "returning", label: "Returning" },
          ]}
          height={180}
          aria-label="Visitors per day, all and returning"
        />
      </Card.Content>
    </Card>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <StatsWithChart />
    </div>
  );
}
