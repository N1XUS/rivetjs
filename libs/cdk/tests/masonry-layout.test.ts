// Placement engine of `@rivetjs/cdk/masonry` (`masonry/layout.ts`, `geometry.ts`, `justified.ts`, pure): breakpoints
// (columns map, minItemWidth, per-breakpoint gaps), reference widths, shortest-column greedy (ties, determinism,
// measured heights), column spans (term sets: no overlap at any width of a breakpoint), incremental re-place = full
// place, fit="both" (flush bottoms), numeric greedy under a prefix, justified rows (upstream flickr/justified-layout
// test cases where they apply + every row fills the width at any width, flush bottom with lastRow="fill"), Bento dense
// = row-major first fit (backfills holes) vs skyline (no backfill), span clamping, CSS terms and the MasonryLayout
// virtual layout geometry (columns + justified). Fix round 1 (2026-10-12): masked negative slopes, fill fallback,
// tolerance splits + maxWidth, incremental justified == full, container-relative masonrySizes.
// The "justified rows" cases are ported from flickr/justified-layout v4.1.0 test/justified-layout.js (MIT, Copyright 2019
// SmugMug, Inc.; see libs/cdk/NOTICE), adapted to the linear geometry (no container padding: width − 20, offsets − 10).
import { describe, expect, it } from "vitest";
import { emptyGeometry, extentAt, geometryHeight, geometryStyle, pruneTerms, rectsAt, type Geometry } from "../masonry/geometry.ts";
import { placeJustified, placeJustifiedRun } from "../masonry/justified.ts";
import {
  CHECKPOINT,
  bentoGeometry,
  bentoRects,
  fitColumns,
  placeColumns,
  placeNumeric,
  unitRange,
  breakpointAt,
  columnWidth,
  defaultAspectRatio,
  defaultItemKey,
  gapOf,
  gridVars,
  masonrySizes,
  masonryHeight,
  masonryRects,
  packBento,
  placeMasonry,
  referenceWidths,
  resolveBreakpoints,
  responsiveAt,
  validRatio,
  justifiedSplits,
  capBreakpoints,
} from "../masonry/layout.ts";
import { MasonryLayout } from "../masonry/masonry-layout.ts";
import { VirtualizerEngine, createCollection, Rect, Size } from "../virtualizer/engine.ts";

describe("breakpoints", () => {
  it("resolves numbers, maps (sorted, first min 0, duplicates merged) and minItemWidth", () => {
    const g: [number, number] = [16, 16];
    expect(resolveBreakpoints(3)).toEqual([{ min: 0, columns: 3, gap: g }]);
    expect(resolveBreakpoints()).toEqual([
      { min: 0, columns: 2, gap: g },
      { min: 640, columns: 3, gap: g },
      { min: 1024, columns: 4, gap: g },
    ]);
    expect(resolveBreakpoints({ 1200: 5, 300: 2, 700: 2, 900: 3 })).toEqual([
      { min: 0, columns: 2, gap: g },
      { min: 900, columns: 3, gap: g },
      { min: 1200, columns: 5, gap: g },
    ]);
    expect(resolveBreakpoints(undefined, 200, 3, 10)).toEqual([
      { min: 0, columns: 1, gap: [10, 10] },
      { min: 410, columns: 2, gap: [10, 10] },
      { min: 620, columns: 3, gap: [10, 10] },
    ]);
    expect(resolveBreakpoints(0)).toEqual([{ min: 0, columns: 1, gap: g }]);
  });

  it("gap maps split breakpoints; splits force breakpoints with equal columns", () => {
    expect(resolveBreakpoints({ 0: 2, 800: 3 }, null, 4, { 0: 8, 500: [12, 20] })).toEqual([
      { min: 0, columns: 2, gap: [8, 8] },
      { min: 500, columns: 2, gap: [12, 20] },
      { min: 800, columns: 3, gap: [12, 20] },
    ]);
    expect(resolveBreakpoints(1, null, 1, 10, [0, 640, 1024]).map((b) => b.min)).toEqual([0, 640, 1024]);
    expect(gapOf({ 0: 4, 900: 9 })).toEqual([4, 4]);
  });

  it("finds the active breakpoint and responsive values", () => {
    const bps = resolveBreakpoints();
    expect(breakpointAt(bps, 0)).toBe(0);
    expect(breakpointAt(bps, 639.98)).toBe(0);
    expect(breakpointAt(bps, 640)).toBe(1);
    expect(breakpointAt(bps, 5000)).toBe(2);
    expect(responsiveAt({ 0: 1, 768: 2 }, 640, 9)).toBe(1);
    expect(responsiveAt({ 0: 1, 768: 2 }, 1024, 9)).toBe(2);
    expect(responsiveAt({ 500: 3 }, 0, 9)).toBe(9);
    expect(responsiveAt(4, 0, 9)).toBe(4);
  });

  it("reference widths sit inside each breakpoint range (override wins)", () => {
    expect(referenceWidths(resolveBreakpoints())).toEqual([480, 832, 1152]);
    expect(referenceWidths(resolveBreakpoints(), 1000)).toEqual([1000, 1000, 1000]);
  });
});

