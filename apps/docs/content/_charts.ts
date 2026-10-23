// Benchmark charts of the docs site (`::chart{id=…}` in content) and the homepage numbers (`homeStrip`, `homeFacts`,
// `editorialLoss`, rendered by src/routes/index.tsx).
// Every number comes from a committed report — never type a value that is not in one. Every value is read at build time:
// - SSR: docs/benchmarks/2026-10-23-ssr-comparison.json; resume: 2026-10-19-fair-comparison.json (not re-measured).
//   apps/dom-bench/competitors.json stores the matching SSR and resume competitor numbers.
// - Krausest: docs/benchmarks/2026-10-23-krausest.json, local Rivet/vanilla only (Chrome 155 vs published Chrome 154).
// - DOM (browser mount / update): docs/benchmarks/2026-10-21-dom-mount-2.json `runTs.baseline` — every lane re-measured
//   interleaved in the same runs under the run.ts mount protocol rewarm-2026-10-21; apps/dom-bench/competitors.json
//   `dom` stores the same competitor numbers (`fair-report.ts --dom … --store-competitors`).
// - Homepage loss row: docs/benchmarks/2026-10-11-editorial.json.
// tests/charts.test.ts re-checks every value against those files and the verdicts (≥ 3% and non-overlapping trial
// ranges, apps/dom-bench/verdict.ts) behind every win / tie / loss the page and the homepage state.
// Lanes are like-for-like within a group; where Rivet loses or ties, the chart shows it.
import { advantage, formatValue, type BenchChartSpec, type ChartPoint } from "@rivetjs/docs-kit/components/chart-model.ts";
import fair from "../../../docs/benchmarks/2026-10-23-ssr-comparison.json" with { type: "json" };
import resumeRun from "../../../docs/benchmarks/2026-10-19-fair-comparison.json" with { type: "json" };
import krausest from "../../../docs/benchmarks/2026-10-23-krausest.json" with { type: "json" };
import domRun from "../../../docs/benchmarks/2026-10-21-dom-mount-2.json" with { type: "json" };
import editorial from "../../../docs/benchmarks/2026-10-11-editorial.json" with { type: "json" };

const REPO = "https://github.com/N1XUS/rivetjs/blob/main/";
const FAIR = { label: "SSR comparison 2026-10-23 (full report)", href: REPO + "docs/benchmarks/2026-10-23-ssr-comparison.md" };
const RESUME = { label: "Resume comparison 2026-10-20 (full report)", href: REPO + "docs/benchmarks/2026-10-19-fair-comparison.md" };
const KRAUSEST = { label: "Krausest local run 2026-10-23 (full report)", href: REPO + "docs/benchmarks/2026-10-23-krausest.md" };
const DOM = { label: "DOM mount report 2026-10-21 (full report)", href: REPO + "docs/benchmarks/2026-10-21-dom-mount-2.md" };

interface Stat {
  median: number;
  min: number;
  max: number;
}
const point = (label: string, stat: Stat, extra: Partial<ChartPoint> = {}): ChartPoint => ({
  label,
  value: stat.median,
  min: stat.min,
  max: stat.max,
  ...extra,
});

// fair.ssr.tuned[rows][concurrency][lane].<metric> — "SSR — profile `tuned`" tables.
const ssr100c10 = fair.ssr.tuned["100"]["10"];
const ssr100 = fair.ssr.tuned["100"]["1"];
const ssr1000 = fair.ssr.tuned["1000"]["1"];
const ssr5000 = fair.ssr.tuned["5000"]["1"];
// fair.ssr["tuned+grid"]["1000"]["1"][lane].cpu_ms — "SSR — profile `tuned+grid`" › "CPU per page" (concurrency 1 only in this run).
const grid1000 = fair.ssr["tuned+grid"]["1000"]["1"];
// resumeRun.resume["slow/<scenario>/<lane>"].<metric> — "Resume (apps/resume-bench, Slow 4G + 4x CPU)".
const resume = resumeRun.resume as unknown as Record<string, Record<string, Stat>>;
const paint = (scenario: string, lane: string): Stat => resume[`slow/${scenario}/${lane}`]!.paintLatency!;
const firstChange = (scenario: string, lane: string): Stat => resume[`slow/${scenario}/${lane}`]!.latency!;
// domRun.runTs.baseline[rows][lane].<metric> — 2026-10-21-dom-mount-2.md "Re-stored competitors".
const dom = domRun.runTs.baseline;

