// Rivet-authored Widget demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Widget } from "@rivetjs/ui/widget";
import { Sparkline } from "@rivetjs/ui/chart";
import { Kpi } from "@rivetjs/ui/kpi";
import { KpiGroup } from "@rivetjs/ui/kpi-group";

export const head = { title: "Widget: With KPIs" };

// #region demo
const WEEKS = [12, 18, 15, 22, 26, 24, 31].map((value, i) => ({ week: `W${i + 1}`, value }));

export function WithKpis() {
  return (
    <Widget id="widget-kpis" class="w-full max-w-3xl">
      <Widget.Header>
        <Widget.Title>This week</Widget.Title>
      </Widget.Header>
      <Widget.Content class="p-0">
        <KpiGroup class="shadow-none">
          <Kpi>
            <Kpi.Title>Revenue</Kpi.Title>
            <Kpi.Body>
              <Kpi.Value value={31240} formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
              <Kpi.Trend trend="up">12%</Kpi.Trend>
            </Kpi.Body>
            <Kpi.Chart>
              <Sparkline data={WEEKS} index="week" series={[{ key: "value", label: "Revenue" }]} height={36} aria-label="Revenue trend" />
            </Kpi.Chart>
          </Kpi>
          <KpiGroup.Separator />
          <Kpi>
            <Kpi.Title>Orders</Kpi.Title>
            <Kpi.Body>
              <Kpi.Value value={842} />
              <Kpi.Trend trend="up">5%</Kpi.Trend>
            </Kpi.Body>
            <Kpi.Chart>
              <Sparkline
                data={WEEKS}
                index="week"
                series={[{ key: "value", label: "Orders", color: "var(--chart-2)" }]}
                height={36}
                aria-label="Orders trend"
              />
            </Kpi.Chart>
          </Kpi>
        </KpiGroup>
      </Widget.Content>
    </Widget>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithKpis />
    </div>
  );
}
