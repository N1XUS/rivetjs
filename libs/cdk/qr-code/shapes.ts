// Rivet-authored (no upstream): QR symbol geometry over an `encodeQr` matrix — module roles (finder / separator / timing /
// alignment / format / version / data), a centred logo area + excavation that only clears data modules (and, opt-in,
// the alignment patterns under the logo), a deterministic non-scannable placeholder, and compact SVG path builders per
// shape. Pure functions: the same input gives the same strings on server and client (RV2103-safe).
import type { QrMatrix } from "./encode.ts";
import { alignmentPositions, drawFunctionPatterns } from "./encode.ts";

/** Area in module coordinates (x / y = top-left module, inclusive). */
export interface QrRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What a module belongs to. `dark` = the always-dark module next to the bottom-left finder. */
export type QrModuleRole = "finder" | "separator" | "timing" | "alignment" | "format" | "version" | "dark" | "data";

/** Module shapes: `square` = standard, `dots` = round modules + rounded finder eyes, `rounded` = connected modules with
 *  rounded outer corners and filleted inner corners (one merged path). */
export type QrShape = "square" | "dots" | "rounded";

/** Matrix data the path builders read (an `encodeQr` result, or an excavated copy of its modules). */
export interface QrModules {
  readonly size: number;
  readonly modules: Uint8Array;
}

/** Top-left modules of the three 7 × 7 finder patterns (top-left, top-right, bottom-left). */
export const finderOrigins = (size: number): readonly (readonly [number, number])[] => [
  [0, 0],
  [size - 7, 0],
  [0, size - 7],
];

/** Whether (x, y) lies in a 7 × 7 finder pattern. */
export const isFinderModule = (size: number, x: number, y: number): boolean => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);

/** The role of module (x, y) of a `version` symbol (`size = version * 4 + 17`). */
export const moduleRole = (version: number, x: number, y: number): QrModuleRole => {
  const size = version * 4 + 17;
  if (isFinderModule(size, x, y)) return "finder";
  if ((x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8)) return "separator";
  if (x === 8 && y === size - 8) return "dark";
  if ((y === 8 && (x <= 8 || x >= size - 8)) || (x === 8 && (y <= 8 || y >= size - 7))) return "format";
  if (version >= 7 && ((x >= size - 11 && x < size - 8 && y < 6) || (y >= size - 11 && y < size - 8 && x < 6))) return "version";
  if (x === 6 || y === 6) return "timing";
  const pos = alignmentPositions(version);
  const last = pos.length - 1;
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      if (Math.abs(x - pos[i]!) <= 2 && Math.abs(y - pos[j]!) <= 2) return "alignment";
    }
  }
  return "data";
};

/** A centred square of about `ratio` × the symbol side, same parity as `size` (so it sits exactly in the middle). */
export const centerRect = (size: number, ratio: number): QrRect => {
  let side = Math.max(1, Math.round(size * Math.min(Math.max(ratio, 0), 1)));
  if (side % 2 !== size % 2) side += side < size ? 1 : -1;
  const start = (size - side) / 2;
  return { x: start, y: start, width: side, height: side };
};

export interface QrExcavateOptions {
  /** Keep alignment patterns inside the area (they are function patterns, not data). @default true */
  keepAlignment?: boolean;
}

/** A copy of `qr.modules` with the data modules inside `rect` cleared (light). Finder, separator, timing, format, version
 *  and dark modules are never touched; alignment modules only when `keepAlignment: false`. The cleared data costs ECC
 *  capacity: pair it with `ecc: "H"` and keep the area small (≈ ≤ 25 % of the side). */
export const excavate = (qr: QrMatrix, rect: QrRect, options: QrExcavateOptions = {}): Uint8Array => {
  const keepAlignment = options.keepAlignment ?? true;
  const out = qr.modules.slice();
  const x1 = Math.min(qr.size, rect.x + rect.width);
  const y1 = Math.min(qr.size, rect.y + rect.height);
  for (let y = Math.max(0, rect.y); y < y1; y++) {
    for (let x = Math.max(0, rect.x); x < x1; x++) {
      const i = y * qr.size + x;
      if (qr.functions[i] === 0) out[i] = 0;
      else if (!keepAlignment && moduleRole(qr.version, x, y) === "alignment") out[i] = 0;
    }
  }
  return out;
};

/** A symbol-shaped placeholder (real function patterns of `version`, pseudo-random data modules from a fixed seed). Not a
 *  valid code: no format information, so scanners reject it. Deterministic. */
export const placeholderQr = (version = 2): QrMatrix => {
  const g = drawFunctionPatterns(version);
  const { size, modules, functions } = g;
  let seed = 0x2f6b3a1d;
  for (let i = 0; i < modules.length; i++) {
    if (functions[i] === 1) {
      // Format modules light: the placeholder must not look decodable.
      const x = i % size;
      const y = (i / size) | 0;
      const role = moduleRole(version, x, y);
      if (role === "format") modules[i] = 0;
      continue;
    }
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    modules[i] = (seed >>> 0) % 5 < 2 ? 1 : 0;
  }
  return { version, size, ecc: "L", mask: 0, modules, functions };
};

/* -------------------------------------------------------------------------------------------------
 * SVG paths (module units: module (x, y) covers [x, x + 1] × [y, y + 1])
 * -----------------------------------------------------------------------------------------------*/

/** Paths of one symbol: `body` = every dark module outside the finder patterns, `eyes` = the three finder patterns.
 *  `square` / `rounded`: both are fill paths (nonzero). `dots`: `body` is a stroke path of zero-length segments (draw it
 *  with `stroke-linecap: round` and `stroke-width` < 1 — one dot per module, ≈ 8 bytes each), `eyes` a fill path for
 *  `fill-rule: evenodd` (rounded ring + rounded centre). */