const SSR_CAPTION = {
  // 2026-10-23-ssr-comparison.md "Methodology" + "Rerun methodology".
  machine: "Apple M4 Pro (14 cores), Docker Desktop; every lane 1 CPU / 512 MiB",
  date: "2026-10-23",
  method:
    "ssr-bench, tuned GC, 3 interleaved repeats (10 s after 3 s warmup); median, whiskers = min–max. Six row/concurrency batches, each prewarmed for 10 s at its own row count. Ordinary desktop apps remained active; batch-end 1-minute load 4–8. Smaller-page peak memory is not directly comparable with the earlier largest-page prewarm protocol.",
  source: FAIR,
};
const RESUME_CAPTION = {
  // Notes "How this run was made" › Resume; report "Resume" header (Chrome version).
  machine: "Apple M4 Pro, Chrome 155",
  date: "2026-10-20",
  method:
    "resume-bench, Slow 4G + 4× CPU throttling, 10 repeats; median, whiskers = min–max. Two test suites ran on the host at the same time (1-minute load 25–40).",
  source: RESUME,
};
const DOM_CAPTION = {
  // 2026-10-21-dom-mount-2.md header + "Re-stored competitors".
  machine: "Apple M4 Pro, Playwright Chromium 153, cross-origin isolated",
  date: "2026-10-21",
  method:
    "dom-bench run.ts, every lane interleaved, 3 runs × 3 trials × 5 samples; median of trial medians, whiskers = min–max. Other test suites shared the host (1-minute load 2–8).",
  source: DOM,
};
const KRAUSEST_CAPTION = {
  machine: "Apple M4 Pro, headless Chrome " + krausest.environment.chrome,
  date: "2026-10-23",
  method:
    `Local Rivet/vanilla trials, fresh context per sample, interleaved lanes; median, whiskers = min–max. Local Chrome ${krausest.environment.chrome}, published reference ${krausest.comparison.reference.chrome}: framework comparisons are not comparable across browser majors.`,
  source: KRAUSEST,
};
const C1 = "Concurrency 1. ";

// Labels: apps/dom-bench/competitors.json labels (solid-stable, solid, react, dotnet).
const DOM_LANES = [
  ["solid-stable", "Solid 1.9.15"],
  ["solid", "Solid 2.0.0-rc.13"],
  ["react", "React 19.3"],
] as const;
// Labels: resume-bench lane versions (solid-stable = Solid 1.9.15, solid = 2.0.0-rc.13, qwik-stable = 1.20.1, qwik = 2.0.0-rc.0).
const RESUME_LANES = [
  ["rivet", "Rivet"],
  ["solid-stable", "Solid 1"],
  ["solid", "Solid 2"],
  ["qwik-stable", "Qwik 1"],
  ["qwik", "Qwik 2"],
] as const;
const resumeChart = (id: string, title: string, scenarios: readonly (readonly [string, string])[], stat: (scenario: string, lane: string) => Stat): BenchChartSpec => ({
  id,
  kind: "range",
  title,
  unit: "ms",
  better: "lower",
  digits: 1,
  groups: scenarios.map(([label, scenario]) => ({
    label,
    points: RESUME_LANES.map(([lane, name]) => point(name, stat(scenario, lane), lane === "rivet" ? { rivet: true } : {})),
  })),
  caption: RESUME_CAPTION,
});

