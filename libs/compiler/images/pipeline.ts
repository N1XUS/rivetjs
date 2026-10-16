import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { describe, fallbackFormat, planWidths, single, type ImageDescriptor, type ImageFormat, type Placeholder } from "@rivetjs/runtime/image-plan";
import { resolveOptions, type Directives, type ImagesConfig } from "./options.ts";
import type { EncodeOptions, ImageProcessor } from "./processor.ts";
import { diskCache, hash, pool } from "./cache.ts";
import { inlineSvg, optimizeSvg, svgDimensions, svgoKey, type SvgDirectives } from "./svg.ts";

export interface PlannedAsset {
  key: string;
  ext: string;
  file: string;
  fileName: string;
  url: string;
  /** Absent: copy the source bytes (animated) or, with `svg`, optimise with svgo. */
  encode?: EncodeOptions;
  svg?: true;
}
export interface Described {
  descriptor: ImageDescriptor;
  assets: PlannedAsset[];
  warnings: string[];
}
const EXT: Record<ImageFormat, string> = { avif: "avif", webp: "webp", jpeg: "jpg", png: "png", gif: "gif", svg: "svg" };
export const MIME_BY_EXT: Record<string, string> = {
  avif: "image/avif",
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
};
export interface PipelineContext {
  config: ImagesConfig;
  processor: ImageProcessor;
  base: string;
  assetsDir: string;
  dev: boolean;
  cacheDir: string;
}
export function createPipeline(ctx: PipelineContext) {
  const cache = diskCache(ctx.cacheDir);
  const run = pool();
  async function placeholder(input: Buffer, digest: string, kind: "blur" | "dominant-color"): Promise<Placeholder> {
    const name = `${hash(digest, kind, ctx.processor.id)}.placeholder.json`;
    const cached = await cache.get(name);
    if (cached) return JSON.parse(cached.toString("utf8")) as Placeholder;
    const value = await ctx.processor.placeholder(input, kind);
    await cache.set(name, Buffer.from(JSON.stringify(value)));
    return value;
  }
  async function describeFile(file: string, directives: Directives & { preset?: string }): Promise<Described> {
    const options = resolveOptions(ctx.config, directives, file);
    const input = await readFile(file);
    const digest = hash(input);
    const stem = basename(file, extname(file)).replace(/[^\w.-]/g, "_");
    const asset = (key: string, ext: string, width: number, encode?: EncodeOptions): PlannedAsset => {
      const fileName = `${ctx.assetsDir}/${stem}-${width}-${key.slice(0, 8)}.${ext}`;
      return { key, ext, file, fileName, url: ctx.dev ? `${ctx.base}@rivet/image/${key}.${ext}` : ctx.base + fileName, ...(encode ? { encode } : {}) };
    };
    // SVG: svgo (no sharp needed), intrinsic size from width / height / viewBox for CLS-free <img>.
    if (/\.svg$/i.test(file)) {
      const source = input.toString("utf8");
      const intrinsic = svgDimensions(source);
      const warnings = intrinsic ? [] : [`${file}: SVG has no width / height / viewBox; assuming 300x150`];
      const meta = intrinsic ?? { width: 300, height: 150 };
      const width = options.width ?? (options.height ? Math.round((options.height * meta.width) / meta.height) : meta.width);
      const height = options.height ?? Math.round((width * meta.height) / meta.width);
      const a: PlannedAsset = { ...asset(hash(digest, svgoKey(ctx.config.svgo ?? {}, "file")), "svg", width), svg: true };
      warnings.push(...(await svgFile(a)).warnings);
      return { descriptor: single(a.url, "svg", width, height, options.layout), assets: [a], warnings };
    }
    const meta = await ctx.processor.metadata(input);
    if (meta.format === "svg" || meta.animated) {
      if (meta.format === "tiff") throw new Error(`${file}: animated TIFF is not supported`);
      const width = options.width ?? meta.width;
      const height = options.height ?? Math.round((width * meta.height) / meta.width);
      const a = asset(digest, EXT[meta.format], width);
      return { descriptor: single(a.url, meta.format, width, height, options.layout), assets: [a], warnings: [] };
    }
    const plan = planWidths({
      intrinsic: meta,
      layout: options.layout,
      width: options.width,
      height: options.height,
      densities: options.densities,
      breakpoints: options.breakpoints,
    });
    const warnings = plan.clamped ? [`${file}: requested width ${options.width}px exceeds intrinsic ${meta.width}px; clamped`] : [];
    const fallback = fallbackFormat(meta.format, meta.hasAlpha);
    const formats = [...new Set([...options.formats.filter((f) => f !== fallback), fallback])];
    const assets: PlannedAsset[] = [];
    const sources = formats.map((format) => ({
      format,
      urls: plan.widths.map(({ width }) => {
        const encode: EncodeOptions = {
          width,
          ...(options.height ? { height: Math.round((width * plan.height) / plan.width) } : {}),
          format,
          quality: options.quality[format],
          fit: options.fit,
          position: options.position,
        };
        const a = asset(hash(digest, JSON.stringify(encode), ctx.processor.id), EXT[format], width, encode);
        assets.push(a);
        return a.url;
      }),
    }));
    const ph = options.placeholder === "none" ? undefined : await placeholder(input, digest, options.placeholder);
    return { descriptor: describe({ plan, layout: options.layout, placeholder: ph, sources }), assets, warnings };
  }
  /** Optimised SVG asset bytes (cached by svgo setup); warnings only when freshly optimised. */
  async function svgFile(asset: PlannedAsset): Promise<{ data: Buffer; warnings: string[] }> {
    const name = `${asset.key}.svg`;
    const cached = await cache.get(name);
    if (cached) return { data: cached, warnings: [] };
    const { data, warnings } = await optimizeSvg(asset.file, await readFile(asset.file, "utf8"), ctx.config.svgo ?? {});
    const out = Buffer.from(data);
    await cache.set(name, out);
    return { data: out, warnings };
  }
  /** `?svg`: TSX source of the inline component (cached by source + svgo setup + directives). */
  async function inline(file: string, directives: SvgDirectives): Promise<{ tsx: string; warnings: string[] }> {
    const source = await readFile(file, "utf8");
    const name = `${hash(source, file, svgoKey(ctx.config.svgo ?? {}, "inline", directives))}.svg.tsx`;
    const cached = await cache.get(name);
    if (cached) return { tsx: cached.toString("utf8"), warnings: [] };
    const result = await inlineSvg(file, source, ctx.config.svgo ?? {}, directives);
    await cache.set(name, Buffer.from(result.tsx));
    return result;
  }
  async function encode(asset: PlannedAsset): Promise<Buffer> {
    if (asset.svg) return (await svgFile(asset)).data;
    const name = `${asset.key}.${asset.ext}`;
    const cached = await cache.get(name);
    if (cached) return cached;
    return run(async () => {
      const input = await readFile(asset.file);
      const output = asset.encode ? await ctx.processor.encode(input, asset.encode) : input;
      await cache.set(name, output);
      return output;
    });
  }
  return { describe: describeFile, encode, inline };
}
