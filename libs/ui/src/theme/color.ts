// OKLCH / OKLab / sRGB conversions, CSS `color-mix(in oklab, …)` and WCAG 2 contrast for the theme tools.
// Pure functions, no DOM: the theme builder previews with them and the theme tests check contrast with them.

/** OKLCH colour: `l` 0–1, `c` ≥ 0, `h` degrees; `alpha` 0–1 (default 1). */
export interface Oklch {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

/** OKLab colour (`alpha` 0–1, default 1). */
export interface Oklab {
  l: number;
  a: number;
  b: number;
  alpha?: number;
}

/** sRGB colour, channels 0–1 (may fall outside 0–1 before clamping), `alpha` 0–1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

const OKLCH = /^oklch\(\s*([0-9.]+)(%?)\s+([0-9.]+)\s+([0-9.]+|none)\s*(?:\/\s*([0-9.]+)(%?)\s*)?\)$/;

/** Parses `oklch(L C H)` / `oklch(L% C H)` / `oklch(L C H / A)` (`none` hue = 0); `null` for anything else (e.g. `var(…)`). */
export function parseOklch(value: string): Oklch | null {
  const m = OKLCH.exec(value.trim());
  if (!m) return null;
  const l = parseFloat(m[1]!) / (m[2] ? 100 : 1);
  const alpha = m[5] === undefined ? 1 : parseFloat(m[5]) / (m[6] ? 100 : 1);
  return { l: l > 1 ? l / 100 : l, c: parseFloat(m[3]!), h: m[4] === "none" ? 0 : parseFloat(m[4]!), alpha };
}

/** `#rgb` / `#rrggbb` → OKLCH. */
export function hexToOklch(hex: string): Oklch {
  let s = hex.replace("#", "");
  if (s.length === 3) s = [...s].map((ch) => ch + ch).join("");
  const n = parseInt(s, 16);
  return oklabToOklch(rgbToOklab({ r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, alpha: 1 }));
}

/** OKLCH → hex (gamut-clamped per channel). */
export function oklchToHex(color: Oklch): string {
  const { r, g, b } = clampRgb(oklabToRgb(oklchToOklab(color)));
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function oklchToOklab({ l, c, h, alpha = 1 }: Oklch): Oklab {
  const rad = (h * Math.PI) / 180;
  return { l, a: c * Math.cos(rad), b: c * Math.sin(rad), alpha };
}

export function oklabToOklch({ l, a, b, alpha = 1 }: Oklab): Oklch {
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l, c: Math.hypot(a, b), h, alpha };
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.sign(v) * Math.abs(v) ** (1 / 2.4) - 0.055);

export function rgbToOklab({ r, g, b, alpha }: Rgb): Oklab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    alpha,
  };
}

export function oklabToRgb({ l, a, b, alpha = 1 }: Oklab): Rgb {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: fromLinear(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: fromLinear(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: fromLinear(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
    alpha,
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function clampRgb(c: Rgb): Rgb {
  return { r: clamp01(c.r), g: clamp01(c.g), b: clamp01(c.b), alpha: clamp01(c.alpha) };
}

/** True when the OKLCH colour is inside sRGB (small tolerance). */
export function inSrgb(color: Oklch): boolean {
  const { r, g, b } = oklabToRgb(oklchToOklab(color));
  const e = 1e-4;
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e;
}

/**
 * CSS Color 5 `color-mix(in oklab, a pa, b pb)`: percentages normalised to 100 % (a sum below 100 % scales the
 * result's alpha by the sum), premultiplied-alpha interpolation. `transparent` = `{ l: 0, a: 0, b: 0, alpha: 0 }`.
 */
export function mixOklab(a: Oklab, pa: number | undefined, b: Oklab, pb: number | undefined): Oklab {
  let p1 = pa ?? (pb === undefined ? 50 : 100 - pb);
  let p2 = pb ?? 100 - p1;
  const sum = p1 + p2;
  const scale = sum < 100 ? sum / 100 : 1;
  p1 /= sum;
  p2 /= sum;
  const a1 = a.alpha ?? 1;
  const a2 = b.alpha ?? 1;
  const alpha = a1 * p1 + a2 * p2;
  if (alpha === 0) return { l: 0, a: 0, b: 0, alpha: 0 };
  const ch = (x: number, y: number) => (x * a1 * p1 + y * a2 * p2) / alpha;
  return { l: ch(a.l, b.l), a: ch(a.a, b.a), b: ch(a.b, b.b), alpha: alpha * scale };
}

/** Source-over compositing of `top` on an opaque `bottom` in sRGB (what a browser paints). */
export function compositeRgb(top: Rgb, bottom: Rgb): Rgb {
  const a = top.alpha;
  return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), alpha: 1 };
}

/** WCAG 2 relative luminance of an (opaque, clamped) sRGB colour. */
export function luminance(c: Rgb): number {
  const { r, g, b } = clampRgb(c);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2 contrast ratio (1–21) of two opaque sRGB colours. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** APCA screen luminance (APCA-W3 0.1.9 / 0.0.98G-4g constants): simple 2.4 exponent, soft black clamp. */
function apcaY(c: Rgb): number {
  const { r, g, b } = clampRgb(c);
  const y = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
  return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;
}

/**
 * APCA lightness contrast Lc of text `fg` on `bg` (opaque sRGB; APCA-W3 0.1.9): positive for dark text on a light
 * background, negative for light on dark; |Lc| 60 = body text, 45 = large text, 30 = non-text UI (APCA bronze levels).
 */
export function apcaContrast(fg: Rgb, bg: Rgb): number {
  const yt = apcaY(fg);
  const yb = apcaY(bg);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const sapc = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }
  const sapc = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}