describe("masonry greedy", () => {
  it("places each item in the shortest column (ties → lowest index), tops = A·w + B", () => {
    // Ratios 1, 0.5, 1, 2: heights at w = 100 → 100, 200, 100, 50.
    const alpha = [1, 2, 1, 0.5];
    const p = placeMasonry(alpha, [0, 0, 0, 0], 2, 100, 10);
    // c: column 0 (110 < 210) → 220; d: column 1 (210 < 220).
    expect([...p.col]).toEqual([0, 1, 0, 1]);
    expect([...p.a]).toEqual([0, 0, 1, 2]);
    expect([...p.b]).toEqual([0, 0, 10, 10]);
    expect(masonryHeight(p, 100, 10)).toBe(260);
    const rects = masonryRects(p, alpha, [0, 0, 0, 0], 210, 10);
    expect(rects[1]).toEqual({ x: 110, y: 0, width: 100, height: 200 });
    expect(rects[3]).toEqual({ x: 110, y: 210, width: 100, height: 50 });
  });

  it("is deterministic and depends only on the reference width, never on the real width", () => {
    const alpha = Array.from({ length: 500 }, (_, i) => 0.4 + ((i * 37) % 13) / 10);
    const beta = alpha.map(() => 24);
    const a = placeMasonry(alpha, beta, 4, 240, 16);
    const b = placeMasonry(alpha, beta, 4, 240, 16);
    expect([...a.col]).toEqual([...b.col]);
    const counts = [0, 0, 0, 0];
    for (const c of a.col) counts[c]!++;
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThan(60);
    // Columns end within one item of each other.
    const h = [0, 1, 2, 3].map((c) => a.colA[c]! * 240 + a.colB[c]!);
    expect(Math.max(...h) - Math.min(...h)).toBeLessThan(240 * 1.7 + 40);
  });

  it("measured heights (α = 0) place by px", () => {
    const p = placeMasonry([0, 0, 0], [300, 100, 50], 2, 1, 8);
    expect([...p.col]).toEqual([0, 1, 1]);
    expect([...p.b]).toEqual([0, 0, 108]);
  });
});

describe("bento packers", () => {
  const cs = [2, 1, 1, 1, 2, 1, 1, 3];
  const rs = [2, 1, 1, 2, 1, 1, 1, 1];
  it("dense = row-major first fit, filling holes left by wide tiles", () => {
    const p = packBento(cs, rs, 3, "dense");
    const cells = [...p.row].map((r, i) => [r, p.col[i]]);
    expect(cells[0]).toEqual([0, 0]);
    expect(cells[1]).toEqual([0, 2]);
    expect(cells[2]).toEqual([1, 2]);
    expect(cells[3]).toEqual([2, 0]);
    expect(cells[4]).toEqual([2, 1]);
    expect(cells[5]).toEqual([3, 1]);
    expect(cells[6]).toEqual([3, 2]);
    expect(cells[7]).toEqual([4, 0]);
    expect(p.rows).toBe(5);
    // A later tile backfills a hole: the 3-wide tile cannot fit next to the first one, the 2-wide tile after it can.
    const hole = packBento([1, 3, 2, 1], [1, 1, 1, 1], 3, "dense");
    expect([...hole.row]).toEqual([0, 1, 0, 2]);
    expect([...hole.col]).toEqual([0, 0, 1, 0]);
  });

  it("skyline drops on the lowest column range and never backfills under the skyline", () => {
    const p = packBento([1, 3, 2, 1], [1, 1, 1, 1], 3, "skyline");
    expect([...p.row]).toEqual([0, 1, 2, 2]);
    expect([...p.col]).toEqual([0, 0, 0, 2]);
  });

  it("clamps spans to the column count", () => {
    const p = packBento([5, 1], [1, 1], 2);
    expect([...p.colSpan]).toEqual([2, 1]);
    expect([...p.row]).toEqual([0, 1]);
  });

  it("rects and CSS of a fixed row height", () => {
    const p = packBento([2, 1], [2, 1], 3);
    expect(bentoRects(p, 100, 320, 10, 10)[0]).toEqual({ x: 0, y: 0, width: 210, height: 210 });
    expect(rectsAt(bentoGeometry(p, 100, 10, 10), 100)[0]).toEqual({ x: 0, y: 0, width: 210, height: 210 });
    expect(geometryStyle([bentoGeometry(p, 100, 10, 10)], 1)).toEqual({
      position: "absolute",
      "box-sizing": "border-box",
      top: "0px",
      "inset-inline-start": "calc(2 * var(--rv-w0) + 20px)",
      width: "var(--rv-mw)",
      height: "100px",
    });
    expect(geometryHeight([bentoGeometry(p, 100, 10, 10)])).toBe("210px");
    expect(geometryHeight([bentoGeometry(p, { aspectRatio: 2 }, 10, 10)])).toBe("calc(var(--rv-w0) + 10px)");
  });
});

