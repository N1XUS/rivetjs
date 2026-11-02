// Server-target suite (FIX-UI 2026-11-01, review R1 / R3 chart edges): axis ticks terminate and stay ordered for huge
// magnitudes and a `maxValue` below the data, non-numeric / infinite datums count as missing instead of turning the chart
// into NaN, Sparkline leaves gaps like Area / Line, the value range of a large data set does not overflow the call stack,
// and PieChart takes `rings={[]}`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { niceTicks } from "../src/components/chart/chart-math.ts";
import { AreaChart, BarChart, Sparkline } from "../src/components/chart/index.ts";
import { ComposedChart } from "../src/components/composed-chart/index.ts";
import { PieChart } from "../src/components/pie-chart/index.ts";
import { RadarChart } from "../src/components/radar-chart/index.ts";

test("niceTicks: terminates below float resolution, orders a reversed range", () => {
  const huge = niceTicks(1e17, 1e17 + 16, 4);
  assert.ok(huge.length > 0 && huge.length <= 1000, `bounded (${huge.length})`);
  assert.ok(huge.every(Number.isFinite));
  const reversed = niceTicks(100, 10, 4);
  assert.ok(reversed.length >= 2);
  assert.ok(reversed.every(Number.isFinite));
  assert.ok(reversed[0]! <= 10 && reversed[reversed.length - 1]! >= 100, reversed.join());
});

test("charts: non-numeric and infinite datums are missing values, not NaN", async () => {
  const data = [
    { m: "a", v: 1 },
    { m: "b", v: "abc" },
    { m: "c", v: Infinity },
    { m: "d", v: 4 },
  ];
  for (const Chart of [AreaChart, BarChart, Sparkline, ComposedChart, RadarChart] as const) {
    const html = await renderToString(() => <Chart data={data} index="m" series={[{ key: "v", type: "line" }]} />);
    assert.ok(!html.includes("NaN"), `${(Chart as { name?: string }).name}: no NaN in ${html.slice(0, 200)}`);
    assert.ok(!html.includes("Infinity"), `${(Chart as { name?: string }).name}: no Infinity`);
  }
});

test("sparkline: a missing value leaves a gap (two runs)", async () => {
  const html = await renderToString(() => (
    <Sparkline
      data={[
        { m: "a", v: 1 },
        { m: "b", v: 2 },
        { m: "c", v: null },
        { m: "d", v: 3 },
        { m: "e", v: 5 },
      ]}
      index="m"
      series={[{ key: "v" }]}
    />
  ));
  const line = /class="[^"]*chart__line[^"]*" d="([^"]+)"/.exec(html)?.[1] ?? "";
  assert.equal((line.match(/M/g) ?? []).length, 2, `two runs: ${line}`);
  assert.ok(!/ 100(\.0+)? ?L|L\S+ 100 /.test(line.split("M")[1] ?? ""), "no dip to the baseline");
});

test("charts: the value range of a large data set does not overflow the stack", async () => {
  const data = Array.from({ length: 200_000 }, (_, i) => ({ m: String(i), v: i % 97 }));
  for (const Chart of [Sparkline, ComposedChart] as const) {
    const html = await renderToString(() => <Chart data={data} index="m" series={[{ key: "v", type: "line" }]} />);
    assert.ok(html.length > 0);
  }
});

test("pie chart: rings={[]} renders an empty chart", async () => {
  const html = await renderToString(() => <PieChart rings={[]} />);
  assert.match(html, /data-slot="chart"/);
});
