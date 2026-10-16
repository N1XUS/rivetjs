// Ported from HeroUI v3.2.6 apps/docs/src/app/[lang]/themes/utils/generate-theme-colors.ts,
// hooks/use-computed-theme-vars.ts and utils/generate-css-variables.ts (Apache-2.0, © 2025 NextUI Inc.).
// Modified: framework-free (no React hooks / nuqs / Next), fonts dropped, one `deriveTheme()` entry, record-based
// output, Rivet `accentDark` extension, selectors / header of the CSS output configurable.

import { parseOklch, type Oklch } from "./color.ts";

/* -------------------------------------------------------------------------------------------------
 * Default theme values (from styles/themes/default/variables.css)
 * -----------------------------------------------------------------------------------------------*/

/** HeroUI default accent `oklch(0.6204 0.195 253.83)`. */
export const DEFAULT_ACCENT = { chroma: 0.195, hue: 253.83, lightness: 0.6204 } as const;

/** HeroUI theme builder's default gray chroma (`base`). */
export const DEFAULT_BASE = 0.0015;

const SEMANTIC_HUE_BLEND_FACTOR = 0.12; // 12% influence from base hue

// Baseline neutrals the builder re-tints with the accent hue and the gray chroma.
const DEFAULT_THEME_VALUES = {
  dark: {
    background: { c: 0.005, h: 285.823, l: 0.12 },
    border: { c: 0.006, h: 286.033, l: 0.28 },
    default: { c: 0.006, h: 286.033, l: 0.274 },
    foreground: { c: 0, h: 0, l: 0.9911 },
    muted: { c: 0.015, h: 286.067, l: 0.705 },
    overlay: { c: 0.0059, h: 285.89, l: 0.2103 },
    scrollbar: { c: 0.015, h: 286.067, l: 0.705 },
    segment: { c: 0.01, h: 285.93, l: 0.3964 },
    separator: { c: 0.006, h: 286.033, l: 0.25 },
    surface: { c: 0.0059, h: 285.89, l: 0.2103 },
    surfaceSecondary: { c: 0.0037, h: 286.14, l: 0.257 },
    surfaceTertiary: { c: 0.0024, h: 247.91, l: 0.2721 },
  },
  light: {
    background: { c: 0, h: 0, l: 0.9702 },
    border: { c: 0.004, h: 286.32, l: 0.9 },
    default: { c: 0.001, h: 286.375, l: 0.94 },
    foreground: { c: 0.0059, h: 285.89, l: 0.2103 },
    muted: { c: 0.0138, h: 285.94, l: 0.5517 },
    overlay: { c: 0, h: 0, l: 1 },
    scrollbar: { c: 0.006, h: 286.286, l: 0.871 },
    segment: { c: 0, h: 0, l: 1 },
    separator: { c: 0.004, h: 286.32, l: 0.92 },
    surface: { c: 0, h: 0, l: 1 },
    surfaceSecondary: { c: 0.0013, h: 286.37, l: 0.9524 },
    surfaceTertiary: { c: 0.0013, h: 286.37, l: 0.9373 },
  },
};

// Semantic colour defaults (from variables.css)
const SEMANTIC_COLORS = {
  danger: { chromaDark: 0.1967, chromaLight: 0.2328, hue: 25.74, hueDark: 24.63, lightnessDark: 0.594, lightnessLight: 0.6532 },
  success: { chromaDark: 0.1935, chromaLight: 0.1935, hue: 150.81, lightnessDark: 0.7329, lightnessLight: 0.7329 },
  warning: { chromaDark: 0.1388, chromaLight: 0.1585, hue: 72.33, hueDark: 76.34, lightnessDark: 0.8203, lightnessLight: 0.7819 },
};

type SemanticConfig = { chromaDark: number; chromaLight: number; hue: number; hueDark?: number; lightnessDark: number; lightnessLight: number };