describe("CSS", () => {
  it("grid variables: one breakpoint = plain calc, several = masked widths + active max()", () => {
    expect(gridVars([{ min: 0, columns: 1, gap: [16, 16] }])).toEqual({ "--rv-w0": "calc(100cqw)", "--rv-mw": "var(--rv-w0)" });
    const vars = gridVars(resolveBreakpoints({ 0: 1, 500: 2 }, null, 4, 10));
    expect(vars["--rv-m0"]).toBe("clamp(0px, (100cqw - 500px + 0.01px) * 1e9, 1e9px)");
    expect(vars["--rv-w1"]).toBe("calc((100cqw - 10px) / 2 - var(--rv-m1))");
    expect(vars["--rv-mw"]).toBe("max(var(--rv-w0), var(--rv-w1))");
    expect(vars["--rv-gx"]).toBeUndefined();
    const gaps = gridVars(resolveBreakpoints({ 0: 1, 500: 2 }, null, 4, { 0: 8, 500: 12 }));
    expect(gaps["--rv-w1"]).toBe("calc((100cqw - 12px) / 2 - var(--rv-m1))");
    expect(gaps["--rv-gx"]).toBe("max(calc(8px - var(--rv-m0)), calc(12px - var(--rv-m1)))");
  });

  it("constant terms of several breakpoints carry the mask; zero terms collapse", () => {
    const g1 = bentoGeometry(packBento([1, 1], [1, 1], 1), 50, 10, 10);
    const g2 = bentoGeometry(packBento([1, 1], [1, 1], 2), 50, 10, 10);
    const style = geometryStyle([g1, g2], 1);
    expect(style.top).toBe("max(calc(60px - var(--rv-m0)), 0px)");
    expect(style["inset-inline-start"]).toBe("max(0px, calc(var(--rv-w1) + 10px))");
    expect(style.height).toBe("max(calc(50px - var(--rv-m0)), calc(50px - var(--rv-m1)))");
    const m = geometryStyle([placeColumns({ alpha: [1], beta: [0] }, 2, 100, 100, 100, 8, 0).geometry], 0);
    expect(m.top).toBe("0px");
    expect(m["aspect-ratio"]).toBe("1");
    expect(m.width).toBe("var(--rv-mw)");
  });
});

describe("item data", () => {
  it("reads ratios, keys and gaps", () => {
    expect(defaultAspectRatio({ aspectRatio: 1.5 })).toBe(1.5);
    expect(defaultAspectRatio({ width: 300, height: 200 })).toBe(1.5);
    expect(defaultAspectRatio({ width: 300 })).toBe(null);
    expect(validRatio(0)).toBe(null);
    expect(validRatio(Infinity)).toBe(null);
    expect(defaultItemKey({ id: 7 }, 3)).toBe(7);
    expect(defaultItemKey({}, 3)).toBe(3);
    expect(gapOf(undefined)).toEqual([16, 16]);
    expect(gapOf([4, 8])).toEqual([4, 8]);
    expect(columnWidth(330, 3, 15)).toBe(100);
  });
});

describe("MasonryLayout (virtualized)", () => {
  it("lays out exact ratios at the virtualizer width, estimates + measures unknown ones, spatial keys", () => {
    const items = [{ id: "a", aspectRatio: 1 }, { id: "b", aspectRatio: 0.5 }, { id: "c" }, { id: "d", aspectRatio: 2 }];
    const layout = new MasonryLayout<{ id: string; aspectRatio?: number }>((item) => item.aspectRatio ?? null);
    const engine = new VirtualizerEngine<any, unknown>({
      collection: createCollection(items, { getKey: (i: { id: string }) => i.id }),
      layout,
      delegate: { setVisibleRect() {}, renderView: (_t: unknown, c: unknown) => c, invalidate() {} },
    });
    engine.render({
      layout,
      collection: engine.collection,
      persistedKeys: new Set(),
      visibleRect: new Rect(0, 0, 210, 1000),
      size: new Size(210, 1000),
      invalidationContext: { layoutOptions: { breakpoints: [{ min: 0, columns: 2, gap: [10, 10] }] } },
      isScrolling: false,
      layoutOptions: { breakpoints: [{ min: 0, columns: 2, gap: [10, 10] }] },
    } as never);
    const rect = (k: string) => layout.getLayoutInfo(k).rect;
    expect([rect("a").x, rect("a").y, rect("a").width, rect("a").height]).toEqual([0, 0, 100, 100]);
    expect([rect("b").x, rect("b").height]).toEqual([110, 200]);
    expect(layout.getLayoutInfo("c").estimatedSize).toBe(true);
    expect([rect("c").x, rect("c").y]).toEqual([0, 110]);
    expect(layout.getLayoutInfo("a").estimatedSize).toBe(false);
    expect(layout.updateItemSize("c", new Size(100, 40))).toBe(true);
    expect(layout.getKeyRightOf("a")).toBe("b");
    expect(layout.getContentSize().height).toBeGreaterThan(200);
  });
});

