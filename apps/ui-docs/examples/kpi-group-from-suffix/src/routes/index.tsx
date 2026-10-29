// Rivet-authored KpiGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Kpi } from "@rivetjs/ui/kpi";
import { KpiGroup } from "@rivetjs/ui/kpi-group";
import { NumberValue } from "@rivetjs/ui/number-value";

export const head = { title: "KpiGroup: With From Suffix" };

// #region demo
const ROWS = [
  { title: "MRR", now: 18400, before: 16900, trend: "up", change: "8.9%" },
  { title: "Active seats", now: 2310, before: 2244, trend: "up", change: "2.9%" },
  { title: "Churned", now: 41, before: 57, trend: "down", change: "28%" },
] as const;

export function FromSuffix() {
  return (
    <KpiGroup id="kpi-group-from" class="w-full max-w-3xl">
      {ROWS.map((row, i) => (
        <>
          {i > 0 ? <KpiGroup.Separator /> : null}
          <Kpi>
            <Kpi.Title>{row.title}</Kpi.Title>
            <Kpi.Body>
              <Kpi.Value>
                <NumberValue value={row.now} maximumFractionDigits={0} />
              </Kpi.Value>
              <span class="text-sm text-muted">
                from <NumberValue value={row.before} maximumFractionDigits={0} />
              </span>
            </Kpi.Body>
            <Kpi.Trend trend={row.trend} isInverted={row.title === "Churned"} class="self-start">
              {row.change}
            </Kpi.Trend>
          </Kpi>
        </>
      ))}
    </KpiGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <FromSuffix />
    </div>
  );
}