export interface QrPaths {
  readonly body: string;
  readonly eyes: string;
}

const num = (v: number): string => {
  const r = Math.round(v * 1000) / 1000;
  return String(r);
};

const darkAt = (m: QrModules, mask: (x: number, y: number) => boolean, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < m.size && y < m.size && m.modules[y * m.size + x] === 1 && mask(x, y);

/** Horizontal runs of dark modules as relative rectangles: `M x y h n v1 h-n z m dx dy …`. */
const squarePath = (m: QrModules, mask: (x: number, y: number) => boolean): string => {
  let d = "";
  let px = 0;
  let py = 0;
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!darkAt(m, mask, x, y)) continue;
      let w = 1;
      while (darkAt(m, mask, x + w, y)) w++;
      d += d === "" ? `M${x} ${y}` : `m${x - px} ${y - py}`;
      d += `h${w}v1h-${w}z`;
      px = x;
      py = y;
      x += w - 1;
    }
  }
  return d;
};

/** Rounded rectangle (clockwise), corners `tl` / `tr` / `br` / `bl` rounded with radius `r` when set. */
const roundedRect = (x: number, y: number, w: number, h: number, r: number, tl: boolean, tr: boolean, br: boolean, bl: boolean): string => {
  const a = `A${num(r)} ${num(r)} 0 0 1 `;
  let d = `M${num(tl ? x + r : x)} ${y}H${num(tr ? x + w - r : x + w)}`;
  if (tr) d += `${a}${x + w} ${num(y + r)}`;
  d += `V${num(br ? y + h - r : y + h)}`;
  if (br) d += `${a}${num(x + w - r)} ${y + h}`;
  d += `H${num(bl ? x + r : x)}`;
  if (bl) d += `${a}${x} ${num(y + h - r)}`;
  d += `V${num(tl ? y + r : y)}`;
  if (tl) d += `${a}${num(x + r)} ${y}`;
  return `${d}Z`;
};

/** Connected modules: one rectangle per horizontal run, outer corners rounded where both edge neighbours are light,
 *  concave fillets in light modules whose two edge neighbours and diagonal toward a corner are dark. */
const roundedPath = (m: QrModules, mask: (x: number, y: number) => boolean, r = 0.5): string => {
  let d = "";
  const dark = (x: number, y: number): boolean => darkAt(m, mask, x, y);
  const f = (v: number): string => num(v);
  const arc = `A${f(r)} ${f(r)} 0 0 0 `;
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (dark(x, y)) {
        let w = 1;
        while (dark(x + w, y)) w++;
        const e = x + w - 1;
        d += roundedRect(x, y, w, 1, r, !dark(x, y - 1), !dark(e, y - 1), !dark(e, y + 1), !dark(x, y + 1));
        x = e;
        continue;
      }
      // Light module: inner (concave) corners.
      const l = dark(x - 1, y);
      const rt = dark(x + 1, y);
      const t = dark(x, y - 1);
      const b = dark(x, y + 1);
      if (l && t && dark(x - 1, y - 1)) d += `M${x} ${y}H${f(x + r)}${arc}${x} ${f(y + r)}Z`;
      if (rt && t && dark(x + 1, y - 1)) d += `M${x + 1} ${y}V${f(y + r)}${arc}${f(x + 1 - r)} ${y}Z`;
      if (rt && b && dark(x + 1, y + 1)) d += `M${x + 1} ${y + 1}H${f(x + 1 - r)}${arc}${x + 1} ${f(y + 1 - r)}Z`;
      if (l && b && dark(x - 1, y + 1)) d += `M${x} ${y + 1}V${f(y + 1 - r)}${arc}${f(x + r)} ${y + 1}Z`;
    }
  }
  return d;
};

/** One zero-length segment per dark module centre (`M x.5 y.5h0 m dx dy h0 …`), for round stroke caps. */
const dotsPath = (m: QrModules, mask: (x: number, y: number) => boolean): string => {
  let d = "";
  let px = 0;
  let py = 0;
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!darkAt(m, mask, x, y)) continue;
      d += d === "" ? `M${x + 0.5} ${y + 0.5}h0` : `m${x - px} ${y - py}h0`;
      px = x;
      py = y;
    }
  }
  return d;
};

/** Finder eyes for `dots`: 7 × 7 ring (outer radius 2, hole radius 1) + 3 × 3 centre (radius 1), for evenodd fill. */
const dotEyes = (size: number): string => {
  let d = "";
  for (const [x, y] of finderOrigins(size)) {
    d += roundedRect(x, y, 7, 7, 2, true, true, true, true);
    d += roundedRect(x + 1, y + 1, 5, 5, 1, true, true, true, true);
    d += roundedRect(x + 2, y + 2, 3, 3, 1, true, true, true, true);
  }
  return d;
};

/** SVG paths of `m` in `shape`. Pass an excavated `modules` copy to leave a logo area empty. */
export const qrPaths = (m: QrModules, shape: QrShape = "square"): QrPaths => {
  const size = m.size;
  const body = (x: number, y: number): boolean => !isFinderModule(size, x, y);
  const eye = (x: number, y: number): boolean => isFinderModule(size, x, y);
  if (shape === "dots") return { body: dotsPath(m, body), eyes: dotEyes(size) };
  if (shape === "rounded") return { body: roundedPath(m, body), eyes: roundedPath(m, eye) };
  return { body: squarePath(m, body), eyes: squarePath(m, eye) };
};
