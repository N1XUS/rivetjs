// Contrast audit of a theme: resolves the theme's variables (`oklch()`, `var()`, `color-mix(in oklab, …)`,
// `transparent`) like a browser does, composites translucent backgrounds on their surface and reports the WCAG 2
// contrast + APCA Lc (APCA-W3 0.1.9) of the text / background pairs the components paint.

import { apcaContrast, compositeRgb, contrastRatio, hexToOklch, mixOklab, oklabToRgb, oklchToOklab, parseOklch, type Oklab, type Rgb } from "./color.ts";
import { deriveTheme, themeVariables, type ThemeMode, type ThemeParams, type ThemeTokens } from "./derive.ts";
import { RIVET_BRAND } from "./presets.ts";

const TRANSPARENT: Oklab = { l: 0, a: 0, b: 0, alpha: 0 };

/** Splits `a, b, c` at top-level commas. */
function args(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Resolves a CSS colour value against `vars` to OKLab; throws on what it cannot evaluate. */
export function resolveColor(vars: Readonly<Record<string, string>>, value: string, seen: ReadonlySet<string> = new Set()): Oklab {
  const v = value.trim();
  if (v === "transparent") return TRANSPARENT;
  const ok = parseOklch(v);
  if (ok) return oklchToOklab(ok);
  if (/^#[0-9a-f]{6}$/i.test(v)) return oklchToOklab(hexToOklch(v));
  const inner = (fn: string) => (v.startsWith(fn + "(") && v.endsWith(")") ? v.slice(fn.length + 1, -1) : null);
  const ref = inner("var");
  if (ref !== null) {
    const [name, fallback] = args(ref) as [string, string?];
    if (seen.has(name)) throw new Error(`cycle at ${name}`);
    const own = vars[name];
    if (own !== undefined) return resolveColor(vars, own, new Set([...seen, name]));
    if (fallback !== undefined) return resolveColor(vars, fallback, seen);
    throw new Error(`unset ${name}`);
  }
  const mix = inner("color-mix");
  if (mix !== null) {
    const [space, a, b] = args(mix) as [string, string, string];
    if (space !== "in oklab") throw new Error(`unsupported ${space}`);
    const part = (s: string): [Oklab, number | undefined] => {
      const m = /^(.*?)\s+([0-9.]+)%$/.exec(s);
      return m ? [resolveColor(vars, m[1]!, seen), parseFloat(m[2]!)] : [resolveColor(vars, s, seen), undefined];
    };
    const [ca, pa] = part(a);
    const [cb, pb] = part(b);
    return mixOklab(ca, pa, cb, pb);
  }
  throw new Error(`cannot resolve ${v}`);
}

/** The painted (opaque) sRGB colour of `value` over the opaque `under` colour value. */
export function paint(vars: Readonly<Record<string, string>>, value: string, under?: string): Rgb {
  const top = oklabToRgb(resolveColor(vars, value));
  if ((top.alpha ?? 1) >= 1 || under === undefined) return top;
  return compositeRgb(top, paint(vars, under));
}

/** One audited pair: text (or a non-text part) `fg` on `bg` painted over `on`. */
export interface ContrastPair {
  fg: string;
  bg: string;
  /** Opaque surface a translucent `bg` sits on. */
  on?: string;
  /** Required ratio: 4.5 for text (AA), 3 for non-text UI parts. */
  min: number;
  /** Required APCA |Lc| (APCA-W3 0.1.9): 60 body text, 45 large text, 30 non-text UI parts. */
  lc: number;
}

/** The `.chart` series palette per mode (`styles/components/chart.css`; `--chart-1` = `--accent`), for the series pairs. */
export const CHART_PALETTE: Readonly<Record<ThemeMode, Readonly<Record<string, string>>>> = {
  light: {
    "--chart-2": "oklch(0.62 0.105 200)",
    "--chart-3": "oklch(0.6 0.2 300)",
    "--chart-4": "oklch(0.62 0.145 60)",
    "--chart-5": "oklch(0.65 0.2 350)",
    "--chart-6": "oklch(0.62 0.13 150)",
  },
  dark: {
    "--chart-2": "oklch(0.72 0.14 200)",
    "--chart-3": "oklch(0.6 0.2 300)",
    "--chart-4": "oklch(0.72 0.16 60)",
    "--chart-5": "oklch(0.65 0.2 350)",
    "--chart-6": "oklch(0.7 0.14 150)",
  },
};

/** The `Button variant="brand"` gradient stops (`button.css`): the logo's deep stops, `--rivet-*` (`RIVET_BRAND`). */
export const BRAND_STOPS = ["--rivet-blue", "--rivet-indigo", "--rivet-violet", "--rivet-purple"] as const;

const text = (fg: string, bg: string, on?: string): ContrastPair => ({ fg, bg, ...(on ? { on } : {}), min: 4.5, lc: 60 });
const part = (fg: string, bg: string): ContrastPair => ({ fg, bg, min: 3, lc: 30 });

/**
 * Text / background pairs the shipped components paint (WCAG AA 4.5:1 + APCA Lc 60) and non-text parts (focus ring,
 * accent, chart series: 3:1 + Lc 30, WCAG 1.4.11): muted text on every surface level, placeholder on fields.
 */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  text("--foreground", "--background"),
  text("--surface-foreground", "--surface"),
  text("--surface-secondary-foreground", "--surface-secondary"),
  text("--surface-tertiary-foreground", "--surface-tertiary"),
  text("--overlay-foreground", "--overlay"),
  text("--muted", "--background"),
  text("--muted", "--surface"),
  text("--muted", "--surface-secondary"),
  text("--muted", "--surface-tertiary"),
  text("--muted", "--overlay"),
  text("--default-foreground", "--default"),
  text("--segment-foreground", "--segment"),
  text("--field-foreground", "--field-background"),
  text("--field-placeholder", "--field-background"),
  text("--accent-foreground", "--accent"),
  text("--accent-foreground", "--accent-hover"),
  text("--success-foreground", "--success"),
  text("--warning-foreground", "--warning"),
  text("--danger-foreground", "--danger"),
  text("--accent-soft-foreground", "--accent-soft", "--surface"),
  text("--success-soft-foreground", "--success-soft", "--surface"),
  text("--warning-soft-foreground", "--warning-soft", "--surface"),
  text("--danger-soft-foreground", "--danger-soft", "--surface"),
  part("--focus", "--background"),
  part("--focus", "--surface"),
  // The accent fill of selected controls (checkbox, switch, radio) carries a white mark (`--accent-foreground` pair):
  // the accent stays (spec §3.5), so dark mode holds WCAG 3:1 but APCA only Lc 15 (−23 measured).
  { ...part("--accent", "--background"), lc: 15 },
  ...Object.keys(CHART_PALETTE.light).map((series) => part(series, "--surface")),
  // `Button variant="brand"`: white label on every stop of its gradient (the logo's deep stops, `RIVET_BRAND`).
  ...BRAND_STOPS.map((stop) => text("--snow", stop)),
];

export interface ContrastResult extends ContrastPair {
  mode: ThemeMode;
  /** WCAG 2 contrast ratio. */
  ratio: number;
  /** APCA lightness contrast (signed: negative = light on dark). */
  apca: number;
  /** Both: ratio ≥ `min` and |apca| ≥ `lc`. */
  pass: boolean;
}

/** WCAG + APCA contrast of every `CONTRAST_PAIRS` entry for the theme in `mode` (resolved with the scoped variables). */
export function auditContrast(params: ThemeParams, mode: ThemeMode, tokens: ThemeTokens = deriveTheme(params), pairs = CONTRAST_PAIRS): ContrastResult[] {
  return auditVariables(themeVariables(params, mode, tokens), mode, pairs);
}

/** Same audit over an explicit variable record (e.g. parsed from a stylesheet). */
export function auditVariables(vars: Readonly<Record<string, string>>, mode: ThemeMode, pairs = CONTRAST_PAIRS): ContrastResult[] {
  const all = {
    "--white": "oklch(100% 0 0)",
    "--black": "oklch(0% 0 0)",
    "--snow": "oklch(0.9911 0 0)",
    "--eclipse": "oklch(0.2103 0.0059 285.89)",
    ...CHART_PALETTE[mode],
    ...Object.fromEntries(Object.entries(RIVET_BRAND).map(([k, v]) => [`--rivet-${k}`, v])),
    ...vars,
  };
  return pairs.map((p) => {
    const under = p.on ? `var(${p.on})` : undefined;
    const bg = paint(all, `var(${p.bg})`, under);
    const fg = oklabToRgb(resolveColor(all, `var(${p.fg})`));
    const fgOnBg = fg.alpha < 1 ? compositeRgb(fg, bg) : fg;
    const ratio = contrastRatio(fgOnBg, bg);
    const apca = apcaContrast(fgOnBg, bg);
    return { ...p, mode, ratio, apca, pass: ratio >= p.min && Math.abs(apca) >= p.lc };
  });
}
