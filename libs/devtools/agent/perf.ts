// Performance indicators (Performance tab): layout shifts (CLS), long frames, interactions (INP-style
// breakdown), forced reflows, effects / computeds that run too often, and chunk loads per interaction,
// attributed to components. Pure bookkeeping: performance observers, the reflow patch and the model
// feed it (fake entries in tests); names and source locations are resolved when the panel asks (`info`).
import { appFrame, parseStack } from "./source.ts";
import type {
  CompRef,
  PerfChunk,
  PerfFinding,
  PerfHint,
  PerfInfo,
  PerfInteraction,
  PerfKind,
  PerfOptions,
  PerfRow,
  Rating,
  SourceLocation,
} from "../protocol.ts";

/** What the bookkeeping needs from the page (the model, in the agent). */
export interface PerfEnv {
  /** Innermost component (id) whose DOM range contains `node`. */
  componentAt(node: unknown): number | null;
  /** A live component reference (null once unmounted). */
  ref(id: number): (CompRef & { file?: string }) | null;
  /** App source frames of a stack, the first being the site (resolved through source maps). */
  locate(stack: Error): Promise<SourceLocation[]>;
  /** A reactive node: what to call it, and its creation stack. */
  describe(node: object): { label: string; stack?: Error };
}

export interface RectLike {
  x?: number;
  y?: number;
  width: number;
  height: number;
}
/** `layout-shift` entry (the fields used). */
export interface ShiftEntry {
  value: number;
  hadRecentInput: boolean;
  startTime: number;
  sources?: readonly { node?: unknown; previousRect?: RectLike; currentRect?: RectLike }[];
}
/** `long-animation-frame` (or `longtask`) entry. */
export interface FrameEntry {
  entryType: string;
  startTime: number;
  duration: number;
  blockingDuration?: number;
  scripts?: readonly { invoker?: string; invokerType?: string; sourceURL?: string; sourceFunctionName?: string; duration: number }[];
}
/** Event timing entry (`event`). */
export interface EventEntry {
  name: string;
  interactionId?: number;
  startTime: number;
  processingStart: number;
  processingEnd: number;
  duration: number;
  target?: unknown;
}
/** Resource timing entry (`resource`). */
export interface ResourceEntry {
  name: string;
  initiatorType: string;
  startTime: number;
  responseEnd: number;
  transferSize?: number;
  encodedBodySize?: number;
}

/** Thresholds (web-vitals ratings; 50 ms long frames). */
export const CLS_GOOD = 0.1,
  CLS_POOR = 0.25,
  INP_GOOD = 200,
  INP_POOR = 500,
  LONG_FRAME = 50;
/** Runs of one effect / computed per interaction that count as "too often". */
export const FREQUENT = 10;
/** Runs after an input belong to it for this long (or until the next input); chunk loads up to 3 s. */
export const RUN_WINDOW = 1000,
  CHUNK_WINDOW = 3000;
/** A component is hot when its runs took this long (and a quarter of all run time). */
export const HOT_MS = 50;
const MAX_FINDINGS = 300,
  MAX_RUNS = 5000,
  MAX_INPUTS = 50,
  MAX_INTERACTIONS = 100;

export const rateCls = (value: number): Rating => (value <= CLS_GOOD ? "good" : value <= CLS_POOR ? "needs-improvement" : "poor");
export const rateInp = (value: number): Rating => (value <= INP_GOOD ? "good" : value <= INP_POOR ? "needs-improvement" : "poor");
/** Flash color of a node updated `count` times in the last second (blue → green → amber → red). */
export const heatColor = (count: number): string => (count <= 1 ? "#3b82f6" : count <= 3 ? "#22c55e" : count <= 7 ? "#f59e0b" : "#ef4444");