export const charts: Record<string, BenchChartSpec> = {
  "ssr-static-headline": {
    id: "ssr-static-headline",
    kind: "stat",
    title: "Static SSR, 1,000 rows: CPU per page",
    lead: "less CPU per page than Razor",
    claim: "Static page, 1,000 rows, concurrency 1. The report's verdict is a win: a gap of at least 3% and trial ranges that do not overlap.",
    unit: "ms",
    better: "lower",
    digits: 2,
    groups: [
      {
        label: "Static",
        points: [point("Rivet static", ssr1000["rivet-compiled"].cpu_ms, { rivet: true }), point("Razor (.NET 10)", ssr1000["dotnet"].cpu_ms)],
      },
    ],
    caption: { ...SSR_CAPTION, method: C1 + SSR_CAPTION.method },
  },
  "ssr-static-cpu": {
    id: "ssr-static-cpu",
    kind: "bar",
    title: "Static SSR, 1,000 rows: CPU per page",
    unit: "ms",
    better: "lower",
    digits: 2,
    groups: [
      {
        label: "Static (no client state)",
        points: [
          point("Rivet static", ssr1000["rivet-compiled"].cpu_ms, { rivet: true, note: "compiled JSX, .map" }),
          point("Razor (.NET 10)", ssr1000["dotnet"].cpu_ms),
          point("Solid 1.9 static", ssr1000["solid-stable-static"].cpu_ms, { note: "hydratable: false, renderToString" }),
        ],
      },
    ],
    caption: { ...SSR_CAPTION, method: C1 + SSR_CAPTION.method },
  },
  "ssr-grid-cpu": {
    id: "ssr-grid-cpu",
    kind: "bar",
    title: "Static SSR, text grid (1,000 rows × 10 short strings): CPU per page",
    unit: "ms",
    better: "lower",
    digits: 2,
    groups: [
      {
        label: "Concurrency 1",
        points: [
          point("Rivet static", grid1000["rivet-compiled"].cpu_ms, { rivet: true }),
          point("Razor (.NET 10)", grid1000["dotnet"].cpu_ms),
          point("Solid 1.9 static", grid1000["solid-stable-static"].cpu_ms),
        ],
      },
    ],
    caption: {
      ...SSR_CAPTION,
      method:
        "ssr-bench --grid (every field a 24–64 character string, 20% with characters to escape), concurrency 1 (this run did not repeat the grid at concurrency 10). " +
        SSR_CAPTION.method,
    },
  },
  "ssr-resumable-cpu-1000": {
    id: "ssr-resumable-cpu-1000",
    kind: "bar",
    title: "Interactive SSR, 1,000 rows: CPU per page",
    unit: "ms",
    better: "lower",
    digits: 2,
    groups: [
      {
        label: "Resumable / interactive (like-for-like)",
        points: [
          point("Rivet resumable", ssr1000["rivet-resume"].cpu_ms, { rivet: true, note: "handlers, links, nested layout state, resume data" }),
          point("Solid 1.9 interactive", ssr1000["solid-stable-interactive"].cpu_ms, { note: "hydratable, same handlers, links and page data" }),
        ],
      },
      {
        label: "Hydratable, less work",
        points: [
          point("Solid 2 hydratable", ssr1000["solid"].cpu_ms, { note: "no handlers, links or page data" }),
          point("Solid 1 hydratable", ssr1000["solid-stable"].cpu_ms, { note: "no handlers, links or page data" }),
        ],
      },
    ],
    caption: { ...SSR_CAPTION, method: C1 + SSR_CAPTION.method },
  },
  "ssr-resumable-cpu-5000": {
    id: "ssr-resumable-cpu-5000",
    kind: "bar",
    title: "Interactive SSR, 5,000 rows: CPU per page",
    unit: "ms",
    better: "lower",
    digits: 1,
    groups: [
      {
        label: "Resumable / interactive (like-for-like)",
        points: [
          point("Rivet resumable", ssr5000["rivet-resume"].cpu_ms, { rivet: true, note: "handlers, links, nested layout state, resume data" }),
          point("Solid 1.9 interactive", ssr5000["solid-stable-interactive"].cpu_ms, { note: "hydratable, same handlers, links and page data" }),
        ],
      },
      {
        label: "Hydratable, less work",
        points: [
          point("Solid 2 hydratable", ssr5000["solid"].cpu_ms, { note: "no handlers, links or page data" }),
          point("Solid 1 hydratable", ssr5000["solid-stable"].cpu_ms, { note: "no handlers, links or page data" }),
        ],
      },
    ],
    caption: { ...SSR_CAPTION, method: C1 + SSR_CAPTION.method },
  },
  // A remaining CPU loss of the resumable class: 100 rows, concurrency 10 against plain Solid 1.9.
  // rivet-router = the page without row handlers, for attribution (level with plain Solid in this run).
  "ssr-resumable-cpu-100-c10": {
    id: "ssr-resumable-cpu-100-c10",
    kind: "bar",
    title: "Interactive SSR, 100 rows, 10 concurrent requests: CPU per page",
    unit: "ms",
    better: "lower",
    digits: 2,
    groups: [
      {
        label: "Resumable / interactive (like-for-like)",
        points: [
          point("Rivet resumable", ssr100c10["rivet-resume"].cpu_ms, { rivet: true, note: "handlers, links, nested layout state, resume data" }),
          point("Solid 1.9 interactive", ssr100c10["solid-stable-interactive"].cpu_ms, { note: "hydratable, same handlers, links and page data" }),
        ],
      },
      {
        label: "Without handlers, links or page data",
        points: [
          point("Rivet router", ssr100c10["rivet-router"].cpu_ms, { rivet: true, note: "router + resume render, no handlers" }),
          point("Solid 1 hydratable", ssr100c10["solid-stable"].cpu_ms, { note: "no handlers, links or page data" }),
          point("Solid 2 hydratable", ssr100c10["solid"].cpu_ms, { note: "no handlers, links or page data" }),
        ],
      },
    ],
    caption: { ...SSR_CAPTION, method: "Concurrency 10. " + SSR_CAPTION.method },
  },
  // Peak working set of the resumable class (report "Peak working set" table).
  "ssr-resumable-memory": {
    id: "ssr-resumable-memory",
    kind: "bar",
    title: "Interactive SSR: peak memory of the server container",
    unit: "MiB",
    better: "lower",
    digits: 1,
    groups: (
      [
        ["100 rows", ssr100],
        ["1,000 rows", ssr1000],
      ] as const
    ).map(([label, lanes]) => ({
      label,
      points: [
        point("Rivet resumable", lanes["rivet-resume"].peak_mib, { rivet: true }),
        point("Solid 1.9 interactive", lanes["solid-stable-interactive"].peak_mib),
        point("Solid 1 hydratable", lanes["solid-stable"].peak_mib, { note: "no handlers, links or page data" }),
        point("Solid 2 hydratable", lanes["solid"].peak_mib, { note: "no handlers, links or page data" }),
        point("Qwik 1.20", lanes["qwik-stable"].peak_mib),
        point("Qwik 2 rc", lanes["qwik"].peak_mib),
      ],
    })),
    caption: { ...SSR_CAPTION, method: C1 + "Highest container memory seen during the run (not a leak test). " + SSR_CAPTION.method },
  },
  "resume-input-paint": resumeChart(
    "resume-input-paint",
    "Resume: input to paint per scenario",
    [
      ["Click (mouse)", "click"],
      ["Click (keyboard)", "keyClick"],
      ["Tap", "tapClick"],
      ["Filter", "filter"],
      ["Navigate", "navigate"],
    ],
    paint,
  ),
  // `latency` = first DOM mutation; the scenarios whose verdict is LOSE (scroll-then-click also loses, but one Rivet
  // trial took 690 ms and would flatten the axis; it is in the report).
  "resume-first-change": resumeChart(
    "resume-first-change",
    "Resume: input to the first DOM change",
    [
      ["Click (mouse)", "click"],
      ["Filter", "filter"],
    ],
    firstChange,
  ),
  // resumeRun.resume["slow/load/<lane>"].jsBytesBeforeInteraction (bytes; shown in KB = 1,000 B).
  "resume-js-before-input": {
    id: "resume-js-before-input",
    kind: "bar",
    title: "Resume: JavaScript downloaded before the first input",
    unit: "KB",
    better: "lower",
    digits: 1,
    groups: [
      {
        label: "Page load, before any input",
        points: RESUME_LANES.map(([lane, name]) => {
          const bytes = resume[`slow/load/${lane}`]!.jsBytesBeforeInteraction!;
          return { label: name, value: bytes.median / 1000, ...(lane === "rivet" ? { rivet: true } : {}) };
        }),
      },
    ],
    caption: { ...RESUME_CAPTION, method: "resume-bench, Slow 4G + 4× CPU throttling, 10 repeats; script bytes the page downloaded before the first input (the same in every repeat)." },
  },
  "dom-mount-1000": {
    id: "dom-mount-1000",
    kind: "bar",
    title: "Browser: mount 1,000 rows",
    unit: "ms",
    better: "lower",
    digits: 1,
    groups: [
      {
        label: "Client-rendered",
        points: [point("Rivet", dom["1000"].rivet.mount, { rivet: true }), ...DOM_LANES.map(([lane, label]) => point(label, dom["1000"][lane].mount))],
      },
    ],
    caption: DOM_CAPTION,
  },
  "dom-mount-5000": {
    id: "dom-mount-5000",
    kind: "bar",
    title: "Browser: mount 5,000 rows",
    unit: "ms",
    better: "lower",
    digits: 1,
    groups: [
      {
        label: "Client-rendered",
        points: [point("Rivet", dom["5000"].rivet.mount, { rivet: true }), ...DOM_LANES.map(([lane, label]) => point(label, dom["5000"][lane].mount))],
      },
    ],
    caption: { ...DOM_CAPTION, method: DOM_CAPTION.method + " After the garbage collection that sets the memory baseline, one untimed mount and unmount runs before the timed mount." },
  },
  "dom-update-1000": {
    id: "dom-update-1000",
    kind: "bar",
    title: "Browser: update 1,000 rows (100% and 1% of the fields)",
    unit: "ms",
    better: "lower",
    digits: 2,
    groups: (
      [
        ["Update 100%", "update100"],
        ["Update 1%", "update1"],
      ] as const
    ).map(([label, metric]) => ({
      label,
      points: [point("Rivet", dom["1000"].rivet[metric], { rivet: true }), ...DOM_LANES.map(([lane, name]) => point(name, dom["1000"][lane][metric]))],
    })),
    caption: DOM_CAPTION,
  },
  "krausest-cpu": {
    id: "krausest-cpu",
    kind: "range",
    title: "Keyed table: operations starting with 1,000 rows",
    unit: "ms",
    better: "lower",
    digits: 1,
    groups: ([
      ["Create 1,000 rows", "01_run1k"],
      ["Replace 1,000 rows", "02_replace1k"],
      ["Update every tenth row", "03_update10th1k_x16"],
      ["Select a row", "04_select1k"],
      ["Swap rows", "05_swap1k"],
      ["Remove one row", "06_remove-one-1k"],
      ["Append 1,000 rows", "08_create1k-after1k_x2"],
      ["Clear 1,000 rows", "09_clear1k_x8"],
    ] as const).map(([label, id]) => ({
      label,
      points: [point("Rivet", krausest.cpu[id].rivet.total, { rivet: true }), point("Vanilla JS", krausest.cpu[id].vanilla.total)],
    })),
    caption: {
      ...KRAUSEST_CAPTION,
      method: "15 samples per lane (25 for selection). CPU slowdown: 4× for update/select/swap/clear, 2× for remove. " + KRAUSEST_CAPTION.method,
    },
  },
  "krausest-memory": {
    id: "krausest-memory",
    kind: "bar",
    title: "Keyed table: browser memory",
    unit: "MiB",
    better: "lower",
    digits: 2,
    groups: ([
      ["Ready page", "21_ready-memory"],
      ["1,000 rows", "22_run-memory"],
      ["After five create/clear cycles", "25_run-clear-memory"],
    ] as const).map(([label, id]) => ({
      label,
      points: [point("Rivet", krausest.memory[id].rivet, { rivet: true }), point("Vanilla JS", krausest.memory[id].vanilla)],
    })),
    caption: {
      ...KRAUSEST_CAPTION,
      method: "3 samples per lane, forced major GC, measureUserAgentSpecificMemory; MiB = bytes / 1,048,576. These snapshots are not a leak test. " + KRAUSEST_CAPTION.method,
    },
  },
};

