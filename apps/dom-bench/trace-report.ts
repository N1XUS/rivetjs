// Analyse and diff trace.ts recordings.
// Usage: node apps/dom-bench/trace-report.ts <dir> [<dir> ...] [--top 25] [--heap] [--md <file>]
// Per recording: main-thread split (scripting / style / layout / paint+commit / GC / other), GC counts,
// top self-time functions (CPU profile; symbolized through <bundle>.map when present), DOM nodes and JS
// listeners created (Memory.getDOMCounters before/after, GC'd), heap delta, and with --heap the top
// heap-snapshot constructors by self size. With several dirs it prints them side by side (ratio to the first).
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { SourceMap } from "node:module";
import { basename, resolve } from "node:path";
import type { TraceEvent } from "./krausest/timeline.ts";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const top = Number(option("top") ?? 25);
const md = option("md");
const heapIndex = args.indexOf("--heap");
const withHeap = heapIndex >= 0;
if (withHeap) args.splice(heapIndex, 1);
const dirs = args.map((d) => resolve(d));
if (!dirs.length) throw Error("Usage: trace-report.ts <dir> [<dir> ...] [--top N] [--heap] [--md out.md]");

interface CPUProfile {
  nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number; columnNumber: number }; children?: number[] }[];
  samples: number[];
  timeDeltas: number[];
  startTime: number;
  endTime: number;
}
interface Meta {
  suite: string;
  lane: string;
  op: string;
  rows?: number;
  chrome: string;
  bundle: { path: string; bytes: number };
  delta: { nodes: number; jsEventListeners: number; heapUsedBytes: number };
  counters: { before: { nodes: number; jsEventListeners: number }; afterNoGc: { nodes: number; jsEventListeners: number; heapUsedBytes: number } };
}
const SPLIT: Record<string, string[]> = {
  scripting: ["EventDispatch", "EvaluateScript", "v8.evaluateModule", "FunctionCall", "TimerFire", "FireIdleCallback", "FireAnimationFrame", "RunMicrotasks", "V8.Execute", "v8.compile", "v8.compileModule"],
  style: ["UpdateLayoutTree", "RecalculateStyles", "ParseAuthorStyleSheet"],
  layout: ["Layout", "UpdateLayerTree", "HitTest"],
  paint: ["PrePaint", "Paint", "Layerize", "Commit", "PaintImage", "CompositeLayers", "RasterTask"],
  gc: ["MinorGC", "MajorGC", "V8.GC_SCAVENGER", "V8.GC_MARK_COMPACTOR", "V8.GC_MC_BACKGROUND_MARKING", "BlinkGC.AtomicPhase", "CppGC.AtomicMark"],
};

/** Exclusive (self) time per category on one thread: each instant goes to the innermost categorized event. */
function split(events: TraceEvent[]) {
  const spans = events.filter((e) => e.ph === "X" && e.dur != null).sort((a, b) => a.ts - b.ts || b.dur! - a.dur!);
  const category = (name: string) => Object.keys(SPLIT).find((k) => SPLIT[k]!.includes(name)) ?? (name === "RunTask" || name === "ThreadControllerImpl::RunTask" ? "task" : null);
  const totals: Record<string, number> = { scripting: 0, style: 0, layout: 0, paint: 0, gc: 0, other: 0 };
  // Sweep boundaries; each segment goes to the innermost categorized open span.
  const points = new Set<number>();
  const typed = spans.map((e) => ({ start: e.ts, end: e.ts + e.dur!, cat: category(e.name) })).filter((s) => s.cat);
  for (const s of typed) points.add(s.start), points.add(s.end);
  const sorted = [...points].sort((a, b) => a - b);
  let open: typeof typed = [];
  let next = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!, b = sorted[i + 1]!;
    open = open.filter((s) => s.end > a);
    while (next < typed.length && typed[next]!.start <= a) open.push(typed[next++]!);
    const live = open.filter((s) => s.start <= a && s.end >= b);
    if (!live.length) continue;
    // Innermost = latest start (ties: shortest).
    const inner = live.reduce((x, y) => (y.start > x.start || (y.start === x.start && y.end < x.end) ? y : x));
    const cat = inner.cat === "task" ? "other" : inner.cat!;
    totals[cat]! += (b - a) / 1000;
  }
  const count = (names: string[]) => events.filter((e) => e.ph === "X" && names.includes(e.name)).length;
  return { totals, total: Object.values(totals).reduce((a, b) => a + b, 0), minorGC: count(["MinorGC"]), majorGC: count(["MajorGC"]) };
}

