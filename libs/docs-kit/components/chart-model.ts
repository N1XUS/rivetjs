// Benchmark chart data shapes + pure scale / layout math (server + browser, no DOM). `BenchChart.tsx`
// renders a spec as figure + table on the server; `chart-canvas.ts` reads the table back in the browser
// and draws with the layouts computed here. Unit-tested in `tests/chart-model.test.ts`.

/** One measured lane: median, optional trial range. */
export interface ChartPoint {
  /** Lane label as shown ("Rivet resumable", "Razor (.NET 10)"). */
  label: string;
  value: number;
  min?: number;
  max?: number;
  /** The Rivet series: drawn with the brand gradient. Exactly the Rivet lanes set it. */
  rivet?: boolean;
  /** Short qualifier shown in the table / tooltip ("no handlers, links or data"). */
  note?: string;
}

/** Rows that belong together: a lane class (bar) or a scenario (range). */
export interface ChartGroup {
  label: string;
  points: ChartPoint[];
}

export interface ChartCaption {
  /** Machine + environment ("Apple M4 Pro, Docker Linux ARM64, 1 CPU / 512 MiB per lane"). */
  machine: string;
  /** ISO date of the run. */
  date: string;
  /** Method in one sentence (repeats, load, statistic). */
  method: string;
  /** Full report. */
  source: { label: string; href: string };
}

interface ChartBase {
  /** Stable id (`::chart{id=…}`); also the DOM id prefix. */
  id: string;
  title: string;
  /** Unit of every value ("ms", "MiB"). */
  unit: string;
  better: "lower" | "higher";
  /** Decimals for labels (default 1). */
  digits?: number;
  caption: ChartCaption;
}
/** Horizontal bars, sorted best-first inside each group (lane class); whiskers when min/max exist. */
export interface BarChartSpec extends ChartBase {
  kind: "bar";
  groups: ChartGroup[];
}
/** Median dot + min–max whisker per lane, one block per scenario. */
export interface RangeChartSpec extends ChartBase {
  kind: "range";
  groups: ChartGroup[];
}
/** One headline ratio: the Rivet lane against one reference lane, as a big-number card. */
export interface StatChartSpec extends ChartBase {
  kind: "stat";
  /** Words after the ratio in the headline ("less CPU than Razor" → "1.86× less CPU than Razor"). */
  lead: string;
  /** Sentence under the headline (conditions, verdict). */
  claim: string;
  /** Exactly two points in one group: the Rivet lane and the reference lane. */
  groups: [ChartGroup];
}
export type BenchChartSpec = BarChartSpec | RangeChartSpec | StatChartSpec;

/** Tick step of 1 / 2 / 2.5 / 5 × 10^n giving about `count` ticks over [0, max]. */
export function niceStep(max: number, count = 5): number {
  if (!(max > 0) || !Number.isFinite(max)) return 1;
  const raw = max / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/** Axis from 0 to a nice bound ≥ `max`, with its ticks. */
export function niceAxis(max: number, count = 5): { max: number; ticks: number[] } {
  const step = niceStep(max, count);
  const top = Math.max(step, Math.ceil(max / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let i = 0; i * step <= top + step * 1e-9; i++) ticks.push(round(i * step));
  return { max: round(top), ticks };
}
const round = (n: number) => Math.round(n * 1e9) / 1e9;

/** Linear map [0, domainMax] → [x0, x1]; clamps to the range. */
export function linear(domainMax: number, x0: number, x1: number): (value: number) => number {
  const span = domainMax > 0 ? domainMax : 1;
  return (value) => x0 + (Math.min(Math.max(value, 0), span) / span) * (x1 - x0);
}

// One `Intl.NumberFormat` per option set: `Number.prototype.toLocaleString(locale, options)` builds a new formatter on
// every call (~10 µs each; 80 % of the server render of a page with a few charts). `format` is the same algorithm
// (ECMA-402 `toLocaleString` = `new Intl.NumberFormat(locale, options).format`), so labels are unchanged.
const formats = new Map<number, Intl.NumberFormat>();
let tick: Intl.NumberFormat | undefined;
function formatter(digits: number): Intl.NumberFormat {
  let format = formats.get(digits);
  if (format === undefined) {
    // Throws for invalid digits like `toLocaleString` does; only a valid formatter is kept.
    format = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (formats.size < 32) formats.set(digits, format);
  }
  return format;
}

/** Label with fixed decimals; thousands separated. */
export function formatValue(value: number, digits = 1): string {
  return formatter(digits).format(value);
}
/** Tick label: no trailing zeros. */
export function formatTick(value: number): string {
  return (tick ??= new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })).format(value);
}

/** Points of a group, best first (ties keep source order). */
export function sorted(points: readonly ChartPoint[], better: "lower" | "higher"): ChartPoint[] {
  return points
    .map((point, index) => ({ point, index }))
    .sort((a, b) => (better === "lower" ? a.point.value - b.point.value : b.point.value - a.point.value) || a.index - b.index)
    .map(({ point }) => point);
}

