// Rivet-authored Kpi demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Kpi } from "@rivetjs/ui/kpi";

export const head = { title: "Kpi: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
      <Kpi>
        <Kpi.Title>Active members</Kpi.Title>
        <Kpi.Body>
          <Kpi.Value value={12840} />
          <Kpi.Trend trend="up">4.2%</Kpi.Trend>
        </Kpi.Body>
      </Kpi>
      <Kpi variant="secondary">
        <Kpi.Title>Avg. order</Kpi.Title>
        <Kpi.Body>
          <Kpi.Value value={64.3} formatOptions={{ style: "currency", currency: "USD" }} />
          <Kpi.Trend trend="neutral">0.0%</Kpi.Trend>
        </Kpi.Body>
      </Kpi>
      <Kpi variant="transparent">
        <Kpi.Title>Monthly churn</Kpi.Title>
        <Kpi.Body>
          <Kpi.Value value={0.021} formatOptions={{ style: "percent", minimumFractionDigits: 1 }} />
          <Kpi.Trend trend="down" isInverted>
            0.4 pt
          </Kpi.Trend>
        </Kpi.Body>
      </Kpi>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-4">
      <Variants />
    </div>
  );
}
