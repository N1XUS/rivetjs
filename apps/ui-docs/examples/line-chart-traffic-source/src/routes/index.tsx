// Rivet-authored LineChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Card } from "@rivetjs/ui/card";
import { LineChart } from "@rivetjs/ui/chart";

export const head = { title: "LineChart: Traffic Source" };

// #region demo
const SOURCES = [
  { key: "organic", label: "Organic search", color: "var(--accent)" },
  { key: "direct", label: "Direct", color: "var(--success)" },
  { key: "referral", label: "Referral", color: "var(--warning)" },
  { key: "social", label: "Social", color: "var(--danger)" },
];

const WEEKS = [
  { week: "W1", organic: 4200, direct: 2600, referral: 1300, social: 900 },
  { week: "W2", organic: 4480, direct: 2540, referral: 1420, social: 1180 },
  { week: "W3", organic: 4610, direct: 2710, referral: 1380, social: 1050 },
  { week: "W4", organic: 4950, direct: 2820, referral: 1560, social: 1320 },
  { week: "W5", organic: 5120, direct: 2760, referral: 1610, social: 1640 },
  { week: "W6", organic: 5340, direct: 2900, referral: 1700, social: 1510 },
  { week: "W7", organic: 5590, direct: 3010, referral: 1680, social: 1790 },
  { week: "W8", organic: 5870, direct: 3120, referral: 1820, social: 2060 },
];

const number = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const totals = SOURCES.map((source) => WEEKS.reduce((sum, week) => sum + Number(week[source.key as keyof (typeof WEEKS)[number]]), 0));
const all = totals.reduce((sum, total) => sum + total, 0);

export function TrafficSource() {
  return (
    <Card id="line-chart-traffic-source" class="w-full max-w-2xl">
      <Card.Header>
        <Card.Title>Traffic source</Card.Title>
        <Card.Description>Sessions per week, last 8 weeks</Card.Description>
      </Card.Header>
      <Card.Content class="gap-6">
        <LineChart
          data={WEEKS}
          index="week"
          series={SOURCES}
          showLegend={false}
          valueFormatter={(v) => number.format(v)}
          height={200}
          aria-label="Sessions per week by traffic source"
        />
        <ul class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {SOURCES.map((source, i) => (
            <li class="flex flex-col gap-0.5">
              <span class="flex items-center gap-2 text-sm text-muted">
                <span class="size-2 rounded-full" style={{ background: source.color }} aria-hidden="true" />
                {source.label}
              </span>
              <span class="text-lg font-semibold tabular-nums">{number.format(totals[i]!)}</span>
              <span class="text-xs text-muted tabular-nums">{Math.round((totals[i]! / all) * 100)}% of sessions</span>
            </li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <TrafficSource />
    </div>
  );
}