function mainThread(trace: TraceEvent[]): TraceEvent[] {
  const mains = trace.filter((e) => e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain").map((e) => `${e.pid}:${e.tid}`);
  let best: TraceEvent[] = [], bestTime = -1;
  for (const key of new Set(mains)) {
    const events = trace.filter((e) => `${e.pid}:${e.tid}` === key);
    const time = events.reduce((sum, e) => sum + (e.name === "RunTask" && e.dur ? e.dur : 0), 0);
    if (time > bestTime) (best = events), (bestTime = time);
  }
  return best;
}

function symbolizer(bundlePath: string) {
  const mapPath = bundlePath + ".map";
  if (!existsSync(mapPath)) return null;
  const map = new SourceMap(JSON.parse(readFileSync(mapPath, "utf8")));
  return (line: number, column: number) => {
    const origin = map.findOrigin(line + 1, column + 1) as { name?: string; fileName?: string; lineNumber?: number } | Record<string, never>;
    if (!("fileName" in origin) || !origin.fileName) return null;
    const file = origin.fileName.replace(/^.*?(libs|apps|node_modules)\//, "$1/");
    return `${origin.name ?? ""}${origin.name ? " " : ""}${file}:${origin.lineNumber}`;
  };
}

function selfTimes(profile: CPUProfile, meta: Meta) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map<number, number>();
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const symbolize = symbolizer(meta.bundle.path);
  const bundleName = basename(meta.bundle.path);
  const agg = new Map<string, number>();
  let total = 0;
  for (const [id, us] of self) {
    const { callFrame: f } = byId.get(id)!;
    if (f.functionName === "(idle)" || f.functionName === "(root)") continue;
    total += us;
    let key = f.functionName || "(anonymous)";
    if (f.url) {
      const original = f.url.endsWith(bundleName) || f.url.includes(`/${meta.lane}`) ? symbolize?.(f.lineNumber, f.columnNumber) : null;
      key = original ? `${f.functionName || "(anon)"} → ${original}` : `${key} ${f.url.replace(/^https?:\/\/[^/]+\//, "")}:${f.lineNumber + 1}:${f.columnNumber + 1}`;
    }
    agg.set(key, (agg.get(key) ?? 0) + us);
  }
  return { total: total / 1000, list: [...agg].sort((a, b) => b[1] - a[1]).map(([name, us]) => ({ name, ms: us / 1000 })) };
}

function heapTop(file: string) {
  if (!existsSync(file)) return null;
  if (statSync(file).size > 450 * 1024 * 1024) return { skipped: "snapshot > 450 MB" };
  const snap = JSON.parse(readFileSync(file, "utf8")) as { snapshot: { meta: { node_fields: string[]; node_types: [string[]] } }; nodes: number[]; strings: string[] };
  const fields = snap.snapshot.meta.node_fields, width = fields.length;
  const typeAt = fields.indexOf("type"), nameAt = fields.indexOf("name"), sizeAt = fields.indexOf("self_size");
  const types = snap.snapshot.meta.node_types[0];
  const agg = new Map<string, { count: number; bytes: number }>();
  for (let i = 0; i < snap.nodes.length; i += width) {
    const type = types[snap.nodes[i + typeAt]!]!;
    const name = type === "object" || type === "native" || type === "closure" ? `${type}:${snap.strings[snap.nodes[i + nameAt]!]}` : `(${type})`;
    const entry = agg.get(name) ?? { count: 0, bytes: 0 };
    entry.count++;
    entry.bytes += snap.nodes[i + sizeAt]!;
    agg.set(name, entry);
  }
  return [...agg].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 15).map(([name, v]) => ({ name, count: v.count, MiB: v.bytes / 1048576 }));
}

