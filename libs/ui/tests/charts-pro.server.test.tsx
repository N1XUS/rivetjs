// Server-target suite (UI-PORT S6 charts; Rivet additions, feature sets inspired by HeroUI Pro's public chart docs,
// independent implementations): polar geometry (sector / full ring / angle split), ChartTooltip (parts, indicator shape,
// inactive, auto Content with formatters), the `tooltip` render function on a cartesian chart, PieChart (sectors with
// focusable layers + tooltips, donut centre, outside labels, nested rings, breakdown legend), RadarChart (grid, shapes,
// wedges, angle labels, radius ticks), RadialChart (tracks, arcs by share of `maxValue`, centre), ComposedChart (bars +
// line + area on one frame, stacked bars, dashed line, one slot per index).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { BarChart } from "../src/components/chart/index.ts";
import { polar, sectorPath, splitAngles } from "../src/components/chart/polar-math.ts";
import { ChartTooltip } from "../src/components/chart-tooltip/index.ts";
import { PieChart } from "../src/components/pie-chart/index.ts";
import { RadarChart } from "../src/components/radar-chart/index.ts";
import { RadialChart } from "../src/components/radial-chart/index.ts";
import { ComposedChart } from "../src/components/composed-chart/index.ts";

const count = (html: string, re: RegExp) => (html.match(new RegExp(re.source, "g")) ?? []).length;

test("polar math: points, sectors, full rings, angle split", () => {
  const top = polar(10, 90);
  assert.ok(Math.abs(top.x - 50) < 1e-9 && Math.abs(top.y - 40) < 1e-9);
  assert.match(sectorPath(40, 0, 90, 0), /^M50 10 A40 40 0 0 1 90 50 L50 50 Z$/);
  assert.match(sectorPath(40, 20, 90, 0), / L70 50 A20 20 0 0 0 50 30 Z$/);
  const ring = sectorPath(40, 20, 90, -270);
  assert.equal(count(ring, /Z/), 2);
  const parts = splitAngles([1, 1, 2], 90, -270, 0);
  assert.deepEqual(
    parts.map((p) => Math.round(p.a1)),
    [0, -90, -270],
  );
  const padded = splitAngles([1, 1], 90, -270, 10);
  assert.equal(Math.round(padded[0]!.a0), 85);
  assert.equal(Math.round(padded[0]!.a1), -85);
});

test("chart tooltip SSR: parts, indicator, inactive, auto content", async () => {
  const html = await renderToString(() => (
    <div>
      <ChartTooltip indicator="line">
        <ChartTooltip.Header>Jan</ChartTooltip.Header>
        <ChartTooltip.Item>
          <ChartTooltip.Indicator color="red" />
          <ChartTooltip.Label>Revenue</ChartTooltip.Label>
          <ChartTooltip.Value>4,000</ChartTooltip.Value>
        </ChartTooltip.Item>
      </ChartTooltip>
      <ChartTooltip active={false}>
        <ChartTooltip.Header>hidden</ChartTooltip.Header>
      </ChartTooltip>
      <ChartTooltip.Content
        label="Feb"
        payload={[{ name: "Visits", value: 1200, color: "blue" }]}
        labelFormatter={(l) => `Month ${l}`}
        valueFormatter={(v) => `${v} views`}
      />
      <ChartTooltip.Content hideHeader label="Mar" payload={[{ name: "A", value: 1 }]} />
    </div>
  ));
  assert.match(html, /class="chart-tooltip" data-slot="chart-tooltip" data-indicator="line"/);
  assert.match(html, /class="chart-tooltip__indicator chart-tooltip__indicator--line"[^>]*style="--chart-color:red"/);
  assert.match(html, /chart-tooltip__value[^>]*>4,000</);
  assert.doesNotMatch(html, />hidden</);
  assert.match(html, /chart-tooltip__header[^>]*>Month Feb</);
  assert.match(html, /chart-tooltip__value[^>]*>1200 views</);
  assert.match(html, /chart-tooltip__indicator--dot/);
  assert.doesNotMatch(html, />Mar</);
});

test("cartesian tooltip render function: custom content in each slot", async () => {
  const html = await renderToString(() => (
    <BarChart
      data={[
        { m: "Jan", a: 1 },
        { m: "Feb", a: 2 },
      ]}
      index="m"
      series={[{ key: "a", label: "Alpha" }]}
      tooltip={(point) => <ChartTooltip.Content label={point.label} payload={point.items.map((i) => ({ name: i.name, value: i.formatted, color: i.color }))} />}
    />
  ));
  assert.equal(count(html, /chart__tooltip chart__tooltip--custom/), 2);
  assert.match(html, /chart-tooltip__header[^>]*>Feb</);
  assert.doesNotMatch(html, / tooltip=/);
});

