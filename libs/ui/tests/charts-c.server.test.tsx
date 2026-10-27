// Server-target suite (UI-PORT-C charts; Rivet additions, feature sets inspired by HeroUI Pro's public area / bar / line
// chart docs, independent implementations): missing values (gaps per run, `connectNulls`, tooltips / slot names skip the
// series, an empty bar keeps its place), `showDots`, series `dashed`, per-series colours, horizontal bars (category labels,
// value ticks, widths along the inline axis, stacked, tooltip anchor).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { AreaChart, BarChart, LineChart } from "../src/components/chart/index.ts";

const count = (html: string, re: RegExp) => (html.match(new RegExp(re.source, "g")) ?? []).length;
/** The markup of the slot named `label…` (from its opening tag to the next slot). */
function slotOf(html: string, label: string): string {
  const at = html.indexOf(`aria-label="${label}`);
  const start = html.lastIndexOf("<div class=", at);
  const next = html.indexOf('data-slot="chart-slot"', at);
  return html.slice(start, next < 0 ? undefined : next);
}
const lineOf = (html: string, n = 0) => [...html.matchAll(/<path class="chart__line" d="([^"]*)"/g)][n]?.[1] ?? "";

const DATA = [
  { day: "Mon", a: 10, b: 4 },
  { day: "Tue", a: 12, b: null },
  { day: "Wed", a: null, b: 6 },
  { day: "Thu", a: 14, b: 7 },
  { day: "Fri", a: 16 },
];

test("line chart: a missing value splits the line into runs; connectNulls joins them", async () => {
  const gaps = await renderToString(() => <LineChart data={DATA} index="day" series={[{ key: "a" }, { key: "b" }]} curve="linear" />);
  // a: Mon–Tue, Thu–Fri = two runs (two moves); b: Mon, Wed–Thu = two runs.
  assert.equal(count(lineOf(gaps, 0), /M/), 2);
  assert.equal(count(lineOf(gaps, 1), /M/), 2);
  const joined = await renderToString(() => <LineChart data={DATA} index="day" series={[{ key: "a" }, { key: "b" }]} curve="linear" connectNulls />);
  assert.equal(count(lineOf(joined, 0), /M/), 1);
  assert.equal(count(lineOf(joined, 0), /L/), 3);
  // Slot names + tooltips leave the missing series out (Wed has no `a`, Fri no `b`).
  assert.match(gaps, /aria-label="Wed: b 6"/);
  assert.match(gaps, /aria-label="Fri: a 16"/);
  const wed = slotOf(gaps, "Wed");
  assert.equal(count(wed, /class="chart__dot"/), 1);
  assert.equal(count(wed, /class="chart__tooltip-row"/), 1);
});

test("area chart: one closed area per run; stacked counts a gap as 0", async () => {
  const html = await renderToString(() => <AreaChart data={DATA} index="day" series={[{ key: "a" }]} curve="linear" />);
  const area = html.match(/<path class="chart__area" d="([^"]*)"/)![1]!;
  assert.equal(count(area, /Z/), 2);
  const stacked = await renderToString(() => <AreaChart data={DATA} index="day" series={[{ key: "a" }, { key: "b" }]} stacked curve="linear" />);
  assert.equal(count(lineOf(stacked, 0), /M/), 1);
  assert.match(stacked, /aria-label="Tue: a 12"/);
});

test("missing values do not widen the y range", async () => {
  const html = await renderToString(() => (
    <LineChart
      data={[
        { d: "a", v: 98 },
        { d: "b", v: null },
        { d: "c", v: 99 },
      ]}
      index="d"
      series={[{ key: "v" }]}
      minValue={97}
      maxValue={100}
    />
  ));
  assert.doesNotMatch(html, /class="chart__y-label"[^>]*>0</);
  assert.match(html, /class="chart__y-label"[^>]*>97</);
});

