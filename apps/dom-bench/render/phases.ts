// Main-thread phase breakdown of a Chrome performance trace: self time per event, bucketed into
// script (incl. DOM API C++ work inside JS calls), style (Recalc Style = UpdateLayoutTree), layout,
// prepaint, paint, composite (Layerize / Commit / UpdateLayer), gc, hittest, other.
// Used by render/krausest.ts and render/page.ts (rendering-cost lane RENDERCOST 2026-10-26).
import type { TraceEvent } from "../krausest/timeline.ts";

export const BUCKETS = ["script", "style", "layout", "prepaint", "paint", "composite", "gc", "hittest", "other"] as const;
export type Bucket = (typeof BUCKETS)[number];
export type Phases = Record<Bucket, number> & { total: number; styleElements: number; layoutObjects: number; byName?: Record<string, number> };

const bucketOf = (name: string): Bucket => {
  switch (name) {
    case "UpdateLayoutTree":
    case "RecalculateStyles":
    case "ParseAuthorStyleSheet":
    case "StyleInvalidatorInvalidate":
    case "ScheduleStyleInvalidationTracking":
      return "style";
    case "Layout":
    case "UpdateLayerTree":
    case "IntersectionObserverController::computeIntersections":
      return "layout";
    case "PrePaint":
      return "prepaint";
    case "Paint":
    case "PaintImage":
    case "PaintSetup":
    case "RasterTask":
      return "paint";
    case "Layerize":
    case "Commit":
    case "UpdateLayer":
    case "CompositeLayers":
      return "composite";
    case "HitTest":
      return "hittest";
    case "MinorGC":
    case "MajorGC":
    case "V8.GC_SCAVENGER":
    case "V8.GC_MARK_COMPACTOR":
    case "BlinkGC.AtomicPhase":
    case "ThreadState::performIdleLazySweep":
      return "gc";
    case "EventDispatch":
    case "FunctionCall":
    case "TimerFire":
    case "FireAnimationFrame":
    case "FireIdleCallback":
    case "RunMicrotasks":
    case "V8.Execute":
    case "EvaluateScript":
    case "v8.evaluateModule":
    case "v8.compile":
    case "v8.compileModule":
    case "v8.run":
    case "ParseHTML":
    case "XHRReadyStateChange":
      return "script";
    default:
      return name.startsWith("V8.GC") || name.startsWith("BlinkGC") ? "gc" : name.startsWith("v8.") || name.startsWith("V8.") ? "script" : "other";
  }
};

/** Renderer main thread (CrRendererMain) of the page whose EventDispatch / ParseHTML events we see. */
export function mainThread(trace: TraceEvent[], pid: number): number {
  const meta = trace.find((e) => e.ph === "M" && e.name === "thread_name" && e.pid === pid && e.args?.name === "CrRendererMain");
  if (meta) return meta.tid;
  const e = trace.find((x) => x.pid === pid && x.name === "EventDispatch");
  if (!e) throw Error("renderer main thread not found");
  return e.tid;
}

/** Self time (ms) per bucket of complete events on one thread, clipped to [start, end] (µs). */
export function phases(trace: TraceEvent[], pid: number, tid: number, start: number, end: number, byName?: Record<string, number>): Phases {
  const out = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as unknown as Phases;
  out.styleElements = 0;
  out.layoutObjects = 0;
  const events = trace
    .filter((e) => e.pid === pid && e.tid === tid && e.ph === "X" && (e.dur ?? 0) > 0 && e.ts + e.dur! > start && e.ts < end)
    .map((e) => ({ e, s: Math.max(start, e.ts), t: Math.min(end, e.ts + e.dur!) }))
    .sort((a, b) => a.s - b.s || b.t - a.t);
  // Stack walk: self = own clipped duration minus children. Top-level task wrappers (RunTask etc.) only count
  // their uncovered remainder, in "other".
  const stack: { t: number; name: string; child: number; s: number }[] = [];
  const close = (x: { t: number; name: string; child: number; s: number }) => {
    const self = x.t - x.s - x.child;
    out[bucketOf(x.name)] += Math.max(0, self) / 1000;
    if (byName) byName[x.name] = (byName[x.name] ?? 0) + Math.max(0, self) / 1000;
    const parent = stack.at(-1);
    if (parent) parent.child += x.t - x.s;
  };
  for (const { e, s, t } of events) {
    while (stack.length && stack.at(-1)!.t <= s) close(stack.pop()!);
    const top = stack.at(-1);
    const tt = top ? Math.min(t, top.t) : t;
    stack.push({ t: tt, name: e.name, child: 0, s });
    if (e.name === "UpdateLayoutTree") out.styleElements += Number((e.args as { elementCount?: number } | undefined)?.elementCount ?? 0);
    if (e.name === "Layout") out.layoutObjects += Number((e.args as { beginData?: { dirtyObjects?: number } } | undefined)?.beginData?.dirtyObjects ?? 0);
  }
  while (stack.length) close(stack.pop()!);
  out.total = BUCKETS.reduce((sum, b) => sum + out[b], 0);
  return out;
}

export const rendering = (p: Phases) => p.style + p.layout + p.prepaint + p.paint + p.composite;