// Dynamic rendering (per-request SSR of a page the browser resumes): the like-for-like interactive lanes plus the
// resumable Qwik lanes of the same report. fair.ssr.tuned["1000"]["1"][lane].cpu_ms.
charts["ssr-dynamic-cpu-1000"] = {
  id: "ssr-dynamic-cpu-1000",
  kind: "bar",
  title: "Dynamic rendering, 1,000 rows: CPU per request",
  unit: "ms",
  better: "lower",
  digits: 2,
  groups: [
    {
      label: "Interactive pages, rendered per request",
      points: [
        point("Rivet resumable", ssr1000["rivet-resume"].cpu_ms, { rivet: true, note: "handlers, links, nested layout state, resume data" }),
        point("Solid 1.9 interactive", ssr1000["solid-stable-interactive"].cpu_ms, { note: "hydratable, same handlers, links and page data" }),
        // Labels: ssr-bench lane versions (qwik-stable = Qwik 1.20, qwik = Qwik 2 rc).
        point("Qwik 1.20", ssr1000["qwik-stable"].cpu_ms, { note: "resumable" }),
        point("Qwik 2 rc", ssr1000["qwik"].cpu_ms, { note: "resumable" }),
      ],
    },
    {
      label: "Hydratable, less work",
      points: [point("Solid 1.9 plain", ssr1000["solid-stable"].cpu_ms, { note: "no handlers, links or page data" })],
    },
  ],
  caption: { ...SSR_CAPTION, method: C1 + SSR_CAPTION.method },
};