/**
 * Adaptive accents: a black accent (`oklch(0 0 0)`) turns near-white in dark mode (upstream `adaptiveColors`).
 * Keyed by `oklch(${lightness} ${chroma} ${hue})`.
 */
export const ADAPTIVE_COLORS: Record<string, { light: string; dark: string }> = {
  "oklch(0 0 0)": { dark: "oklch(0.9848 0 0)", light: "oklch(0 0 0)" },
};

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type ThemeMode = "light" | "dark";

/** Semantic colour override for success / warning / danger. */
export interface SemanticColorOverride {
  /** OKLCH colour string, e.g. `"oklch(0.5148 0.1337 146.82)"`. */
  color: string;
  /** Foreground on the colour; computed from its lightness when omitted. */
  foreground?: string;
}

/** Per-mode overrides (upstream `SemanticOverrides`). */
export interface SemanticOverrides {
  light?: { accentForeground?: string; danger?: SemanticColorOverride; success?: SemanticColorOverride; warning?: SemanticColorOverride };
  dark?: { accentForeground?: string; danger?: SemanticColorOverride; success?: SemanticColorOverride; warning?: SemanticColorOverride };
}

export const RADIUS_IDS = ["none", "extra-small", "small", "medium", "large", "extra-large"] as const;
export type RadiusId = (typeof RADIUS_IDS)[number];

/** Radius id → CSS length (upstream `radiusCssMap`). */
export const RADIUS_CSS: Record<RadiusId, string> = {
  none: "0",
  "extra-small": "0.125rem",
  small: "0.25rem",
  medium: "0.5rem",
  large: "0.75rem",
  "extra-large": "1rem",
};

/** Theme builder inputs (upstream `ThemeValues` minus the font). */
export interface ThemeParams {
  /** Accent lightness 0–1. */
  lightness: number;
  /** Accent chroma 0–0.4. */
  chroma: number;
  /** Accent hue 0–360; also tints every neutral. */
  hue: number;
  /** Gray chroma (upstream `base`, 0–0.02); default `min(chroma * 0.05, 0.015)` like `generateThemeColors`. */
  base?: number;
  /** `--radius` (default `medium`). */
  radius?: RadiusId;
  /** `--field-radius` (default `large`). */
  formRadius?: RadiusId;
  /** Vibrant (more saturated, less contrast) soft foregrounds. */
  vibrant?: boolean;
  semanticOverrides?: SemanticOverrides;
  /** Rivet extension: a separate dark-mode accent (upstream uses the same accent in both modes). */
  accentDark?: Oklch;
  /**
   * Rivet extension: final per-mode values (applied after the derivation, e.g. a contrast fix): base tokens or a
   * derived formula of the stylesheet (`--accent-soft-foreground`, …), which then wins over `derivedFormulas`.
   */
  overrides?: { light?: Partial<Record<`--${string}`, string>>; dark?: Partial<Record<`--${string}`, string>> };
  /**
   * Motion (`@rivetjs/motion` spec D17): `overlays: "spring"` sets the cdk motion token `--rv-motion-spring` (Modal /
   * Drawer enter + exit on a spring `linear()` curve); a string = the token value (`"<visualDuration s> <bounce>"`).
   * Unset = the theme's own easings.
   */
  motion?: { overlays?: "spring" | (string & {}) };
}

/** `--rv-motion-spring` for `motion: { overlays: "spring" }`: Motion's default visual duration 0.3 s, bounce 0.2. */
export const OVERLAY_SPRING = "0.3 0.2";
const motionToken = (params: ThemeParams): string | undefined => (params.motion?.overlays === "spring" ? OVERLAY_SPRING : params.motion?.overlays || undefined);

/** One colour token in both modes. */
export interface ThemeColor {
  name: string;
  light: string;
  dark: string;
}

/* -------------------------------------------------------------------------------------------------
 * Utility functions
 * -----------------------------------------------------------------------------------------------*/