// Deterministic pseudo-random inputs.
const rng = (seed: number) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const overlaps = (rects: { x: number; y: number; width: number; height: number }[]) => {
  let n = 0;
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!;
      const b = rects[j]!;
      if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1e-6 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1e-6) n++;
    }
  return n;
};

describe("columns with spans (placeColumns)", () => {
  it("one-column items = placeMasonry (single term tops)", () => {
    const r = rng(3);
    const alpha = Array.from({ length: 200 }, () => 0.4 + r() * 1.5);
    const beta = alpha.map(() => 20);
    const a = placeMasonry(alpha, beta, 4, 240, 12);
    const b = placeColumns({ alpha, beta }, 4, 240, 100, 400, 16, 12);
    expect([...b.col]).toEqual([...a.col]);
    expect(b.geometry.topMore).toBe(null);
    for (let i = 0; i < 200; i++) expect([b.geometry.top[2 * i], b.geometry.top[2 * i + 1]]).toEqual([a.a[i], a.b[i]]);
  });

  it("spanning items sit under the highest of their columns at every width of the range (no overlap)", () => {
    const r = rng(11);
    const n = 300;
    const alpha = Array.from({ length: n }, () => (r() < 0.5 ? 0.5 + r() : 0));
    const beta = alpha.map((a) => (a ? 18 : 40 + r() * 200));
    const span = Array.from({ length: n }, () => (r() < 0.2 ? 2 + Math.floor(r() * 2) : 1));
    const [lo, hi] = [120, 420];
    const run = placeColumns({ alpha, beta, span }, 4, 250, lo, hi, 12, 10);
    expect(run.geometry.topMore?.some(Boolean)).toBe(true);
    for (const u of [lo, 160, 250, 333, hi]) expect(overlaps(rectsAt(run.geometry, u)), `u ${u}`).toBe(0);
    // A spanning item never ends past the container: x + width ≤ 4·u + 3·gap.
    const rects = rectsAt(run.geometry, 200);
    for (const rect of rects) expect(rect.x + rect.width).toBeLessThanOrEqual(4 * 200 + 3 * 12 + 1e-6);
    expect(extentAt(run.geometry, 200)).toBeGreaterThanOrEqual(Math.max(...rects.map((x) => x.y + x.height)) - 1e-6);
  });

  it("pruneTerms keeps the max on the range", () => {
    const kept = pruneTerms([1, 0, 0, 150, 2, -50, 1, -10], 100, 300);
    for (const u of [100, 150, 200, 300]) {
      const all = Math.max(u, 150, 2 * u - 50, u - 10);
      let v = -Infinity;
      for (let t = 0; t < kept.length; t += 2) v = Math.max(v, kept[t]! * u + kept[t + 1]!);
      expect(v).toBeCloseTo(all, 9);
    }
    expect(kept).toEqual([2, -50]);
  });

  it("incremental re-place from a changed item = full placement", () => {
    const r = rng(5);
    const n = 400;
    const alpha = Float64Array.from({ length: n }, () => 0.5 + r());
    const beta = Float64Array.from({ length: n }, () => 10);
    const span = Uint16Array.from({ length: n }, () => (r() < 0.1 ? 2 : 1));
    const full0 = placeColumns({ alpha, beta, span }, 3, 260, 150, 400, 16, 16);
    for (const changed of [0, 1, CHECKPOINT - 1, CHECKPOINT, 77, 250, n - 1]) {
      const next = span.slice();
      next[changed] = next[changed] === 1 ? 2 : 1;
      const full = placeColumns({ alpha, beta, span: next }, 3, 260, 150, 400, 16, 16);
      const inc = placeColumns({ alpha, beta, span: next }, 3, 260, 150, 400, 16, 16, { run: full0, from: changed });
      expect([...inc.col], `changed ${changed}`).toEqual([...full.col]);
      expect([...inc.geometry.top]).toEqual([...full.geometry.top]);
      expect([...inc.geometry.width]).toEqual([...full.geometry.width]);
      expect([...inc.geometry.extent]).toEqual([...full.geometry.extent]);
      expect(inc.geometry.topMore?.map((t) => (t ? [...t] : null)) ?? null).toEqual(full.geometry.topMore?.map((t) => (t ? [...t] : null)) ?? null);
    }
  });

  it('fit="both" stretches each column\'s last item to the tallest column (flush at any width)', () => {
    const r = rng(9);
    const alpha = Array.from({ length: 23 }, () => 0.5 + r());
    const beta = alpha.map(() => 0);
    const run = placeColumns({ alpha, beta }, 4, 220, 120, 400, 10, 10);
    const g = fitColumns(run, 120, 400);
    for (const u of [120, 220, 400]) {
      const rects = rectsAt(g, u);
      const bottoms = [0, 1, 2, 3].map((c) => rects[run.state.last[c]!]!).map((x) => x.y + x.height);
      for (const b of bottoms) expect(b).toBeCloseTo(extentAt(g, u), 6);
      expect(overlaps(rects)).toBe(0);
    }
    // Stretched items lose their aspect ratio (height written explicitly).
    expect(geometryStyle([g], run.state.last[0]!).height).toBeDefined();
  });

  it("numeric greedy with spans continues under a prefix", () => {
    const p = placeNumeric([100, 50, 80], [1, 2, 1], 3, 100, 10, 10, [0, 220, 40]);
    // Item 0 (1 col): column 0 (0). Item 1 (2 cols): columns 1–2 → max(220, 40) = 220 vs columns 0–1 → max(110, 220).
    expect([...p.x]).toEqual([0, 0, 220]);
    expect([...p.y]).toEqual([0, 220, 40]);
    expect([...p.width]).toEqual([100, 210, 100]);
    expect(p.height).toBe(270);
  });
});

