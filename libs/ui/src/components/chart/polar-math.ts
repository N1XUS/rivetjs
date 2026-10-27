// Rivet-authored polar chart geometry (pure functions, no DOM) in a 0…100 viewBox centred on (50, 50).
// Angles are degrees, counter-clockwise from 3 o'clock (the usual maths / recharts convention); SVG y grows downwards,
// so a point is (cx + r·cos a, cy − r·sin a). A sweep from `start` to a smaller `end` runs clockwise on screen.

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();
const RAD = Math.PI / 180;

/** The point at radius `r` and angle `a` (degrees) around (50, 50). */
export function polar(r: number, a: number): { x: number; y: number } {
  return { x: 50 + r * Math.cos(a * RAD), y: 50 - r * Math.sin(a * RAD) };
}

/**
 * A ring sector (or a pie slice when `inner` is 0) from angle `a0` to `a1`. A sweep of 360° or more is a full ring
 * (two half arcs: one SVG arc cannot end where it starts).
 */
export function sectorPath(outer: number, inner: number, a0: number, a1: number): string {
  const span = a1 - a0;
  if (Math.abs(span) >= 359.999) {
    const mid = a0 + span / 2;
    const half = (r: number, from: number, to: number) => {
      const p = polar(r, to);
      return `A${fmt(r)} ${fmt(r)} 0 0 ${to < from ? 1 : 0} ${fmt(p.x)} ${fmt(p.y)}`;
    };
    const o0 = polar(outer, a0);
    const ring = `M${fmt(o0.x)} ${fmt(o0.y)} ${half(outer, a0, mid)} ${half(outer, mid, a0 + span)} Z`;
    if (inner <= 0) return ring;
    const i0 = polar(inner, a0);
    return `${ring} M${fmt(i0.x)} ${fmt(i0.y)} ${half(inner, a0 + span, mid)} ${half(inner, mid, a0)} Z`;
  }
  const large = Math.abs(span) > 180 ? 1 : 0;
  const sweep = a1 < a0 ? 1 : 0;
  const p0 = polar(outer, a0);
  const p1 = polar(outer, a1);
  let d = `M${fmt(p0.x)} ${fmt(p0.y)} A${fmt(outer)} ${fmt(outer)} 0 ${large} ${sweep} ${fmt(p1.x)} ${fmt(p1.y)}`;
  if (inner > 0) {
    const q1 = polar(inner, a1);
    const q0 = polar(inner, a0);
    d += ` L${fmt(q1.x)} ${fmt(q1.y)} A${fmt(inner)} ${fmt(inner)} 0 ${large} ${1 - sweep} ${fmt(q0.x)} ${fmt(q0.y)}`;
  } else d += " L50 50";
  return `${d} Z`;
}

/** A closed polygon through the points (radar shapes, polygon grids). */
export function polygonPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${fmt(p.x)} ${fmt(p.y)}`).join(" ") + " Z";
}

/** A circle as a path (circular grids). */
export function circlePath(r: number): string {
  return `M${fmt(50 - r)} 50 A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(50 + r)} 50 A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(50 - r)} 50 Z`;
}

/** Splits [start, end] into one sector per value (proportional), with `pad` degrees between neighbours. */
export function splitAngles(values: number[], start: number, end: number, pad: number): { a0: number; a1: number; mid: number }[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  const dir = end < start ? -1 : 1;
  const span = Math.abs(end - start);
  const n = values.filter((v) => v > 0).length;
  const padding = n > 1 ? Math.min(pad, span / n / 2) : 0;
  const free = span - padding * (n > 1 ? n : 0);
  let at = start;
  return values.map((v) => {
    const len = total ? (Math.max(0, v) / total) * free : 0;
    const a0 = at + (v > 0 ? (dir * padding) / 2 : 0);
    const a1 = a0 + dir * len;
    at = a1 + (v > 0 ? (dir * padding) / 2 : 0);
    return { a0, a1, mid: (a0 + a1) / 2 };
  });
}
