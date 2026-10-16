// Presets: Rivet brand theme + a selection of HeroUI v3.2.6 theme builder presets.
// HeroUI values ported from apps/docs/src/app/[lang]/themes/theme-values.ts (Apache-2.0, © 2025 NextUI Inc.).
// Modified: upstream brand-named presets renamed (uber → mono, rabbit → ember, coinbase → ocean, discord → iris),
// `findMatchingTheme` → `matchPreset`; Rivet preset added.

import { DEFAULT_BASE, type RadiusId, type SemanticOverrides, type ThemeParams } from "./derive.ts";

/** A named theme builder preset. */
export interface ThemePreset extends ThemeParams {
  id: string;
  label: string;
  base: number;
  radius: RadiusId;
  formRadius: RadiusId;
}

/**
 * Rivet logo gradient stops (`logo.svg`): cyan → blue → indigo → violet → purple → magenta → pink. The brand theme's
 * accent is the logo blue; the stops are exposed as `--rivet-*` tokens for special surfaces only.
 */
export const RIVET_BRAND = {
  cyan: "#01eef9",
  blue: "#0360fa",
  indigo: "#262cfa",
  violet: "#5b00f8",
  purple: "#b815f9",
  magenta: "#f827f5",
  pink: "#f930bf",
} as const;

/**
 * Rivet brand theme. Accent `oklch(0.52 0.24 264)` (#1a54f0): the logo blue `#0360fa` (oklch 0.5482 0.2414
 * 261.45) nudged toward the logo indigo `#262cfa` and darkened just enough that white text passes AA on the accent
 * AND on its hover mix (the logo blue gives 5.2:1 at rest but 4.1:1 hovered); neutrals tinted toward it (`base`
 * 0.005). Contrast fixes over the derivation: a deeper danger red (white text AA) and a darker light-mode muted
 * (4.5:1 on the page background). Checked by `tests/theme.test.ts`.
 */
export const RIVET_PRESET: ThemePreset = {
  id: "rivet",
  label: "Rivet",
  lightness: 0.52,
  chroma: 0.24,
  hue: 264,
  base: 0.005,
  radius: "medium",
  formRadius: "large",
  semanticOverrides: {
    light: { danger: { color: "oklch(0.56 0.215 26)" } },
    dark: { danger: { color: "oklch(0.56 0.2 25)" } },
  },
  // Contrast fixes (WCAG AA + APCA Lc, `CONTRAST_PAIRS`; identity spec §3.6): muted text on every surface level
  // (light 4.30 → 4.78 on surface-tertiary; dark Lc −47.5 → −60.3), placeholder = muted, dark focus ring L 0.68 (3.44 →
  // 6.9 : 1 on the background), dark soft foregrounds (accent Lc −39 → −61, danger −42 → −62).
  overrides: {
    light: { "--muted": "oklch(51.00% 0.0100 264.00)", "--field-placeholder": "oklch(51.00% 0.0100 264.00)" },
    dark: {
      "--muted": "oklch(78.00% 0.0120 264.00)",
      "--field-placeholder": "oklch(78.00% 0.0120 264.00)",
      "--focus": "oklch(68.00% 0.1600 264.00)",
      "--accent-soft-foreground": "color-mix(in oklab, var(--accent) 45%, var(--foreground) 55%)",
      "--danger-soft-foreground": "color-mix(in oklab, var(--danger) 45%, var(--foreground) 55%)",
    },
  },
};

/** Classic: the upstream stylesheet's original default theme (`oklch(0.6204 0.195 253.83)`). */
export const CLASSIC_PRESET: ThemePreset = {
  id: "classic",
  label: "Classic",
  lightness: 0.6204,
  chroma: 0.195,
  hue: 253.83,
  base: DEFAULT_BASE,
  radius: "medium",
  formRadius: "large",
};

const preset = (id: string, label: string, v: Omit<ThemePreset, "id" | "label">): ThemePreset => ({ id, label, ...v });

/**
 * The Rivet preset's contrast fixes (`RIVET_PRESET`), re-tinted to a hue: muted / placeholder text on every surface
 * level, dark focus ring, dark soft foregrounds, a deeper danger and a lighter success / warning (dark text AA + Lc 60).
 */
function contrastFixes(hue: number): { semanticOverrides: SemanticOverrides; overrides: NonNullable<ThemePreset["overrides"]> } {
  const h = hue.toFixed(2);
  return {
    semanticOverrides: {
      light: {
        danger: { color: "oklch(0.56 0.215 26)" },
        success: { color: "oklch(0.77 0.19 150)" },
        warning: { color: "oklch(0.83 0.16 80)" },
      },
      dark: {
        danger: { color: "oklch(0.56 0.2 25)" },
        success: { color: "oklch(0.77 0.19 150)" },
        warning: { color: "oklch(0.83 0.14 80)" },
      },
    },
    overrides: {
      light: { "--muted": `oklch(51.00% 0.0100 ${h})`, "--field-placeholder": `oklch(51.00% 0.0100 ${h})` },
      dark: {
        "--muted": `oklch(78.00% 0.0120 ${h})`,
        "--field-placeholder": `oklch(78.00% 0.0120 ${h})`,
        "--focus": `oklch(68.00% 0.1600 ${h})`,
        "--accent-soft-foreground": "color-mix(in oklab, var(--accent) 45%, var(--foreground) 55%)",
        "--danger-soft-foreground": "color-mix(in oklab, var(--danger) 45%, var(--foreground) 55%)",
      },
    },
  };
}