const reports = dirs.map((dir) => {
  const meta = JSON.parse(readFileSync(resolve(dir, "meta.json"), "utf8")) as Meta;
  const raw = JSON.parse(gunzipSync(readFileSync(resolve(dir, "trace.json.gz"))).toString("utf8")) as { traceEvents?: TraceEvent[] } | TraceEvent[];
  const trace = Array.isArray(raw) ? raw : raw.traceEvents ?? [];
  const profile = JSON.parse(readFileSync(resolve(dir, "profile.cpuprofile"), "utf8")) as CPUProfile;
  return {
    dir,
    meta,
    split: split(mainThread(trace)),
    cpu: selfTimes(profile, meta),
    created: {
      nodes: meta.counters.afterNoGc.nodes - meta.counters.before.nodes,
      listeners: meta.counters.afterNoGc.jsEventListeners - meta.counters.before.jsEventListeners,
    },
    heap: withHeap ? heapTop(resolve(dir, "heap.heapsnapshot")) : null,
  };
});

const f = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "–");
const ratio = (n: number, base: number) => (reports.length > 1 && base ? ` (${f(n / base, 2)}x)` : "");
const lines: string[] = [];
const title = (r: (typeof reports)[number]) => `${r.meta.lane} ${r.meta.op}${r.meta.rows ? ` ${r.meta.rows}` : ""}`;
lines.push(`# Trace report`, "", `Chrome ${reports[0]!.meta.chrome}. Times include profiler+tracing overhead; compare recordings made the same way.`, "");
lines.push(`| metric | ${reports.map(title).join(" | ")} |`, `|---|${reports.map(() => "---").join("|")}|`);
const metric = (name: string, value: (r: (typeof reports)[number]) => number, d = 1) =>
  lines.push(`| ${name} | ${reports.map((r) => f(value(r), d) + ratio(value(r), value(reports[0]!))).join(" | ")} |`);
metric("main thread busy ms", (r) => r.split.total);
for (const k of ["scripting", "style", "layout", "paint", "gc", "other"])
  metric(k === "other" ? "  other task time ms (CDP-evaluated JS lands here)" : `  ${k} ms`, (r) => r.split.totals[k]!);
const NOT_JS = /^\((program|garbage collector|idle|root)\)|^(getBoundingClientRect|serialize)$/;
metric("JS self ms (profile, excl. program/GC/forced layout)", (r) => r.cpu.list.filter((x) => !NOT_JS.test(x.name)).reduce((a, x) => a + x.ms, 0));
metric("minor GCs", (r) => r.split.minorGC, 0);
metric("major GCs", (r) => r.split.majorGC, 0);
metric("profile self ms (non-idle)", (r) => r.cpu.total);
metric("(garbage collector) self ms", (r) => r.cpu.list.find((x) => x.name.startsWith("(garbage collector)"))?.ms ?? 0);
metric("DOM nodes created", (r) => r.created.nodes, 0);
metric("DOM nodes retained after GC", (r) => r.meta.delta.nodes, 0);
metric("JS listeners created", (r) => r.created.listeners, 0);
metric("JS listeners retained after GC", (r) => r.meta.delta.jsEventListeners, 0);
metric("heap delta after GC MiB", (r) => r.meta.delta.heapUsedBytes / 1048576);
metric("bundle bytes", (r) => r.meta.bundle.bytes, 0);
for (const r of reports) {
  lines.push("", `## Top self time: ${title(r)}`, "", "| ms | % | function |", "|---|---|---|");
  for (const x of r.cpu.list.slice(0, top)) lines.push(`| ${f(x.ms, 2)} | ${f((100 * x.ms) / r.cpu.total)} | ${x.name.replace(/\|/g, "\\|")} |`);
  if (r.heap && Array.isArray(r.heap)) {
    lines.push("", `### Heap snapshot (after op), top constructors by self size`, "", "| MiB | count | name |", "|---|---|---|");
    for (const h of r.heap) lines.push(`| ${f(h.MiB, 2)} | ${h.count} | ${h.name} |`);
  } else if (r.heap) lines.push("", `Heap: ${JSON.stringify(r.heap)}`);
}
const text = lines.join("\n") + "\n";
if (md) writeFileSync(md, text);
console.log(text);
