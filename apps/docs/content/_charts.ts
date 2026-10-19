// Benchmark charts of the docs site (`::chart{id=…}` in content) and the homepage benchmark section
// (`proof` → BenchProof tabs, `proofGrid` → BenchGrid, from @rivetjs/docs-kit/components/BenchProof.tsx).
// Every number comes from a committed report — never type a value that is not in one:
// every value is read at build time from docs/benchmarks/2026-10-09-fair-comparison.json
// (written by apps/ssr-bench/fair-report.ts; path in each comment). apps/dom-bench/competitors.json
// stores the same SSR and resume competitor numbers (`fair-report.ts --store-competitors`);
// tests/charts.test.ts checks both. The homepage loss row reads docs/benchmarks/2026-10-11-editorial.json.
// Lanes are like-for-like within a group; where Rivet loses or ties, the chart shows it.
import { advantage, formatValue, type BenchChartSpec, type ChartPoint, type ProofGrid, type ProofMetric } from "@rivetjs/docs-kit/components/chart-model.ts";
import fair from "../../../docs/benchmarks/2026-10-09-fair-comparison.json" with { type: "json" };
import editorial from "../../../docs/benchmarks/2026-10-11-editorial.json" with { type: "json" };

const REPO = "https://github.com/N1XUS/rivetjs/blob/main/";
const FAIR = { label: "Fair comparison 2026-10-09 (full report)", href: REPO + "docs/benchmarks/2026-10-09-fair-comparison.md" };

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
const ssr1000 = fair.ssr.tuned["1000"]["1"];
const ssr5000 = fair.ssr.tuned["5000"]["1"];
// fair.ssr["tuned+grid"]["1000"][concurrency][lane].cpu_ms — "SSR — profile `tuned+grid`" › "CPU per page".
const grid1000 = fair.ssr["tuned+grid"]["1000"];
// fair.dom["1000"][metric].stats[lane] — "DOM (apps/dom-bench…)" › "1000 rows".
const dom1000 = fair.dom["1000"];
// fair.resume["slow/<scenario>/<lane>"].paintLatency — "Resume (apps/resume-bench, Slow 4G + 4x CPU)".
const paint = (scenario: string, lane: string): Stat => (fair.resume as unknown as Record<string, { paintLatency: Stat }>)[`slow/${scenario}/${lane}`]!.paintLatency;