const adjustHue = (color: Oklch, h: number): Oklch => ({ ...color, h });
const adjustChroma = (color: Oklch, c: number): Oklch => ({ ...color, c: Math.max(0, c) });

/** `oklch(L% C H)` with the builder's rounding (2 / 4 / 2 decimals). */
export function formatOklch(color: Oklch): string {
  return `oklch(${(color.l * 100).toFixed(2)}% ${color.c.toFixed(4)} ${color.h.toFixed(2)})`;
}

function calculateSemanticHue(semanticDefaultHue: number, baseHue: number): number {
  let h = semanticDefaultHue + (baseHue - DEFAULT_ACCENT.hue) * SEMANTIC_HUE_BLEND_FACTOR;
  while (h < 0) h += 360;
  while (h >= 360) h -= 360;
  return h;
}

/** Foreground for an arbitrary background (lightness threshold 0.65). */
export function calculateForeground(oklch: string): string {
  const color = parseOklch(oklch);
  if (!color) return "oklch(99.11% 0 0)";
  const { c, h, l } = color;
  return l > 0.65 ? `oklch(15% ${Math.min(c * 0.3, 0.05).toFixed(4)} ${h.toFixed(2)})` : `oklch(98% ${Math.min(c * 0.1, 0.02).toFixed(4)} ${h.toFixed(2)})`;
}

/** Text colour on a solid accent: dark above lightness 0.65, snow below. */
export function calculateAccentForeground(lightness: number, chroma: number, hue: number): string {
  return lightness > 0.65 ? `oklch(15% ${Math.min(chroma * 0.2, 0.03).toFixed(4)} ${hue.toFixed(2)})` : "oklch(99.11% 0 0)";
}

function generateSemanticColor(name: string, config: SemanticConfig, baseHue: number, grayChroma: number): { color: ThemeColor; foreground: ThemeColor } {
  const hue = calculateSemanticHue(config.hue, baseHue);
  const hueDark = calculateSemanticHue(config.hueDark ?? config.hue, baseHue);
  const chromaBoost = 1 + grayChroma * 2;
  const chromaLight = Math.min(config.chromaLight * chromaBoost, 0.35);
  const chromaDark = Math.min(config.chromaDark * chromaBoost, 0.35);
  // Threshold ~0.67: success (0.73), warning (0.78) → dark fg; danger (0.65) → light fg
  const THRESHOLD = 0.67;
  const snow = "oklch(99.11% 0 0)";
  return {
    color: {
      name: `--${name}`,
      light: formatOklch({ c: chromaLight, h: hue, l: config.lightnessLight }),
      dark: formatOklch({ c: chromaDark, h: hueDark, l: config.lightnessDark }),
    },
    foreground: {
      name: `--${name}-foreground`,
      light: config.lightnessLight > THRESHOLD ? formatOklch({ c: 0.0059, h: hue, l: 0.2103 }) : snow,
      dark: config.lightnessDark > THRESHOLD ? formatOklch({ c: 0.0059, h: hueDark, l: 0.2103 }) : snow,
    },
  };
}

function semantic(
  name: "success" | "warning" | "danger",
  hue: number,
  grayChroma: number,
  overrides?: SemanticOverrides,
): { color: ThemeColor; foreground: ThemeColor } {
  const calculated = generateSemanticColor(name, SEMANTIC_COLORS[name], hue, grayChroma);
  const lo = overrides?.light?.[name];
  const dk = overrides?.dark?.[name];
  if (!lo && !dk) return calculated;
  const light = lo?.color ?? calculated.color.light;
  const dark = dk?.color ?? calculated.color.dark;
  return {
    color: { name: `--${name}`, light, dark },
    foreground: { name: `--${name}-foreground`, light: lo?.foreground ?? calculateForeground(light), dark: dk?.foreground ?? calculateForeground(dark) },
  };
}

/* -------------------------------------------------------------------------------------------------
 * Main colour generation (upstream generateThemeColors + getBaseColorVariables)
 * -----------------------------------------------------------------------------------------------*/

