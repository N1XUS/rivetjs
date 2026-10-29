// Rivet-authored AreaChart demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { AreaChart } from "@rivetjs/ui/chart";
import { Kpi } from "@rivetjs/ui/kpi";
import { Users } from "lucide";

export const head = { title: "AreaChart: KPI With Area Chart" };

// #region demo
const DAYS = [
  { day: "Mon", users: 1840 },
  { day: "Tue", users: 2120 },
  { day: "Wed", users: 1990 },
  { day: "Thu", users: 2410 },
  { day: "Fri", users: 2280 },
  { day: "Sat", users: 2730 },
  { day: "Sun", users: 2960 },
];

export function KpiWithAreaChart() {
  return (
    <Kpi id="area-chart-kpi" class="w-full max-w-sm">
      <Kpi.Header>
        <Kpi.Title>Daily active users</Kpi.Title>
        <Kpi.Icon>
          <Icon icon={Users} size={16} />
        </Kpi.Icon>
      </Kpi.Header>
      <Kpi.Body>
        <Kpi.Value value={2960} />
        <Kpi.Trend trend="up">14.2%</Kpi.Trend>
      </Kpi.Body>
      <Kpi.Description>vs. last Sunday</Kpi.Description>
      <Kpi.Chart>
        <AreaChart
          data={DAYS}
          index="day"
          series={[{ key: "users", label: "Users" }]}
          minValue={1500}
          height={96}
          showXAxis={false}
          showYAxis={false}
          showGrid={false}
          aria-label="Daily active users this week"
        />
      </Kpi.Chart>
    </Kpi>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <KpiWithAreaChart />
    </div>
  );
}
