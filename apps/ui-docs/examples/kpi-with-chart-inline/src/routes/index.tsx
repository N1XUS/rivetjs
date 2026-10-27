// Rivet-authored Kpi demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Sparkline } from "@rivetjs/ui/chart";
import { Kpi } from "@rivetjs/ui/kpi";

export const head = { title: "Kpi: inline chart" };

// #region demo
const DAYS = [
  { day: "Mon", value: 32 },
  { day: "Tue", value: 41 },
  { day: "Wed", value: 38 },
  { day: "Thu", value: 52 },
  { day: "Fri", value: 47 },
  { day: "Sat", value: 61 },
  { day: "Sun", value: 58 },
];

export function ChartInline() {
  return (
    <Kpi id="kpi-inline" class="w-full max-w-sm">
      <Kpi.Header>
        <Kpi.Title>Orders</Kpi.Title>
      </Kpi.Header>
      <div class="flex items-end justify-between gap-4">
        <Kpi.Content class="flex-col items-start">
          <Kpi.Value value={329} />
          <Kpi.Trend trend="up">12%</Kpi.Trend>
        </Kpi.Content>
        <div class="h-12 w-32">
          <Sparkline data={DAYS} index="day" series={[{ key: "value", label: "Orders" }]} height={48} aria-label="Orders this week" />
        </div>
      </div>
    </Kpi>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ChartInline />
    </div>
  );
}