/** Largest value the axis must show (max of medians and whisker ends). */
export function extent(groups: readonly ChartGroup[]): number {
  let max = 0;
  for (const group of groups) for (const p of group.points) max = Math.max(max, p.value, p.max ?? 0);
  return max;
}

export interface RowBox {
  group: number;
  point: ChartPoint;
  /** Row top / height in CSS px. */
  y: number;
  h: number;
}
export interface RowLayout {
  rows: RowBox[];
  /** Group heading baselines (bar: lane-class headings; range: scenario headings). */
  headings: { label: string; y: number }[];
  /** Plot area in CSS px. */
  plot: { x0: number; x1: number; y0: number; y1: number };
  height: number;
  axis: { max: number; ticks: number[] };
  /** Label column on the left; false = labels above the bars (narrow). */
  labelsLeft: boolean;
}

/** Shared geometry constants (CSS px); exported for tests. */
export const LAYOUT = {
  pad: 4,
  /** Width below which labels move above the bars. */
  narrow: 520,
  labelWidth: 168,
  /** Room right of the plot for the value label. */
  valueWidth: 64,
  row: 30,
  rowNarrow: 42,
  heading: 28,
  groupGap: 14,
  axis: 26,
} as const;

/**
 * Rows for bar and range charts: one heading per group (when there is more than one group or the
 * group has a label), rows sorted best-first for bars, source order for ranges.
 */
export function rowLayout(spec: BarChartSpec | RangeChartSpec, width: number): RowLayout {
  const labelsLeft = width >= LAYOUT.narrow;
  const rowH = labelsLeft ? LAYOUT.row : LAYOUT.rowNarrow;
  const x0 = labelsLeft ? LAYOUT.labelWidth : LAYOUT.pad;
  const x1 = Math.max(x0 + 40, width - LAYOUT.valueWidth);
  const axis = niceAxis(extent(spec.groups), width < LAYOUT.narrow ? 4 : 5);
  const rows: RowBox[] = [];
  const headings: { label: string; y: number }[] = [];
  let y = LAYOUT.pad;
  spec.groups.forEach((group, g) => {
    if (g > 0) y += LAYOUT.groupGap;
    if (group.label) {
      headings.push({ label: group.label, y: y + LAYOUT.heading - 10 });
      y += LAYOUT.heading;
    }
    const points = spec.kind === "bar" ? sorted(group.points, spec.better) : group.points;
    for (const point of points) {
      rows.push({ group: g, point, y, h: rowH });
      y += rowH;
    }
  });
  const y1 = y;
  return { rows, headings, plot: { x0, x1, y0: LAYOUT.pad, y1 }, height: y1 + LAYOUT.axis, axis, labelsLeft };
}

/** Rivet's advantage over a reference: reference / rivet for lower-is-better, rivet / reference otherwise. */
export function advantage(rivet: number, reference: number, better: "lower" | "higher"): number {
  return better === "lower" ? reference / rivet : rivet / reference;
}

/** Easing for the entrance animation (ease-out cubic). */
export const easeOut = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;

/** Index of the row under `y` (CSS px), or -1. */
export function hitRow(layout: RowLayout, y: number): number {
  return layout.rows.findIndex((row) => y >= row.y && y < row.y + row.h);
}

/**
 * One metric of a `BenchProof` (homepage tabs): a headline that states the result, a plain subline, and
 * one bar per framework (no ranges: the benchmarks page shows those). `verdict` comes from the report.
 */
export interface ProofMetric {
  id: string;
  /** Segmented-control label ("Server render"). */
  tab: string;
  /** The result in a few words ("1.86× less CPU than Razor"). */
  headline: string;
  /** What was measured, in one plain sentence. */
  subline: string;
  verdict: "win" | "tie" | "loss";
  unit: string;
  better: "lower" | "higher";
  digits: number;
  points: ChartPoint[];
  /** One provenance line ("Fair comparison, 2026-10-06 · 14-core Mac") + the report link. */
  source: { text: string; href: string };
}

/** Comparison grid: frameworks as columns, metrics as rows; `null` = not measured in that run. */
export interface ProofGrid {
  columns: { label: string; rivet?: boolean }[];
  rows: { label: string; unit: string; better: "lower" | "higher"; digits: number; cells: (number | null)[] }[];
  /** Row label → small qualifier ("same handlers and data"). */
  notes?: Record<string, string>;
  source: { text: string; href: string }[];
}

/** Index of the best measured cell of a grid row (`-1` when none). */
export function bestCell(cells: readonly (number | null)[], better: "lower" | "higher"): number {
  let best = -1;
  cells.forEach((value, i) => {
    if (value === null) return;
    const current = best < 0 ? null : cells[best]!;
    if (current === null || (better === "lower" ? value < current : value > current)) best = i;
  });
  return best;
}
