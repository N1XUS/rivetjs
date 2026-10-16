import { DEFAULT_BREAKPOINTS, DEFAULT_DENSITIES, ENCODABLE, LAYOUTS, type EncodableFormat, type Layout } from "@rivetjs/runtime/image-plan";
import type { ImageProcessor } from "./processor.ts";
import type { SvgDirectives, SvgoOptions } from "./svg.ts";

export const IMAGE_FILE = /\.(?:jpe?g|png|webp|avif|gif|svg|tiff?)$/i;
export type PlaceholderKind = "blur" | "dominant-color" | "none";
export type Fit = "cover" | "contain" | "inside";
/** Per-import / preset options (`?width=320&layout=fixed&image`). */
export interface Directives {
  layout?: Layout;
  width?: number;
  height?: number;
  formats?: EncodableFormat[];
  quality?: number;
  densities?: number[];
  placeholder?: PlaceholderKind;
  fit?: Fit;
  position?: string;
}
/** `rivet({ images })`; build-time only, serialisable except `processor`. */
export interface ImagesConfig {
  layout?: Layout;
  formats?: EncodableFormat[];
  densities?: number[];
  breakpoints?: number[];
  quality?: Partial<Record<EncodableFormat, number>>;
  placeholder?: PlaceholderKind;
  presets?: Record<string, Directives>;
  processor?: ImageProcessor;
  /** Root-relative; default `node_modules/.rivet/images`. */
  cacheDir?: string;
  /** SVG optimisation (svgo) for `?image` / `?jsx` assets and inline `?svg` components; `false` = sanitise only. */
  svgo?: false | SvgoOptions;
}
export interface ImageOptions {
  layout: Layout;
  width?: number;
  height?: number;
  formats: EncodableFormat[];
  quality: Record<EncodableFormat, number>;
  densities: number[];
  breakpoints: number[];
  placeholder: PlaceholderKind;
  fit: Fit;
  position: string;
}
export const DEFAULT_QUALITY: Record<EncodableFormat, number> = { avif: 50, webp: 75, jpeg: 78, png: 80 };
const PLACEHOLDERS: readonly PlaceholderKind[] = ["blur", "dominant-color", "none"];
const FITS: readonly Fit[] = ["cover", "contain", "inside"];
const POSITIONS = ["center", "top", "right", "bottom", "left", "entropy", "attention"];
const VITE_KEYS = new Set(["import", "t", "v"]);
export type ImageRequest = (
  | { file: string; kind: "image" | "jsx"; directives: Directives & { preset?: string } }
  /** `?svg`: inline SVG component. */
  | { file: string; kind: "svg"; directives: SvgDirectives }
) & {
  /** Set when the keyword is not the last query key: `client.d.ts` only types `*?image` / `*&image` (one
   * wildcard per ambient module), so `?image&width=800` builds but fails to typecheck. */
  warning?: string;
};
/** `null` when `id` is not an image import with the `image`/`jsx` keyword. */
export function parseImageId(id: string): ImageRequest | null {
  const q = id.indexOf("?");
  if (q < 0) return null;
  const file = id.slice(0, q);
  if (!IMAGE_FILE.test(file)) return null;
  const params = new URLSearchParams(id.slice(q + 1));
  const kinds = KINDS.filter((kind) => params.has(kind));
  if (!kinds.length) return null;
  if (kinds.length > 1) throw new Error(`${file}: use one of ?image, ?jsx or ?svg, not ${kinds.map((k) => "?" + k).join(" + ")}`);
  const kind = kinds[0]!;
  const own = [...params].filter(([key]) => !VITE_KEYS.has(key));
  const warning =
    own.at(-1)?.[0] === kind
      ? undefined
      : `${file}: put ?${kind} last (\`?${own
          .filter(([key]) => key !== kind)
          .map(([key, value]) => (value ? key + "=" + value : key))
          .join("&")}&${kind}\`) — @rivetjs/compiler/images/client only types imports ending in ${kind}`;
  const raw: Record<string, string> = {};
  for (const [key, value] of params) if (!KINDS.includes(key as never) && !VITE_KEYS.has(key)) raw[key] = value;
  if (kind === "svg") {
    if (!/\.svg$/i.test(file)) throw new Error(`${file}: ?svg needs an .svg file (use ?image or ?jsx)`);
    return { file, kind, directives: parseSvgDirectives(raw, file), ...(warning ? { warning } : {}) };
  }
  return { file, kind, directives: parseDirectives(raw, file), ...(warning ? { warning } : {}) };
}
const KINDS = ["image", "jsx", "svg"] as const;
const flag = (value: string, key: string, where: string) => {
  if (value === "" || value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${where}: ${key} must be true or false`);
};
/** `?currentColor&svg`, `?prefixIds=false&svg`, `?prefixIds=logo&svg`. */
export function parseSvgDirectives(raw: Record<string, string>, where: string): SvgDirectives {
  const out: SvgDirectives = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "currentColor") out.currentColor = flag(value, key, where);
    else if (key === "prefixIds") out.prefixIds = value === "" || value === "true" || value === "false" ? flag(value, key, where) : value;
    else throw new Error(`${where}: unknown svg directive "${key}" (currentColor, prefixIds)`);
  }
  return out;
}
const list = (value: string) => value.split(";").filter(Boolean);
export function parseDirectives(raw: Record<string, string>, where: string): Directives & { preset?: string } {
  const out: Directives & { preset?: string } = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "width" || key === "height" || key === "quality") out[key] = /^\d+$/.test(value) ? Number(value) : NaN;
    else if (key === "densities") out.densities = list(value).map(Number);
    else if (key === "formats") out.formats = list(value) as EncodableFormat[];
    else if (key === "layout") out.layout = value as Layout;
    else if (key === "placeholder") out.placeholder = value as PlaceholderKind;
    else if (key === "fit") out.fit = value as Fit;
    else if (key === "position" || key === "preset") out[key] = value;
    else throw new Error(`${where}: unknown image directive "${key}"`);
  }
  checkDirectives(out, where);
  return out;
}
const oneOf = (where: string, name: string, value: unknown, allowed: readonly string[]) => {
  if (value !== undefined && !allowed.includes(value as string)) throw new Error(`${where}: ${name} must be one of ${allowed.join(", ")}`);
};
const positiveInt = (value: unknown) => Number.isInteger(value) && (value as number) > 0;
function checkFormats(formats: readonly string[] | undefined, where: string) {
  for (const f of formats ?? []) if (!ENCODABLE.includes(f as EncodableFormat)) throw new Error(`${where}: unknown image format "${f}"`);
}
/** Validate typed directives (from a query string, a preset, or config). */
export function checkDirectives(d: Directives, where: string): Directives {
  for (const key of ["width", "height"] as const)
    if (d[key] !== undefined && !positiveInt(d[key])) throw new Error(`${where}: ${key} must be a positive integer`);
  if (d.quality !== undefined && !(positiveInt(d.quality) && d.quality <= 100)) throw new Error(`${where}: quality must be 1-100`);
  if (d.densities !== undefined && !(d.densities.length && d.densities.every((n) => n > 0 && Number.isFinite(n))))
    throw new Error(`${where}: densities must be positive numbers`);
  checkFormats(d.formats, where);
  oneOf(where, "layout", d.layout, LAYOUTS);
  oneOf(where, "placeholder", d.placeholder, PLACEHOLDERS);
  oneOf(where, "fit", d.fit, FITS);
  oneOf(where, "position", d.position, POSITIONS);
  return d;
}
export function validateConfig(config: ImagesConfig): void {
  const where = "images config";
  checkDirectives({ layout: config.layout, formats: config.formats, densities: config.densities, placeholder: config.placeholder }, where);
  if (config.breakpoints && !config.breakpoints.every(positiveInt)) throw new Error(`${where}: breakpoints must be positive integers`);
  for (const [format, q] of Object.entries(config.quality ?? {})) {
    checkFormats([format], where);
    if (!(positiveInt(q) && q <= 100)) throw new Error(`${where}: quality must be 1-100`);
  }
  for (const [name, preset] of Object.entries(config.presets ?? {})) checkDirectives(preset, `images preset "${name}"`);
  const svgo = config.svgo;
  if (svgo !== undefined && svgo !== false && (typeof svgo !== "object" || svgo === null || (svgo.plugins !== undefined && !Array.isArray(svgo.plugins))))
    throw new Error(`${where}: svgo must be false or { plugins?, multipass?, floatPrecision?, prefixIds? }`);
}
/** Merge: import directives > preset > config > defaults. */
export function resolveOptions(config: ImagesConfig, directives: Directives & { preset?: string }, file: string): ImageOptions {
  const { preset: name, ...own } = directives;
  const preset = name === undefined ? {} : config.presets?.[name];
  if (!preset) throw new Error(`${file}: unknown image preset "${name}"`);
  const pick = <K extends keyof Directives>(key: K): Directives[K] => own[key] ?? preset[key];
  const quality = pick("quality");
  return {
    layout: pick("layout") ?? config.layout ?? "constrained",
    width: pick("width"),
    height: pick("height"),
    formats: pick("formats") ?? config.formats ?? ["avif", "webp"],
    quality: quality === undefined ? { ...DEFAULT_QUALITY, ...config.quality } : { avif: quality, webp: quality, jpeg: quality, png: quality },
    densities: pick("densities") ?? config.densities ?? [...DEFAULT_DENSITIES],
    breakpoints: config.breakpoints ?? [...DEFAULT_BREAKPOINTS],
    placeholder: pick("placeholder") ?? config.placeholder ?? "blur",
    fit: pick("fit") ?? "cover",
    position: pick("position") ?? "center",
  };
}