describe("justified rows (flickr/justified-layout cases; container padding 10 of upstream = width − 20, offsets − 10)", () => {
  const upstream = (aspects: number[], opts: { containerWidth?: number; targetRowHeight?: number; tolerance?: number; spacing?: [number, number] } = {}) => {
    const W = (opts.containerWidth ?? 1060) - 20;
    const g = placeJustified(aspects, W, {
      rowHeight: opts.targetRowHeight ?? 320,
      tolerance: opts.tolerance,
      gap: opts.spacing ?? [10, 10],
      lastRow: "left",
    });
    return { g, rects: rectsAt(g, W), W };
  };

  it("creates additional rows if items do not fit within constraints", () => {
    const { rects } = upstream([1, 2], { containerWidth: 200, targetRowHeight: 100 });
    expect(rects[0]!.y).toBe(0);
    expect(rects[1]!.y).toBe(190);
  });

  it("handles a panorama as the only row item", () => {
    const { rects, W } = upstream([5]);
    expect(rects.length).toBe(1);
    expect(rects[0]!.width).toBeCloseTo(W, 9);
  });

  it("accepts a new item that brings the row closer to the target height", () => {
    const { rects } = upstream([1, 4, 1.1], { containerWidth: 1000, targetRowHeight: 250 });
    expect(rects.map((r) => r.height)).toEqual([194, 194, 194]);
  });

  it("four squares (default config and 400 px)", () => {
    const round = (rects: { x: number; y: number; width: number; height: number }[]) =>
      rects.map((r) => [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 1e6) / 1e6));
    const four = upstream([1, 1, 1, 1]).rects;
    expect(round(four)).toEqual([
      [0, 0, 340, 340],
      [350, 0, 340, 340],
      [700, 0, 340, 340],
      [0, 350, 340, 340],
    ]);
    expect(extentAt(upstream([1, 1, 1, 1]).g, 1040)).toBeCloseTo(690, 9);
    const four400 = upstream([1, 1, 1, 1], { containerWidth: 400 }).rects;
    expect(round(four400)).toEqual([
      [0, 0, 380, 380],
      [0, 390, 380, 380],
      [0, 780, 380, 380],
      [0, 1170, 380, 380],
    ]);
  });

  it("box spacing (one value and horizontal / vertical)", () => {
    const one = upstream([1, 1, 1, 1], { spacing: [40, 40] }).rects;
    expect(one[1]!.x).toBeCloseTo(360, 9);
    expect(one[3]!.y).toBeCloseTo(360, 9);
    const two = upstream([1, 1, 1, 1], { spacing: [40, 5] }).rects;
    expect(two[1]!.x).toBeCloseTo(360, 9);
    expect(two[3]!.y).toBeCloseTo(325, 9);
  });

  it("target row height and tolerance", () => {
    // Upstream: 255 (the widow overflows 1040 px at 4 × 255 + 3 × 10). Deviation: an overflowing widow becomes a justified row.
    expect(upstream([1, 1, 1, 1], { targetRowHeight: 255, tolerance: 0 }).rects[0]!.height).toBe(252.5);
    expect(upstream([1, 1, 1], { targetRowHeight: 255, tolerance: 0 }).rects[0]!.height).toBe(255);
    expect(upstream([1, 1, 1], { tolerance: 0 }).rects[0]!.height).toBe(320);
    expect(extentAt(upstream([1, 1, 1], { tolerance: 0 }).g, 1040)).toBeCloseTo(320, 9);
  });

  it("widows: previous row height, left by default; centred; justified", () => {
    const left = upstream([1, 1, 1, 1]).rects;
    expect(left[3]!.height).toBeCloseTo(left[0]!.height, 9);
    expect(left[3]!.x).toBe(left[0]!.x);
    for (const aspects of [
      [1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1.6, 1, 2.3, 1.2, 0.1],
    ]) {
      const W = 1040;
      const g = placeJustified(aspects, W, { rowHeight: 320, gap: [10, 10], lastRow: "center" });
      const rects = rectsAt(g, W);
      const lastTop = rects[rects.length - 1]!.y;
      const widows = rects.filter((r) => Math.abs(r.y - lastTop) < 1e-6);
      const rowWidth = widows.reduce((a, r) => a + r.width, 0) + (widows.length - 1) * 10;
      expect(widows[0]!.x).toBeCloseTo((W - rowWidth) / 2, 6);
    }
    const W = 860;
    const j = rectsAt(placeJustified([1, 1, 1, 2.5], W, { rowHeight: 320, gap: [10, 10], lastRow: "justify" }), W);
    expect(j[3]!.width).toBeCloseTo(W, 6);
    const widow = rectsAt(placeJustified([1, 1, 1, 1], 1040, { rowHeight: 320, gap: [10, 10], lastRow: "justify" }), 1040);
    expect(widow[3]!.width).toBeCloseTo(1040, 6);
    expect(widow[3]!.height).toBeCloseTo(340, 9);
  });

  it('every row fills the width at every width of the range; lastRow="fill" ends flush', () => {
    const r = rng(17);
    const aspects = Array.from({ length: 157 }, () => 0.5 + r() * 1.6);
    const g = placeJustified(aspects, 900, { rowHeight: 200, gap: [8, 8] });
    for (const W of [640, 900, 1023]) {
      const rects = rectsAt(g, W);
      const rows = new Map<number, typeof rects>();
      for (const rect of rects) {
        const k = Math.round(rect.y * 1000);
        rows.set(k, [...(rows.get(k) ?? []), rect]);
      }
      for (const row of rows.values()) {
        const end = Math.max(...row.map((x) => x.x + x.width));
        expect(Math.abs(end - W), `W ${W}`).toBeLessThan(1);
        expect(Math.min(...row.map((x) => x.x))).toBeCloseTo(0, 6);
      }
      // Flush bottom: every item of the last row ends at the content height.
      const ext = extentAt(g, W);
      const last = Math.max(...rects.map((x) => x.y));
      for (const rect of rects.filter((x) => Math.abs(x.y - last) < 1e-6)) expect(rect.y + rect.height).toBeCloseTo(ext, 6);
      expect(overlaps(rects)).toBe(0);
    }
  });

  it("fill rebalances a lonely widow with the row before it", () => {
    const W = 1040;
    const fill = rectsAt(placeJustified([1.5, 1.5, 1.5, 0.4], W, { rowHeight: 320, gap: [10, 10] }), W);
    const left = rectsAt(placeJustified([1.5, 1.5, 1.5, 0.4], W, { rowHeight: 320, gap: [10, 10], lastRow: "left" }), W);
    // left: the [1.5, 0.4] widow row ends short at the previous row height; fill: every row spans the width.
    expect(left[3]!.x + left[3]!.width).toBeLessThan(W - 300);
    const lastTop = Math.max(...fill.map((x) => x.y));
    const end = Math.max(...fill.filter((x) => Math.abs(x.y - lastTop) < 1e-6).map((x) => x.x + x.width));
    expect(end).toBeCloseTo(W, 6);
  });

  it("CSS: aspect-ratio for justified items, explicit height for clamped rows", () => {
    const g: Geometry = placeJustified([1, 1, 1, 1], 1040, { rowHeight: 320, gap: [10, 10] });
    const style = geometryStyle([g], 0);
    expect(style["aspect-ratio"]).toBe("1");
    expect(style.width).toMatch(/var\(--rv-w0\)/);
    const pano = placeJustified([20], 1040, { rowHeight: 320, gap: [10, 10] });
    expect(geometryStyle([pano], 0).height).toBe("160px");
  });
});

