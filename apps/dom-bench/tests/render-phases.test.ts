import { describe, expect, it } from "vitest";
import type { TraceEvent } from "../krausest/timeline.ts";
import { mainThread, phases, rendering } from "../render/phases.ts";

const x = (name: string, ts: number, dur: number, args?: TraceEvent["args"]): TraceEvent => ({ name, ph: "X", ts, dur, pid: 1, tid: 2, args });

describe("render phases", () => {
  it("buckets self time and subtracts nested children", () => {
    const trace: TraceEvent[] = [
      { name: "thread_name", ph: "M", ts: 0, pid: 1, tid: 2, args: { name: "CrRendererMain" } },
      x("RunTask", 0, 10_000),
      x("EventDispatch", 100, 3_000),
      x("FunctionCall", 200, 2_500),
      x("UpdateLayoutTree", 1_000, 500, { elementCount: 12 }),
      x("UpdateLayoutTree", 4_000, 1_000, { elementCount: 3 }),
      x("Layout", 5_000, 2_000, { beginData: { dirtyObjects: 7 } }),
      x("PrePaint", 7_000, 400),
      x("Paint", 7_400, 600),
      x("Commit", 8_000, 300),
      { ...x("Paint", 0, 5_000), tid: 9 },
    ];
    expect(mainThread(trace, 1)).toBe(2);
    const p = phases(trace, 1, 2, 0, 10_000);
    expect(p.script).toBeCloseTo(2.5, 5); // EventDispatch self 0.5 + FunctionCall self 2.0 (its nested style 0.5 is style)
    expect(p.style).toBeCloseTo(1.5, 5);
    expect(p.layout).toBeCloseTo(2, 5);
    expect(p.prepaint).toBeCloseTo(0.4, 5);
    expect(p.paint).toBeCloseTo(0.6, 5);
    expect(p.composite).toBeCloseTo(0.3, 5);
    expect(p.other).toBeCloseTo(10 - 3 - 1 - 2 - 0.4 - 0.6 - 0.3, 5); // RunTask remainder
    expect(p.total).toBeCloseTo(10, 5);
    expect(p.styleElements).toBe(15);
    expect(p.layoutObjects).toBe(7);
    expect(rendering(p)).toBeCloseTo(4.8, 5);
  });

  it("clips events to the window", () => {
    const trace = [x("Layout", 0, 4_000), x("Paint", 3_000, 2_000)];
    const p = phases(trace, 1, 2, 2_000, 4_000);
    expect(p.layout).toBeCloseTo(1, 5);
    expect(p.paint).toBeCloseTo(1, 5);
  });
});