/** A look preset: `contrastFixes(hue)` merged under the preset's own overrides. */
function look(p: ThemePreset): ThemePreset {
  const fix = contrastFixes(p.hue);
  return {
    ...p,
    semanticOverrides: p.semanticOverrides ?? fix.semanticOverrides,
    overrides: { light: { ...fix.overrides.light, ...p.overrides?.light }, dark: { ...fix.overrides.dark, ...p.overrides?.dark } },
  };
}

/**
 * Look presets (Rivet, 2026-10-12): whole-look swaps through variables only (shape tokens included), shown by the
 * ui-docs `theme-swap` example. Brutalist: flat, square, 2 px ink borders (`--border-width`, `--field-border-width`),
 * hard offset shadows, cream paper. Values contrast-checked by `tests/theme.test.ts` (WCAG AA + APCA).
 */
export const BRUTALIST_PRESET: ThemePreset = look({
  id: "brutalist",
  label: "Brutalist",
  lightness: 0.52,
  chroma: 0.22,
  hue: 30,
  base: 0,
  radius: "none",
  formRadius: "none",
  overrides: {
    light: {
      "--background": "oklch(96.50% 0.0250 90.00)",
      "--border": "var(--foreground)",
      "--border-width": "2px",
      "--field-border": "var(--foreground)",
      "--field-border-width": "2px",
      "--foreground": "oklch(15.00% 0 0)",
      "--surface-shadow": "inset 0 0 0 2px var(--foreground), 4px 4px 0 0 var(--foreground)",
      "--overlay-shadow": "inset 0 0 0 2px var(--foreground), 6px 6px 0 0 var(--foreground)",
      "--field-shadow": "0 0 0 0 transparent",
    },
    dark: {
      "--border": "var(--foreground)",
      "--border-width": "2px",
      "--field-border": "var(--foreground)",
      "--field-border-width": "2px",
      "--surface-shadow": "inset 0 0 0 2px var(--foreground), 4px 4px 0 0 var(--foreground)",
      "--overlay-shadow": "inset 0 0 0 2px var(--foreground), 6px 6px 0 0 var(--foreground)",
      "--field-shadow": "0 0 0 0 transparent",
    },
  },
});

/**
 * Glass: translucent surfaces and fields over a blurred backdrop (`--surface-backdrop`, read by `.card`), white
 * hairlines, soft wide shadows, large radii. Needs something colourful behind the cards to read as glass.
 */
export const GLASS_PRESET: ThemePreset = look({
  id: "glass",
  label: "Glass",
  lightness: 0.5,
  chroma: 0.18,
  hue: 250,
  base: 0.01,
  radius: "large",
  formRadius: "extra-large",
  overrides: {
    light: {
      "--surface": "oklch(100% 0 0 / 0.62)",
      "--field-background": "oklch(100% 0 0 / 0.55)",
      "--surface-backdrop": "blur(20px) saturate(1.6)",
      "--surface-shadow": "inset 0 0 0 1px oklch(100% 0 0 / 0.7), 0 8px 32px 0 oklch(0.3 0.05 250 / 0.14)",
      "--field-shadow": "inset 0 0 0 1px oklch(100% 0 0 / 0.6)",
    },
    dark: {
      "--surface": "oklch(24.00% 0.0200 250.00 / 0.6)",
      "--field-background": "oklch(26.00% 0.0200 250.00 / 0.55)",
      "--accent-soft-foreground": "color-mix(in oklab, var(--accent) 40%, var(--foreground) 60%)",
      "--surface-backdrop": "blur(20px) saturate(1.4)",
      "--surface-shadow": "inset 0 0 0 1px oklch(100% 0 0 / 0.12), 0 8px 32px 0 oklch(0 0 0 / 0.3)",
    },
  },
});

/** Mauve: warm dusty rose accent, rose-tinted neutrals and shadows, large soft radii. */
export const MAUVE_PRESET: ThemePreset = look({
  id: "mauve",
  label: "Mauve",
  lightness: 0.52,
  chroma: 0.11,
  hue: 345,
  base: 0.012,
  radius: "large",
  formRadius: "extra-large",
  overrides: {
    light: {
      "--surface-shadow": "0 1px 2px 0 oklch(0.3 0.05 345 / 0.08), 0 8px 24px -4px oklch(0.3 0.05 345 / 0.12)",
      "--overlay-shadow": "0 2px 8px 0 oklch(0.3 0.05 345 / 0.1), 0 16px 32px -4px oklch(0.3 0.05 345 / 0.16)",
    },
    dark: { "--accent-soft-foreground": "color-mix(in oklab, var(--accent) 40%, var(--foreground) 60%)" },
  },
});