test("all values missing: a slot says no data", async () => {
  const html = await renderToString(() => <LineChart data={[{ d: "x", v: null }]} index="d" series={[{ key: "v" }]} />);
  assert.match(html, /aria-label="x: no data"/);
});

test("showDots, dashed and per-series colours", async () => {
  const html = await renderToString(() => (
    <LineChart
      data={DATA}
      index="day"
      showDots
      series={[
        { key: "a", color: "rgb(1, 2, 3)" },
        { key: "b", dashed: true },
      ]}
    />
  ));
  assert.match(html, /<div class="chart__points" aria-hidden="true">/);
  // 4 values of a + 3 of b.
  assert.equal(count(html, /class="chart__point"/), 7);
  assert.match(html, /class="chart__point" style="left:0%;top:[^"]*--chart-color:rgb\(1, 2, 3\)/);
  assert.equal(count(html, /data-dashed=""/), 1);
  assert.match(html, /--chart-color:var\(--chart-2\)/);
  const none = await renderToString(() => <LineChart data={DATA} index="day" series={[{ key: "a" }]} />);
  assert.doesNotMatch(none, /chart__points/);
});

test("bar chart: a missing value keeps an empty bar in its group", async () => {
  const html = await renderToString(() => <BarChart data={DATA} index="day" series={[{ key: "a" }, { key: "b" }]} />);
  const tue = slotOf(html, "Tue");
  assert.equal(count(tue, /class="chart__bar"/), 2);
  assert.match(tue, /class="chart__bar" style="height:0%/);
  assert.match(html, /aria-label="Tue: a 12"/);
});

test("horizontal bar chart: categories down the side, value ticks along the bottom, widths", async () => {
  const data = [
    { browser: "Chrome", visits: 600 },
    { browser: "Safari", visits: 300 },
    { browser: "Firefox", visits: 150 },
  ];
  const html = await renderToString(() => (
    <BarChart id="h" data={data} index="browser" orientation="horizontal" series={[{ key: "visits", label: "Visits" }]} maxValue={600} categoryWidth="5rem" />
  ));
  assert.match(
    html,
    /<figure class="chart chart--horizontal chart--bar" data-slot="chart" data-orientation="horizontal" style="--chart-height:240px;--chart-y-axis-width:5rem" id="h"/,
  );
  assert.match(html, /<span class="chart__y-label" style="top:16\.667%">Chrome<\/span>/);
  assert.match(html, /<span class="chart__y-label" style="top:83\.333%">Firefox<\/span>/);
  assert.match(html, /class="chart__x-label" style="inset-inline-start:100%">600</);
  assert.match(html, /class="chart__grid-line" style="inset-inline-start:0%" data-baseline=""/);
  assert.match(html, /class="chart__bar" style="width:100%;--chart-color:var\(--chart-1\)"/);
  assert.match(html, /class="chart__bar" style="width:50%;/);
  assert.match(html, /class="chart__bar" style="width:25%;/);
  // Tooltip at the bar end, opening toward the start past 60 %.
  const chrome = slotOf(html, "Chrome");
  assert.match(chrome, /data-side="start"/);
  assert.match(chrome, /style="--chart-anchor:100%"/);
  const firefox = slotOf(html, "Firefox");
  assert.match(firefox, /data-side="end"/);
  assert.match(firefox, /style="--chart-anchor:25%"/);
});

test("horizontal stacked bars: one stack per category, widths by share of the range", async () => {
  const data = [
    { team: "Core", done: 30, open: 10 },
    { team: "Docs", done: 10, open: 30 },
  ];
  const html = await renderToString(() => (
    <BarChart data={data} index="team" orientation="horizontal" stacked maxValue={40} series={[{ key: "done" }, { key: "open" }]} />
  ));
  assert.equal(count(html, /class="chart__bar-stack"/), 2);
  assert.match(html, /class="chart__bar" style="width:75%;/);
  assert.match(html, /class="chart__bar" style="width:25%;/);
  assert.match(html, /<ul class="chart__legend"/);
});