const DOCS = {
  cls: "https://web.dev/articles/cls",
  reflow: "https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing",
  loaf: "https://developer.chrome.com/docs/web-platform/long-animation-frames",
  inp: "https://web.dev/articles/inp",
  runs: "https://web.dev/articles/optimize-long-tasks",
  chunks: "https://web.dev/articles/reduce-javascript-payloads-with-code-splitting",
};
export const HINTS: Record<PerfKind, PerfHint> = {
  "layout-shift": {
    why: "Content moved without user input: readers lose their place and click the wrong thing (CLS).",
    fix: "Reserve space for content that arrives later (width / height, aspect-ratio, min-height), or insert it below the viewport or in response to input.",
    docs: DOCS.cls,
  },
  "forced-reflow": {
    why: "A layout read right after a DOM write makes the browser lay out synchronously, inside the task.",
    fix: "Read layout before writing (batch reads, then writes), or move the read to requestAnimationFrame / a ResizeObserver.",
    docs: DOCS.reflow,
  },
  "long-frame": {
    why: "A frame over 50 ms delays input handling and paint.",
    fix: "Split the work (yield between chunks), do less in effects, or render less at once; start with the components listed.",
    docs: DOCS.loaf,
  },
  "slow-interaction": {
    why: "An interaction over 200 ms feels laggy (INP).",
    fix: "Input delay: a long task was running (see long frames). Processing: make handlers and the effects they trigger cheaper. Presentation: update less DOM, avoid big layouts.",
    docs: DOCS.inp,
  },
  "frequent-runs": {
    why: "One effect or computed re-ran many times for a single interaction: usually writes in a loop, or an effect that writes state it reads.",
    fix: "Group writes in batch(), derive with computed instead of syncing in an effect, or read less in it.",
    docs: DOCS.runs,
  },
  chunks: {
    why: "The interaction waited for code to load before it could respond.",
    fix: "Preload the chunks likely interactions need (on hover / idle), or merge small chunks.",
    docs: DOCS.chunks,
  },
};

interface Stat {
  runs: number;
  /** Inclusive run time (nested runs counted in each), and self time (nested runs subtracted). */
  ms: number;
  self: number;
  updates: number;
  cls: number;
  shifts: number;
  reflows: number;
  longMs: number;
  longFrames: number;
  maxRuns: number;
}
interface Raw {
  id: number;
  kind: PerfKind;
  ts: number;
  dur?: number;
  title: string;
  /** Detail text; component ids resolve to names. */
  detail: (name: (id: number) => string) => string;
  comps: number[];
  stack?: Error;
  count: number;
  score?: number;
}
interface Input {
  seq: number;
  type: string;
  ts: number;
  comp: number | null;
  runs: Map<object, number>;
  chunks: PerfChunk[];
  finding?: Raw;
}
interface RawInteraction {
  id: number;
  type: string;
  ts: number;
  target: number | null;
  inputDelay: number;
  processing: number;
  presentation: number;
  duration: number;
  handlers: Map<number, { ms: number; runs: number }>;
  input?: Input;
}
interface Run {
  ts: number;
  comp: number | null;
  /** Self time: sums over a window count nested runs once. */
  ms: number;
}

