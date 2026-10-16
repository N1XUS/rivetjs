// Ported from flickr/justified-layout (lib/row.js, lib/index.js, v4.1.0), MIT, Copyright 2019 SmugMug, Inc.
// Rivet:
// - the row packing (`Row.addItem`: min / max aspect ratio window from `targetRowHeight` ± tolerance, the pano special
//   case, accept-or-reject by distance to the target; `completeLayout`: edge-case clamp to [min, max] row height with
//   widths kept at the natural height; widows completed at the previous row's height with `widowLayoutStyle`
//   left / justify / center; center = the row centred in the width) runs at a reference container width and decides the rows; the geometry is then written
//   as LINEAR terms of the container width W (`./geometry.ts`): a justified row of k items with aspect sum A has height
//   (W − (k − 1)·gap) / A, so the server CSS fills the width exactly at any W of the breakpoint (no pixel rounding,
//   upstream's integer error distribution is unnecessary); a row clamped at the reference width keeps the clamped
//   height (constant) and its natural widths (items crop with `object-fit: cover`, as upstream);
// - `lastRow: "fill"` (Rivet, the default) rebalances the widow row with the row before it (best split of their items
//   into one or two justified rows, nearest to the target height, rows inside [minRowHeight, maxRowHeight]) so the
//   bottom edge is flush and every row fills the width; when no such arrangement exists (a lone portrait, a short
//   list) the widow stays `left` (upstream default); `"justify"` / `"left"` / `"center"` = upstream `widowLayoutStyle`
//   (at the previous row's height); a widow wider than the width at that height becomes a justified row (Deviation:
//   upstream lets it overflow);
// - not ported: `containerPadding` (the grid has none), `maxNumRows`, `forceAspectRatio`, `fullWidthBreakoutRowCadence`
//   (breakout rows), `showWidows: false`.
import { emptyGeometry, type Geometry } from "./geometry.ts";

export type JustifiedLastRow = "fill" | "justify" | "left" | "center";

export interface JustifiedOptions {
  /** Target row height in px (upstream `targetRowHeight`). */
  rowHeight: number;
  /** Row heights may vary ± rowHeight · tolerance (upstream `targetRowHeightTolerance`). Default 0.25. */
  tolerance?: number;
  /** Edge-case row height bounds (upstream `edgeCaseMinRowHeight` / `edgeCaseMaxRowHeight`). Default 0.5× / 2× `rowHeight`. */
  minRowHeight?: number;
  maxRowHeight?: number;
  /** `[column, row]` gaps (upstream `boxSpacing`). */
  gap: readonly [number, number];
  /** Last (widow) row. Default `"fill"`. */
  lastRow?: JustifiedLastRow;
}

/** A row decided at the reference width: item indices, natural (justify) or widow completion. */
export interface RowPlan {
  items: number[];
  /** `justify`: height = (W − (k − 1)·gap) / A, unless clamped at the reference width. `widow`: previous row's height. */
  kind: "justify" | "widow";
  style: "justify" | "left" | "center";
  clamped: number | null;
}

/** Row.addItem at width `width` (returns [accepted, completedHeight | null]). */
function addItem(row: number[], aspects: ArrayLike<number>, i: number, width: number, spacing: number, target: number, tolerance: number): [boolean, boolean] {
  const minAspectRatio = (width / target) * (1 - tolerance);
  const maxAspectRatio = (width / target) * (1 + tolerance);
  const count = row.length + 1;
  const rowWidthWithoutSpacing = width - (count - 1) * spacing;
  let newAspectRatio = aspects[i]!;
  for (const j of row) newAspectRatio += aspects[j]!;
  const targetAspectRatio = rowWidthWithoutSpacing / target;
  if (newAspectRatio < minAspectRatio) {
    row.push(i);
    return [true, false];
  }
  if (newAspectRatio > maxAspectRatio) {
    if (row.length === 0) {
      row.push(i);
      return [true, true];
    }
    const previousRowWidthWithoutSpacing = width - (row.length - 1) * spacing;
    const previousAspectRatio = newAspectRatio - aspects[i]!;
    const previousTargetAspectRatio = previousRowWidthWithoutSpacing / target;
    if (Math.abs(newAspectRatio - targetAspectRatio) > Math.abs(previousAspectRatio - previousTargetAspectRatio)) return [false, true];
    row.push(i);
    return [true, true];
  }
  row.push(i);
  return [true, true];
}

const sumOf = (items: readonly number[], aspects: ArrayLike<number>) => {
  let a = 0;
  for (const j of items) a += aspects[j]!;
  return a;
};

/**
 * Justified rows (Flickr / Google Photos style) of items with aspect ratios `aspects` (width / height; an item weight
 * multiplies it), decided at container width `refWidth`; geometry in terms of the container width (the breakpoint's
 * unit with one column).
 */