describe("MasonryLayout justified + spans (virtualized)", () => {
  it("lays out justified rows at the real width and spans in columns", () => {
    const items = [
      { id: "a", aspectRatio: 1 },
      { id: "b", aspectRatio: 1 },
      { id: "c", aspectRatio: 1 },
    ];
    const j = new MasonryLayout<{ id: string; aspectRatio: number }>((item) => item.aspectRatio);
    const rects = j.rectsFor(
      items.map((value) => ({ key: value.id, value })),
      1040,
      { breakpoints: [{ min: 0, columns: 1, gap: [10, 10] }], justified: { rowHeight: 340, tolerance: 0.25 } },
    );
    expect(rects.map((r) => Math.round(r.rect.width))).toEqual([340, 340, 340]);
    const spans = new MasonryLayout<{ id: string; aspectRatio: number; span?: number }>(
      (item) => item.aspectRatio,
      (item) => item.span ?? 1,
    );
    const placed = spans.rectsFor(
      [
        { id: "a", aspectRatio: 1, span: 2 },
        { id: "b", aspectRatio: 1 },
        { id: "c", aspectRatio: 1 },
      ].map((value) => ({ key: value.id, value })),
      320,
      { breakpoints: [{ min: 0, columns: 3, gap: [10, 10] }] },
    );
    expect(placed.map((p) => [p.rect.x, p.rect.y, p.rect.width])).toEqual([
      [0, 0, 210],
      [220, 0, 100],
      [220, 110, 100],
    ]);
    expect(unitRange([{ min: 0, columns: 2, gap: [10, 10] }], 0)[0]).toBe(-5);
  });
});

