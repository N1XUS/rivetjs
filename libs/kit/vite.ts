// kit() Vite plugin: browser builds resolve kit's DOM entries, `?font` imports become font
// descriptors with `@font-face` CSS, and the router (rivetRouter) turns component head on.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { Plugin } from "vite";

/** Options of the `kit()` Vite plugin. */
export interface KitOptions {
  fonts?: {
    /** `font-display` default (`swap`). */
    display?: string;
    /**
     * Download cache of `google-font:` imports (css2 sheets + woff2 files), relative to the Vite root.
     * Default `node_modules/.rivet/fonts`. Warm cache = no network; restore it in offline CI.
     */
    cacheDir?: string;
  };
}

const FONT_CSS = ".rivet-font.css";
const FORMATS: Record<string, "woff2" | "woff" | "truetype" | "opentype"> = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" };
const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace"]);

interface FontRequest {
  file: string;
  family: string;
  weight: string;
  style: string;
  display: string;
  fallback?: string;
  unicodeRange?: string;
  format: "woff2" | "woff" | "truetype" | "opentype";
}
/** `<file>?font&family=…&weight=…&style=…&display=…&fallback=…&unicodeRange=…` (any order; `font` may come last). */
export function parseFontId(id: string, display = "swap"): FontRequest | null {
  const q = id.indexOf("?");
  if (q < 0) return null;
  const params = new URLSearchParams(id.slice(q + 1));
  if (!params.has("font")) return null;
  const file = id.slice(0, q);
  const ext = /\.([a-z0-9]+)$/i.exec(file)?.[1]?.toLowerCase() ?? "";
  const format = FORMATS[ext];
  if (!format) throw new Error(`${file}: ?font needs a .woff2, .woff, .ttf or .otf file`);
  const family =
    params.get("family") ??
    basename(file)
      .replace(/\.[^.]+$/, "")
      .replace(/[-_](?:variable|vf|regular)$/i, "");
  if (!/^[\w \-]+$/.test(family)) throw new Error(`${file}: invalid font family "${family}"`);
  const value = (name: string, fallback: string, valid: RegExp) => {
    const v = params.get(name) ?? fallback;
    if (!valid.test(v)) throw new Error(`${file}: invalid ?font ${name} "${v}"`);
    return v;
  };
  const fallback = params.get("fallback") ?? undefined;
  if (fallback !== undefined && !/^[\w \-]+$/.test(fallback)) throw new Error(`${file}: invalid fallback "${fallback}"`);
  const unicodeRange = params.get("unicodeRange") ?? undefined;
  if (unicodeRange !== undefined && !/^[Uu]\+[0-9A-Fa-f?\-+, Uu]+$/.test(unicodeRange)) throw new Error(`${file}: invalid unicodeRange`);
  return {
    file,
    family,
    weight: value("weight", "400", /^\d{1,4}(?:\.\.\d{1,4})?$/).replace("..", " "),
    style: value("style", "normal", /^(?:normal|italic|oblique)$/),
    display: value("display", display, /^(?:auto|block|swap|fallback|optional)$/),
    ...(fallback !== undefined ? { fallback } : {}),
    ...(unicodeRange !== undefined ? { unicodeRange } : {}),
    format,
  };
}

interface Metrics {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  xWidthAvg: number;
}
/**
 * Fallback face overrides (metric-compatible local font): needs optional `@capsizecss/unpack` (3.x or 4.x;
 * `fromBuffer` — 4.x moved `fromFile` to `/fs`) + `@capsizecss/metrics`.
 */
async function fallbackFace(request: FontRequest, warn: (message: string) => void): Promise<string | null> {
  if (!request.fallback || GENERIC.has(request.fallback)) return null;
  const skip = (why: string) => (warn(`${request.file}: fallback metrics for "${request.fallback}" skipped (${why})`), null);
  let unpack: { fromBuffer(buffer: Uint8Array): Promise<Metrics> };
  try {
    unpack = (await import("@capsizecss/unpack" as string)) as typeof unpack;
  } catch {
    return skip("install @capsizecss/unpack and @capsizecss/metrics");
  }
  if (typeof unpack.fromBuffer !== "function") return skip("@capsizecss/unpack has no fromBuffer: install 3.x or 4.x");
  const camel = (family: string) => family.replace(/\s+(\w)/g, (_, c: string) => c.toUpperCase()).replace(/^\w/, (c) => c.toLowerCase());
  const name = camel(request.fallback);
  const metrics = async (id: string) => ((await import(`@capsizecss/metrics/${id}` as string)) as { default: Metrics }).default;
  let fallback: Metrics;
  try {
    fallback = await metrics(name);
  } catch {
    return skip(`no @capsizecss/metrics/${name}: install @capsizecss/metrics or pick a font it covers`);
  }
  // A variable font (weight range) unpacks as its default instance, which is often not the regular weight text uses
  // (Manrope's: xWidthAvg 0.4435 em vs 0.46 at 400 → size-adjust 3.7 % too small, lines wrapped differently after the
  // swap: docs CLS 0.11–0.13). The metrics collection's entry of the family (measured at regular) wins when it has one.
  let primary: Metrics | undefined;
  if (request.weight.includes(" ")) primary = await metrics(camel(request.family)).catch(() => undefined);
  try {
    primary ??= await unpack.fromBuffer(await readFile(request.file));
  } catch (error) {
    return skip(`unreadable font: ${(error as Error).message}`);
  }
  const size = primary.xWidthAvg / primary.unitsPerEm / (fallback.xWidthAvg / fallback.unitsPerEm);
  const pct = (n: number) => (n * 100).toFixed(2) + "%";
  const em = primary.unitsPerEm * size;
  return (
    `@font-face{font-family:"${request.family} Fallback";src:local("${request.fallback}");size-adjust:${pct(size)};` +
    `ascent-override:${pct(primary.ascent / em)};descent-override:${pct(Math.abs(primary.descent) / em)};line-gap-override:${pct(primary.lineGap / em)}}`
  );
}