// ---------------------------------------------------------------------------------------------------------------
// Homepage numbers strip (apps/docs/src/routes/index.tsx): four charts (order: no two equal big numbers side by side), each
// the points of a chart above (no new numbers), a big ratio computed from them, a one-line claim and a footnote.
// `word` = the hero's rotating word it proves.
const pointsOf = (id: string, group: string | number = 0): ChartPoint[] => {
  const spec = charts[id]!;
  const found = typeof group === "number" ? spec.groups[group] : spec.groups.find((g) => g.label === group);
  if (!found) throw new Error(`home: chart ${id} has no group ${group}`);
  return found.points;
};
const relabel = (points: ChartPoint[], labels: Record<string, string>): ChartPoint[] =>
  points.map(({ label, value, rivet }) => ({ label: labels[label] ?? label, value, ...(rivet ? { rivet } : {}) }));
const valueOf = (points: ChartPoint[], label: string): number => {
  const found = points.find((p) => p.label === label);
  if (!found) throw new Error(`home: no lane ${label}`);
  return found.value;
};
const times = (rivet: number, other: number, digits = 1) => formatValue(advantage(rivet, other, "lower"), digits) + "×";
const ms = (value: number, digits: number) => formatValue(value, digits) + " ms";

export interface HomeChart {
  id: string;
  /** Rotating hero word this chart proves. */
  word: "fast" | "dynamic" | "resumable" | "updates";
  /** Big number, computed (e.g. "3.1×"). */
  big: string;
  /** The competitor the big number is measured against, shown beside it ("vs Razor"). */
  peer: string;
  /** Hero proof strip line under the big number (index.tsx `.lp-strip`), names the peer. */
  strip: string;
  claim: string;
  unit: string;
  better: "lower" | "higher";
  digits: number;
  /** Bars: Rivet first, then the peers best first. */
  points: ChartPoint[];
  footnote: string;
  /** Where Rivet loses in this measure (shown under the chart), with what is being done about it. */
  loss?: string;
  /** Source chart on /about/benchmarks/ + the report. */
  chart: string;
  source: { text: string; href: string };
}

