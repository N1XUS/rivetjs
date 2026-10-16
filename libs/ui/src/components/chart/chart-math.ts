// Rivet-authored chart geometry (pure functions, no DOM): "nice" axis ticks and SVG paths in a 0…100 viewBox.
// Monotone cubic interpolation = the Fritsch–Carlson method (1980): tangents limited so the curve never overshoots
// between two points (no fake peaks / dips in the data).

export interface Point {
  x: number;
  y: number;
}

/** Rounds `range / count` to 1, 2, 2.5 or 5 × 10^n and returns ticks from `min` (floored) to ≥ `max`. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max === min) max = min + 1;
  const raw = (max - min) / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const step = (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v < max + step * 0.5; v += step) ticks.push(Math.round(v / step) * step);
  if (ticks[ticks.length - 1]! < max) ticks.push(ticks[ticks.length - 1]! + step);
  return ticks;
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** Straight segments through the points. */
export function linearPath(points: Point[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${fmt(p.x)} ${fmt(p.y)}`).join(" ");
}

/** Monotone cubic (Fritsch–Carlson) through points with increasing x. */
export function monotonePath(points: Point[]): string {
  const n = points.length;
  if (n < 3) return linearPath(points);
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1]!.x - points[i]!.x);
    slope.push((points[i + 1]!.y - points[i]!.y) / (dx[i] || 1));
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    tangent.push(a * b <= 0 ? 0 : (3 * (dx[i - 1]! + dx[i]!)) / ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b));
  }
  tangent.push(slope[n - 2]!);
  let d = `M${fmt(points[0]!.x)} ${fmt(points[0]!.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${fmt(p.x + h)} ${fmt(p.y + h * tangent[i]!)} ${fmt(q.x - h)} ${fmt(q.y - h * tangent[i + 1]!)} ${fmt(q.x)} ${fmt(q.y)}`;
  }
  return d;
}

/** Closes a line path down to `baseline` (area fill). */
export function areaPath(line: string, points: Point[], baseline: number): string {
  if (!points.length) return "";
  return `${line} L${fmt(points[points.length - 1]!.x)} ${fmt(baseline)} L${fmt(points[0]!.x)} ${fmt(baseline)} Z`;
}

/** Indices of x labels to show: at most `max`, evenly spaced from the first. */
export function labelIndices(count: number, max = 7): number[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  // Even rhythm beats forcing the last label in: every `step`-th index from the first.
  const step = Math.ceil(count / max);
  const out: number[] = [];
  for (let i = 0; i < count; i += step) out.push(i);
  return out;
}