/** Kit Vite plugin: add next to `rivetRouter()` (it enables component head). */
export function kit(options: KitOptions = {}): Plugin {
  const fallbacks = new Map<string, Promise<string | null>>();
  const fallbackOf = (request: FontRequest, warn: (message: string) => void) => {
    const key = [request.file, request.fallback ?? "", request.family, request.weight].join("\0");
    let face = fallbacks.get(key);
    if (!face) fallbacks.set(key, (face = fallbackFace(request, warn)));
    return face;
  };
  let root = process.cwd();
  const isClient = (ctx: { environment?: { config: { consumer: string } } }, ssr?: boolean) =>
    ctx.environment ? ctx.environment.config.consumer === "client" : !ssr;
  return {
    name: "vite-plugin-rivet-kit",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    async resolveId(id, importer, resolveOptions) {
      // `google-font:Inter?weight=100..900&font`: downloaded once into the cache, then a local `?font` file.
      if (id.startsWith("google-font:")) {
        const { parseGoogleFontId, resolveGoogleFont } = await import("./google-fonts.ts");
        try {
          const request = parseGoogleFontId(id)!;
          return (await resolveGoogleFont(request, resolve(root, options.fonts?.cacheDir ?? join("node_modules", ".rivet", "fonts")))).id;
        } catch (error) {
          return this.error((error as Error).message);
        }
      }
      if (isClient(this, resolveOptions?.ssr)) {
        if (id === "@rivetjs/kit") return this.resolve("@rivetjs/kit/dom", importer, { skipSelf: true });
        if (id === "@rivetjs/runtime/image") return this.resolve("@rivetjs/runtime/image/dom", importer, { skipSelf: true });
      }
      // `<font file>.rivet-font.css?…`: the font's @font-face sheet, next to the font (relative url()).
      const clean = id.split("?", 1)[0] ?? "";
      if (clean.endsWith(FONT_CSS)) return existsSync(clean.slice(0, -FONT_CSS.length)) ? id : null;
      return null;
    },
    async load(id) {
      const [clean = "", query = ""] = id.split("?", 2);
      if (clean.endsWith(FONT_CSS)) {
        const request = parseFontId(clean.slice(0, -FONT_CSS.length) + "?" + query, options.fonts?.display);
        if (!request) return null;
        const fallback = fallbackOf(request, (message) => this.warn(message));
        const face =
          `@font-face{font-family:"${request.family}";src:url("./${basename(request.file)}?no-inline") format("${request.format}");` +
          `font-weight:${request.weight};font-style:${request.style};font-display:${request.display}` +
          (request.unicodeRange ? `;unicode-range:${request.unicodeRange}` : "") +
          "}";
        return face + ((await fallback) ?? "") + "\n";
      }
      let request: FontRequest | null;
      try {
        request = parseFontId(id, options.fonts?.display);
      } catch (error) {
        return this.error((error as Error).message);
      }
      if (!request) return null;
      this.addWatchFile(request.file);
      await readFile(request.file).catch(() => this.error(`${request!.file}: font file not found`));
      const fallback = await fallbackOf(request, (message) => this.warn(message));
      const generic = request.fallback && GENERIC.has(request.fallback) ? request.fallback : "sans-serif";
      const stack = [
        `"${request.family}"`,
        ...(fallback ? [`"${request.family} Fallback"`] : request.fallback && !GENERIC.has(request.fallback) ? [`"${request.fallback}"`] : []),
        generic,
      ].join(", ");
      const sheet = request.file + FONT_CSS + "?" + id.slice(id.indexOf("?") + 1);
      const type = `font/${request.format === "truetype" ? "ttf" : request.format === "opentype" ? "otf" : request.format}`;
      return (
        `import src from ${JSON.stringify(request.file + "?url&no-inline")};\n` +
        `import ${JSON.stringify(sheet)};\n` +
        `export default { family: ${JSON.stringify(request.family)}, stack: ${JSON.stringify(stack)}, src, format: ${JSON.stringify(request.format)}, ` +
        `weight: ${JSON.stringify(request.weight)}, style: ${JSON.stringify(request.style)}, display: ${JSON.stringify(request.display)}, ` +
        `preload: { rel: "preload", as: "font", type: ${JSON.stringify(type)}, crossorigin: "anonymous", href: src } };\n`
      );
    },
  };
}