const rivetFirst = (points: ChartPoint[]) => [...points.filter((p) => p.rivet), ...points.filter((p) => !p.rivet).sort((a, b) => a.value - b.value)];
const DOM_LABELS = { "Solid 1.9.15": "Solid 1.9", "Solid 2.0.0-rc.13": "Solid 2 rc", "React 19.3": "React 19" };
// resume-bench "Solid 1" = the solid-stable lane (Solid 1.9), "Qwik 1" = Qwik 1.20, "Qwik 2" = Qwik 2.0.0-rc.0.
const RESUME_LABELS = { "Solid 1": "Solid 1.9", "Solid 2": "Solid 2 rc", "Qwik 1": "Qwik 1.20", "Qwik 2": "Qwik 2 rc" };

const ssrStatic = relabel(pointsOf("ssr-static-cpu"), { "Rivet static": "Rivet", "Solid 1.9 static": "Solid 1.9", "Razor (.NET 10)": "Razor" });
const ssrStatic5000 = relabel([point("Rivet static", ssr5000["rivet-compiled"].cpu_ms, { rivet: true }), point("Razor (.NET 10)", ssr5000["dotnet"].cpu_ms)], {
  "Rivet static": "Rivet",
  "Razor (.NET 10)": "Razor",
});
const click = relabel(pointsOf("resume-input-paint", "Click (mouse)"), RESUME_LABELS);
const navigate = relabel(pointsOf("resume-input-paint", "Navigate"), RESUME_LABELS);
// Fastest competitor in a resume scenario.
const fastest = (points: ChartPoint[]) => points.filter((p) => !p.rivet).reduce((a, b) => (b.value < a.value ? b : a));
const mount1000 = relabel(pointsOf("dom-mount-1000"), DOM_LABELS);
const mount5000 = relabel(pointsOf("dom-mount-5000"), DOM_LABELS);
const update100 = relabel(pointsOf("dom-update-1000", "Update 100%"), DOM_LABELS);
const dynamic = relabel(pointsOf("ssr-dynamic-cpu-1000", 0), { "Rivet resumable": "Rivet", "Solid 1.9 interactive": "Solid 1.9" });
const small = relabel(pointsOf("ssr-resumable-cpu-100-c10", 1), { "Solid 1 hydratable": "Solid 1.9 plain" });
const smallRivet = valueOf(pointsOf("ssr-resumable-cpu-100-c10", 0), "Rivet resumable");