export function placeJustified(aspects: ArrayLike<number>, refWidth: number, options: JustifiedOptions): Geometry {
  return placeJustifiedRun(aspects, refWidth, options, null).geometry;
}

/** A justified placement plus its row plans (resumable: `placeJustifiedRun(…, { run, from })`). */
export interface JustifiedRun {
  geometry: Geometry;
  /** Rows closed by the greedy pass (before the last-row treatment). */
  closed: readonly RowPlan[];
  /** Final rows (after the last-row treatment). */
  rows: readonly RowPlan[];
  /** Per final row: top `[k, c]` and height `[k, c]` (linear in W). */
  rowTop: Float64Array;
  rowHeight: Float64Array;
}

/**
 * `placeJustified` with a checkpoint: when only items from index `from` on changed (same reference width + options),
 * the rows closed before the one holding `from` (and before the previous last closed row, which the last-row
 * treatment may rebalance) are kept with their geometry; the greedy pass restarts there. Equal to a full run.
 */
export function placeJustifiedRun(
  aspects: ArrayLike<number>,
  refWidth: number,
  options: JustifiedOptions,
  resume: { run: JustifiedRun; from: number } | null,
): JustifiedRun {
  const count = aspects.length;
  const target = Math.max(1, options.rowHeight);
  const tolerance = options.tolerance ?? 0.25;
  const minH = options.minRowHeight ?? 0.5 * target;
  const maxH = options.maxRowHeight ?? 2 * target;
  const [gapX, gapY] = options.gap;
  const lastRow = options.lastRow ?? "fill";
  const W = refWidth;
  const clampAt = (k: number, A: number): number | null => {
    const h = (W - (k - 1) * gapX) / A;
    const c = Math.max(minH, Math.min(h, maxH));
    return c !== h ? c : null;
  };

  const rowHeightAt = (row: RowPlan): number => row.clamped ?? (W - (row.items.length - 1) * gapX) / sumOf(row.items, aspects);
  // computeLayout: rows at the reference width.
  const rows: RowPlan[] = [];
  // Checkpoint: kept closed rows end before `from - 1` (a row closes on the item after it, so a change at `from` can
  // reopen the row ending at `from - 1`) and before the previous last closed row.
  let keep = 0;
  if (resume) {
    const prevClosed = resume.run.closed;
    const limit = Math.min(prevClosed.length - 1, resume.run.rows.length);
    while (keep < limit && prevClosed[keep]!.items[prevClosed[keep]!.items.length - 1]! + 1 < resume.from && prevClosed[keep] === resume.run.rows[keep]) keep++;
    for (let r = 0; r < keep; r++) rows.push(prevClosed[r]!);
  }
  const start = keep ? rows[keep - 1]!.items[rows[keep - 1]!.items.length - 1]! + 1 : 0;
  let current: number[] = [];
  const close = () => {
    rows.push({ items: current, kind: "justify", style: "justify", clamped: clampAt(current.length, sumOf(current, aspects)) });
    current = [];
  };
  for (let i = start; i < count; i++) {
    const [added, complete] = addItem(current, aspects, i, W, gapX, target, tolerance);
    if (complete) {
      close();
      if (!added) {
        const [, again] = addItem(current, aspects, i, W, gapX, target, tolerance);
        if (again) close();
      }
    }
  }
  const closed = rows.slice();
  if (current.length) {
    let filled = false;
    if (lastRow === "fill") {
      const prev = rows[rows.length - 1];
      const pool = prev ? [...prev.items, ...current] : current;
      // One row, or the best split into two, nearest to the target height (worst row of the two); only arrangements
      // whose rows stay inside [minRowHeight, maxRowHeight] (a clamped row would crop: then the widow stays `left`).
      const total = sumOf(pool, aspects);
      const inRange = (h: number) => h >= minH - 1e-9 && h <= maxH + 1e-9;
      const one = (W - (pool.length - 1) * gapX) / total;
      let bestCost = inRange(one) ? Math.abs(one - target) : Infinity;
      let split = pool.length;
      let left = 0;
      for (let m = 1; m < pool.length; m++) {
        left += aspects[pool[m - 1]!]!;
        const h1 = (W - (m - 1) * gapX) / left;
        const h2 = (W - (pool.length - m - 1) * gapX) / (total - left);
        if (!inRange(h1) || !inRange(h2)) continue;
        const cost = Math.max(Math.abs(h1 - target), Math.abs(h2 - target));
        if (cost < bestCost - 1e-9) {
          bestCost = cost;
          split = m;
        }
      }
      if (bestCost < Infinity) {
        if (prev) rows.pop();
        for (const items of split === pool.length ? [pool] : [pool.slice(0, split), pool.slice(split)])
          rows.push({ items, kind: "justify", style: "justify", clamped: null });
        filled = true;
      }
    }
    if (!filled) {
      // Widow at the previous row's height; one that would overflow the width at it becomes a justified row instead.
      const style = lastRow === "fill" ? "left" : lastRow;
      const prev = rows[rows.length - 1];
      const widowH = prev ? rowHeightAt(prev) : Math.max(minH, Math.min(target, maxH));
      const natural = sumOf(current, aspects) * widowH + (current.length - 1) * gapX;
      if (natural > W + 1e-6) rows.push({ items: current, kind: "justify", style: "justify", clamped: clampAt(current.length, sumOf(current, aspects)) });
      else rows.push({ items: current, kind: "widow", style, clamped: null });
    }
  }

  // Geometry: linear in W. Kept rows (still final and unchanged) copy their item geometry.
  const g = emptyGeometry(count);
  const rowTop = new Float64Array(rows.length * 2);
  const rowHeight = new Float64Array(rows.length * 2);
  let first = 0;
  if (resume) {
    const prev = resume.run;
    while (first < keep && rows[first] === prev.rows[first]) first++;
    if (first) {
      const end = rows[first - 1]!.items[rows[first - 1]!.items.length - 1]! + 1;
      const pg = prev.geometry;
      g.x.set(pg.x.subarray(0, 2 * end));
      g.width.set(pg.width.subarray(0, 2 * end));
      g.height.set(pg.height.subarray(0, 2 * end));
      g.top.set(pg.top.subarray(0, 2 * end));
      g.ratio.set(pg.ratio.subarray(0, end));
      rowTop.set(prev.rowTop.subarray(0, 2 * first));
      rowHeight.set(prev.rowHeight.subarray(0, 2 * first));
    }
  }
  let topK = 0;
  let topC = 0;
  let prevH: [number, number] = [0, target];
  if (first) {
    const r = first - 1;
    prevH = [rowHeight[2 * r]!, rowHeight[2 * r + 1]!];
    topK = rowTop[2 * r]! + prevH[0];
    topC = rowTop[2 * r + 1]! + prevH[1] + gapY;
  }
  for (let r = first; r < rows.length; r++) {
    const row = rows[r]!;
    const k = row.items.length;
    const A = sumOf(row.items, aspects);
    // Row height h = hk·W + hc; item widths a·(natural height) (+ the widow `justify` error share).
    let hk: number;
    let hc: number;
    let nk: number;
    let nc: number;
    if (row.kind === "justify") {
      nk = 1 / A;
      nc = (-(k - 1) * gapX) / A;
      if (row.clamped != null) [hk, hc] = [0, row.clamped];
      else [hk, hc] = [nk, nc];
    } else {
      // Widow at the previous row's height (upstream forceComplete(false, previous.height) / target height).
      [hk, hc] = r > 0 ? prevH : [0, Math.max(minH, Math.min(target, maxH))];
      [nk, nc] = [hk, hc];
    }
    // Width error per item for `justify` widows: (Σw + (k − 1)·gap − W) / k.
    const ek = row.kind === "widow" && row.style === "justify" ? (A * nk - 1) / k : 0;
    const ec = row.kind === "widow" && row.style === "justify" ? (A * nc + (k - 1) * gapX) / k : 0;
    // Centered widows: offset (W − (Σw + (k − 1)·gap)) / 2 (upstream adds its container padding to the same centre).
    const ok = row.kind === "widow" && row.style === "center" ? (1 - A * nk) / 2 : 0;
    const oc = row.kind === "widow" && row.style === "center" ? (-(A * nc) - (k - 1) * gapX) / 2 : 0;
    let xk = ok;
    let xc = oc;
    for (let j = 0; j < k; j++) {
      const i = row.items[j]!;
      const a = aspects[i]!;
      const wk = a * nk - ek;
      const wc = a * nc - ec;
      g.x[2 * i] = xk;
      g.x[2 * i + 1] = xc;
      g.width[2 * i] = wk;
      g.width[2 * i + 1] = wc;
      g.height[2 * i] = hk;
      g.height[2 * i + 1] = hc;
      g.top[2 * i] = topK;
      g.top[2 * i + 1] = topC;
      // Height = width / aspect exactly when the row is neither clamped nor a justified widow.
      g.ratio[i] = (row.kind === "justify" && row.clamped == null) || (row.kind === "widow" && row.style !== "justify") ? a : 0;
      xk += wk;
      xc += wc + gapX;
    }
    rowTop[2 * r] = topK;
    rowTop[2 * r + 1] = topC;
    rowHeight[2 * r] = hk;
    rowHeight[2 * r + 1] = hc;
    prevH = [hk, hc];
    topK += hk;
    topC += hc + (r < rows.length - 1 ? gapY : 0);
  }
  if (first && first === rows.length) topC -= gapY;
  g.extent = rows.length ? Float64Array.of(topK, topC) : new Float64Array(0);
  return { geometry: g, closed, rows, rowTop, rowHeight };
}