const SSR_CAPTION = {
  // 2026-10-09-fair-comparison.md "Methodology" + notes "Run conditions".
  machine: "Apple M4 Pro (14 cores), Docker Desktop; every lane 1 CPU / 512 MiB",
  date: "2026-10-09",
  method:
    "ssr-bench, tuned GC profile, 3 interleaved repeats (10 s after 3 s warmup); median, whiskers = min–max of repeats. Other jobs ran on the host (1-minute load 5–27).",
  source: FAIR,
};

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
        points: [
          point("Rivet static", ssr1000["rivet-compiled"].cpu_ms, { rivet: true }),
          // Label: apps/dom-bench/competitors.json labels.dotnet.
          point("Razor (.NET 10)", ssr1000["dotnet"].cpu_ms),
        ],
      },
    ],
    caption: { ...SSR_CAPTION, method: "ssr-bench, concurrency 1, tuned GC profile, 3 interleaved repeats (10 s after 3 s warmup); medians. Other jobs ran on the host (1-minute load 5–27)." },
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
    caption: { ...SSR_CAPTION, method: "Concurrency 1. " + SSR_CAPTION.method },
  },
  "ssr-grid-cpu": {
    id: "ssr-grid-cpu",
    kind: "bar",
    title: "Static SSR, text grid (1,000 rows × 10 short strings): CPU per page",
    unit: "ms",
    better: "lower",
    digits: 2,
    groups: (["1", "10"] as const).map((c) => ({
      label: `Concurrency ${c}`,
      points: [
        point("Rivet static", grid1000[c]["rivet-compiled"].cpu_ms, { rivet: true }),
        point("Razor (.NET 10)", grid1000[c]["dotnet"].cpu_ms),
        point("Solid 1.9 static", grid1000[c]["solid-stable-static"].cpu_ms),
      ],
    })),
    caption: {
      ...SSR_CAPTION,
      method: "ssr-bench --grid (every field a 24–64 character string, 20% with characters to escape). " + SSR_CAPTION.method,
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
    caption: { ...SSR_CAPTION, method: "Concurrency 1. " + SSR_CAPTION.method },
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
    caption: { ...SSR_CAPTION, method: "Concurrency 1. " + SSR_CAPTION.method },
  },
  "resume-input-paint": {
    id: "resume-input-paint",
    kind: "range",
    title: "Resume: input to paint per scenario",
    unit: "ms",
    better: "lower",
    digits: 1,
    // Scenario ids of resume-bench: click (mouse), keyClick, tapClick, filter, navigate.
    groups: (
      [
        ["Click (mouse)", "click"],
        ["Click (keyboard)", "keyClick"],
        ["Tap", "tapClick"],
        ["Filter", "filter"],
        ["Navigate", "navigate"],
      ] as const
    ).map(([label, scenario]) => ({
      label,
      points: [
        point("Rivet", paint(scenario, "rivet"), { rivet: true }),
        // Labels: resume-bench lane versions (solid-stable = Solid 1.9.15, solid = 2.0.0-rc.13, qwik-stable = 1.20.1, qwik = 2.0.0-rc.0).
        point("Solid 1", paint(scenario, "solid-stable")),
        point("Solid 2", paint(scenario, "solid")),
        point("Qwik 1", paint(scenario, "qwik-stable")),
        point("Qwik 2", paint(scenario, "qwik")),
      ],
    })),
    caption: {
      machine: "Apple M4 Pro, Chrome 154",
      date: "2026-10-09",
      method:
        "resume-bench, Slow 4G + 4× CPU throttling, 7 repeats; input → paint of the update, median, whiskers = min–max. Other jobs ran on the host (1-minute load 6–14).",
      source: FAIR,
    },
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
        points: [
          point("Rivet", dom1000.mount.stats["rivet"], { rivet: true }),
          // Labels: apps/dom-bench/competitors.json labels (solid-stable, solid, react).
          point("Solid 1.9.15", dom1000.mount.stats["solid-stable"]),
          point("Solid 2.0.0-rc.13", dom1000.mount.stats["solid"]),
          point("React 19.3", dom1000.mount.stats["react"]),
        ],
      },
    ],
    caption: {
      // 2026-10-09-fair-comparison.md "DOM (apps/dom-bench, local re-measure of every lane)".
      machine: "Apple M4 Pro, Playwright Chromium 153, cross-origin isolated",
      date: "2026-10-09",
      method: "dom-bench, 5 interleaved repeats; committed-DOM time, median, whiskers = min–max. Other jobs ran on the host (1-minute load 10–11).",
      source: FAIR,
    },
  },
  "dom-update-1000": {
    id: "dom-update-1000",
    kind: "bar",
    title: "Browser: update 1,000 rows (100%, 10%, 1% of the fields)",
    unit: "ms",
    better: "lower",
    digits: 2,
    groups: (
      [
        ["Update 100%", "update100"],
        ["Update 10%", "update10"],
        ["Update 1%", "update1"],
      ] as const
    ).map(([label, metric]) => ({
      label,
      points: [
        point("Rivet", dom1000[metric].stats["rivet"], { rivet: true }),
        point("Solid 1.9.15", dom1000[metric].stats["solid-stable"]),
        point("Solid 2.0.0-rc.13", dom1000[metric].stats["solid"]),
        point("React 19.3", dom1000[metric].stats["react"]),
      ],
    })),
    caption: {
      machine: "Apple M4 Pro, Playwright Chromium 153, cross-origin isolated",
      date: "2026-10-09",
      method: "dom-bench, 5 interleaved repeats; committed-DOM time, median, whiskers = min–max. Other jobs ran on the host (1-minute load 10–11).",
      source: FAIR,
    },
  },
};

// Homepage proof: the same points as the charts above (no new numbers), relabelled for short rows.
// Headline ratios are computed from those points, never typed.
const pointsOf = (id: string, group: string | number = 0): ChartPoint[] => {
  const spec = charts[id]!;
  const found = typeof group === "number" ? spec.groups[group] : spec.groups.find((g) => g.label === group);
  if (!found) throw new Error(`proof: chart ${id} has no group ${group}`);
  return found.points;
};
const relabel = (points: ChartPoint[], labels: Record<string, string>): ChartPoint[] =>
  points.map(({ label, value, rivet }) => ({ label: labels[label] ?? label, value, ...(rivet ? { rivet } : {}) }));
const valueOf = (points: ChartPoint[], label: string): number => {
  const found = points.find((p) => p.label === label);
  if (!found) throw new Error(`proof: no lane ${label}`);
  return found.value;
};
const times = (rivet: number, other: number, digits = 1) => formatValue(advantage(rivet, other, "lower"), digits) + "×";