const FAIR_LINE = { text: "SSR comparison, 2026-10-23 · Apple M4 Pro", href: FAIR.href };
const RESUME_LINE = { text: "Resume comparison, 2026-10-20 · Apple M4 Pro", href: RESUME.href };
const DOM_LINE = { text: "DOM mount report, 2026-10-21 · Apple M4 Pro", href: DOM.href };

export const homeStrip: HomeChart[] = [
  {
    id: "ssr",
    word: "fast",
    big: times(valueOf(ssrStatic, "Rivet"), valueOf(ssrStatic, "Razor")),
    peer: "Razor",
    strip: "less server CPU per page than ASP.NET Razor",
    claim: "less CPU per server-rendered page than ASP.NET Razor",
    unit: "ms",
    better: "lower",
    digits: 2,
    points: rivetFirst(ssrStatic),
    footnote: `${times(valueOf(ssrStatic5000, "Rivet"), valueOf(ssrStatic5000, "Razor"))} at 5,000 rows. Static page, one CPU core each.`,
    chart: "ssr-static-cpu",
    source: FAIR_LINE,
  },
  {
    // Against hydrated Solid (verdict WIN); Qwik, which also resumes, is level (TIE) and the footnote says so.
    id: "navigate",
    word: "resumable",
    big: times(valueOf(navigate, "Rivet"), valueOf(navigate, "Solid 1.9")),
    peer: "Solid",
    strip: "faster navigation after resume than hydrated Solid 1.9",
    claim: "faster navigation after resume than hydrated Solid 1.9, on slow 4G",
    unit: "ms",
    better: "lower",
    digits: 1,
    points: rivetFirst(navigate),
    footnote: `Qwik also resumes and is level: ${ms(valueOf(navigate, "Qwik 1.20"), 1)} (Qwik 1.20) vs ${ms(valueOf(navigate, "Rivet"), 1)}. First click: level with Qwik (${ms(valueOf(click, "Rivet"), 1)} vs ${ms(fastest(click).value, 1)}). Slow 4G, 4× slower CPU.`,
    chart: "resume-input-paint",
    source: RESUME_LINE,
  },
  {
    id: "update",
    word: "updates",
    big: times(valueOf(update100, "Rivet"), valueOf(update100, "Solid 1.9")),
    peer: "Solid",
    strip: "faster DOM updates than Solid 1.9",
    claim: `faster DOM updates than Solid, ${times(valueOf(update100, "Rivet"), valueOf(update100, "React 19"))} faster than React`,
    unit: "ms",
    better: "lower",
    digits: 2,
    points: rivetFirst(update100),
    footnote: `Update every field of 1,000 rows in Chromium, every framework measured in the same run. Mounting is level with Solid 1.9: ${ms(valueOf(mount1000, "Rivet"), 1)} vs ${ms(valueOf(mount1000, "Solid 1.9"), 1)} at 1,000 rows, ${ms(valueOf(mount5000, "Rivet"), 1)} vs ${ms(valueOf(mount5000, "Solid 1.9"), 1)} at 5,000.`,
    chart: "dom-update-1000",
    source: DOM_LINE,
  },
  {
    id: "dynamic",
    word: "dynamic",
    big: times(valueOf(dynamic, "Rivet"), valueOf(dynamic, "Solid 1.9")),
    peer: "Solid",
    strip: "less CPU per interactive request than Solid 1.9",
    claim: `less CPU per request than Solid for the same interactive page, ${times(valueOf(dynamic, "Rivet"), valueOf(dynamic, "Qwik 1.20"), 0)} less than Qwik`,
    unit: "ms",
    better: "lower",
    digits: 2,
    points: rivetFirst(dynamic),
    footnote: "Dynamic rendering: every request renders the page with its handlers, links and resume data. 1,000 rows, one request at a time.",
    loss: `On a 100-row page under 10 concurrent requests, plain hydratable Solid 1.9, without handlers, links or page data, needs ${times(valueOf(small, "Solid 1.9 plain"), smallRivet)} less CPU (${ms(valueOf(small, "Solid 1.9 plain"), 2)} vs ${ms(smallRivet, 2)}). Plain Solid 1.9 also uses less CPU on the text-grid fixture. At 100 rows and one request at a time, Rivet uses more peak memory than both Solid 1.9 lanes and is level with Solid 2.`,
    chart: "ssr-dynamic-cpu-1000",
    source: FAIR_LINE,
  },
];

