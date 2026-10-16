// Server-target suite (Rivet additions, feature sets inspired by HeroUI Pro's public docs, independent implementations):
// Rating (read-only fractional fill + accessible name, interactive native radios with the checked value), TrendChip (tone
// per trend / inverted, icon), Kpi (formatted value, parts), charts (area / line paths + slots with tooltip labels + axes,
// stacked areas, bar heights + stacked bars, donut segments + legend + centre, sparkline without axes).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Rating } from "../src/components/rating/index.ts";
import { TrendChip } from "../src/components/trend-chip/index.ts";
import { Kpi } from "../src/components/kpi/index.ts";
import { AreaChart, BarChart, DonutChart, LineChart, Sparkline, niceTicks, monotonePath } from "../src/components/chart/index.ts";

const DATA = [
  { month: "Jan", revenue: 1200, costs: 800 },
  { month: "Feb", revenue: 1800, costs: 900 },
  { month: "Mar", revenue: 1500, costs: 1000 },
  { month: "Apr", revenue: 2400, costs: 1100 },
];
const SERIES = [
  { key: "revenue", label: "Revenue" },
  { key: "costs", label: "Costs", color: "var(--danger)" },
];

test("rating SSR: read-only fractional", async () => {
  const html = await renderToString(() => <Rating value={3.5} isReadOnly size="sm" showValue />);
  assert.match(html, /class="rating rating--readonly rating--sm"/);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="3.5 out of 5"/);
  assert.equal((html.match(/data-slot="rating-item"/g) ?? []).length, 5);
  assert.match(html, /--rating-fill:100%/);
  assert.match(html, /--rating-fill:50%/);
  assert.match(html, /--rating-fill:0%/);
  assert.match(html, /class="rating__value" data-slot="rating-value">3.5</);
});

test("rating SSR: interactive radios", async () => {
  const html = await renderToString(() => <Rating defaultValue={4} name="stars" maxValue={6} aria-label="Your rating" />);
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /aria-label="Your rating"/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 6);
  assert.match(html, /name="stars" value="4" checked/);
  assert.doesNotMatch(html, /value="3" checked/);
  assert.match(html, /aria-label="1 star"/);
});

test("trend chip SSR: tones", async () => {
  const up = await renderToString(() => <TrendChip trend="up">12%</TrendChip>);
  assert.match(up, /class="trend-chip trend-chip--md trend-chip--positive trend-chip--soft"/);
  assert.match(up, /data-trend="up"/);
  assert.match(up, /<svg[^>]*class="trend-chip__icon"/);
  const inverted = await renderToString(() => (
    <TrendChip trend="up" isInverted variant="ghost" size="sm" hideIcon>
      3 ms
    </TrendChip>
  ));
  assert.match(inverted, /trend-chip--sm trend-chip--negative trend-chip--ghost/);
  assert.doesNotMatch(inverted, /<svg/);
});

test("kpi SSR: parts + formatted value", async () => {
  const html = await renderToString(() => (
    <Kpi variant="secondary" class="w-60">
      <Kpi.Header>
        <Kpi.Title>Revenue</Kpi.Title>
      </Kpi.Header>
      <Kpi.Body>
        <Kpi.Value value={48210.5} formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
        <Kpi.Trend trend="down">4.1%</Kpi.Trend>
      </Kpi.Body>
      <Kpi.Footer>Updated today</Kpi.Footer>
    </Kpi>
  ));
  assert.match(html, /class="kpi kpi--secondary w-60"/);
  assert.match(html, /<h3 class="kpi__title" data-slot="kpi-title">Revenue<\/h3>/);
  assert.match(html, /class="kpi__value" data-slot="kpi-value">\$48,211</);
  assert.match(html, /trend-chip--negative/);
  assert.match(html, /class="kpi__footer"/);
});

test("chart math", () => {
  assert.deepEqual(niceTicks(0, 2400, 4), [0, 1000, 2000, 3000]);
  assert.deepEqual(niceTicks(0, 95, 4), [0, 25, 50, 75, 100]);
  assert.match(
    monotonePath([
      { x: 0, y: 10 },
      { x: 50, y: 0 },
      { x: 100, y: 10 },
    ]),
    /^M0 10 C/,
  );
});

test("area / line chart SSR", async () => {
  const html = await renderToString(() => (
    <AreaChart data={DATA} index="month" series={SERIES} aria-label="Revenue and costs" valueFormatter={(v) => `$${v}`} />
  ));
  assert.match(html, /<figure class="chart chart--area"/);
  assert.match(html, /aria-label="Revenue and costs"/);
  assert.equal((html.match(/class="chart__area"/g) ?? []).length, 2);
  assert.equal((html.match(/class="chart__line"/g) ?? []).length, 2);
  assert.equal((html.match(/data-slot="chart-slot"/g) ?? []).length, 4);
  assert.match(html, /aria-label="Apr: Revenue \$2400, Costs \$1100"/);
  assert.match(html, /class="chart__y-label"[^>]*>\$3000</);
  assert.match(html, /class="chart__x-label"[^>]*>Jan</);
  assert.match(html, /data-slot="chart-legend"/);
  const line = await renderToString(() => <LineChart data={DATA} index="month" series={SERIES.slice(0, 1)} showYAxis={false} />);
  assert.match(line, /chart--line/);
  assert.match(line, /data-hide-y-axis=""/);
  assert.doesNotMatch(line, /chart__area/);
  assert.doesNotMatch(line, /data-slot="chart-legend"/);
});

test("bar chart SSR: grouped + stacked", async () => {
  const html = await renderToString(() => <BarChart data={DATA} index="month" series={SERIES} />);
  assert.match(html, /chart--bar/);
  assert.equal((html.match(/class="chart__bar"/g) ?? []).length, 8);
  assert.match(html, /height:80%/);
  const stacked = await renderToString(() => <BarChart data={DATA} index="month" series={SERIES} stacked />);
  assert.equal((stacked.match(/class="chart__bar-stack"/g) ?? []).length, 4);
});

test("donut + sparkline SSR", async () => {
  const html = await renderToString(() => (
    <DonutChart
      data={[
        { key: "a", label: "Direct", value: 60 },
        { key: "b", label: "Search", value: 40 },
      ]}
      centerLabel="Visits"
    />
  ));
  assert.match(html, /chart--donut/);
  assert.equal((html.match(/class="chart__donut-segment"/g) ?? []).length, 2);
  assert.match(html, /<title>Direct: 60 \(60%\)<\/title>/);
  assert.match(html, /class="chart__donut-value">100</);
  assert.match(html, /Search<span class="chart__legend-value">40 · 40%/);
  const spark = await renderToString(() => <Sparkline data={DATA} index="month" series={SERIES.slice(0, 1)} />);
  assert.match(spark, /chart--sparkline/);
  assert.doesNotMatch(spark, /chart__x-axis|chart__y-axis|chart__slot/);
});
