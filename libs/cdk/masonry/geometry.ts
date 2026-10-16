// Rivet-authored (not a port): the shared geometry of `@rivetjs/cdk/masonry` — every layout (masonry columns, justified
// rows, Bento tiles) produces, per breakpoint, item boxes whose edges are LINEAR in the breakpoint's unit `u` (the
// column width; justified rows: the container width), `k·u + c` px. A top can be the max of several such terms (an
// item spanning columns sits under the lowest of them; a stretched last tile reaches the tallest column). That is what
// makes the server CSS exact at any container width of a breakpoint (`max()` of masked terms, see `gridVars`), and what
// the client evaluates at a width (`rectsAt`) for keyboard geometry, FLIP animation and tests. Pure, DOM-free.

/** Number → shortest CSS form (4 decimals). */
export const num = (x: number): string => String(Math.round(x * 1e4) / 1e4);

/**
 * Item boxes of one breakpoint. Item i: start edge `x[2i]·u + x[2i+1]`, width / height / top likewise; `topMore[i]` /
 * `heightMore[i]` hold extra `[k, c, k, c, …]` terms (the value is the max of all its terms); `ratio[i] > 0` means
 * height = width / ratio exactly (written as CSS `aspect-ratio`); `extent` = content height terms (max).
 */
export interface Geometry {
  count: number;
  x: Float64Array;
  width: Float64Array;
  height: Float64Array;
  top: Float64Array;
  topMore: (Float64Array | null)[] | null;
  heightMore: (Float64Array | null)[] | null;
  ratio: Float64Array;
  extent: Float64Array;
}

export function emptyGeometry(count: number): Geometry {
  return {
    count,
    x: new Float64Array(count * 2),
    width: new Float64Array(count * 2),
    height: new Float64Array(count * 2),
    top: new Float64Array(count * 2),
    topMore: null,
    heightMore: null,
    ratio: new Float64Array(count),
    extent: new Float64Array(0),
  };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const maxAt = (base: Float64Array, i: number, more: Float64Array | null | undefined, u: number) => {
  let v = base[2 * i]! * u + base[2 * i + 1]!;
  if (more) for (let t = 0; t < more.length; t += 2) v = Math.max(v, more[t]! * u + more[t + 1]!);
  return v;
};

/** Pixel rects (x from the start edge) of a geometry at unit `u`. */
export function rectsAt(g: Geometry, u: number): Rect[] {
  const out: Rect[] = new Array(g.count);
  for (let i = 0; i < g.count; i++)
    out[i] = {
      x: g.x[2 * i]! * u + g.x[2 * i + 1]!,
      y: maxAt(g.top, i, g.topMore?.[i], u),
      width: g.width[2 * i]! * u + g.width[2 * i + 1]!,
      height: maxAt(g.height, i, g.heightMore?.[i], u),
    };
  return out;
}

/** Content height of a geometry at unit `u`. */
export function extentAt(g: Geometry, u: number): number {
  let h = 0;
  for (let t = 0; t < g.extent.length; t += 2) h = Math.max(h, g.extent[t]! * u + g.extent[t + 1]!);
  return h;
}

// ---------------------------------------------------------------------------------------------------------------
// Term sets (max of linear functions over a unit range)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Union of term sets `[k, c, …]` without the terms dominated over `[lo, hi]` (≤ another term at both ends: then ≤ it on
 * the whole range). The max of what is left equals the max of the inputs on the range.
 */
export function pruneTerms(terms: readonly number[], lo: number, hi: number): number[] {
  const n = terms.length / 2;
  if (n <= 1) return terms.slice();
  const keep: number[] = [];
  for (let a = 0; a < n; a++) {
    const ka = terms[2 * a]!;
    const ca = terms[2 * a + 1]!;
    const la = ka * lo + ca;
    const ha = ka * hi + ca;
    let dominated = false;
    for (let b = 0; b < n && !dominated; b++) {
      if (b === a) continue;
      const kb = terms[2 * b]!;
      const cb = terms[2 * b + 1]!;
      const lb = kb * lo + cb;
      const hb = kb * hi + cb;
      // Strictly below somewhere and not above anywhere; exact duplicates keep the first.
      if (lb >= la - 1e-9 && hb >= ha - 1e-9 && (lb > la + 1e-9 || hb > ha + 1e-9 || b < a)) dominated = true;
    }
    if (!dominated) keep.push(ka, ca);
  }
  return keep;
}

// ---------------------------------------------------------------------------------------------------------------
// CSS (inline, exact at any container width)
// ---------------------------------------------------------------------------------------------------------------

