// Rivet-authored LineChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Card } from "@rivetjs/ui/card";
import { LineChart } from "@rivetjs/ui/chart";
import { NumberValue } from "@rivetjs/ui/number-value";
import { TrendChip } from "@rivetjs/ui/trend-chip";

export const head = { title: "LineChart: Portfolio" };

// #region demo
const VALUE = [
  { month: "Jan", portfolio: 84.2, benchmark: 84.2 },
  { month: "Feb", portfolio: 86.9, benchmark: 85.1 },
  { month: "Mar", portfolio: 85.4, benchmark: 84.6 },
  { month: "Apr", portfolio: 88.8, benchmark: 86.3 },
  { month: "May", portfolio: 91.5, benchmark: 87.9 },
  { month: "Jun", portfolio: 90.2, benchmark: 88.4 },
  { month: "Jul", portfolio: 93.7, benchmark: 89.6 },
  { month: "Aug", portfolio: 95.1, benchmark: 90.8 },
  { month: "Sep", portfolio: 94.0, benchmark: 91.2 },
  { month: "Oct", portfolio: 97.6, benchmark: 92.5 },
  { month: "Nov", portfolio: 99.8, benchmark: 93.4 },
  { month: "Dec", portfolio: 102.4, benchmark: 94.9 },
];

const ALLOCATION = [
  { name: "Equities", share: 0.62, color: "var(--accent)" },
  { name: "Bonds", share: 0.28, color: "var(--success)" },
  { name: "Cash", share: 0.1, color: "var(--warning)" },
];

export function Portfolio() {
  return (
    <Card id="line-chart-portfolio" class="w-full max-w-2xl">
      <Card.Header>
        <Card.Description>Portfolio value</Card.Description>
        <div class="flex flex-wrap items-center gap-3">
          <NumberValue class="text-3xl font-semibold" value={102400} style="currency" currency="USD" maximumFractionDigits={0} />
          <TrendChip trend="up">21.6% this year</TrendChip>
        </div>
      </Card.Header>
      <Card.Content>
        <LineChart
          data={VALUE}
          index="month"
          series={[
            { key: "portfolio", label: "Portfolio" },
            { key: "benchmark", label: "Benchmark", color: "var(--muted)", dashed: true },
          ]}
          valueFormatter={(v) => `$${v.toFixed(1)}k`}
          minValue={80}
          height={200}
          aria-label="Portfolio value against the benchmark, last 12 months"
        />
      </Card.Content>
      <Card.Footer class="flex-col items-stretch gap-2">
        <div class="flex h-2 overflow-hidden rounded-full" aria-hidden="true">
          {ALLOCATION.map((part) => (
            <span style={{ width: `${part.share * 100}%`, background: part.color }} />
          ))}
        </div>
        <ul class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {ALLOCATION.map((part) => (
            <li class="flex items-center gap-2">
              <span class="size-2 rounded-full" style={{ background: part.color }} aria-hidden="true" />
              <span class="text-muted">{part.name}</span>
              <NumberValue class="font-medium" value={part.share} style="percent" />
            </li>
          ))}
        </ul>
      </Card.Footer>
    </Card>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <Portfolio />
    </div>
  );
}