/** Authored colour tokens (the ones a theme sets; the stylesheet derives the rest), in upstream output order. */
export const BASE_TOKENS = [
  "--accent",
  "--accent-foreground",
  "--background",
  "--border",
  "--danger",
  "--danger-foreground",
  "--default",
  "--default-foreground",
  "--field-background",
  "--field-border",
  "--field-foreground",
  "--field-placeholder",
  "--focus",
  "--foreground",
  "--muted",
  "--overlay",
  "--overlay-foreground",
  "--scrollbar",
  "--segment",
  "--segment-foreground",
  "--separator",
  "--success",
  "--success-foreground",
  "--surface",
  "--surface-foreground",
  "--surface-secondary",
  "--surface-secondary-foreground",
  "--surface-tertiary",
  "--surface-tertiary-foreground",
  "--warning",
  "--warning-foreground",
] as const;

export type BaseToken = (typeof BASE_TOKENS)[number];

/** Base colour tokens of a theme, per mode. */
export interface ThemeTokens {
  light: Record<BaseToken, string>;
  dark: Record<BaseToken, string>;
}

const key = ({ lightness, chroma, hue }: Pick<ThemeParams, "lightness" | "chroma" | "hue">) => `oklch(${lightness} ${chroma} ${hue})`;

/**
 * Derives every authored colour token of a theme from an accent (lightness / chroma / hue) and a gray chroma,
 * for light and dark mode: HeroUI's theme builder algorithm (neutrals re-tinted with the accent hue, semantic
 * hues blended 12 % toward it, foregrounds picked by lightness), plus the adaptive black accent.
 */
export function deriveTheme(params: ThemeParams): ThemeTokens {
  const { lightness, chroma, hue, semanticOverrides } = params;
  const adaptive = ADAPTIVE_COLORS[key(params)];
  // Upstream: adaptive accents ignore `base` (generateThemeColors without grayChroma).
  const grayChroma = adaptive || params.base === undefined ? Math.min(chroma * 0.05, 0.015) : params.base;
  const L = DEFAULT_THEME_VALUES.light;
  const D = DEFAULT_THEME_VALUES.dark;
  const tint = (c: Oklch, k: number) => formatOklch(adjustChroma(adjustHue(c, hue), grayChroma * k));
  const pair = (name: keyof typeof L, kLight: number, kDark: number) => ({ light: tint(L[name], kLight), dark: tint(D[name], kDark) });

  const accentLight = formatOklch({ c: chroma, h: hue, l: lightness });
  const accentDark = params.accentDark ? formatOklch(params.accentDark) : accentLight;
  const accentFgLight = semanticOverrides?.light?.accentForeground ?? calculateAccentForeground(lightness, chroma, hue);
  const accentFgDark =
    semanticOverrides?.dark?.accentForeground ??
    (params.accentDark
      ? calculateAccentForeground(params.accentDark.l, params.accentDark.c, params.accentDark.h)
      : calculateAccentForeground(lightness, chroma, hue));

  const background = pair("background", 1, 1);
  const foreground = pair("foreground", 1, 1);
  const muted = pair("muted", 2, 2);
  const surface = pair("surface", 0.5, 2);
  const success = semantic("success", hue, grayChroma, semanticOverrides);
  const warning = semantic("warning", hue, grayChroma, semanticOverrides);
  const danger = semantic("danger", hue, grayChroma, semanticOverrides);

  const build = (mode: ThemeMode): Record<BaseToken, string> => {
    const v = (p: { light: string; dark: string }) => p[mode];
    const fg = v(foreground);
    const out: Record<BaseToken, string> = {
      "--accent": mode === "light" ? accentLight : accentDark,
      "--accent-foreground": mode === "light" ? accentFgLight : accentFgDark,
      "--background": v(background),
      "--border": v(pair("border", 1, 1)),
      "--danger": v(danger.color),
      "--danger-foreground": v(danger.foreground),
      "--default": v(pair("default", 1, 1)),
      "--default-foreground": mode === "light" ? formatOklch({ c: 0.0059, h: hue, l: 0.2103 }) : "oklch(99.11% 0 0)",
      "--field-background": v(surface),
      "--field-border": "transparent",
      "--field-foreground": fg,
      "--field-placeholder": v(muted),
      "--focus": mode === "light" ? accentLight : accentDark,
      "--foreground": fg,
      "--muted": v(muted),
      "--overlay": v(pair("overlay", 0.3, 2)),
      "--overlay-foreground": fg,
      "--scrollbar": v(pair("scrollbar", 1, 1)),
      "--segment": v(pair("segment", 1, 1)),
      "--segment-foreground": fg,
      "--separator": v(pair("separator", 1, 1)),
      "--success": v(success.color),
      "--success-foreground": v(success.foreground),
      "--surface": v(surface),
      "--surface-foreground": fg,
      "--surface-secondary": v(pair("surfaceSecondary", 0.8, 1.5)),
      "--surface-secondary-foreground": fg,
      "--surface-tertiary": v(pair("surfaceTertiary", 0.8, 1.5)),
      "--surface-tertiary-foreground": fg,
      "--warning": v(warning.color),
      "--warning-foreground": v(warning.foreground),
    };
    if (adaptive) {
      const accent = adaptive[mode];
      const a = parseOklch(accent);
      out["--accent"] = accent;
      out["--accent-foreground"] = a ? calculateAccentForeground(a.l, a.c, a.h) : calculateAccentForeground(mode === "light" ? 0 : 1, 0, 0);
      out["--focus"] = accent;
    }
    return { ...out, ...params.overrides?.[mode] } as Record<BaseToken, string>;
  };
  return { light: build("light"), dark: build("dark") };
}

