// Rivet-authored LineChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { LineChart } from "@rivetjs/ui/chart";
import { Kpi } from "@rivetjs/ui/kpi";
import { Percent } from "lucide";

export const head = { title: "LineChart: KPI With Chart" };

// #region demo
const CONVERSION = [
  { month: "Jan", rate: 2.4 },
  { month: "Feb", rate: 2.6 },
  { month: "Mar", rate: 2.5 },
  { month: "Apr", rate: 2.9 },
  { month: "May", rate: 3.1 },
  { month: "Jun", rate: 3.4 },
];

export function KpiWithChart() {
  return (
    <Kpi id="line-chart-kpi" class="w-full max-w-sm">
      <Kpi.Header>
        <Kpi.Title>Conversion rate</Kpi.Title>
        <Kpi.Icon>
          <Icon icon={Percent} size={16} />
        </Kpi.Icon>
      </Kpi.Header>
      <Kpi.Body>
        <Kpi.Value value={0.034} formatOptions={{ style: "percent", minimumFractionDigits: 1 }} />
        <Kpi.Trend trend="up">0.3 pt</Kpi.Trend>
      </Kpi.Body>
      <Kpi.Description>Checkout sessions that ended in an order</Kpi.Description>
      <Kpi.Chart>
        <LineChart
          data={CONVERSION}
          index="month"
          series={[{ key: "rate", label: "Conversion" }]}
          valueFormatter={(v) => `${v.toFixed(1)}%`}
          minValue={2}
          height={88}
          showXAxis={false}
          showYAxis={false}
          showGrid={false}
          aria-label="Conversion rate by month"
        />
      </Kpi.Chart>
    </Kpi>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <KpiWithChart />
    </div>
  );
}
