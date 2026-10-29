// Rivet-authored KpiGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Kpi } from "@rivetjs/ui/kpi";
import { KpiGroup } from "@rivetjs/ui/kpi-group";

export const head = { title: "KpiGroup: Vertical" };

// #region demo
const METRICS = [
  { id: "revenue", title: "Revenue", value: 48210, format: { style: "currency", currency: "USD", maximumFractionDigits: 0 }, trend: "up", change: "9.6%" },
  { id: "orders", title: "Orders", value: 1284, format: {}, trend: "up", change: "4.2%" },
  { id: "refunds", title: "Refund rate", value: 0.021, format: { style: "percent", maximumFractionDigits: 1 }, trend: "down", change: "0.4 pt" },
] as const;

export function Vertical() {
  return (
    <KpiGroup id="kpi-group-vertical" orientation="vertical" class="w-full max-w-72">
      <Kpi>
        <Kpi.Title>{METRICS[0].title}</Kpi.Title>
        <Kpi.Body>
          <Kpi.Value value={METRICS[0].value} formatOptions={METRICS[0].format} />
          <Kpi.Trend trend={METRICS[0].trend}>{METRICS[0].change}</Kpi.Trend>
        </Kpi.Body>
      </Kpi>
      <KpiGroup.Separator />
      <Kpi>
        <Kpi.Title>{METRICS[1].title}</Kpi.Title>
        <Kpi.Body>
          <Kpi.Value value={METRICS[1].value} formatOptions={METRICS[1].format} />
          <Kpi.Trend trend={METRICS[1].trend}>{METRICS[1].change}</Kpi.Trend>
        </Kpi.Body>
      </Kpi>
      <KpiGroup.Separator />
      <Kpi>
        <Kpi.Title>{METRICS[2].title}</Kpi.Title>
        <Kpi.Body>
          <Kpi.Value value={METRICS[2].value} formatOptions={METRICS[2].format} />
          <Kpi.Trend trend={METRICS[2].trend} isInverted>
            {METRICS[2].change}
          </Kpi.Trend>
        </Kpi.Body>
      </Kpi>
    </KpiGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Vertical />
    </div>
  );
}
