import { planWidths, describe, DEFAULT_DENSITIES, type ImageDescriptor, type ImageFormat, type Layout } from "./image-plan.ts";

/** Options an image CDN URL builder receives. */
export interface CdnUrlOptions {
  width: number;
  height?: number;
  format?: ImageFormat;
  quality?: number;
  fit?: "cover" | "contain";
}
/** URL builder for an image CDN; `autoFormat` = CDN picks the format from `Accept`. */
export interface ImageCdn {
  url(src: string, options: CdnUrlOptions): string;
  autoFormat?: boolean;
}
/** Options of `cdn()`: CDN, display size, layout, formats and quality. */
export interface CdnImageOptions {
  cdn: ImageCdn;
  /** Display size; required so `<img>` reserves space (CLS). */
  width: number;
  height: number;
  layout?: Layout;
  /** Explicit formats; default: none when `autoFormat`, else avif/webp/jpeg. */
  formats?: ImageFormat[];
  quality?: number;
  fit?: "cover" | "contain";
  /** Largest variant; default `width × max(densities)`. */
  maxWidth?: number;
  densities?: number[];
  breakpoints?: number[];
}
/** Descriptor for a CDN-hosted image: pure string building at render time, no fetch. */
export function cdn(src: string, options: CdnImageOptions): ImageDescriptor {
  if (!(options.width > 0) || !(options.height > 0)) throw new TypeError(`cdn("${src}") needs width and height`);
  const densities = options.densities ?? DEFAULT_DENSITIES;
  const maxWidth = options.maxWidth ?? Math.round(options.width * Math.max(...densities));
  const layout = options.layout ?? "constrained";
  const plan = planWidths({
    intrinsic: { width: maxWidth, height: Math.round((maxWidth * options.height) / options.width) },
    layout,
    width: options.width,
    height: options.height,
    densities,
    breakpoints: options.breakpoints,
  });
  const formats: (ImageFormat | undefined)[] = options.formats ?? (options.cdn.autoFormat ? [undefined] : ["avif", "webp", "jpeg"]);
  const fit = options.fit ?? "cover";
  return describe({
    plan,
    layout,
    sources: formats.map((format) => ({
      format,
      urls: plan.widths.map(({ width }) =>
        options.cdn.url(src, { width, height: Math.round((width * plan.height) / plan.width), format, quality: options.quality, fit }),
      ),
    })),
  });
}
const path = (src: string) => src.replace(/^\/+/, "");
const short = (format: ImageFormat | undefined) => (format === "jpeg" ? "jpg" : format);
/** `{src} {width} {height} {format} {quality} {fit}` placeholders; missing values become empty. */
export function urlTemplate(template: string, { autoFormat = false }: { autoFormat?: boolean } = {}): ImageCdn {
  return {
    autoFormat,
    url: (src, o) =>
      template.replace(/\{(src|width|height|format|quality|fit)\}/g, (_, key: keyof CdnUrlOptions | "src") =>
        key === "src" ? path(src) : o[key] == null ? "" : encodeURIComponent(String(o[key])),
      ),
  };
}
/** Cloudinary URL builder. */
export function cloudinary({ cloud }: { cloud: string }): ImageCdn {
  return {
    autoFormat: true,
    url: (src, o) =>
      `https://res.cloudinary.com/${cloud}/image/upload/${[
        `w_${o.width}`,
        o.height && `h_${o.height}`,
        o.height && `c_${o.fit === "contain" ? "fit" : "fill"}`,
        `f_${short(o.format) ?? "auto"}`,
        `q_${o.quality ?? "auto"}`,
      ]
        .filter(Boolean)
        .join(",")}/${path(src)}`,
  };
}
/** imgix URL builder. */
export function imgix({ domain }: { domain: string }): ImageCdn {
  return {
    autoFormat: true,
    url: (src, o) => {
      const q = new URLSearchParams({ w: String(o.width) });
      if (o.height) q.set("h", String(o.height)), q.set("fit", o.fit === "contain" ? "clip" : "crop");
      if (o.format) q.set("fm", short(o.format)!);
      else q.set("auto", "format");
      if (o.quality) q.set("q", String(o.quality));
      return `https://${domain}/${path(src)}?${q}`;
    },
  };
}
/** Cloudflare Images URL builder (`/cdn-cgi/image/`). */
export function cloudflare({ origin = "" }: { origin?: string } = {}): ImageCdn {
  return {
    autoFormat: true,
    url: (src, o) =>
      `${origin}/cdn-cgi/image/${[
        `width=${o.width}`,
        o.height && `height=${o.height}`,
        `fit=${o.fit === "contain" ? "contain" : "cover"}`,
        `format=${o.format ?? "auto"}`,
        o.quality && `quality=${o.quality}`,
      ]
        .filter(Boolean)
        .join(",")}/${path(src)}`,
  };
}