const OCEAN_OVERRIDES: SemanticOverrides = {
  dark: {
    danger: { color: "oklch(0.6545 0.2145 22.31)" },
    success: { color: "oklch(0.7574 0.180554 156.931)" },
    warning: { color: "oklch(0.8095 0.1119 61.69)" },
  },
  light: {
    danger: { color: "oklch(0.5507 0.2062 24)" },
    success: { color: "oklch(0.5438 0.1268 157.17)" },
    warning: { color: "oklch(0.8095 0.1119 61.69)" },
  },
};

/** Presets in builder order: Rivet (default), Classic, the look presets, then upstream presets. */
export const THEME_PRESETS: readonly ThemePreset[] = [
  RIVET_PRESET,
  CLASSIC_PRESET,
  BRUTALIST_PRESET,
  GLASS_PRESET,
  MAUVE_PRESET,
  preset("sky", "Sky", { base: DEFAULT_BASE, chroma: 0.16, hue: 225, lightness: 0.78, radius: "medium", formRadius: "large" }),
  preset("lavender", "Lavender", { base: DEFAULT_BASE, chroma: 0.13, hue: 305, lightness: 0.77, radius: "medium", formRadius: "large" }),
  preset("mint", "Mint", { base: DEFAULT_BASE, chroma: 0.12, hue: 155, lightness: 0.82, radius: "medium", formRadius: "large" }),
  preset("ocean", "Ocean", {
    base: 0.002,
    chroma: 0.2628,
    hue: 262.87,
    lightness: 0.5282,
    radius: "medium",
    formRadius: "extra-small",
    semanticOverrides: OCEAN_OVERRIDES,
  }),
  preset("iris", "Iris", {
    base: 0.01,
    chroma: 0.2091,
    hue: 273.85,
    lightness: 0.5774,
    radius: "small",
    formRadius: "large",
    semanticOverrides: {
      dark: {
        danger: { color: "oklch(0.6318 0.2075 24.57)" },
        success: { color: "oklch(0.8548 0.1967 150.16)" },
        warning: { color: "oklch(0.9218 0.1571 99.87)" },
      },
      light: {
        danger: { color: "oklch(0.5884 0.1993 24.39)" },
        success: { color: "oklch(0.532 0.1238 151.57)" },
        warning: { color: "oklch(0.9218 0.1571 99.87)" },
      },
    },
  }),
  preset("ember", "Ember", {
    base: 0.01,
    chroma: 0.2232,
    hue: 36.66,
    lightness: 0.6678,
    radius: "medium",
    formRadius: "extra-large",
    semanticOverrides: {
      dark: { danger: { color: "oklch(0.6291 0.2565 29.09)" }, success: { color: "oklch(0.7113 0.2043 140.81)" } },
      light: { danger: { color: "oklch(0.6291 0.2565 29.09)" }, success: { color: "oklch(0.7113 0.2043 140.81)" } },
    },
  }),
  preset("mono", "Mono", {
    base: 0,
    chroma: 0,
    hue: 0,
    lightness: 0,
    radius: "small",
    formRadius: "small",
    semanticOverrides: {
      dark: {
        danger: { color: "oklch(0.7044 0.1872 23.19)" },
        success: { color: "oklch(0.6514 0.1321 156.22)" },
        warning: { color: "oklch(0.8803 0.1348 86.06)" },
      },
      light: {
        danger: { color: "oklch(0.573 0.2249 21.97)" },
        success: { color: "oklch(0.6277 0.1604 153.06)" },
        warning: { color: "oklch(0.8446 0.1525 80.6)" },
      },
    },
  }),
];

const COMPARE = ["base", "chroma", "hue", "lightness", "radius", "formRadius"] as const;

/** The preset whose values equal `params` (numbers within 1e-4), or `undefined` for a custom theme. */
export function matchPreset(params: ThemeParams): ThemePreset | undefined {
  return THEME_PRESETS.find((p) =>
    COMPARE.every((k) => {
      const a = params[k] ?? (k === "radius" ? "medium" : k === "formRadius" ? "large" : k === "base" ? DEFAULT_BASE : undefined);
      const b = p[k];
      return typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 0.0001 : a === b;
    }),
  );
}

/**
 * Params with the matching preset's semantic overrides (upstream: overrides only for a matching preset) and Rivet
 * extensions (`overrides`, `accentDark`) applied.
 */
export function resolveParams(params: ThemeParams): ThemeParams {
  const match = matchPreset(params);
  if (!match) return params;
  const out: ThemeParams = { ...params };
  if (match.semanticOverrides) out.semanticOverrides = match.semanticOverrides;
  if (match.overrides) out.overrides = match.overrides;
  if (match.accentDark) out.accentDark = match.accentDark;
  return out;
}
