// Rivet-authored LineChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Card } from "@rivetjs/ui/card";
import { LineChart } from "@rivetjs/ui/chart";
import { TrendChip } from "@rivetjs/ui/trend-chip";

export const head = { title: "LineChart: Sparkline" };

// #region demo
const CARDS = [
  { name: "Visitors", value: "48.2k", change: "12%", trend: "up" as const, color: "var(--chart-1)", points: [31, 34, 33, 38, 41, 40, 46, 48] },
  { name: "Bounce rate", value: "38.4%", change: "2.1%", trend: "down" as const, color: "var(--chart-2)", points: [44, 43, 45, 41, 40, 41, 39, 38] },
  { name: "Avg. session", value: "3m 12s", change: "0%", trend: "neutral" as const, color: "var(--chart-3)", points: [3.1, 3.3, 3.0, 3.2, 3.2, 3.1, 3.3, 3.2] },
];

export function Sparklines() {
  return (
    <div id="line-chart-sparkline" class="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
      {CARDS.map((card) => (
        <Card>
          <Card.Header>
            <Card.Description>{card.name}</Card.Description>
            <div class="flex items-center gap-2">
              <span class="text-xl font-semibold tabular-nums">{card.value}</span>
              <TrendChip trend={card.trend} isInverted={card.name === "Bounce rate"}>
                {card.change}
              </TrendChip>
            </div>
          </Card.Header>
          <LineChart
            data={card.points.map((value, i) => ({ week: `W${i + 1}`, value }))}
            index="week"
            series={[{ key: "value", label: card.name, color: card.color }]}
            minValue={Math.min(...card.points) * 0.9}
            height={40}
            showLegend={false}
            showGrid={false}
            showXAxis={false}
            showYAxis={false}
            showTooltip={false}
            aria-label={`${card.name}, last 8 weeks`}
          />
        </Card>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <Sparklines />
    </div>
  );
}