/* -------------------------------------------------------------------------------------------------
 * Derived formulas + radius (upstream getDerivedColorFormulas / radiusDerivedVariables)
 * -----------------------------------------------------------------------------------------------*/

/**
 * The `var()`-based formulas of styles/themes/default/variables.css. They must be re-declared on a scoped element
 * (custom properties resolve `var()` where they are declared, not where inherited). Light and dark differ in the
 * soft percentages.
 */
export function derivedFormulas(mode: ThemeMode, options?: { vibrant?: boolean }): Record<string, string> {
  const isLight = mode === "light";
  const [softPct, softHoverPct] = isLight ? ["15%", "20%"] : ["12%", "16%"];
  const sfFg = (name: string, accessible: string) => (options?.vibrant ? `color-mix(in oklab, var(--${name}) 92%, var(--foreground) 8%)` : accessible);
  return {
    "--accent-hover": "color-mix(in oklab, var(--accent) 90%, var(--accent-foreground) 10%)",
    "--accent-soft": `color-mix(in oklab, var(--accent) ${softPct}, transparent)`,
    "--accent-soft-foreground": sfFg(
      "accent",
      isLight ? "color-mix(in oklab, var(--accent) 70%, var(--foreground) 30%)" : "color-mix(in oklab, var(--accent) 80%, var(--foreground) 30%)",
    ),
    "--accent-soft-hover": `color-mix(in oklab, var(--accent) ${softHoverPct}, transparent)`,
    "--background-inverse": "var(--foreground)",
    "--background-secondary": "color-mix(in oklab, var(--background) 96%, var(--foreground) 4%)",
    "--background-tertiary": "color-mix(in oklab, var(--background) 92%, var(--foreground) 8%)",
    "--border-secondary": "color-mix(in oklab, var(--surface) 78%, var(--surface-foreground) 22%)",
    "--border-tertiary": "color-mix(in oklab, var(--surface) 66%, var(--surface-foreground) 34%)",
    "--danger-hover": "color-mix(in oklab, var(--danger) 90%, var(--danger-foreground) 10%)",
    "--danger-soft": "color-mix(in oklab, var(--danger) 15%, transparent)",
    "--danger-soft-foreground": sfFg(
      "danger",
      isLight ? "color-mix(in oklab, var(--danger) 70%, var(--foreground) 40%)" : "color-mix(in oklab, var(--danger) 80%, var(--foreground) 30%)",
    ),
    "--danger-soft-hover": "color-mix(in oklab, var(--danger) 20%, transparent)",
    "--default-hover": "color-mix(in oklab, var(--default) 96%, var(--default-foreground) 4%)",
    "--default-soft": "color-mix(in oklab, var(--default) 50%, transparent)",
    "--default-soft-foreground": "var(--default-foreground)",
    "--default-soft-hover": "color-mix(in oklab, var(--default) 60%, transparent)",
    "--field-border-focus": "color-mix(in oklab, var(--field-border, var(--border)) 74%, var(--field-foreground, var(--foreground)) 22%)",
    "--field-border-hover": "color-mix(in oklab, var(--field-border, var(--border)) 88%, var(--field-foreground, var(--foreground)) 10%)",
    "--field-focus": "var(--field-background, var(--default))",
    "--field-hover": "color-mix(in oklab, var(--field-background, var(--default)) 90%, var(--field-foreground, var(--foreground)) 2%)",
    "--separator-secondary": "color-mix(in oklab, var(--surface) 85%, var(--surface-foreground) 15%)",
    "--separator-tertiary": "color-mix(in oklab, var(--surface) 81%, var(--surface-foreground) 19%)",
    "--success-hover": "color-mix(in oklab, var(--success) 90%, var(--success-foreground) 10%)",
    "--success-soft": `color-mix(in oklab, var(--success) ${softPct}, transparent)`,
    "--success-soft-foreground": sfFg(
      "success",
      isLight ? "color-mix(in oklab, var(--success) 80%, var(--foreground) 60%)" : "color-mix(in oklab, var(--success) 80%, var(--foreground) 30%)",
    ),
    "--success-soft-hover": `color-mix(in oklab, var(--success) ${softHoverPct}, transparent)`,
    "--surface-hover": "color-mix(in oklab, var(--surface) 92%, var(--surface-foreground) 8%)",
    "--tw-ring-color": "var(--focus)",
    "--warning-hover": "color-mix(in oklab, var(--warning) 90%, var(--warning-foreground) 10%)",
    "--warning-soft": `color-mix(in oklab, var(--warning) ${softPct}, transparent)`,
    "--warning-soft-foreground": sfFg(
      "warning",
      isLight ? "color-mix(in oklab, var(--warning) 80%, var(--foreground) 70%)" : "color-mix(in oklab, var(--warning) 80%, var(--foreground) 30%)",
    ),
    "--warning-soft-hover": `color-mix(in oklab, var(--warning) ${softHoverPct}, transparent)`,
  };
}

