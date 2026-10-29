// Rivet-authored BarChart demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { BarChart } from "@rivetjs/ui/chart";
import { Kpi } from "@rivetjs/ui/kpi";
import { ShoppingCart } from "lucide";

export const head = { title: "BarChart: KPI With Bar Chart" };

// #region demo
const DAYS = [
  { day: "Mon", orders: 124 },
  { day: "Tue", orders: 156 },
  { day: "Wed", orders: 141 },
  { day: "Thu", orders: 189 },
  { day: "Fri", orders: 232 },
  { day: "Sat", orders: 278 },
  { day: "Sun", orders: 203 },
];

export function KpiWithBarChart() {
  return (
    <Kpi id="bar-chart-kpi" class="w-full max-w-sm">
      <Kpi.Header>
        <Kpi.Title>Orders this week</Kpi.Title>
        <Kpi.Icon>
          <Icon icon={ShoppingCart} size={16} />
        </Kpi.Icon>
      </Kpi.Header>
      <Kpi.Body>
        <Kpi.Value value={1323} />
        <Kpi.Trend trend="up">6.8%</Kpi.Trend>
      </Kpi.Body>
      <Kpi.Description>Best day: Saturday, 278 orders</Kpi.Description>
      <Kpi.Chart class="px-4 pb-4">
        <BarChart
          data={DAYS}
          index="day"
          series={[{ key: "orders", label: "Orders" }]}
          height={88}
          showYAxis={false}
          showGrid={false}
          aria-label="Orders per day"
        />
      </Kpi.Chart>
    </Kpi>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <KpiWithBarChart />
    </div>
  );
}