const ssrStatic = relabel(pointsOf("ssr-static-cpu"), { "Rivet static": "Rivet", "Solid 1.9 static": "Solid 1.9", "Razor (.NET 10)": "Razor" });
const ssrInteractive = relabel(pointsOf("ssr-resumable-cpu-1000"), { "Rivet resumable": "Rivet", "Solid 1.9 interactive": "Solid 1.9" });
const ssrInteractiveAll = relabel([...pointsOf("ssr-resumable-cpu-1000", 0), ...pointsOf("ssr-resumable-cpu-1000", 1)], {
  "Rivet resumable": "Rivet",
  "Solid 1 hydratable": "Solid 1.9 plain",
  "Solid 2 hydratable": "Solid 2 rc plain",
});
const mount = relabel(pointsOf("dom-mount-1000"), { "Solid 1.9.15": "Solid 1.9", "Solid 2.0.0-rc.13": "Solid 2 rc", "React 19.3": "React 19" });
// resume-bench "Solid 1" = the solid-stable lane (Solid 1.9), "Qwik 2" = Qwik 2.0.0-rc.0.
const RESUME_LABELS = { "Solid 1": "Solid 1.9", "Solid 2": "Solid 2 rc", "Qwik 1": "Qwik 1.20" };
const click = relabel(pointsOf("resume-input-paint", "Click (mouse)"), RESUME_LABELS);
const navigate = relabel(pointsOf("resume-input-paint", "Navigate"), RESUME_LABELS);
// Fastest competitor in a resume scenario (the headline compares against it).
const fastest = (points: ChartPoint[]) => points.filter((p) => !p.rivet).reduce((a, b) => (b.value < a.value ? b : a));
const navigateBest = fastest(navigate);

const FAIR_LINE = { text: "Fair comparison, 2026-10-09 · Apple M4 Pro", href: FAIR.href };

export const proof: ProofMetric[] = [
  {
    id: "ssr",
    tab: "Server render",
    headline: `${times(valueOf(ssrStatic, "Rivet"), valueOf(ssrStatic, "Razor"), 2)} less CPU than Razor`,
    subline: "CPU time to render a 1,000-row page on the server, against ASP.NET Razor (.NET 10) and Solid. Every framework gets one CPU core.",
    verdict: "win",
    unit: "ms",
    better: "lower",
    digits: 2,
    points: ssrStatic,
    source: FAIR_LINE,
  },
  {
    id: "interactive",
    tab: "Interactive SSR",
    headline: `Plain hydratable Solid uses ${times(valueOf(ssrInteractiveAll, "Solid 1.9 plain"), valueOf(ssrInteractiveAll, "Rivet"))} less CPU`,
    subline: `CPU time for a 1,000-row page the browser can resume. Solid 1.9 rendering the same rows without handlers, links or page data still needs less CPU than Rivet. Against Solid 1.9 doing the same work, Rivet uses ${times(valueOf(ssrInteractiveAll, "Rivet"), valueOf(ssrInteractiveAll, "Solid 1.9 interactive"))} less.`,
    // Report verdict: LOSE vs solid-stable (plain hydratable) at 1000 rows c1, WIN vs solid-stable-interactive.
    verdict: "loss",
    unit: "ms",
    better: "lower",
    digits: 2,
    points: ssrInteractiveAll,
    source: FAIR_LINE,
  },
  {
    id: "mount",
    tab: "DOM mount",
    headline: `${times(valueOf(mount, "Rivet"), valueOf(mount, "Solid 1.9"), 2)} faster than Solid, ${times(valueOf(mount, "Rivet"), valueOf(mount, "React 19"))} faster than React`,
    subline: "Time to create and insert 1,000 table rows in the browser (Chromium).",
    // Report verdict: WIN against every lane (≥3% gap, ranges do not overlap); the gap to Solid 1.9 is small.
    verdict: "win",
    unit: "ms",
    better: "lower",
    digits: 1,
    points: mount,
    source: FAIR_LINE,
  },
  {
    id: "click",
    tab: "First click",
    headline: "Level with Qwik on the first click",
    subline: `From the first click on a server-rendered page to the painted update, on slow 4G with a 4× slower CPU. Solid hydrates first and takes ${times(valueOf(click, "Rivet"), valueOf(click, "Solid 1.9"))} as long.`,
    verdict: "tie",
    unit: "ms",
    better: "lower",
    digits: 1,
    points: click,
    source: FAIR_LINE,
  },
  {
    id: "navigate",
    tab: "Navigation",
    headline: `Navigates ${times(valueOf(navigate, "Rivet"), navigateBest.value)} faster than ${navigateBest.label}`,
    subline: `Following a link after the page has resumed, on slow 4G with a 4× slower CPU. Solid 1.9 takes ${times(valueOf(navigate, "Rivet"), valueOf(navigate, "Solid 1.9"))} as long; Qwik's runs vary widely.`,
    verdict: "win",
    unit: "ms",
    better: "lower",
    digits: 1,
    points: navigate,
    source: FAIR_LINE,
  },
];

