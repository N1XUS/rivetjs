import { test } from "vitest";
import assert from "node:assert/strict";
import { computeCPU, unionWithin, type TraceEvent } from "../krausest/timeline.ts";
import { compareToPublished, loadPublished, type SuiteResults } from "../krausest/compare.ts";

const ev = (name: string, ts: number, dur: number, extra: Partial<TraceEvent> = {}): TraceEvent => ({ name, ph: "X", ts, dur, pid: 1, tid: 1, ...extra });
const click = (ts: number, dur: number) => ev("EventDispatch", ts, dur, { args: { data: { type: "click" } } });

test("CPU duration runs from click start to the first commit after the last related work", () => {
  const trace = [click(1000, 4000), ev("Layout", 6000, 1000), ev("Commit", 8000, 500), ev("Commit", 30000, 500), ev("Paint", 7500, 300)];
  const cpu = computeCPU(trace);
  assert.equal(cpu.duration, 7.5);
  assert.equal(cpu.layouts, 1);
  assert.equal(cpu.numberCommits, 2);
  assert.throws(() => computeCPU([ev("Commit", 1, 1)]), /exactly one click/);
});

test("interval union counts nested and overlapping events once", () => {
  const trace = [click(0, 10000), ev("FunctionCall", 1000, 2000), ev("FunctionCall", 20000, 1000), ev("Layout", 30000, 5000)];
  assert.equal(unionWithin(trace, ["FunctionCall"], 0, 25000, true), 11);
  assert.equal(unionWithin(trace, ["Layout"], 0, 40000, false), 5);
});

test("comparison ratios use local vanilla and published vanillajs", () => {
  const published = loadPublished();
  const vanilla = published.frameworks["vanillajs-keyed"]!.results["01_run1k"]!.total!.median;
  const solid = published.frameworks["solid-v1.9.3-keyed"]!.results["01_run1k"]!.total!.median;
  const s = (median: number) => ({ n: 1, median, mean: median, min: median, max: median });
  const results = {
    environment: { chrome: "test" },
    cpu: { "01_run1k": { rivet: { total: s(10), script: s(1), paint: s(1) }, vanilla: { total: s(10), script: s(1), paint: s(1) } } },
    memory: {},
    startup: {},
    size: {},
  } as unknown as SuiteResults;
  const row = compareToPublished(results).rows.find((r) => r.id === "01_run1k")!;
  assert.equal(row.rivetRatio, 1);
  assert.equal(row.published["solid-v1.9.3-keyed"]!.ratio, solid / vanilla);
  assert.equal(row.verdicts["solid-v1.9.3-keyed"], solid / vanilla >= 1 ? "WIN" : "LOSE");
});