/** `k·u + c` px at breakpoint b as a CSS term (several breakpoints: masked, so it is ≈ −1e9 px outside b's range). */
export function linear(k: number, c: number, b: number, single: boolean): string {
  if (Math.abs(k) < 1e-12) {
    // Geometry is never negative: an unmasked 0 is a lower bound in every breakpoint.
    if (Math.abs(c) < 1e-9) return "0px";
    return single ? `${num(c)}px` : `calc(${num(c)}px - var(--rv-m${b}))`;
  }
  // Negative slope: the masked unit (≈ −1e9 px outside b) would turn the term huge and positive; use the unmasked
  // unit (`--rv-w + --rv-m`) and subtract the mask from the constant instead.
  if (k < 0 && !single) return `calc(${num(k)} * (var(--rv-w${b}) + var(--rv-m${b})) ${c < 0 ? "-" : "+"} ${num(Math.abs(c))}px - var(--rv-m${b}))`;
  const kw = Math.abs(k - 1) < 1e-12 ? `var(--rv-w${b})` : `${num(k)} * var(--rv-w${b})`;
  if (Math.abs(c) < 1e-9) return single && Math.abs(k - 1) < 1e-12 ? `var(--rv-w${b})` : `calc(${kw})`;
  return `calc(${kw} ${c < 0 ? "-" : "+"} ${num(Math.abs(c))}px)`;
}

/** One value across breakpoints from per-breakpoint term lists: a term, or `max()` of every (masked) term. */
function across(perBreakpoint: string[][]): string {
  const all: string[] = [];
  for (const terms of perBreakpoint) for (const t of terms) all.push(t);
  if (all.length === 1) return all[0]!;
  if (all.every((t) => t === "0px")) return "0px";
  return `max(${all.join(", ")})`;
}

const termsOf = (base: Float64Array, i: number, more: Float64Array | null | undefined, b: number, single: boolean): string[] => {
  const out = [linear(base[2 * i]!, base[2 * i + 1]!, b, single)];
  if (more) for (let t = 0; t < more.length; t += 2) out.push(linear(more[t]!, more[t + 1]!, b, single));
  return out;
};

/**
 * Inline style of item i placed by `geometries` (one per breakpoint): absolute `top` / `inset-inline-start`, `width`
 * (`var(--rv-mw)` when it is one column everywhere) and `height` (CSS `aspect-ratio` when it is width / ratio in every
 * breakpoint). Frozen: the runtime writes a frozen style object as one validated `cssText`.
 */
export function geometryStyle(geometries: readonly Geometry[], i: number): Record<string, string> {
  const single = geometries.length === 1;
  const top: string[][] = [];
  const left: string[][] = [];
  const width: string[][] = [];
  const height: string[][] = [];
  let unitWidth = true;
  let ratio = geometries[0]!.ratio[i]!;
  for (let b = 0; b < geometries.length; b++) {
    const g = geometries[b]!;
    top.push(termsOf(g.top, i, g.topMore?.[i], b, single));
    left.push([linear(g.x[2 * i]!, g.x[2 * i + 1]!, b, single)]);
    const wk = g.width[2 * i]!;
    const wc = g.width[2 * i + 1]!;
    if (Math.abs(wk - 1) > 1e-12 || Math.abs(wc) > 1e-9) unitWidth = false;
    width.push([linear(wk, wc, b, single)]);
    height.push(termsOf(g.height, i, g.heightMore?.[i], b, single));
    if (!(g.ratio[i]! > 0) || Math.abs(g.ratio[i]! - ratio) > 1e-9) ratio = 0;
  }
  const style: Record<string, string> = {
    position: "absolute",
    "box-sizing": "border-box",
    top: across(top),
    "inset-inline-start": across(left),
    width: unitWidth ? "var(--rv-mw)" : across(width),
  };
  if (ratio > 0) style["aspect-ratio"] = num(ratio);
  else {
    // One column everywhere with the same `k·u + c` height in every breakpoint: one term over the active width.
    const g0 = geometries[0]!;
    const hk = g0.height[2 * i]!;
    const hc = g0.height[2 * i + 1]!;
    const same =
      unitWidth && geometries.every((g) => !g.heightMore?.[i] && Math.abs(g.height[2 * i]! - hk) < 1e-12 && Math.abs(g.height[2 * i + 1]! - hc) < 1e-9);
    if (same && geometries.length > 1 && Math.abs(hk) > 1e-12) {
      const kw = Math.abs(hk - 1) < 1e-12 ? "var(--rv-mw)" : `${num(hk)} * var(--rv-mw)`;
      style.height = Math.abs(hc) < 1e-9 ? `calc(${kw})` : `calc(${kw} ${hc < 0 ? "-" : "+"} ${num(Math.abs(hc))}px)`;
    } else style.height = across(height);
  }
  return Object.freeze(style);
}

/** Grid height (content extent) across breakpoints. */
export function geometryHeight(geometries: readonly Geometry[]): string {
  const single = geometries.length === 1;
  const terms: string[] = [];
  geometries.forEach((g, b) => {
    for (let t = 0; t < g.extent.length; t += 2) terms.push(linear(g.extent[t]!, g.extent[t + 1]!, b, single));
  });
  if (!terms.length) return "0px";
  if (terms.length === 1) return terms[0]!;
  return `max(0px, ${terms.join(", ")})`;
}
