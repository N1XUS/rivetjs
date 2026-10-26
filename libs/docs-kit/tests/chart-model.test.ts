// Benchmark chart math (components/chart-model.ts): ticks, scales, sorting, row layout, gauge.
import { strict as assert } from "node:assert";
import { test } from "vitest";
import {
  advantage,
  easeOut,
  extent,
  formatTick,
  formatValue,
  hitRow,
  LAYOUT,
  linear,
  niceAxis,
  niceStep,
  rowLayout,
  sorted,
  type BarChartSpec,
  type RangeChartSpec,
} from "../components/chart-model.ts";

const caption = { machine: "m", date: "2026-10-07", method: "x", source: { label: "r", href: "https://example.com" } };

test("niceStep: 1 / 2 / 2.5 / 5 × 10^n", () => {
  assert.equal(niceStep(10, 5), 2);
  assert.equal(niceStep(1.83, 5), 0.5);
  assert.equal(niceStep(189, 5), 50);
  assert.equal(niceStep(12, 5), 2.5);
  assert.equal(niceStep(0), 1);
  assert.equal(niceStep(Number.NaN), 1);
});

test("niceAxis covers the max with whole steps from 0", () => {
  assert.deepEqual(niceAxis(2.3, 5), { max: 2.5, ticks: [0, 0.5, 1, 1.5, 2, 2.5] });
  assert.deepEqual(niceAxis(189, 5), { max: 200, ticks: [0, 50, 100, 150, 200] });
  assert.deepEqual(niceAxis(50, 5), { max: 50, ticks: [0, 10, 20, 30, 40, 50] });
  const axis = niceAxis(0.7, 4);
  assert.ok(axis.max >= 0.7 && axis.ticks.at(-1) === axis.max);
});

test("linear maps and clamps", () => {
  const x = linear(10, 100, 300);
  assert.equal(x(0), 100);
  assert.equal(x(5), 200);
  assert.equal(x(10), 300);
  assert.equal(x(-3), 100);
  assert.equal(x(20), 300);
  assert.equal(linear(0, 0, 10)(1), 10);
});

test("formatting", () => {
  assert.equal(formatValue(0.98278, 2), "0.98");
  assert.equal(formatValue(1234.5, 1), "1,234.5");
  assert.equal(formatValue(30, 1), "30.0");
  assert.equal(formatTick(2.5), "2.5");
  assert.equal(formatTick(200), "200");
  // Cached formatters print what `toLocaleString` prints (lane X7: one Intl.NumberFormat per option set).
  for (const value of [0, -0, -1234.5678, 0.005, 1e21, 123456789.987, Number.NaN, Infinity, 2.345, 0.125])
    for (const digits of [0, 1, 2, 3]) {
      assert.equal(formatValue(value, digits), value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }));
      assert.equal(formatTick(value), value.toLocaleString("en-US", { maximumFractionDigits: 2 }));
    }
  assert.throws(() => formatValue(1, -1), RangeError);
});

test("sorted: best first, stable on ties", () => {
  const points = [
    { label: "a", value: 3 },
    { label: "b", value: 1 },
    { label: "c", value: 3 },
  ];
  assert.deepEqual(
    sorted(points, "lower").map((p) => p.label),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    sorted(points, "higher").map((p) => p.label),
    ["a", "c", "b"],
  );
  assert.equal(points[0]!.label, "a", "input untouched");
});

const bar: BarChartSpec = {
  id: "t",
  kind: "bar",
  title: "T",
  unit: "ms",
  better: "lower",
  caption,
  groups: [
    {
      label: "Class A",
      points: [
        { label: "slow", value: 6, min: 5, max: 7 },
        { label: "Rivet", value: 2, rivet: true },
      ],
    },
    { label: "Class B", points: [{ label: "x", value: 9.5 }] },
  ],
};

test("extent includes whisker ends", () => {
  assert.equal(extent(bar.groups), 9.5);
  assert.equal(extent([{ label: "", points: [{ label: "a", value: 1, max: 12 }] }]), 12);
});

test("rowLayout: wide — label column, headings, sorted rows, stacked without overlap", () => {
  const layout = rowLayout(bar, 720);
  assert.equal(layout.labelsLeft, true);
  assert.equal(layout.plot.x0, LAYOUT.labelWidth);
  assert.equal(layout.plot.x1, 720 - LAYOUT.valueWidth);
  assert.deepEqual(
    layout.headings.map((h) => h.label),
    ["Class A", "Class B"],
  );
  assert.deepEqual(
    layout.rows.map((r) => r.point.label),
    ["Rivet", "slow", "x"],
  );
  for (let i = 1; i < layout.rows.length; i++) assert.ok(layout.rows[i]!.y >= layout.rows[i - 1]!.y + layout.rows[i - 1]!.h);
  assert.equal(layout.height, layout.plot.y1 + LAYOUT.axis);
  assert.deepEqual(layout.axis, { max: 10, ticks: [0, 2, 4, 6, 8, 10] });
});

test("rowLayout: narrow — labels above the bars, taller rows", () => {
  const layout = rowLayout(bar, 340);
  assert.equal(layout.labelsLeft, false);
  assert.equal(layout.plot.x0, LAYOUT.pad);
  assert.ok(layout.rows.every((r) => r.h === LAYOUT.rowNarrow));
  assert.ok(layout.height > rowLayout(bar, 720).height);
});

test("rowLayout: range charts keep source order", () => {
  const range: RangeChartSpec = { ...bar, kind: "range" };
  assert.deepEqual(
    rowLayout(range, 720).rows.map((r) => r.point.label),
    ["slow", "Rivet", "x"],
  );
});

test("hitRow finds the row under y", () => {
  const layout = rowLayout(bar, 720);
  const second = layout.rows[1]!;
  assert.equal(hitRow(layout, second.y + 1), 1);
  assert.equal(hitRow(layout, -5), -1);
  assert.equal(hitRow(layout, layout.height + 50), -1);
});

test("advantage", () => {
  assert.equal(advantage(1, 2, "lower"), 2);
  assert.equal(advantage(4, 2, "higher"), 2);
});

test("easeOut: 0 → 1, clamped", () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.equal(easeOut(-1), 0);
  assert.equal(easeOut(2), 1);
  assert.ok(easeOut(0.5) > 0.5);
});