// Where Rivet loses: purely static content sites (docs/benchmarks/2026-10-11-editorial.json, 1,000 articles).
// output["1000"][lane].article.inlineJS = inline JS bytes of an article page; serve["1000"][lane].client.jsBytes =
// JS fetched by a visit; serve["1000"][lane].lighthouse.article.lcp.median = Lighthouse mobile LCP (ms).
const EDITORIAL = { text: "Editorial benchmark, 2026-10-11", href: REPO + "docs/benchmarks/2026-10-11-editorial.md" };
const zeroJsLanes = (["astro", "eleventy", "hugo"] as const).filter((lane) => editorial.serve["1000"][lane].client.jsBytes === 0);
export const editorialLoss = {
  zeroJs: zeroJsLanes.map((lane) => ({ astro: "Astro", eleventy: "Eleventy", hugo: "Hugo" })[lane]),
  rivetInlineJS: editorial.output["1000"].rivet.article.inlineJS,
  rivetFetchedJS: editorial.serve["1000"].rivet.client.jsBytes,
  rivetLcp: editorial.serve["1000"].rivet.lighthouse.article.lcp.median,
  astroLcp: editorial.serve["1000"].astro.lighthouse.article.lcp.median,
  source: EDITORIAL,
};

/** Numbers quoted by the home feature grid (index.tsx FEATURES), from the same JSON files. */
export const homeFacts = {
  /** Browser: update every field of 1,000 rows, Rivet median (chart dom-update-1000, domRun.runTs.baseline["1000"].rivet.update100). */
  domUpdate1000: ms(valueOf(update100, "Rivet"), 2),
  /** Streaming SSR, 5,000 rows, 1 connection: p99 page latency, Rivet compiled vs Razor (fair.ssr.tuned["5000"]["1"][lane].p99_ms). */
  streamP99: ms(ssr5000["rivet-compiled"].p99_ms.median, 1),
  razorP99: ms(ssr5000["dotnet"].p99_ms.median, 1),
};