test("pie chart SSR: sectors, tooltips, donut centre, labels, rings, breakdown", async () => {
  const data = [
    { label: "Chrome", value: 60 },
    { label: "Safari", value: 30 },
    { label: "Other", value: 10, color: "gray" },
  ];
  const html = await renderToString(() => (
    <div>
      <PieChart data={data} labels="percent" size={180} />
      <PieChart data={data} innerRadius={0.6} paddingAngle={2} centerLabel="Visitors" legend="breakdown" />
      <PieChart
        rings={[
          { label: "2025", data },
          { label: "2024", data },
        ]}
        innerRadius={0.4}
        legend="none"
      />
    </div>
  ));
  assert.match(html, /class="chart chart--pie pie-chart"[^>]*style="--chart-polar-size:180px"/);
  assert.equal(count(html, /class="chart__sector"/), 3 + 3 + 6);
  assert.match(html, /aria-label="Chrome: 60 \(60%\)"/);
  assert.match(html, /tabindex="0"/);
  assert.equal(count(html, /class="chart__polar-label"/), 3);
  assert.match(html, /chart__polar-label[^>]*>60%</);
  assert.equal(count(html, /class="pie-chart__leader"/), 3);
  assert.match(html, /chart__sector-path"[^>]*style="--chart-color:gray"/);
  assert.match(html, /chart__polar-center[^]*>100<\/span><span>Visitors</);
  assert.match(html, /data-legend="breakdown"[^]*Chrome<span class="chart__legend-value">60 · 60%/);
  assert.match(html, /aria-label="2024, Safari: 30 \(30%\)"/);
  assert.equal(count(html, /data-slot="chart-legend"/), 2);
});

test("radar chart SSR: grid, shapes, wedges, labels, ticks", async () => {
  const data = [
    { skill: "Speed", a: 80, b: 50 },
    { skill: "Power", a: 60, b: 90 },
    { skill: "Range", a: 40, b: 70 },
    { skill: "Agility", a: 90, b: 60 },
  ];
  const html = await renderToString(() => (
    <RadarChart
      data={data}
      index="skill"
      series={[
        { key: "a", label: "Alpha" },
        { key: "b", label: "Beta", fill: false, dots: true },
      ]}
      gridType="circle"
      showRadiusAxis
    />
  ));
  assert.match(html, /class="chart chart--radar radar-chart"/);
  assert.equal(count(html, /class="radar-chart__shape"/), 2);
  assert.match(html, /radar-chart__shape" d="[^"]+" data-fill="" data-stroke=""/);
  assert.match(html, /radar-chart__shape" d="[^"]+" data-stroke=""/);
  assert.equal(count(html, /class="radar-chart__vertex"/), 4);
  assert.equal(count(html, /class="chart__sector"/), 4);
  assert.match(html, /aria-label="Power: Alpha 60, Beta 90"/);
  assert.equal(count(html, /class="chart__polar-label"/), 4);
  assert.match(html, /radar-chart__tick[^>]*>100</);
  assert.match(html, /chart__polar-grid/);
  assert.match(html, /data-slot="chart-legend"/);
});

test("radial chart SSR: tracks, arcs by share, centre, legend", async () => {
  const html = await renderToString(() => (
    <RadialChart
      data={[
        { label: "Storage", value: 75 },
        { label: "Memory", value: 0 },
      ]}
      startAngle={180}
      endAngle={0}
      showLegend
      centerLabel="used"
    >
      75%
    </RadialChart>
  ));
  assert.match(html, /class="chart chart--radial radial-chart"/);
  assert.equal(count(html, /class="radial-chart__track"/), 2);
  assert.equal(count(html, /class="chart__sector-path"/), 1);
  assert.match(html, /aria-label="Storage: 75"/);
  assert.match(html, /chart__polar-center[^]*>75%<\/span><span>used</);
  assert.match(html, /Memory<span class="chart__legend-value">0</);
});

test("composed chart SSR: bars + line + area, stacked, dashed, slots", async () => {
  const data = [
    { m: "Jan", a: 10, b: 5, t: 12, v: 4 },
    { m: "Feb", a: 20, b: 5, t: 22, v: 8 },
    { m: "Mar", a: 15, b: 10, t: 30, v: 6 },
  ];
  const html = await renderToString(() => (
    <ComposedChart
      data={data}
      index="m"
      stacked
      series={[
        { key: "a", label: "Online", type: "bar" },
        { key: "b", label: "Retail", type: "bar" },
        { key: "t", label: "Target", type: "line", dashed: true },
        { key: "v", label: "Visits", type: "area" },
      ]}
    />
  ));
  assert.match(html, /class="chart chart--composed composed-chart"/);
  assert.equal(count(html, /class="chart__bar-stack"/), 3);
  assert.equal(count(html, /class="chart__bar"/), 6);
  assert.equal(count(html, /class="chart__line"/), 2);
  assert.match(html, /chart__line" d="[^"]+" data-dashed=""/);
  assert.equal(count(html, /class="chart__area"/), 1);
  assert.equal(count(html, /data-slot="chart-slot"/), 3);
  assert.match(html, /aria-label="Feb: Online 20, Retail 5, Target 22, Visits 8"/);
  // dots only for the line / area series
  assert.equal(count(html, /class="chart__dot"/), 3 * 2);
  assert.match(html, /chart__y-label[^>]*>30</);
});
