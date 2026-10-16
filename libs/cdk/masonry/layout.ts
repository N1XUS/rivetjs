// Rivet-authored (not a port): placement engine of `@rivetjs/cdk/masonry` (`Masonry` + `Bento`). Pure and DOM-free:
// the server, the measured client reflow, the virtualized `MasonryLayout` and the keyboard geometry all call it, so a
// placement computed on the server is the placement the browser shows (no reflow). Spec:
// `docs/design/specs/2026-10-11-masonry-design.md`.
// - Breakpoints are container widths (`columns` map or `minItemWidth`); every geometry value is linear in the column
//   width `w`, so the CSS emitted here is exact at any container width: one breakpoint = plain `calc()` over `100cqw`,
//   several = masked `max()` terms (the inactive breakpoints' terms are ≈ −1e9 px; see `gridVars`).
// - Masonry: shortest-column greedy (ties → lowest column) at a deterministic reference width per breakpoint.
// - Bento: `dense` = first fit in row-major order (CSS `grid-auto-flow: row dense`), `skyline` = lowest-then-leftmost
//   drop on the column skyline.

import { emptyGeometry, num, pruneTerms, type Geometry, type Rect } from "./geometry.ts";

export type Key = string | number;
export type { Geometry, Rect } from "./geometry.ts";
/** Column count: a number, or a container-width breakpoint map (`{ 0: 2, 640: 3, 1024: 4 }`, min width → columns). */
export type Columns = number | Readonly<Record<number, number>>;
/** A per-item value that may differ per breakpoint (`2`, or `{ 0: 1, 768: 2 }`: min container width → value). */
export type Responsive<T> = T | Readonly<Record<number, T>>;

export interface Breakpoint {
  /** Minimum container content width in px (the first is 0). */
  min: number;
  /** Column count from `min` on (justified rows: 1, the unit is the container width). */
  columns: number;
  /** `[column, row]` gaps in px from `min` on. */
  gap: [number, number];
}

/** A gap: one value or `[column, row]` px. */
export type Gap = number | readonly [number, number];

/** Default columns: 2 below 640 px, 3 below 1024 px, 4 above (container width). */
export const DEFAULT_COLUMNS: Readonly<Record<number, number>> = { 0: 2, 640: 3, 1024: 4 };

const toInt = (v: unknown, min: number) => Math.max(min, Math.floor(Number(v)) || min);

const isMap = (v: unknown): v is Readonly<Record<number, unknown>> => v != null && typeof v === "object" && !Array.isArray(v);

/** `gap` value → `[column, row]` px (default 16). */
export function gapPair(gap: Gap | null | undefined): [number, number] {
  if (gap == null) return [16, 16];
  if (typeof gap === "number") return [gap, gap];
  return [gap[0], gap[1]];
}

/** The gap at breakpoint `min` of a `gap` prop (a value, or a container-width map of values). */
export function gapAt(gap: Responsive<Gap> | null | undefined, min: number): [number, number] {
  return gapPair(isMap(gap) ? responsiveAt(gap as Readonly<Record<number, Gap>>, min, 16) : (gap as Gap | null | undefined));
}

/** Map keys (container widths) of a responsive prop. */
export const responsiveMins = (value: unknown): number[] =>
  isMap(value)
    ? Object.keys(value)
        .map((k) => Math.max(0, Math.round(Number(k))))
        .filter(Number.isFinite)
    : [];

/**
 * Extra container-width breakpoints of justified rows: inside a breakpoint every row scales with the width, so the
 * ranges are geometric with `hi / lo ≤ (1 + tolerance) / (1 − tolerance)` (from 320 px; 0.25 → 533, 889, 1481, 2469):
 * a row decided at the middle of its range stays within the height tolerance anywhere in it. Up to `maxWidth` (the
 * grid never gets wider; fewer breakpoints = fewer CSS terms), else up to 4000 px.
 */
export function justifiedSplits(tolerance = 0.25, maxWidth?: number | null): number[] {
  const t = Math.min(0.9, Math.max(0.05, tolerance));
  const ratio = (1 + t) / (1 - t);
  const cap = maxWidth != null && maxWidth > 0 ? maxWidth : 4000;
  const out: number[] = [];
  for (let w = 320 * ratio; w < cap && out.length < 7; w *= ratio) out.push(Math.round(w));
  return out;
}

/** Breakpoints below `maxWidth` only (the grid is never wider): at least the first. */
export function capBreakpoints(breakpoints: readonly Breakpoint[], maxWidth: number): Breakpoint[] {
  const kept = breakpoints.filter((bp) => bp.min < maxWidth);
  return kept.length ? kept : [breakpoints[0]!];
}

