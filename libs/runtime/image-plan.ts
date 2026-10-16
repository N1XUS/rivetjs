/** Image layout: drives which widths are generated and the default `sizes`. */
export type Layout = "fixed" | "constrained" | "full-width";
export const LAYOUTS: readonly Layout[] = ["fixed", "constrained", "full-width"];
/** Image format of a source. */
export type ImageFormat = "avif" | "webp" | "jpeg" | "png" | "gif" | "svg";
/** Formats the build can encode to. */
export type EncodableFormat = "avif" | "webp" | "jpeg" | "png";
export const ENCODABLE: readonly EncodableFormat[] = ["avif", "webp", "jpeg", "png"];
/** One `<source>`: `type` absent = format negotiated by the server (CDN auto format). */
export interface ImageSource {
  type?: string;
  srcset: string;
}
/** Placeholder shown while an image loads: a blurred image or a solid colour. */
export type Placeholder = { kind: "blur"; src: string } | { kind: "color"; value: string };
/** Plain JSON result of `?image` / `cdn()`; the raw API. Sources ordered best → fallback. */
export interface ImageDescriptor {
  src: string;
  width: number;
  height: number;
  layout: Layout;
  sizes?: string;
  placeholder?: Placeholder;
  sources: ImageSource[];
}
export const DEFAULT_BREAKPOINTS: readonly number[] = [640, 768, 1024, 1280, 1536, 1920, 2560];
export const DEFAULT_DENSITIES: readonly number[] = [1, 2];
const MIME: Record<ImageFormat, string> = {
  avif: "image/avif",
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
};
export function mimeType(format: ImageFormat): string {
  return MIME[format];
}
export interface PlanInput {
  intrinsic: { width: number; height: number };
  layout: Layout;
  width?: number;
  height?: number;
  densities?: readonly number[];
  breakpoints?: readonly number[];
}
export interface PlannedWidth {
  width: number;
  /** srcset descriptor: `640w` or `2x`. */
  descriptor: string;
}
export interface Plan {
  /** Display size (CLS). */
  width: number;
  height: number;
  widths: PlannedWidth[];
  /** Requested width exceeded the intrinsic width. */
  clamped: boolean;
}
/** Widths to generate for a layout; never upscales past the intrinsic width. */
export function planWidths(input: PlanInput): Plan {
  const { intrinsic, layout } = input;
  const densities = [...(input.densities ?? DEFAULT_DENSITIES)].sort((a, b) => a - b);
  const breakpoints = input.breakpoints ?? DEFAULT_BREAKPOINTS;
  const requested = input.width ?? intrinsic.width;
  const cap = intrinsic.width;
  const width = Math.min(requested, cap);
  const aspect = input.height ? input.height / requested : intrinsic.height / intrinsic.width;
  const height = Math.round(width * aspect);
  const clamped = requested > cap;
  if (layout === "fixed") {
    const seen = new Map<number, string>();
    for (const d of densities) {
      const w = Math.min(Math.round(width * d), cap);
      if (!seen.has(w)) seen.set(w, `${+(w / width).toFixed(2)}x`);
    }
    const widths = [...seen].map(([w, descriptor]) => ({ width: w, descriptor })).sort((a, b) => a.width - b.width);
    return { width, height, widths, clamped };
  }
  const max = layout === "full-width" ? cap : Math.min(Math.round(width * densities.at(-1)!), cap);
  const set = new Set(breakpoints.filter((b) => b <= max));
  if (layout === "constrained") for (const d of densities) set.add(Math.min(Math.round(width * d), cap));
  set.add(max);
  const widths = [...set].sort((a, b) => a - b).map((w) => ({ width: w, descriptor: `${w}w` }));
  return { width, height, widths, clamped };
}
/** Default `sizes` for a layout; fixed images use x descriptors and need none. */
export function layoutSizes(layout: Layout, width: number): string | undefined {
  if (layout === "fixed") return undefined;
  return layout === "full-width" ? "100vw" : `(min-width: ${width}px) ${width}px, 100vw`;
}
/** Universally supported last-resort format: PNG keeps alpha, otherwise JPEG (PNG sources stay PNG). */
export function fallbackFormat(source: string, hasAlpha: boolean): EncodableFormat {
  return hasAlpha || source === "png" ? "png" : "jpeg";
}
export interface DescribeInput {
  plan: Plan;
  layout: Layout;
  placeholder?: Placeholder;
  /** Ordered best → fallback; `urls` align with `plan.widths`. */
  sources: { format?: ImageFormat; urls: string[] }[];
}
export function describe({ plan, layout, placeholder, sources }: DescribeInput): ImageDescriptor {
  let index = 0;
  plan.widths.forEach((w, k) => {
    if (w.width <= plan.width) index = k;
  });
  const sizes = layoutSizes(layout, plan.width);
  return {
    src: sources.at(-1)!.urls[index]!,
    width: plan.width,
    height: plan.height,
    layout,
    ...(sizes ? { sizes } : {}),
    ...(placeholder ? { placeholder } : {}),
    sources: sources.map((s) => ({
      ...(s.format ? { type: mimeType(s.format) } : {}),
      srcset: s.urls.map((url, k) => `${url} ${plan.widths[k]!.descriptor}`).join(", "),
    })),
  };
}
/** Descriptor for a file served as-is (SVG, animated GIF/WebP). */
export function single(url: string, format: ImageFormat, width: number, height: number, layout: Layout): ImageDescriptor {
  return { src: url, width, height, layout, sources: [{ type: mimeType(format), srcset: url }] };
}
