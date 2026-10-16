// Rivet additions on a resumed page (feature sets inspired by HeroUI Pro's public docs): `#rt` interactive Rating with a
// two-way signal (`#rt-value`), `#rt-ro` read-only 4.3; `#kpi` Kpi with a Sparkline; `#area` AreaChart (6 months, 2 series),
// `#bar` stacked BarChart, `#donut` DonutChart; `#tc` TrendChip.
import { signal } from "@rivetjs/reactivity";
import { AreaChart, BarChart, DonutChart, Sparkline } from "@rivetjs/ui/chart";
import { Kpi } from "@rivetjs/ui/kpi";
import { Rating } from "@rivetjs/ui/rating";
import { TrendChip } from "@rivetjs/ui/trend-chip";

const MONTHS = [
  { month: "Jan", visits: 3200, signups: 420 },
  { month: "Feb", visits: 4100, signups: 510 },
  { month: "Mar", visits: 3800, signups: 480 },
  { month: "Apr", visits: 5200, signups: 690 },
  { month: "May", visits: 6100, signups: 720 },
  { month: "Jun", visits: 5800, signups: 810 },
];

export default function DataDisplayPro() {
  const stars = signal(3);
  return (
    <main class="flex flex-col gap-8 p-6">
      <section class="flex flex-wrap items-center gap-4">
        <Rating id="rt" value={stars} aria-label="Your rating" />
        <span id="rt-value">{stars()}</span>
        <Rating id="rt-ro" value={4.3} isReadOnly showValue />
        <TrendChip id="tc" trend="up">
          12.5%
        </TrendChip>
      </section>
      <Kpi id="kpi" class="w-72">
        <Kpi.Header>
          <Kpi.Title>Signups</Kpi.Title>
        </Kpi.Header>
        <Kpi.Body>
          <Kpi.Value value={3630} />
          <Kpi.Trend trend="up">8.2%</Kpi.Trend>
        </Kpi.Body>
        <Kpi.Chart>
          <Sparkline data={MONTHS} index="month" series={[{ key: "signups" }]} height={40} />
        </Kpi.Chart>
      </Kpi>
      <div class="max-w-2xl">
        <AreaChart
          id="area"
          aria-label="Visits and signups"
          data={MONTHS}
          index="month"
          series={[
            { key: "visits", label: "Visits" },
            { key: "signups", label: "Signups" },
          ]}
        />
      </div>
      <div class="max-w-2xl">
        <BarChart
          id="bar"
          data={MONTHS}
          index="month"
          stacked
          series={[
            { key: "visits", label: "Visits" },
            { key: "signups", label: "Signups" },
          ]}
        />
      </div>
      <DonutChart
        id="donut"
        data={[
          { key: "direct", label: "Direct", value: 42 },
          { key: "search", label: "Search", value: 33 },
          { key: "social", label: "Social", value: 25 },
        ]}
        centerLabel="Sources"
      />
    </main>
  );
}
