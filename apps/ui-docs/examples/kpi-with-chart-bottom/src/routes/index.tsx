// Rivet-authored Kpi demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Sparkline } from "@rivetjs/ui/chart";
import { Kpi } from "@rivetjs/ui/kpi";

export const head = { title: "Kpi: chart at the bottom" };

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

export function ChartBottom() {
  return (
    <Kpi id="kpi-bottom" class="w-full max-w-72">
      <Kpi.Header>
        <Kpi.Title>Sessions</Kpi.Title>
      </Kpi.Header>
      <Kpi.Content>
        <Kpi.Value value={4129} />
        <Kpi.Trend trend="up">8.1%</Kpi.Trend>
      </Kpi.Content>
      <Kpi.Chart>
        <Sparkline data={DAYS} index="day" series={[{ key: "value", label: "Sessions" }]} height={56} aria-label="Sessions this week" />
      </Kpi.Chart>
    </Kpi>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ChartBottom />
    </div>
  );
}