/** `--radius-*` tokens re-declared on a scoped element (upstream `radiusDerivedVariables`). */
export const RADIUS_FORMULAS: Record<string, string> = {
  "--radius-2xl": "calc(var(--radius) * 2)",
  "--radius-3xl": "calc(var(--radius) * 3)",
  "--radius-4xl": "calc(var(--radius) * 4)",
  "--radius-field": "var(--field-radius, var(--radius-xl))",
  "--radius-lg": "calc(var(--radius) * 1)",
  "--radius-md": "calc(var(--radius) * 0.75)",
  "--radius-sm": "calc(var(--radius) * 0.5)",
  "--radius-xl": "calc(var(--radius) * 1.5)",
  "--radius-xs": "calc(var(--radius) * 0.25)",
};

/**
 * Every variable a scoped element needs to show the theme in one mode (upstream `computeThemeVars` minus the
 * font): radius + base tokens + derived formulas. Set on an element (e.g. as its `style`) to preview a theme
 * inside a page that uses another one.
 */
export function themeVariables(params: ThemeParams, mode: ThemeMode, tokens: ThemeTokens = deriveTheme(params)): Record<string, string> {
  const vars: Record<string, string> = {
    "--field-radius": RADIUS_CSS[params.formRadius ?? "large"],
    "--radius": RADIUS_CSS[params.radius ?? "medium"],
    ...RADIUS_FORMULAS,
    ...derivedFormulas(mode, { vibrant: params.vibrant }),
    // after the formulas: a preset may override a formula (`overrides`)
    ...tokens[mode],
  };
  if (ADAPTIVE_COLORS[key(params)]) vars["--accent-soft-foreground"] = tokens[mode]["--accent"];
  const spring = motionToken(params);
  if (spring) vars["--rv-motion-spring"] = spring;
  return vars;
}

