// Trace analysis ported from js-framework-benchmark webdriver-ts/src/timeline.ts (computeResultsCPU,
// computeResultsJS, computeResultsPaint) so local durations follow the published methodology.
export interface TraceEvent {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  cat?: string;
  args?: { data?: { type?: string; [key: string]: unknown }; name?: string; [key: string]: unknown };
}
interface Timed {
  type: string;
  ts: number;
  dur: number;
  end: number;
  pid: number;
}
const X: Record<string, string> = {
  Layout: "layout",
  FunctionCall: "functioncall",
  HitTest: "hittest",
  Commit: "commit",
  Paint: "paint",
  FireAnimationFrame: "fireAnimationFrame",
};

function relevant(entries: TraceEvent[], start: string): Timed[] {
  const out: Timed[] = [];
  const push = (type: string, e: TraceEvent, dur = +(e.dur ?? 0)) => out.push({ type, ts: +e.ts, dur, end: +e.ts + dur, pid: e.pid });
  for (const e of entries) {
    if (e.name === "EventDispatch") {
      const type = e.args?.data?.type;
      if (type === start) push("startLogicEvent", e);
      if (type === "click" || type === "mousedown" || type === "pointerup") push(type, e);
    } else if (e.ph === "X" && X[e.name]) push(X[e.name]!, e);
    else if (e.name === "TimerFire" && e.ph === "X") push("timerFire", e, 0);
    else if (e.name === "RequestAnimationFrame") push("requestAnimationFrame", e, 0);
  }
  return out;
}

export interface CPUDuration {
  tsStart: number;
  tsEnd: number;
  duration: number;
  layouts: number;
  numberCommits: number;
  raf_long_delay: number;
}

/** Click EventDispatch start to the end of the first Commit after the last related main-thread work. */
export function computeCPU(entries: TraceEvent[], start = "click"): CPUDuration {
  const events = relevant(entries, start).sort((a, b) => a.end - b.end);
  if (events.filter((e) => e.type === "mousedown").length > 1) throw Error("at most one mousedown event is expected");
  const clicks = events.filter((e) => e.type === "startLogicEvent");
  if (clicks.length !== 1) throw Error(`exactly one ${start} event is expected, got ${clicks.length}`);
  const click = clicks[0]!;
  const during = events.filter((e) => e.ts > click.end || e.type === "click");
  const main = during.filter((e) => e.pid === click.pid);
  const startFrom = main.filter((e) => [start, "fireAnimationFrame", "timerFire", "layout", "functioncall"].includes(e.type)).at(-1);
  if (!startFrom) throw Error("no events after click");
  const commits = main.filter((e) => e.type === "commit");
  if (!commits.length) throw Error("No commit event found");
  const commit = commits.find((e) => e.ts > startFrom.end) ?? commits.at(-1)!;
  let duration = (commit.end - click.ts) / 1000;
  const layouts = main.filter((e) => e.type === "layout");
  const rafs = events.filter((e) => e.type === "requestAnimationFrame" && e.ts >= click.ts && e.ts <= click.end);
  const fafs = events.filter((e) => e.type === "fireAnimationFrame" && e.ts >= click.ts && e.ts < commit.ts);
  let raf_long_delay = 0;
  if (rafs.length === 1 && fafs.length === 1) {
    const wait = (fafs[0]!.ts - click.end) / 1000;
    if (wait > 16 && !layouts.some((e) => e.ts < fafs[0]!.ts)) {
      raf_long_delay = wait - 16;
      duration -= raf_long_delay;
    }
  }
  return { tsStart: click.ts, tsEnd: commit.end, duration, layouts: layouts.length, numberCommits: commits.length, raf_long_delay };
}

export const JS_EVENTS = ["EventDispatch", "EvaluateScript", "v8.evaluateModule", "FunctionCall", "TimerFire", "FireIdleCallback", "FireAnimationFrame", "RunMicrotasks", "V8.Execute"];
export const PAINT_EVENTS = ["UpdateLayoutTree", "Layout", "Commit", "Paint", "Layerize", "PrePaint"];

/** Union of the named complete events inside [tsStart, tsEnd], in ms (krausest computeResultsFromTrace). */
export function unionWithin(entries: TraceEvent[], names: string[], tsStart: number, tsEnd: number, includeClick: boolean, pid?: number): number {
  let intervals: { start: number; end: number }[] = [];
  for (const e of entries) {
    if (pid !== undefined && e.pid !== pid) continue;
    const isClick = e.name === "EventDispatch" && e.args?.data?.type === "click";
    const ok = e.name === "EventDispatch" ? includeClick && isClick : names.includes(e.name) && e.ph === "X";
    if (!ok || e.ts < tsStart || e.ts > tsEnd) continue;
    const outer = { start: e.ts - tsStart, end: e.ts + (e.dur ?? 0) - tsStart };
    const next = intervals.some((iv) => outer.start >= iv.start && outer.end <= iv.end) ? [] : [outer];
    for (const iv of intervals) if (iv.start < outer.start || iv.end > outer.end) next.push(iv);
    intervals = next;
  }
  return intervals.reduce((sum, iv) => sum + iv.end - iv.start, 0) / 1000;
}