/**
 * Sorted breakpoints from `columns` (default `DEFAULT_COLUMNS`) or from `minItemWidth` (n·m + (n−1)·gap ≤ width), with
 * the gap of each (`gap` may be a container-width map; its keys split breakpoints too, as do `splits`).
 */
export function resolveBreakpoints(
  columns?: Columns | null,
  minItemWidth?: number | null,
  maxColumns = 4,
  gap?: Responsive<Gap> | null,
  splits: readonly number[] = [],
): Breakpoint[] {
  const base: { min: number; columns: number }[] = [];
  if (minItemWidth != null && minItemWidth > 0 && columns == null) {
    const gx = gapAt(gap, 0)[0];
    base.push({ min: 0, columns: 1 });
    const max = toInt(maxColumns, 1);
    for (let n = 2; n <= max; n++) base.push({ min: Math.round(n * minItemWidth + (n - 1) * gx), columns: n });
  } else {
    const value = columns ?? DEFAULT_COLUMNS;
    if (typeof value === "number") base.push({ min: 0, columns: toInt(value, 1) });
    else
      for (const k of Object.keys(value)) {
        const min = Math.max(0, Math.round(Number(k)));
        if (Number.isFinite(min)) base.push({ min, columns: toInt((value as Record<string, number>)[k], 1) });
      }
  }
  base.sort((a, b) => a.min - b.min);
  if (!base.length) base.push({ min: 0, columns: 1 });
  base[0]!.min = 0;
  const mins = new Set<number>([0]);
  for (const b of base) mins.add(b.min);
  for (const m of responsiveMins(gap)) mins.add(m);
  for (const m of splits) if (Number.isFinite(m) && m >= 0) mins.add(Math.round(m));
  const forced = new Set<number>(splits.map((m) => Math.round(m)));
  const out: Breakpoint[] = [];
  for (const min of [...mins].sort((a, b) => a - b)) {
    let columnsAt = base[0]!.columns;
    for (const b of base) if (b.min <= min) columnsAt = b.columns;
    const g = gapAt(gap, min);
    const last = out[out.length - 1];
    if (last && !forced.has(min) && last.columns === columnsAt && last.gap[0] === g[0] && last.gap[1] === g[1]) continue;
    out.push({ min, columns: columnsAt, gap: g });
  }
  return out;
}

/**
 * `sizes` attribute for a masonry image (`?image` srcset): the column width per breakpoint. Breakpoints are container
 * widths; `sizes` media queries are viewport widths, so the container is described relative to the viewport:
 * container = `min(100vw − inset, maxWidth)` (`inset`: px of the viewport outside the grid — page padding, a sidebar;
 * `maxWidth`: the grid's `maxWidth`). A breakpoint at container width `min` then starts at viewport `min + inset`;
 * from viewport `maxWidth + inset` on, every width is a constant. `span` = columns the image covers (number or
 * container-width map, e.g. a live span's current value).
 */
export function masonrySizes(
  options: {
    columns?: Columns | null;
    minItemWidth?: number | null;
    maxColumns?: number;
    gap?: Responsive<Gap> | null;
    span?: Responsive<number> | null;
    inset?: number;
    maxWidth?: number | null;
  } = {},
): string {
  const inset = Math.max(0, options.inset ?? 0);
  const maxWidth = options.maxWidth != null && options.maxWidth > 0 ? options.maxWidth : null;
  let bps = resolveBreakpoints(options.columns, options.minItemWidth, options.maxColumns ?? 4, options.gap);
  if (maxWidth) bps = capBreakpoints(bps, maxWidth);
  const container = inset ? `100vw - ${num(inset)}px` : "100vw";
  const round = (v: number) => Math.round(v * 1e4) / 1e4;
  // Column width of `n` spanned columns at container width x: k·x + c.
  const terms = (bp: Breakpoint): [number, number] => {
    const n = Math.min(Math.max(1, Math.floor(responsiveAt(options.span, bp.min, 1))), bp.columns);
    const gx = bp.gap[0];
    const k = n / bp.columns;
    return [k, gx * (n - 1) - k * (bp.columns - 1) * gx];
  };
  const width = (bp: Breakpoint) => {
    const [k, c] = terms(bp);
    if (k === 1 && Math.abs(c) < 1e-9) return inset ? `calc(${container})` : container;
    return `calc((${container}) * ${round(k)}${c < 0 ? " - " : " + "}${round(Math.abs(c))}px)`;
  };
  const out: string[] = [];
  if (maxWidth) {
    const [k, c] = terms(bps[bps.length - 1]!);
    out.push(`(min-width: ${num(maxWidth + inset)}px) ${round(k * maxWidth + c)}px`);
  }
  for (let b = bps.length - 1; b > 0; b--) out.push(`(min-width: ${num(bps[b]!.min + inset)}px) ${width(bps[b]!)}`);
  out.push(width(bps[0]!));
  return out.join(", ");
}