const area = (rect: RectLike | undefined) => (rect ? Math.max(0, rect.width) * Math.max(0, rect.height) : 0);
const round = (ms: number) => Math.round(ms);
const kb = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";
const SCRIPT = /\.(?:m?js|[jt]sx?)(?:[?#]|$)/;
const OWN = /\/__rivet\/devtools\/|\/devtools\/agent\/|@rivetjs\/devtools/;

export class Perf {
  readonly options: PerfOptions = { reflow: false, shifts: false, heat: false };
  resumed = false;
  /** Runs and DOM updates arrive only while recording (panel open). */
  recording = false;
  supports = { layoutShift: false, loaf: false, longtask: false, event: false };
  /** Called after each change (the agent coalesces it into `perf.changed`). */
  onChange: (() => void) | null = null;
  /** Shifted rects (in-page overlay, when `options.shifts`). */
  onShift: ((rects: RectLike[]) => void) | null = null;
  private env: PerfEnv;
  private stats = new Map<number, Stat>();
  private runs: Run[] = [];
  private findings: Raw[] = [];
  private keyed = new Map<string, Raw>();
  private inputs: Input[] = [];
  /** The page's first input (first-interaction latency, chunks it waited for). */
  private firstInput: Input | null = null;
  private interactions = new Map<number, RawInteraction>();
  private session: { start: number; last: number; value: number } | null = null;
  private clsMax = 0;
  private shiftCount = 0;
  private chunkCount = 0;
  private chunkBytes = 0;
  private seq = 0;
  private inputSeq = 0;
  private nodeKeys = new WeakMap<object, number>();
  private nodeSeq = 0;
  private located = new WeakMap<Error, Promise<SourceLocation[]>>();
  /** A resumed dev page's switch to client render: its own shifts and frames are not the page's. */
  private switched: { start: number; end: number } | null = null;

  constructor(env: PerfEnv) {
    this.env = env;
  }

  private stat(comp: number): Stat {
    let stat = this.stats.get(comp);
    if (!stat) this.stats.set(comp, (stat = { runs: 0, ms: 0, self: 0, updates: 0, cls: 0, shifts: 0, reflows: 0, longMs: 0, longFrames: 0, maxRuns: 0 }));
    return stat;
  }
  private add(raw: Omit<Raw, "id" | "count"> & { count?: number }, key?: string): Raw {
    const found = key ? this.keyed.get(key) : undefined;
    if (found) {
      Object.assign(found, raw, { id: found.id, count: raw.count ?? found.count + 1 });
      return found;
    }
    const entry: Raw = { ...raw, id: ++this.seq, count: raw.count ?? 1 };
    this.findings.push(entry);
    if (key) this.keyed.set(key, entry);
    if (this.findings.length > MAX_FINDINGS) {
      const dropped = this.findings.shift()!;
      for (const [k, v] of this.keyed) if (v === dropped) this.keyed.delete(k);
    }
    return entry;
  }
  private changed(): void {
    this.onChange?.();
  }
  /** Runs between two page times, summed per component. */
  private runsBetween(from: number, to: number): Map<number, { ms: number; runs: number }> {
    const out = new Map<number, { ms: number; runs: number }>();
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const run = this.runs[i]!;
      if (run.ts < from) break;
      if (run.ts > to || run.comp === null) continue;
      const at = out.get(run.comp) ?? { ms: 0, runs: 0 };
      at.ms += run.ms;
      at.runs++;
      out.set(run.comp, at);
    }
    return out;
  }
  /** The input whose window contains `ts` (latest input at or before it). */
  private inputAt(ts: number, window: number): Input | undefined {
    for (let i = this.inputs.length - 1; i >= 0; i--) {
      const input = this.inputs[i]!;
      if (input.ts <= ts) return ts - input.ts <= window ? input : undefined;
    }
    return undefined;
  }

  /** An effect / binding / computed run (`node.run`), owned by component `comp`; `self`: `ms` minus runs nested in it. */
  run(node: object, comp: number | null, ms: number, ts: number, self = ms): void {
    this.runs.push({ ts, comp, ms: self });
    if (this.runs.length > MAX_RUNS * 2) this.runs.splice(0, MAX_RUNS);
    if (comp !== null) {
      const stat = this.stat(comp);
      stat.runs++;
      stat.ms += ms;
      stat.self += self;
    }
    const input = this.inputAt(ts, RUN_WINDOW);
    if (input) {
      const count = (input.runs.get(node) ?? 0) + 1;
      input.runs.set(node, count);
      if (comp !== null) {
        const stat = this.stat(comp);
        stat.maxRuns = Math.max(stat.maxRuns, count);
      }
      if (count >= FREQUENT) {
        let key = this.nodeKeys.get(node);
        if (key === undefined) this.nodeKeys.set(node, (key = ++this.nodeSeq));
        const { label, stack } = this.env.describe(node);
        const type = input.type;
        this.add(
          {
            kind: "frequent-runs",
            ts: input.ts,
            title: label + " ran " + count + "× for one " + type,
            detail: (name) =>
              (comp !== null ? "In <" + name(comp) + ">. " : "") +
              "Runs counted for " +
              RUN_WINDOW / 1000 +
              " s after the " +
              type +
              " (or until the next input).",
            comps: comp !== null ? [comp] : [],
            ...(stack ? { stack } : {}),
            count,
          },
          "runs:" + key + ":" + input.seq,
        );
      }
    }
    this.changed();
  }
  /** A binding re-run that updated DOM (`dom.update`). */
  dom(comp: number | null): void {
    if (comp === null) return;
    this.stat(comp).updates++;
    this.changed();
  }
  /** A user input (capture listener): starts an interaction window. */
  input(type: string, target: unknown, ts: number): void {
    const input: Input = { seq: ++this.inputSeq, type, ts, comp: target ? this.env.componentAt(target) : null, runs: new Map(), chunks: [] };
    this.firstInput ??= input;
    this.inputs.push(input);
    if (this.inputs.length > MAX_INPUTS) this.inputs.shift();
  }

  /** A `layout-shift` entry: scored per component of the moved nodes (split by area). */
  shift(entry: ShiftEntry): void {
    if (entry.hadRecentInput || !(entry.value > 0) || this.during(entry.startTime, 0)) return;
    this.shiftCount++;
    const session = this.session;
    if (session && entry.startTime - session.last < 1000 && entry.startTime - session.start < 5000) {
      session.value += entry.value;
      session.last = entry.startTime;
    } else this.session = { start: entry.startTime, last: entry.startTime, value: entry.value };
    this.clsMax = Math.max(this.clsMax, this.session!.value);
    const weights = new Map<number, number>();
    const rects: RectLike[] = [];
    for (const source of entry.sources ?? []) {
      if (source.currentRect && area(source.currentRect) > 0) rects.push(source.currentRect);
      const comp = source.node ? this.env.componentAt(source.node) : null;
      if (comp === null) continue;
      weights.set(comp, (weights.get(comp) ?? 0) + (area(source.previousRect) + area(source.currentRect) || 1));
    }
    const total = [...weights.values()].reduce((a, b) => a + b, 0);
    const parts: [number, number][] = [...weights].map(([comp, w]) => [comp, (entry.value * w) / total]);
    for (const [comp, score] of parts) {
      const stat = this.stat(comp);
      stat.cls += score;
      stat.shifts++;
    }
    parts.sort((a, b) => b[1] - a[1]);
    this.add({
      kind: "layout-shift",
      ts: entry.startTime,
      title: "Layout shift " + entry.value.toFixed(3),
      detail: (name) =>
        parts.length
          ? "Moved: " +
            parts.map(([comp, score]) => "<" + name(comp) + "> " + score.toFixed(3)).join(", ") +
            ". Look for what was inserted or resized above them."
          : "The moved nodes belong to no component (outside the mount roots).",
      comps: parts.map(([comp]) => comp),
      score: entry.value,
    });
    if (this.options.shifts && rects.length) this.onShift?.(rects);
    this.changed();
  }

  /** A long animation frame (or long task): the components whose runs fell inside it. */
  frame(entry: FrameEntry): void {
    if (entry.duration < LONG_FRAME || this.during(entry.startTime, entry.duration)) return;
    const end = entry.startTime + entry.duration;
    const comps = [...this.runsBetween(entry.startTime, end)].sort((a, b) => b[1].ms - a[1].ms);
    for (const [comp, { ms }] of comps) {
      const stat = this.stat(comp);
      stat.longMs += ms;
      stat.longFrames++;
    }
    const scripts = [...(entry.scripts ?? [])].sort((a, b) => b.duration - a.duration).slice(0, 3);
    const loaf = entry.entryType === "long-animation-frame";
    this.add({
      kind: "long-frame",
      ts: entry.startTime,
      dur: entry.duration,
      title:
        (loaf ? "Long frame " : "Long task ") +
        round(entry.duration) +
        " ms" +
        (entry.blockingDuration ? " (" + round(entry.blockingDuration) + " ms blocking)" : ""),
      detail: (name) =>
        [
          comps.length
            ? "Component runs: " +
              comps
                .slice(0, 5)
                .map(([comp, s]) => "<" + name(comp) + "> " + s.ms.toFixed(1) + " ms / " + s.runs + " runs")
                .join(", ") +
              "."
            : "No component runs recorded in it.",
          scripts.length
            ? "Scripts: " +
              scripts
                .map(
                  (s) =>
                    (s.invoker || s.invokerType || "script") +
                    (s.sourceFunctionName ? " → " + s.sourceFunctionName : "") +
                    (s.sourceURL ? " (" + s.sourceURL.replace(/^.*\//, "").replace(/\?.*$/, "") + ")" : "") +
                    " " +
                    round(s.duration) +
                    " ms",
                )
                .join(", ") +
              "."
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      comps: comps.map(([comp]) => comp),
    });
    this.changed();
  }

  /** An event timing entry: one interaction (longest event per interaction id). */
  event(entry: EventEntry): void {
    const id = entry.interactionId ?? 0;
    if (!id) return;
    const known = this.interactions.get(id);
    if (known && known.duration >= entry.duration) return;
    const handlers = this.runsBetween(entry.processingStart, entry.processingEnd + 1);
    // The input that started it: pointerdown / keydown share its start; click / keyup follow shortly.
    const input = known?.input ?? this.inputAt(entry.startTime + 2, RUN_WINDOW);
    const record: RawInteraction = {
      id,
      // "click" / "keydown" (the input that started it) rather than the longest event's own name.
      type: input?.type ?? entry.name,
      ts: entry.startTime,
      target: entry.target ? this.env.componentAt(entry.target) : (input?.comp ?? null),
      inputDelay: Math.max(0, entry.processingStart - entry.startTime),
      processing: Math.max(0, entry.processingEnd - entry.processingStart),
      presentation: Math.max(0, entry.startTime + entry.duration - entry.processingEnd),
      duration: entry.duration,
      handlers,
      ...(input ? { input } : {}),
    };
    this.interactions.set(id, record);
    if (this.interactions.size > MAX_INTERACTIONS) this.interactions.delete(this.interactions.keys().next().value!);
    if (entry.duration >= INP_GOOD) {
      const phases: [string, number][] = [
        ["input delay", record.inputDelay],
        ["processing", record.processing],
        ["presentation", record.presentation],
      ];
      const worst = phases.reduce((a, b) => (b[1] > a[1] ? b : a));
      const comps = [...handlers].sort((a, b) => b[1].ms - a[1].ms).map(([comp]) => comp);
      if (record.target !== null && !comps.includes(record.target)) comps.unshift(record.target);
      this.add(
        {
          kind: "slow-interaction",
          ts: entry.startTime,
          dur: entry.duration,
          title: "Slow " + record.type + " " + round(entry.duration) + " ms",
          detail: (name) =>
            phases.map(([p, ms]) => p + " " + round(ms) + " ms").join(", ") +
            ". Mostly " +
            worst[0] +
            "." +
            (handlers.size
              ? " Runs while handling: " + [...handlers].map(([comp, s]) => "<" + name(comp) + "> " + s.ms.toFixed(1) + " ms").join(", ") + "."
              : ""),
          comps,
        },
        "int:" + id,
      );
    }
    this.changed();
  }

  /** A resource timing entry: script chunks loaded after an input belong to it. */
  resource(entry: ResourceEntry): void {
    if (!SCRIPT.test(entry.name) || OWN.test(entry.name) || !["script", "link", "other", "fetch"].includes(entry.initiatorType)) return;
    let input: Input | undefined;
    for (let i = this.inputs.length - 1; i >= 0; i--) {
      const at = this.inputs[i]!;
      if (at.ts <= entry.startTime) {
        if (entry.startTime - at.ts <= CHUNK_WINDOW) input = at;
        break;
      }
    }
    if (!input) return;
    const chunk: PerfChunk = {
      url: entry.name,
      bytes: entry.transferSize || entry.encodedBodySize || 0,
      ms: Math.max(0, entry.responseEnd - entry.startTime),
      ts: entry.startTime,
    };
    input.chunks.push(chunk);
    this.chunkCount++;
    this.chunkBytes += chunk.bytes;
    const chunks = input.chunks,
      type = input.type,
      comp = input.comp;
    const bytes = chunks.reduce((n, c) => n + c.bytes, 0);
    input.finding = this.add(
      {
        kind: "chunks",
        ts: input.ts,
        dur: Math.max(...chunks.map((c) => c.ts + c.ms)) - input.ts,
        title: chunks.length + (chunks.length === 1 ? " chunk" : " chunks") + " (" + kb(bytes) + ") loaded after a " + type,
        detail: () => chunks.map((c) => c.url.replace(/^https?:\/\/[^/]+/, "") + " " + kb(c.bytes) + " " + round(c.ms) + " ms").join(", "),
        comps: comp !== null ? [comp] : [],
        count: chunks.length,
      },
      "chunks:" + input.seq,
    );
    this.changed();
  }

  /** A layout read after a DOM write in the same task, inside a framework run or an event handler. */
  reflow(read: string, comp: number | null, stack: Error, ts: number, inside: "run" | "handler"): void {
    if (comp !== null) this.stat(comp).reflows++;
    const frame = appFrame(parseStack(stack.stack));
    const site = frame ? frame.url + ":" + frame.line + ":" + frame.col : "?";
    this.add(
      {
        kind: "forced-reflow",
        ts,
        title: "Forced reflow: " + read,
        detail: (name) =>
          read +
          " read right after a DOM write, " +
          (inside === "run" ? "inside an effect or binding" : "inside an event handler") +
          (comp !== null ? " of <" + name(comp) + ">" : "") +
          ".",
        comps: comp !== null ? [comp] : [],
        stack,
      },
      "reflow:" + comp + ":" + read + ":" + site,
    );
    this.changed();
  }

  /** A resumed dev page switched to client render between `start` and `end` (DevTools inspection or HMR). */
  clientRender(start: number, end: number): void {
    this.switched = { start, end };
    this.changed();
  }
  /** Whether [ts, ts + dur] overlaps the switch (plus 500 ms for its late shifts). */
  private during(ts: number, dur: number): boolean {
    const at = this.switched;
    return at !== null && ts <= at.end + 500 && ts + dur >= at.start;
  }

  reset(): void {
    this.stats.clear();
    this.runs = [];
    this.findings = [];
    this.keyed.clear();
    this.inputs = [];
    this.firstInput = null;
    this.interactions.clear();
    this.session = null;
    this.clsMax = 0;
    this.shiftCount = 0;
    this.chunkCount = 0;
    this.chunkBytes = 0;
    this.changed();
  }

  private locate(stack: Error): Promise<SourceLocation[]> {
    let found = this.located.get(stack);
    if (!found) this.located.set(stack, (found = this.env.locate(stack).catch(() => [])));
    return found;
  }

  /** Everything the Performance tab shows (names and locations resolved now). */
  async info(): Promise<PerfInfo> {
    const refs = new Map<number, (CompRef & { file?: string }) | null>();
    const ref = (id: number) => {
      if (!refs.has(id)) refs.set(id, this.env.ref(id));
      return refs.get(id)!;
    };
    const named = (id: number): CompRef => {
      const found = ref(id);
      return found ? { id: found.id, name: found.name } : { id, name: "unmounted" };
    };
    const name = (id: number) => named(id).name;
    const findings: PerfFinding[] = await Promise.all(
      this.findings.map(async (raw) => {
        const stack = raw.stack ? await this.locate(raw.stack) : [];
        return {
          id: raw.id,
          kind: raw.kind,
          ts: raw.ts,
          ...(raw.dur !== undefined ? { dur: raw.dur } : {}),
          title: raw.title,
          detail: raw.detail(name),
          comps: raw.comps.map(named),
          ...(stack[0] ? { location: stack[0], stack } : {}),
          count: raw.count,
          ...(raw.score !== undefined ? { score: raw.score } : {}),
          hint: HINTS[raw.kind],
        };
      }),
    );
    // Self times: nested runs (computeds pulled by effects) count once.
    const totalMs = [...this.stats.values()].reduce((n, s) => n + s.self, 0);
    const rows: PerfRow[] = [];
    for (const [id, stat] of this.stats) {
      const found = ref(id);
      if (!found) continue;
      const reasons: string[] = [];
      if (stat.cls > 0) reasons.push("layout shift " + stat.cls.toFixed(3));
      if (stat.reflows) reasons.push("forced reflow ×" + stat.reflows);
      if (stat.longMs >= 1) reasons.push(round(stat.longMs) + " ms in long frames");
      if (stat.maxRuns >= FREQUENT) reasons.push("an effect ran " + stat.maxRuns + "× for one interaction");
      const heavy = stat.self >= HOT_MS && stat.self >= totalMs / 4;
      if (heavy) reasons.push("hot: " + round(stat.self) + " ms in updates");
      rows.push({
        comp: { id: found.id, name: found.name },
        ...(found.file ? { file: found.file } : {}),
        runs: stat.runs,
        ms: stat.ms,
        self: stat.self,
        updates: stat.updates,
        cls: stat.cls,
        shifts: stat.shifts,
        reflows: stat.reflows,
        longMs: stat.longMs,
        longFrames: stat.longFrames,
        maxRuns: stat.maxRuns,
        hot: heavy || stat.maxRuns >= FREQUENT || stat.longMs >= LONG_FRAME,
        reasons,
      });
    }
    rows.sort((a, b) => b.self - a.self);
    const interactions: PerfInteraction[] = [...this.interactions.values()].map((raw) => ({
      id: raw.id,
      type: raw.type,
      ts: raw.ts,
      ...(raw.target !== null ? { target: named(raw.target) } : {}),
      inputDelay: raw.inputDelay,
      processing: raw.processing,
      presentation: raw.presentation,
      duration: raw.duration,
      handlers: [...raw.handlers].map(([comp, s]) => ({ comp: named(comp), ms: s.ms, runs: s.runs })),
      chunks: raw.input?.chunks.slice() ?? [],
    }));
    const worst = interactions.reduce<PerfInteraction | null>((a, b) => (!a || b.duration > a.duration ? b : a), null);
    // The first input, with its event timing when it took 16 ms or more (shorter ones are not reported).
    const firstInput = this.firstInput;
    const firstTimed = firstInput ? [...this.interactions.values()].find((raw) => raw.input === firstInput) : undefined;
    return {
      cls: { value: this.clsMax, rating: rateCls(this.clsMax), shifts: this.shiftCount },
      inp: worst ? { value: worst.duration, rating: rateInp(worst.duration), type: worst.type } : null,
      rows,
      findings,
      interactions,
      resume: {
        resumed: this.resumed,
        ...(firstInput
          ? {
              first: {
                type: firstInput.type,
                duration: firstTimed?.duration ?? 0,
                chunks: firstInput.chunks.length,
                bytes: firstInput.chunks.reduce((n, c) => n + c.bytes, 0),
              },
            }
          : {}),
        chunks: this.chunkCount,
        bytes: this.chunkBytes,
        ...(this.switched ? { switchedAt: this.switched.start } : {}),
      },
      options: { ...this.options },
      supports: { ...this.supports },
      recording: this.recording,
    };
  }
}