// Grid: frameworks as columns; a cell only where the lane ran the same work as Rivet in that report.
const GRID_COLUMNS = ["Rivet", "Solid 1.9", "Solid 2 rc", "React 19", "Qwik 2", "Razor"];
const cellsOf = (points: ChartPoint[]) => GRID_COLUMNS.map((column) => points.find((p) => p.label === column)?.value ?? null);
export const proofGrid: ProofGrid = {
  columns: GRID_COLUMNS.map((label) => (label === "Rivet" ? { label, rivet: true } : { label })),
  rows: [
    { label: "Static SSR, CPU per page", unit: "ms", better: "lower", digits: 2, cells: cellsOf(ssrStatic) },
    { label: "Interactive SSR, CPU per page", unit: "ms", better: "lower", digits: 2, cells: cellsOf(ssrInteractive.slice(0, 2)) },
    { label: "DOM mount, 1,000 rows", unit: "ms", better: "lower", digits: 1, cells: cellsOf(mount) },
    { label: "Resume, first click to paint", unit: "ms", better: "lower", digits: 1, cells: cellsOf(click) },
    { label: "Resume, client navigation", unit: "ms", better: "lower", digits: 1, cells: cellsOf(navigate) },
  ],
  notes: { "Interactive SSR, CPU per page": "same handlers, links and page data" },
  source: [{ text: "Fair comparison, 2026-10-09", href: FAIR.href }],
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
  caption: { ...SSR_CAPTION, method: "Concurrency 1. " + SSR_CAPTION.method },
};

// ---------------------------------------------------------------------------------------------------------------
// Homepage numbers strip (apps/docs/src/routes/index.tsx): four charts (order: no two equal big numbers side by side), each the points of a chart above (no new
// numbers), a big ratio computed from them, a one-line claim and a footnote. `word` = the hero's rotating word it proves.
export interface HomeChart {
  id: string;
  /** Rotating hero word this chart proves. */
  word: "fast" | "dynamic" | "resumable" | "updates";
  /** Big number, computed (e.g. "3.6×"). */
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
const ssrStatic5000 = relabel(
  [point("Rivet static", ssr5000["rivet-compiled"].cpu_ms, { rivet: true }), point("Razor (.NET 10)", ssr5000["dotnet"].cpu_ms)],
  { "Rivet static": "Rivet", "Razor (.NET 10)": "Razor" },
);
const dynamic = relabel(pointsOf("ssr-dynamic-cpu-1000", 0), { "Rivet resumable": "Rivet", "Solid 1.9 interactive": "Solid 1.9" });
const dynamicPlain = relabel(pointsOf("ssr-dynamic-cpu-1000", 1), {});
const update100 = relabel(pointsOf("dom-update-1000", "Update 100%"), { "Solid 1.9.15": "Solid 1.9", "Solid 2.0.0-rc.13": "Solid 2 rc", "React 19.3": "React 19" });
const ms = (value: number, digits: number) => formatValue(value, digits) + " ms";

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
    id: "navigate",
    word: "resumable",
    big: times(valueOf(navigate, "Rivet"), navigateBest.value),
    peer: navigateBest.label.replace(/ [\d.]+$/, ""),
    strip: `faster navigation after resume than ${navigateBest.label}`,
    claim: `faster navigation after resume than ${navigateBest.label}, on slow 4G`,
    unit: "ms",
    better: "lower",
    digits: 1,
    points: rivetFirst(navigate),
    footnote: `First click: level with Qwik (${ms(valueOf(click, "Rivet"), 1)} vs ${ms(fastest(click).value, 1)}). Slow 4G, 4× slower CPU.`,
    chart: "resume-input-paint",
    source: FAIR_LINE,
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
    footnote: "Update every field of 1,000 rows in Chromium.",
    chart: "dom-update-1000",
    source: FAIR_LINE,
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
    footnote: "Dynamic rendering: every request renders the page with its handlers, links and resume data.",
    loss: `Plain hydratable Solid 1.9, without handlers, links or page data, needs ${times(valueOf(dynamicPlain, "Solid 1.9 plain"), valueOf(dynamic, "Rivet"))} less (${ms(valueOf(dynamicPlain, "Solid 1.9 plain"), 2)} vs ${ms(valueOf(dynamic, "Rivet"), 2)}). Function Bridge and the row ABI are cutting what Rivet writes per row.`,
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

/** Numbers quoted by the home feature grid (index.tsx FEATURES), from the same JSON. */
export const homeFacts = {
  /** Browser: update every field of 1,000 rows, Rivet median (chart dom-update-1000). */
  domUpdate1000: ms(valueOf(update100, "Rivet"), 2),
  /** Streaming SSR, 5,000 rows, 1 connection: p99 page latency, Rivet compiled vs Razor (fair.ssr.tuned["5000"]["1"][lane].p99_ms). */
  streamP99: ms(ssr5000["rivet-compiled"].p99_ms.median, 1),
  razorP99: ms(ssr5000["dotnet"].p99_ms.median, 1),
};