/** Index of the breakpoint active at container width `width`. */
export function breakpointAt(breakpoints: readonly Breakpoint[], width: number): number {
  let i = 0;
  while (i + 1 < breakpoints.length && width >= breakpoints[i + 1]!.min) i++;
  return i;
}

/** A per-item responsive value at breakpoint `min` (the largest map key ≤ `min`; a plain value everywhere). */
export function responsiveAt<T>(value: Responsive<T> | null | undefined, min: number, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "object") return value as T;
  let best = -1;
  let out = fallback;
  for (const k in value as Record<string, T>) {
    const m = Number(k);
    if (m <= min && m > best) {
      best = m;
      out = (value as Record<string, T>)[k]!;
    }
  }
  return out;
}

/** Column width at container width `width`. */
export const columnWidth = (width: number, columns: number, gapX: number) => (width - (columns - 1) * gapX) / columns;

/**
 * Deterministic container width the greedy compares columns at, per breakpoint: the middle of its range (from
 * max(min, 320) to the next breakpoint, or +25 % for the last). `override` replaces it for every breakpoint.
 */
export function referenceWidths(breakpoints: readonly Breakpoint[], override?: number | null, maxWidth?: number | null): number[] {
  return breakpoints.map((b, i) => {
    if (override != null && override > 0) return override;
    const lo = Math.max(b.min, 320);
    const next = breakpoints[i + 1];
    // The last range ends at `maxWidth` when the grid is capped.
    const hi = next ? Math.max(next.min, lo) : maxWidth != null && maxWidth > lo ? maxWidth : lo * 1.25;
    return (lo + hi) / 2;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Masonry greedy
// ---------------------------------------------------------------------------------------------------------------

/** Placement of `count` items in `columns` columns: item i is in column `col[i]` at `top = a[i]·w + b[i]` px. */
export interface MasonryPlacement {
  columns: number;
  col: Uint16Array;
  a: Float64Array;
  b: Float64Array;
  /** Per column: Σα and Σ(β + gapY) of its items (height = colA·w + colB − gapY when non-empty). */
  colA: Float64Array;
  colB: Float64Array;
  colCount: Uint32Array;
}

/**
 * Shortest-column greedy. Item i is `alpha[i]·w + beta[i]` px tall (exact: α = 1 / aspect ratio, β = extra px;
 * measured: α = 0, β = height). Columns compare at column width `refW` (ties → the lowest column).
 */
export function placeMasonry(alpha: ArrayLike<number>, beta: ArrayLike<number>, columns: number, refW: number, gapY: number): MasonryPlacement {
  const count = alpha.length;
  const n = Math.max(1, columns | 0);
  const col = new Uint16Array(count);
  const a = new Float64Array(count);
  const b = new Float64Array(count);
  const colA = new Float64Array(n);
  const colB = new Float64Array(n);
  const colCount = new Uint32Array(n);
  for (let i = 0; i < count; i++) {
    let best = 0;
    let bestH = colA[0]! * refW + colB[0]!;
    for (let c = 1; c < n; c++) {
      const h = colA[c]! * refW + colB[c]!;
      if (h < bestH - 1e-7) {
        best = c;
        bestH = h;
      }
    }
    col[i] = best;
    a[i] = colA[best]!;
    b[i] = colB[best]!;
    colA[best]! += alpha[i]!;
    colB[best]! += beta[i]! + gapY;
    colCount[best]!++;
  }
  return { columns: n, col, a, b, colA, colB, colCount };
}

// ---------------------------------------------------------------------------------------------------------------
// Masonry columns with spans (general placer → Geometry)
// ---------------------------------------------------------------------------------------------------------------

/** Items of a columns placement: height `alpha·width + beta` px (width = the item's span width), column span. */
export interface ColumnsInput {
  alpha: ArrayLike<number>;
  beta: ArrayLike<number>;
  /** Columns each item spans (default 1; clamped to the column count). */
  span?: ArrayLike<number> | null;
}

/** Column state: per column the terms of its bottom (+ the row gap: the top of its next item). */
interface ColumnsState {
  bottoms: number[][];
  count: Uint32Array;
  last: Int32Array;
}

/** A columns placement (one breakpoint) and what an incremental re-place needs. */
export interface ColumnsRun {
  geometry: Geometry;
  /** First column of item i, and its span. */
  col: Uint16Array;
  span: Uint16Array;
  columns: number;
  /** State before item `j · CHECKPOINT` (incremental re-place resumes from the nearest one). */
  checkpoints: ColumnsState[];
  /** Final state. */
  state: ColumnsState;
}

/** Items between incremental checkpoints. */
export const CHECKPOINT = 32;

const cloneState = (s: ColumnsState): ColumnsState => ({ bottoms: s.bottoms.map((b) => b.slice()), count: s.count.slice(), last: s.last.slice() });

/**
 * Shortest-column greedy with column spans, in linear terms of the column width `u` (see `./geometry.ts`). Columns
 * compare at `refW` (ties → the leftmost); an item spanning s columns goes where the highest of its s columns is the
 * lowest, its top is the max of their bottoms (term set, pruned over `u ∈ [lo, hi]`), so it never overlaps at any
 * width of the range. One-column items keep one term (the PR-1 `placeMasonry` picture). `resume` re-places from item
 * `from` on (same columns / widths / gaps; the result equals a full placement: `masonry-layout.test.ts`).
 */
export function placeColumns(
  input: ColumnsInput,
  columns: number,
  refW: number,
  lo: number,
  hi: number,
  gapX: number,
  gapY: number,
  resume?: { run: ColumnsRun; from: number } | null,
): ColumnsRun {
  const count = input.alpha.length;
  const n = Math.max(1, columns | 0);
  const g = emptyGeometry(count);
  const col = new Uint16Array(count);
  const span = new Uint16Array(count);
  let topMore: (Float64Array | null)[] | null = null;
  const checkpoints: ColumnsState[] = [];
  let state: ColumnsState;
  let start = 0;
  const prev = resume?.run;
  if (prev && prev.columns === n && resume!.from > 0 && prev.checkpoints.length) {
    const cp = Math.min(Math.floor(Math.min(resume!.from, prev.geometry.count, count) / CHECKPOINT), prev.checkpoints.length - 1);
    start = cp * CHECKPOINT;
    state = cloneState(prev.checkpoints[cp]!);
    for (let j = 0; j <= cp; j++) checkpoints.push(prev.checkpoints[j]!);
    const pg = prev.geometry;
    g.x.set(pg.x.subarray(0, start * 2));
    g.width.set(pg.width.subarray(0, start * 2));
    g.height.set(pg.height.subarray(0, start * 2));
    g.top.set(pg.top.subarray(0, start * 2));
    g.ratio.set(pg.ratio.subarray(0, start));
    col.set(prev.col.subarray(0, start));
    span.set(prev.span.subarray(0, start));
    if (pg.topMore) {
      topMore = new Array(count).fill(null);
      for (let i = 0; i < start; i++) topMore[i] = pg.topMore[i] ?? null;
    }
  } else {
    state = { bottoms: Array.from({ length: n }, () => [0, 0]), count: new Uint32Array(n), last: new Int32Array(n).fill(-1) };
  }
  const value = new Float64Array(n);
  for (let i = start; i < count; i++) {
    if (i % CHECKPOINT === 0 && checkpoints.length === i / CHECKPOINT) checkpoints.push(cloneState(state));
    for (let c = 0; c < n; c++) {
      const terms = state.bottoms[c]!;
      let v = terms[0]! * refW + terms[1]!;
      for (let t = 2; t < terms.length; t += 2) v = Math.max(v, terms[t]! * refW + terms[t + 1]!);
      value[c] = v;
    }
    const s = Math.min(n, Math.max(1, Math.floor(Number(input.span?.[i] ?? 1)) || 1));
    let best = 0;
    let bestH = Infinity;
    for (let x = 0; x + s <= n; x++) {
      let h = value[x]!;
      for (let c = x + 1; c < x + s; c++) if (value[c]! > h) h = value[c]!;
      if (h < bestH - 1e-7) {
        best = x;
        bestH = h;
      }
    }
    let top: number[];
    if (s === 1) top = state.bottoms[best]!;
    else {
      const all: number[] = [];
      for (let c = best; c < best + s; c++) all.push(...state.bottoms[c]!);
      top = pruneTerms(all, lo, hi);
    }
    const alpha = Number(input.alpha[i]) || 0;
    const beta = Number(input.beta[i]) || 0;
    const hk = alpha * s;
    const hc = alpha * (s - 1) * gapX + beta;
    col[i] = best;
    span[i] = s;
    g.x[2 * i] = best;
    g.x[2 * i + 1] = best * gapX;
    g.width[2 * i] = s;
    g.width[2 * i + 1] = (s - 1) * gapX;
    g.height[2 * i] = hk;
    g.height[2 * i + 1] = hc;
    g.top[2 * i] = top[0]!;
    g.top[2 * i + 1] = top[1]!;
    if (top.length > 2) (topMore ??= new Array(count).fill(null))[i] = Float64Array.from(top.slice(2));
    else if (topMore) topMore[i] = null;
    g.ratio[i] = alpha > 0 && beta === 0 ? 1 / alpha : 0;
    const bottom: number[] = new Array(top.length);
    for (let t = 0; t < top.length; t += 2) {
      bottom[t] = top[t]! + hk;
      bottom[t + 1] = top[t + 1]! + hc + gapY;
    }
    for (let c = best; c < best + s; c++) {
      state.bottoms[c] = bottom;
      state.count[c]!++;
      state.last[c] = i;
    }
  }
  g.topMore = topMore;
  const ext: number[] = [];
  for (let c = 0; c < n; c++) {
    if (!state.count[c]) continue;
    const b = state.bottoms[c]!;
    for (let t = 0; t < b.length; t += 2) ext.push(b[t]!, b[t + 1]! - gapY);
  }
  g.extent = Float64Array.from(pruneTerms(ext, lo, hi));
  return { geometry: g, col, span, columns: n, checkpoints, state };
}

/**
 * `fit="both"`: stretch the last item of every column down to the content bottom (the tallest column), so the grid
 * ends flush; images inside fill with `object-fit: cover`. Items whose top is a term set (under a spanning item) or
 * that span columns keep their height. Returns a new geometry (the run's stays reusable for incremental re-places).
 */
export function fitColumns(run: ColumnsRun, lo: number, hi: number): Geometry {
  const src = run.geometry;
  const g: Geometry = { ...src, height: src.height.slice(), ratio: src.ratio.slice(), heightMore: new Array(src.count).fill(null) };
  const done = new Set<number>();
  for (let c = 0; c < run.columns; c++) {
    const i = run.state.last[c]!;
    if (i < 0 || done.has(i)) continue;
    done.add(i);
    if (run.span[i] !== 1 || src.topMore?.[i]) continue;
    const tk = src.top[2 * i]!;
    const tc = src.top[2 * i + 1]!;
    const terms: number[] = [src.height[2 * i]!, src.height[2 * i + 1]!];
    for (let t = 0; t < src.extent.length; t += 2) terms.push(src.extent[t]! - tk, src.extent[t + 1]! - tc);
    const kept = pruneTerms(terms, lo, hi);
    g.height[2 * i] = kept[0]!;
    g.height[2 * i + 1] = kept[1]!;
    g.heightMore![i] = kept.length > 2 ? Float64Array.from(kept.slice(2)) : null;
    g.ratio[i] = 0;
  }
  return g;
}

/**
 * Numeric shortest-column greedy with spans at one column width `w` (measured items, virtualized layout): item i is
 * `heights[i]` px tall and spans `spans[i]` columns; columns start at `initial` (px tops of the next item per column,
 * e.g. under a server-placed prefix). Returns start-edge x, top y, width per item and the content height.
 */
export function placeNumeric(
  heights: ArrayLike<number>,
  spans: ArrayLike<number> | null,
  columns: number,
  w: number,
  gapX: number,
  gapY: number,
  initial?: ArrayLike<number> | null,
): { x: Float64Array; y: Float64Array; width: Float64Array; height: number; bottoms: Float64Array } {
  const count = heights.length;
  const n = Math.max(1, columns | 0);
  const bottoms = new Float64Array(n);
  const used = new Uint8Array(n);
  if (initial)
    for (let c = 0; c < n; c++) {
      bottoms[c] = Number(initial[c]) || 0;
      if (bottoms[c]! > 0) used[c] = 1;
    }
  const x = new Float64Array(count);
  const y = new Float64Array(count);
  const width = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const s = Math.min(n, Math.max(1, Math.floor(Number(spans?.[i] ?? 1)) || 1));
    let best = 0;
    let bestH = Infinity;
    for (let c = 0; c + s <= n; c++) {
      let h = bottoms[c]!;
      for (let k = c + 1; k < c + s; k++) if (bottoms[k]! > h) h = bottoms[k]!;
      if (h < bestH - 1e-7) {
        best = c;
        bestH = h;
      }
    }
    x[i] = best * (w + gapX);
    y[i] = bestH;
    width[i] = s * w + (s - 1) * gapX;
    for (let c = best; c < best + s; c++) {
      bottoms[c] = bestH + heights[i]! + gapY;
      used[c] = 1;
    }
  }
  let height = 0;
  for (let c = 0; c < n; c++) if (used[c]) height = Math.max(height, bottoms[c]! - gapY);
  return { x, y, width, height, bottoms };
}

/** Column-width range `[lo, hi]` of breakpoint b (the last one: up to a 100 000 px container). */
export function unitRange(breakpoints: readonly Breakpoint[], b: number, maxWidth?: number | null): [number, number] {
  const bp = breakpoints[b]!;
  const next = breakpoints[b + 1];
  const gx = bp.gap[0];
  return [columnWidth(bp.min, bp.columns, gx), columnWidth(next ? next.min : maxWidth != null && maxWidth > 0 ? maxWidth : 1e5, bp.columns, gx)];
}

/** Content height of a placement at column width `w`. */
export function masonryHeight(p: MasonryPlacement, w: number, gapY: number): number {
  let h = 0;
  for (let c = 0; c < p.columns; c++) if (p.colCount[c]) h = Math.max(h, p.colA[c]! * w + p.colB[c]! - gapY);
  return h;
}

/** Pixel rects (LTR, x from the start edge) of a placement at container width `width`. */
export function masonryRects(p: MasonryPlacement, alpha: ArrayLike<number>, beta: ArrayLike<number>, width: number, gapX: number): Rect[] {
  const w = columnWidth(width, p.columns, gapX);
  const out: Rect[] = new Array(p.col.length);
  for (let i = 0; i < p.col.length; i++) out[i] = { x: p.col[i]! * (w + gapX), y: p.a[i]! * w + p.b[i]!, width: w, height: alpha[i]! * w + beta[i]! };
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Bento packers
// ---------------------------------------------------------------------------------------------------------------

export type BentoPack = "dense" | "skyline";

/** Cell placement of `count` tiles (0-based row / column, spans clamped to the column count). */
export interface BentoPlacement {
  columns: number;
  row: Uint32Array;
  col: Uint16Array;
  rowSpan: Uint16Array;
  colSpan: Uint16Array;
  /** Rows used. */
  rows: number;
}

/** Packs tiles of `colSpans[i]` × `rowSpans[i]` cells into `columns` columns. */
export function packBento(colSpans: ArrayLike<number>, rowSpans: ArrayLike<number>, columns: number, pack: BentoPack = "dense"): BentoPlacement {
  const count = colSpans.length;
  const n = Math.max(1, columns | 0);
  const row = new Uint32Array(count);
  const col = new Uint16Array(count);
  const rs = new Uint16Array(count);
  const cs = new Uint16Array(count);
  let rows = 0;
  if (pack === "skyline") {
    const sky = new Uint32Array(n);
    for (let i = 0; i < count; i++) {
      const w = Math.min(n, toInt(colSpans[i], 1));
      const h = toInt(rowSpans[i], 1);
      let bestX = 0;
      let bestY = Infinity;
      for (let x = 0; x + w <= n; x++) {
        let y = 0;
        for (let k = x; k < x + w; k++) if (sky[k]! > y) y = sky[k]!;
        if (y < bestY) {
          bestY = y;
          bestX = x;
        }
      }
      for (let k = bestX; k < bestX + w; k++) sky[k] = bestY + h;
      row[i] = bestY;
      col[i] = bestX;
      rs[i] = h;
      cs[i] = w;
      if (bestY + h > rows) rows = bestY + h;
    }
    return { columns: n, row, col, rowSpan: rs, colSpan: cs, rows };
  }
  // Dense: occupancy rows (one Uint8Array per row), first fit scanning row-major from the first row with a free cell.
  const grid: Uint8Array[] = [];
  const free: number[] = []; // free cells per row
  let first = 0;
  const ensure = (r: number) => {
    while (grid.length <= r) {
      grid.push(new Uint8Array(n));
      free.push(n);
    }
  };
  for (let i = 0; i < count; i++) {
    const w = Math.min(n, toInt(colSpans[i], 1));
    const h = toInt(rowSpans[i], 1);
    while (first < grid.length && free[first] === 0) first++;
    let placed = false;
    for (let r = first; !placed; r++) {
      ensure(r + h - 1);
      if (free[r]! < w) continue;
      for (let c = 0; c + w <= n; c++) {
        let fits = true;
        for (let rr = r; rr < r + h && fits; rr++) {
          const line = grid[rr]!;
          for (let cc = c; cc < c + w; cc++)
            if (line[cc]) {
              fits = false;
              break;
            }
        }
        if (!fits) continue;
        for (let rr = r; rr < r + h; rr++) {
          const line = grid[rr]!;
          for (let cc = c; cc < c + w; cc++) line[cc] = 1;
          free[rr]! -= w;
        }
        row[i] = r;
        col[i] = c;
        rs[i] = h;
        cs[i] = w;
        if (r + h > rows) rows = r + h;
        placed = true;
        break;
      }
    }
  }
  return { columns: n, row, col, rowSpan: rs, colSpan: cs, rows };
}

// ---------------------------------------------------------------------------------------------------------------
// CSS (inline, exact at any container width)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Custom properties of the grid element: `--rv-w<b>` (column width of breakpoint b; masked to ≈ −1e9 px outside its
 * range when there are several), `--rv-m<b>` (the mask alone: 0 inside, ≈ 1e9 px outside), `--rv-mw` (the active
 * column width). `100cqw` resolves against the root (an `inline-size` container) wherever the variables are used.
 */
/**
 * Registers the grid custom properties as inherited `<length>`s (client, once per name): the grid then computes each
 * masked width once and items inherit a plain length, instead of re-parsing the clamp() token stream per item (~3×
 * faster style recalc for 1k items, measured). Layout is identical without it; `@rivetjs/cdk/masonry.css` declares the
 * same names with `@property` for server-rendered pages before any script runs. No-op on the server.
 */
export function registerGridProperties(count: number): void {
  const css = (globalThis as { CSS?: { registerProperty?: (definition: object) => void } }).CSS;
  if (!css?.registerProperty) return;
  const names = ["--rv-mw", "--rv-gx"];
  for (let b = 0; b < count; b++) names.push(`--rv-m${b}`, `--rv-w${b}`);
  for (const name of names) {
    if (registered.has(name)) continue;
    registered.add(name);
    try {
      css.registerProperty({ name, syntax: "<length>", inherits: true, initialValue: "0px" });
    } catch {
      // Already registered (another copy of this module, or the page did it).
    }
  }
}
const registered = new Set<string>();

export function gridVars(breakpoints: readonly Breakpoint[]): Record<string, string> {
  const vars: Record<string, string> = {};
  const single = breakpoints.length === 1;
  const ws: string[] = [];
  const gaps: string[] = [];
  const sameGap = breakpoints.every((bp) => bp.gap[0] === breakpoints[0]!.gap[0]);
  breakpoints.forEach((bp, i) => {
    const n = bp.columns;
    const gx = bp.gap[0];
    const width = n === 1 ? "100cqw" : `(100cqw - ${num((n - 1) * gx)}px) / ${n}`;
    if (single) {
      vars["--rv-w0"] = `calc(${width})`;
      ws.push("var(--rv-w0)");
      return;
    }
    const next = breakpoints[i + 1];
    const parts: string[] = [];
    if (i > 0) parts.push(`clamp(0px, (${bp.min}px - 100cqw) * 1e9, 1e9px)`);
    if (next) parts.push(`clamp(0px, (100cqw - ${next.min}px + 0.01px) * 1e9, 1e9px)`);
    vars[`--rv-m${i}`] = parts.length === 1 ? parts[0]! : `calc(${parts.join(" + ")})`;
    vars[`--rv-w${i}`] = `calc(${width} - var(--rv-m${i}))`;
    ws.push(`var(--rv-w${i})`);
    gaps.push(`calc(${num(gx)}px - var(--rv-m${i}))`);
  });
  vars["--rv-mw"] = single ? ws[0]! : `max(${ws.join(", ")})`;
  // Active column gap (measured columns / spans) when it differs per breakpoint.
  if (!single && !sameGap) vars["--rv-gx"] = `max(${gaps.join(", ")})`;
  return vars;
}

/** The active column gap as CSS (a px value, or `var(--rv-gx)` when it differs per breakpoint). */
export const columnGapCss = (breakpoints: readonly Breakpoint[]): string =>
  breakpoints.length > 1 && !breakpoints.every((bp) => bp.gap[0] === breakpoints[0]!.gap[0]) ? "var(--rv-gx)" : `${num(breakpoints[0]!.gap[0])}px`;

/** Bento row height: px, or `w / aspectRatio`. */
export type BentoRowHeight = number | { aspectRatio: number } | "auto";

/** `rows` rows (with the gaps between them) as `k·w + c`. */
function rowsExtent(rows: number, rowHeight: number | { aspectRatio: number }, gapY: number): [number, number] {
  if (typeof rowHeight === "number") return [0, rows * rowHeight + Math.max(0, rows - 1) * gapY];
  return [rows / rowHeight.aspectRatio, Math.max(0, rows - 1) * gapY];
}

/** Geometry of a bento placement (unit = the column width; `rowHeight` px or `{ aspectRatio }` of the column width). */
export function bentoGeometry(p: BentoPlacement, rowHeight: number | { aspectRatio: number }, gapX: number, gapY: number): Geometry {
  const n = p.row.length;
  const g = emptyGeometry(n);
  for (let i = 0; i < n; i++) {
    const r = p.row[i]!;
    const c = p.col[i]!;
    const [tk, tc] = rowsExtent(r, rowHeight, gapY);
    g.top[2 * i] = r === 0 ? 0 : tk;
    g.top[2 * i + 1] = r === 0 ? 0 : tc + gapY;
    g.x[2 * i] = c;
    g.x[2 * i + 1] = c * gapX;
    const cs = p.colSpan[i]!;
    g.width[2 * i] = cs;
    g.width[2 * i + 1] = (cs - 1) * gapX;
    const [hk, hc] = rowsExtent(p.rowSpan[i]!, rowHeight, gapY);
    g.height[2 * i] = hk;
    g.height[2 * i + 1] = hc;
  }
  const [ek, ec] = rowsExtent(p.rows, rowHeight, gapY);
  g.extent = p.rows ? Float64Array.of(ek, ec) : new Float64Array(0);
  return g;
}

/** Bento pixel rects at container width `width` (for keyboard geometry / tests). */
export function bentoRects(p: BentoPlacement, rowHeight: number | { aspectRatio: number }, width: number, gapX: number, gapY: number): Rect[] {
  const w = columnWidth(width, p.columns, gapX);
  const rh = typeof rowHeight === "number" ? rowHeight : w / rowHeight.aspectRatio;
  const out: Rect[] = new Array(p.row.length);
  for (let i = 0; i < p.row.length; i++)
    out[i] = {
      x: p.col[i]! * (w + gapX),
      y: p.row[i]! * (rh + gapY),
      width: p.colSpan[i]! * w + (p.colSpan[i]! - 1) * gapX,
      height: p.rowSpan[i]! * rh + (p.rowSpan[i]! - 1) * gapY,
    };
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Item data
// ---------------------------------------------------------------------------------------------------------------

/** Aspect ratio (width / height) from an item's `aspectRatio`, else `width / height`; `null` when unknown. */
export function defaultAspectRatio(item: unknown): number | null {
  const o = item as { aspectRatio?: unknown; width?: unknown; height?: unknown } | null;
  if (o == null || typeof o !== "object") return null;
  if (typeof o.aspectRatio === "number") return o.aspectRatio;
  if (typeof o.width === "number" && typeof o.height === "number" && o.height > 0) return o.width / o.height;
  return null;
}

/** Fixed px height of an item without a ratio: `item.height` when it has neither `width` nor `aspectRatio`. */
export function defaultItemHeight(item: unknown): number | null {
  const o = item as { aspectRatio?: unknown; width?: unknown; height?: unknown } | null;
  if (o == null || typeof o !== "object" || typeof o.aspectRatio === "number" || typeof o.width === "number") return null;
  return typeof o.height === "number" ? o.height : null;
}

/** Column span (justified: width weight) from an item's `span`. */
export const defaultSpan = (item: unknown): Responsive<number> => (item as { span?: Responsive<number> } | null)?.span ?? 1;

/** A usable ratio (finite, > 0) or null. */
export const validRatio = (r: unknown): number | null => (typeof r === "number" && Number.isFinite(r) && r > 0 ? r : null);

/** Item key: `id`, else `key`, else the index. */
export function defaultItemKey(item: unknown, index: number): Key {
  const o = item as { id?: Key; key?: Key } | null;
  return o?.id ?? o?.key ?? index;
}

/** Column / row spans from an item's `colSpan` / `rowSpan`. */
export const defaultColSpan = (item: unknown): Responsive<number> => (item as { colSpan?: Responsive<number> } | null)?.colSpan ?? 1;
export const defaultRowSpan = (item: unknown): Responsive<number> => (item as { rowSpan?: Responsive<number> } | null)?.rowSpan ?? 1;

/** `gap` prop → `[column, row]` px at the smallest breakpoint. */
export const gapOf = (gap: Responsive<Gap> | null | undefined): [number, number] => gapAt(gap, 0);
