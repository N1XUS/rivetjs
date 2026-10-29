// Rivet-authored Kpi demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Sparkline } from "@rivetjs/ui/chart";
import { Kpi } from "@rivetjs/ui/kpi";
import { Wallet } from "lucide";

export const head = { title: "Kpi: Usage" };

// #region demo
const WEEKS = [
  { week: "W1", revenue: 4100 },
  { week: "W2", revenue: 4620 },
  { week: "W3", revenue: 4380 },
  { week: "W4", revenue: 5210 },
  { week: "W5", revenue: 5640 },
  { week: "W6", revenue: 5390 },
  { week: "W7", revenue: 6120 },
  { week: "W8", revenue: 6480 },
];

export function Basic() {
  return (
    <Kpi id="kpi-revenue" class="w-full max-w-72">
      <Kpi.Header>
        <Kpi.Title>Net revenue</Kpi.Title>
        <Kpi.Icon>
          <Icon icon={Wallet} size={16} />
        </Kpi.Icon>
      </Kpi.Header>
      <Kpi.Body>
        <Kpi.Value value={48210} formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
        <Kpi.Trend trend="up">9.6%</Kpi.Trend>
      </Kpi.Body>
      <Kpi.Description>vs. the previous 8 weeks</Kpi.Description>
      <Kpi.Chart>
        <Sparkline data={WEEKS} index="week" series={[{ key: "revenue", label: "Revenue" }]} height={44} aria-label="Weekly revenue" />
      </Kpi.Chart>
    </Kpi>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