describe("masonrySizes", () => {
  it("column width per breakpoint as an img `sizes` (widest first), spans included", () => {
    expect(masonrySizes({ columns: { 0: 2, 640: 3 }, gap: 10 })).toBe("(min-width: 640px) calc((100vw) * 0.3333 - 6.6667px), calc((100vw) * 0.5 - 5px)");
    expect(masonrySizes({ columns: { 0: 1, 500: 2 } })).toBe("(min-width: 500px) calc((100vw) * 0.5 - 8px), 100vw");
  });

  it("container-relative: viewport queries offset by `inset`, constant from `maxWidth`, responsive span", () => {
    // Grid = min(100vw − 48px, 704px): the 520px container breakpoint starts at viewport 568px; from 752px on a column is fixed.
    expect(masonrySizes({ columns: { 0: 2, 520: 3 }, gap: 12, inset: 48, maxWidth: 704 })).toBe(
      "(min-width: 752px) 226.6667px, (min-width: 568px) calc((100vw - 48px) * 0.3333 - 8px), calc((100vw - 48px) * 0.5 - 6px)",
    );
    expect(masonrySizes({ columns: { 0: 2, 520: 3 }, gap: 12, inset: 48, maxWidth: 704, span: 2 })).toBe(
      "(min-width: 752px) 465.3333px, (min-width: 568px) calc((100vw - 48px) * 0.6667 - 4px), calc(100vw - 48px)",
    );
    // Breakpoints at or beyond maxWidth never apply; a per-breakpoint span map.
    expect(masonrySizes({ columns: { 0: 2, 900: 4 }, gap: 0, maxWidth: 800, span: { 0: 1, 900: 2 } })).toBe(
      "(min-width: 800px) 400px, calc((100vw) * 0.5 + 0px)",
    );
  });
});