/** `name: value;` pairs joined for a `style` attribute. */
export function toStyle(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");
}

/* -------------------------------------------------------------------------------------------------
 * CSS output (upstream generateMinimalCssVariables)
 * -----------------------------------------------------------------------------------------------*/

/** Upstream light / dark selector lists of styles/themes/default/variables.css. */
export const LIGHT_SELECTORS = [
  ":root",
  ".light",
  ".default",
  '[data-theme="light"]',
  '[data-theme="default"]',
  ":host(.light)",
  ":host(.default)",
  ':host([data-theme="light"])',
  ':host([data-theme="default"])',
];
export const DARK_SELECTORS = [".dark", '[data-theme="dark"]', ":host(.dark)", ':host([data-theme="dark"])'];

export interface ThemeCssOptions {
  /** Comment block at the top (default: how to use the snippet). `""` for none. */
  header?: string;
  /** Light-mode selectors (default `LIGHT_SELECTORS` minus `:host`). */
  light?: readonly string[];
  /** Dark-mode selectors (default `DARK_SELECTORS` minus `:host`). */
  dark?: readonly string[];
  /** Indent (default two spaces). */
  indent?: string;
}

const DEFAULT_HEADER = `/*
 * Rivet UI theme
 * Add this to your app CSS after \`@import "@rivetjs/ui/styles";\`.
 * Only the authored variables: the stylesheet derives hover / soft / border levels from them.
 * Made with the @rivetjs/ui theme builder (deriveTheme from "@rivetjs/ui/theme").
 */
`;

/**
 * The theme as a CSS snippet: the authored tokens for light (+ `--radius` / `--field-radius`) and dark mode, ready to
 * paste after `@import "@rivetjs/ui/styles"` (upstream builder's "copy code" output, without the font block).
 */
export function themeCss(params: ThemeParams, options: ThemeCssOptions = {}, tokens: ThemeTokens = deriveTheme(params)): string {
  const indent = options.indent ?? "  ";
  const lightSel = options.light ?? LIGHT_SELECTORS.filter((s) => !s.startsWith(":host"));
  const darkSel = options.dark ?? DARK_SELECTORS.filter((s) => !s.startsWith(":host"));
  const lines = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([name, value]) => `${indent}${name}: ${value};`)
      .join("\n");
  const vibrant = params.vibrant
    ? `/*
 * Vibrant palette: add data-vibrant-palette="true" to your <html> element
 * for more saturated soft foreground colors (less accessible contrast).
 */
`
    : "";
  return `${options.header ?? DEFAULT_HEADER}${vibrant}${lightSel.join(",\n")} {
${indent}/* Theme colors (light mode) */
${lines(tokens.light)}

${indent}/* Border radius */
${indent}--radius: ${RADIUS_CSS[params.radius ?? "medium"]};
${indent}--field-radius: ${RADIUS_CSS[params.formRadius ?? "large"]};${motionToken(params) ? `\n\n${indent}/* Motion: spring overlays (cdk motion token) */\n${indent}--rv-motion-spring: ${motionToken(params)};` : ""}
}

${darkSel.join(",\n")} {
${indent}color-scheme: dark;
${indent}/* Theme colors (dark mode) */
${lines(tokens.dark)}
}
`;
}
