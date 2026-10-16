// Theme builder state helpers (pure): URL query <-> params, slider track gradients, labels.
// Query names (shareable URLs: `?lightness=0.6204&chroma=0.195&hue=253.83&base=…&radius=…&formRadius=…`).

import { RADIUS_IDS, RIVET_PRESET, type RadiusId, type ThemeParams } from "@rivetjs/ui/theme";

/** Builder values (a `ThemeParams` with every field set). */
export interface BuilderValues {
  lightness: number;
  chroma: number;
  hue: number;
  base: number;
  radius: RadiusId;
  formRadius: RadiusId;
  vibrant: boolean;
}

export const DEFAULTS: BuilderValues = {
  lightness: RIVET_PRESET.lightness,
  chroma: RIVET_PRESET.chroma,
  hue: RIVET_PRESET.hue,
  base: RIVET_PRESET.base,
  radius: RIVET_PRESET.radius,
  formRadius: RIVET_PRESET.formRadius,
  vibrant: false,
};

/** Slider ranges (lightness 0–1, chroma 0–0.4, hue 0–360, gray chroma 0–0.02). */
export const RANGES = {
  lightness: { min: 0, max: 1, step: 0.0001 },
  chroma: { min: 0, max: 0.4, step: 0.0001 },
  hue: { min: 0, max: 360, step: 0.01 },
  base: { min: 0, max: 0.02, step: 0.0001 },
} as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, step: number) => Math.round(v / step) * step;
/** Shortest decimal for a stepped value (`0.6204`, not `0.6204000000000001`). */
export const fmt = (v: number, step: number) => String(+round(v, step).toFixed(Math.max(0, -Math.floor(Math.log10(step)))));

/** Values from a query string; missing / invalid entries keep the defaults. */
export function parseQuery(search: string): BuilderValues {
  const q = new URLSearchParams(search);
  const num = (k: keyof typeof RANGES) => {
    const raw = q.get(k);
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) ? clamp(v, RANGES[k].min, RANGES[k].max) : DEFAULTS[k];
  };
  const radius = (k: "radius" | "formRadius") => {
    const v = q.get(k);
    return v && (RADIUS_IDS as readonly string[]).includes(v) ? (v as RadiusId) : DEFAULTS[k];
  };
  return {
    lightness: num("lightness"),
    chroma: num("chroma"),
    hue: num("hue"),
    base: num("base"),
    radius: radius("radius"),
    formRadius: radius("formRadius"),
    vibrant: q.get("vibrantPalette") === "true",
  };
}

/** Query string for values (empty when every value is the default, so the bare URL is the Rivet theme). */
export function toQuery(v: BuilderValues): string {
  const q = new URLSearchParams();
  for (const k of ["lightness", "chroma", "hue", "base"] as const) if (Math.abs(v[k] - DEFAULTS[k]) > 1e-9) q.set(k, fmt(v[k], RANGES[k].step));
  if (v.radius !== DEFAULTS.radius) q.set("radius", v.radius);
  if (v.formRadius !== DEFAULTS.formRadius) q.set("formRadius", v.formRadius);
  if (v.vibrant) q.set("vibrantPalette", "true");
  const s = q.toString();
  return s ? "?" + s : "";
}

export const toParams = (v: BuilderValues): ThemeParams => ({ ...v });

const HUE_STOPS = [24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 264, 288, 312, 336, 360, 24];

/** Track backgrounds: each slider shows the colours it reaches at the other two coordinates. */
export const gradients = {
  lightness: (c: number, h: number) => `linear-gradient(to right, oklch(0 ${c} ${h}), oklch(0.5 ${c} ${h}), oklch(1 ${c} ${h}))`,
  chroma: (l: number, h: number) => `linear-gradient(to right, oklch(${l} 0 ${h}), oklch(${l} 0.2 ${h}), oklch(${l} 0.4 ${h}))`,
  hue: (l: number, c: number) => `linear-gradient(to right, ${HUE_STOPS.map((h) => `oklch(${l} ${c} ${h})`).join(", ")})`,
  base: (h: number) => `linear-gradient(to right, oklch(0.7 0 ${h}), oklch(0.7 0.02 ${h}))`,
};

export const RADIUS_LABELS: Record<RadiusId, string> = {
  none: "None",
  "extra-small": "XS",
  small: "S",
  medium: "M",
  large: "L",
  "extra-large": "XL",
};