// Fix round 1 (review 2026-10-11): masked negative slopes, fill fallback, tolerance splits + maxWidth, incremental rows.
/** Evaluates a geometry CSS value at breakpoint `b` of `count` (unit = container width `u`; masks 0 inside b, 1e9 px outside). */
function cssAt(value: string, b: number, u: number): number {
  const js = value
    .replace(/var\(--rv-w(\d+)\)/g, (_, j) => `(${Number(j) === b ? u : u - 1e9})`)
    .replace(/var\(--rv-m(\d+)\)/g, (_, j) => `(${Number(j) === b ? 0 : 1e9})`)
    .replace(/(-?[\d.]+)px/g, "$1")
    .replace(/calc\(/g, "(")
    .replace(/max\(/g, "Math.max(");
  return Function(`return ${js}`)() as number;
}

describe("fix round 1: justified terms", () => {
  it("negative-slope terms stay masked outside their breakpoint", () => {
    const g0 = emptyGeometry(1);
    g0.x.set([-0.0139, -5]);
    g0.width.set([0.5, 0]);
    g0.height.set([0, 100]);
    g0.extent = Float64Array.of(0, 100);
    const g1 = emptyGeometry(1);
    g1.x.set([0.5455, 4.5455]);
    g1.width.set([0.25, 0]);
    g1.height.set([0, 100]);
    g1.extent = Float64Array.of(0, 100);
    const style = geometryStyle([g0, g1], 0);
    for (const [b, u] of [
      [0, 800],
      [1, 1300],
    ] as const) {
      const g = b === 0 ? g0 : g1;
      expect(cssAt(style["inset-inline-start"]!, b, u)).toBeCloseTo(g.x[0]! * u + g.x[1]!, 2);
    }
  });

  it("a centred widow lands on its own geometry in every breakpoint (no ±1e9 leak)", () => {
    const aspects = [3.6, 3.0, 0.7, 1.4, 0.9, 1.2, 0.5];
    const bps = resolveBreakpoints(1, null, 1, 10, [0, ...justifiedSplits()]);
    const refs = referenceWidths(bps);
    const gs = bps.map((bp, b) => placeJustified(aspects, refs[b]!, { rowHeight: 200, gap: bp.gap, lastRow: "center" }));
    for (let b = 0; b < bps.length; b++) {
      const u = refs[b]!;
      const rects = rectsAt(gs[b]!, u);
      for (let i = 0; i < aspects.length; i++) {
        const style = geometryStyle(gs, i);
        // CSS numbers carry 4 decimals (slopes × a 2–3k px unit): within 0.25 px.
        expect(Math.abs(cssAt(style["inset-inline-start"]!, b, u) - rects[i]!.x)).toBeLessThan(0.25);
        expect(Math.abs(cssAt(style.top!, b, u) - rects[i]!.y)).toBeLessThan(0.25);
        expect(Math.abs(cssAt(style.width!, b, u) - rects[i]!.width)).toBeLessThan(0.25);
      }
    }
  });

  it('lastRow="fill" falls back to "left" when no rebalance stays inside the height bounds', () => {
    const one = rectsAt(placeJustified([0.66], 1000, { rowHeight: 200, gap: [10, 10] }), 1000);
    expect(one[0]).toMatchObject({ x: 0, y: 0, height: 200 });
    expect(one[0]!.width).toBeCloseTo(132, 6);
    const two = rectsAt(placeJustified([0.66, 0.75], 1000, { rowHeight: 200, gap: [10, 10] }), 1000);
    expect(two.map((r) => r.height)).toEqual([200, 200]);
    expect(two[1]!.x).toBeCloseTo(142, 6);
    // A rebalance inside the bounds still fills (flush).
    const filled = placeJustified([1.5, 1.5, 1.5, 1.5, 1.5, 0.8], 1000, { rowHeight: 200, gap: [10, 10] });
    const rects = rectsAt(filled, 1000);
    const lastRowY = rects[5]!.y;
    const lastRow = rects.filter((r) => r.y === lastRowY);
    expect(lastRow.reduce((w, r) => w + r.width, 0) + (lastRow.length - 1) * 10).toBeCloseTo(1000, 6);
  });

  it("splits follow the tolerance (geometric, ratio (1 + t) / (1 − t)) and stop at maxWidth", () => {
    expect(justifiedSplits()).toEqual([533, 889, 1481, 2469]);
    expect(justifiedSplits(0.1)).toEqual([391, 478, 584, 714, 873, 1067, 1304]);
    expect(justifiedSplits(0.25, 1400)).toEqual([533, 889]);
    const bps = capBreakpoints(resolveBreakpoints(1, null, 1, 10, [0, ...justifiedSplits(0.25, 1400)]), 1400);
    // Bounded last range: the reference width of the last breakpoint is the middle of [889, 1400].
    expect(referenceWidths(bps, undefined, 1400).at(-1)).toBeCloseTo((889 + 1400) / 2, 6);
    expect(unitRange(bps, bps.length - 1, 1400)).toEqual([889, 1400]);
  });

  it("incremental re-pack (span toggle, append, removal) = a full run", () => {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const base = Float64Array.from({ length: 300 }, () => 0.5 + rand() * 1.6);
    const options = { rowHeight: 200, gap: [10, 10] as const, lastRow: "fill" as const };
    const same = (a: Geometry, b: Geometry) => {
      for (const f of ["x", "width", "height", "top", "ratio", "extent"] as const) expect(Array.from(a[f])).toEqual(Array.from(b[f]));
    };
    const full0 = placeJustifiedRun(base, 1100, options, null);
    for (const i of [0, 1, 37, 150, 298, 299]) {
      const next = base.slice();
      next[i] = next[i]! * 2;
      same(placeJustifiedRun(next, 1100, options, { run: full0, from: i }).geometry, placeJustified(next, 1100, options));
    }
    const appended = Float64Array.from([...base, 1.2, 0.7, 1.9]);
    same(placeJustifiedRun(appended, 1100, options, { run: full0, from: 300 }).geometry, placeJustified(appended, 1100, options));
    const removed = base.slice(0, 120);
    same(placeJustifiedRun(removed, 1100, options, { run: full0, from: 120 }).geometry, placeJustified(removed, 1100, options));
  });

  // Fix round 2 (N1): the checkpoint kept a closed row ending at `from - 1` although a later aspect change can reopen
  // it (the greedy row only closes on the item after it). Seeded fuzz: aspect change / append / truncate × lastRow.
  it("seeded fuzz: incremental re-place = a full run (600 cases, every lastRow)", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const ratios = [0.5, 0.66, 0.75, 1, 1.33, 1.5, 1.78, 2.4];
    const pick = () => ratios[Math.floor(rnd() * ratios.length)]!;
    const mismatches: string[] = [];
    const differs = (a: Geometry, b: Geometry) =>
      (["x", "width", "height", "top", "ratio", "extent"] as const).some(
        (f) => a[f].length !== b[f].length || a[f].some((v, i) => Math.abs(v - b[f][i]!) > 1e-9),
      );
    for (let t = 0; t < 600; t++) {
      const lastRow = (["fill", "left", "center", "justify"] as const)[t % 4]!;
      const count = 1 + Math.floor(rnd() * 60);
      const aspects = Float64Array.from({ length: count }, pick);
      const options = { rowHeight: 100 + Math.floor(rnd() * 200), gap: [8, 12] as [number, number], lastRow };
      const width = 400 + Math.floor(rnd() * 1000);
      const run = placeJustifiedRun(aspects, width, options, null);
      let next: Float64Array;
      let from: number;
      if (t % 3 === 0) {
        next = aspects.slice();
        from = Math.floor(rnd() * count);
        next[from] = pick();
      } else if (t % 3 === 1) {
        next = Float64Array.from([...aspects, ...Array.from({ length: 1 + Math.floor(rnd() * 5) }, pick)]);
        from = count;
      } else {
        from = Math.floor(rnd() * count);
        next = aspects.slice(0, Math.max(1, from));
        from = Math.min(from, next.length);
      }
      if (differs(placeJustifiedRun(next, width, options, { run, from }).geometry, placeJustified(next, width, options)))
        mismatches.push(`t=${t} ${lastRow} from=${from}`);
    }
    expect(mismatches).toEqual([]);
  });
});
