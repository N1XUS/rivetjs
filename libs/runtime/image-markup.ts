import { encodeAttributeValue } from "./template.ts";
import { _styleValue } from "./style.ts";
import type { ImageDescriptor } from "./image-plan.ts";

/** Tailwind default screens; `sizes` map keys. */
export const SCREENS: Readonly<Record<string, number>> = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };
/** Raw string, `"auto"`, or map: screen name / px number → `(min-width)`, `(raw media)`, `default`. */
export type SizesProp = string | Record<string, string>;
/** Media query → descriptor; `default` renders the `<img>`. */
export type ArtDirection = { default: ImageDescriptor; [media: string]: ImageDescriptor };
/** Props of `<Picture>`. */
export interface PictureProps {
  image: ImageDescriptor | ArtDirection;
  /** Required; `""` marks a decorative image. */
  alt: string;
  sizes?: SizesProp;
  /** Above-the-fold: eager + `fetchpriority="high"`. Pair with `<ImagePreload>`. */
  priority?: boolean;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  fetchpriority?: "high" | "low" | "auto";
  /** Force `<picture>` or bare `<img>`; default collapses when `<picture>` adds nothing. */
  as?: "picture" | "img";
  class?: string;
  style?: string;
  id?: string;
  title?: string;
  crossorigin?: "anonymous" | "use-credentials";
  referrerpolicy?: string;
  pictureClass?: string;
}
const attr = (name: string, value: string | number | undefined) => encodeAttributeValue(name, value);
// The user's `style` declarations under the style-value rule (SEC13): an unsafe value (`url()`,
// `expression()`, escapes, … — dev: warning) or a malformed declaration is dropped, like a `style={{…}}` value.
const userStyle = (style: string): string =>
  style
    .split(";")
    .map((declaration) => {
      const colon = declaration.indexOf(":"),
        name = declaration.slice(0, colon).trim(),
        value = colon > 0 && /^(?:--[\w-]+|-?[a-zA-Z][\w-]*)$/.test(name) && _styleValue(name, declaration.slice(colon + 1).trim());
      return value ? name + ":" + value : "";
    })
    .filter(Boolean)
    .join(";");
/** img/source `src`/`srcset`: a `data:` image URL is allowed there. */
const sourceAttr = (name: string, value: string | undefined) => encodeAttributeValue(name, value, "media");
const isDescriptor = (value: unknown): value is ImageDescriptor =>
  typeof (value as ImageDescriptor).src === "string" && Array.isArray((value as ImageDescriptor).sources);
const usesWidths = (set: string) => /\s\d+w(?:,|$)/.test(set);
/** The `sizes` attribute for a `sizes` prop (string, `auto` or breakpoint map), with a fallback. */
export function resolveSizes(sizes: SizesProp | undefined, fallback: string | undefined): string | undefined {
  if (sizes === undefined) return fallback;
  if (typeof sizes === "string") return sizes === "auto" ? `auto, ${fallback ?? "100vw"}` : sizes;
  const raw: string[] = [];
  const widths: [number, string][] = [];
  let last = fallback;
  for (const [key, value] of Object.entries(sizes)) {
    if (key === "default") last = value;
    else if (key.startsWith("(")) raw.push(`${key} ${value}`);
    else {
      const px = SCREENS[key] ?? (/^\d+$/.test(key) ? Number(key) : NaN);
      if (Number.isNaN(px)) throw new TypeError(`Unknown sizes key "${key}"`);
      widths.push([px, value]);
    }
  }
  widths.sort((a, b) => b[0] - a[0]);
  return [...raw, ...widths.map(([px, value]) => `(min-width: ${px}px) ${value}`), last ?? "100vw"].join(", ");
}
const BLUR = /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
const COLOR = /^#[0-9a-fA-F]{3,8}$/;
function placeholderStyle(placeholder: ImageDescriptor["placeholder"]): string {
  if (!placeholder) return "";
  if (placeholder.kind === "blur" && BLUR.test(placeholder.src))
    return `background-image:url(${placeholder.src});background-size:cover;background-position:center;background-repeat:no-repeat`;
  if (placeholder.kind === "color" && COLOR.test(placeholder.value)) return `background-color:${placeholder.value}`;
  throw new TypeError("Invalid image placeholder");
}
/** Brand of build-emitted descriptors (`?image` / `?jsx`, deep-frozen JSON data): their markup parts are cached. */
const IMAGE = Symbol.for("rivet.image");
const described = new WeakMap<ImageDescriptor, Map<string | undefined, [sources: string, img: string, placeholder: string]>>();
function describe(entries: { media: string | undefined; image: ImageDescriptor }[], main: ImageDescriptor, sizesProp: SizesProp | undefined): [string, string, string] {
  let sources = "";
  for (const { media, image } of entries) {
    const sizes = resolveSizes(sizesProp, image.sizes);
    for (const source of media ? image.sources : image.sources.slice(0, -1))
      sources +=
        `<source${attr("media", media)}${attr("type", source.type)}${sourceAttr("srcset", source.srcset)}` +
        `${usesWidths(source.srcset) ? attr("sizes", sizes) : ""}` +
        `${media ? attr("width", image.width) + attr("height", image.height) : ""}>`;
  }
  const fallback = main.sources.at(-1)!;
  const sizes = resolveSizes(sizesProp, main.sizes);
  return [
    sources,
    `${sourceAttr("src", main.src)}${fallback.srcset === main.src ? "" : sourceAttr("srcset", fallback.srcset)}` +
      `${usesWidths(fallback.srcset) ? attr("sizes", sizes) : ""}${attr("width", main.width)}${attr("height", main.height)}`,
    placeholderStyle(main.placeholder),
  ];
}
/** Escaped `<picture>`/`<img>` markup; shared by the server and DOM entries. */
export function pictureHtml(props: PictureProps): string {
  if (typeof props.alt !== "string") throw new TypeError('Picture requires alt (use "" for decorative images)');
  const entries = isDescriptor(props.image)
    ? [{ media: undefined as string | undefined, image: props.image }]
    : [
        ...Object.entries(props.image).filter(([m]) => m !== "default").map(([media, image]) => ({ media: media as string | undefined, image })),
        { media: undefined, image: props.image.default },
      ];
  const main = entries.at(-1)!.image;
  const auto = props.sizes === "auto";
  if (auto && (props.priority || props.loading === "eager")) throw new TypeError('sizes="auto" requires lazy loading');
  if (props.as === "img" && entries.length > 1) throw new TypeError("Art direction requires <picture>");
  const wrap = props.as === "picture" || (props.as !== "img" && (entries.length > 1 || main.sources.length > 1));
  // Descriptor-only markup (`<source>`s; the img's src / srcset / sizes / size, placeholder style): encoded once per build-emitted
  // descriptor (branded, deep-frozen data: no getters) and `sizes` string; any other descriptor every call.
  const branded = entries.length == 1 && (main as { [IMAGE]?: unknown })[IMAGE] === true && (props.sizes === undefined || typeof props.sizes == "string");
  const key = branded ? (props.sizes as string | undefined) : undefined;
  let byDescriptor = branded ? described.get(main) : undefined;
  let parts = byDescriptor?.get(key);
  if (!parts) {
    parts = describe(entries, main, props.sizes);
    if (branded) (byDescriptor ?? (described.set(main, (byDescriptor = new Map())), byDescriptor)).set(key, parts);
  }
  const style = [parts[2], props.style && userStyle(props.style)].filter(Boolean).join(";");
  const html =
    (wrap ? `<picture${attr("class", props.pictureClass)}>` + parts[0] : "") +
    `<img${parts[1]}` +
    `${attr("alt", props.alt)}${attr("loading", props.priority ? "eager" : auto ? "lazy" : (props.loading ?? "lazy"))}` +
    `${attr("decoding", props.decoding ?? "async")}${attr("fetchpriority", props.priority ? "high" : props.fetchpriority)}` +
    `${attr("class", props.class)}${attr("id", props.id)}${attr("title", props.title)}${attr("crossorigin", props.crossorigin)}` +
    `${attr("referrerpolicy", props.referrerpolicy)}${attr("style", style || undefined)}>`;
  return wrap ? html + "</picture>" : html;
}
/** A head `<link rel="preload" as="image">`. */
export interface PreloadLink {
  rel: "preload";
  as: "image";
  href: string;
  imagesrcset?: string;
  imagesizes?: string;
  type?: string;
  fetchpriority: "high" | "low" | "auto";
  media?: string;
}
/** Preload attributes for the best source (`type` lets unsupported browsers skip it). */
export function preloadLink(
  image: ImageDescriptor,
  options: { sizes?: SizesProp; media?: string; fetchpriority?: "high" | "low" | "auto" } = {},
): PreloadLink {
  const best = image.sources[0]!;
  const sizes = usesWidths(best.srcset) ? resolveSizes(options.sizes, image.sizes) : undefined;
  return {
    rel: "preload",
    as: "image",
    href: image.src,
    ...(best.srcset !== image.src ? { imagesrcset: best.srcset } : {}),
    ...(sizes ? { imagesizes: sizes } : {}),
    ...(best.type ? { type: best.type } : {}),
    fetchpriority: options.fetchpriority ?? "high",
    ...(options.media ? { media: options.media } : {}),
  };
}
/** HTML of an image preload link. */
export function preloadHtml(link: PreloadLink): string {
  return (
    `<link${attr("rel", link.rel)}${attr("as", link.as)}${attr("href", link.href)}${attr("imagesrcset", link.imagesrcset)}` +
    `${attr("imagesizes", link.imagesizes)}${attr("type", link.type)}${attr("fetchpriority", link.fetchpriority)}${attr("media", link.media)}>`
  );
}
/** srcset of the best source, or of the source with this MIME type. */
export function srcset(image: ImageDescriptor, type?: string): string {
  const source = type === undefined ? image.sources[0] : image.sources.find((s) => s.type === type);
  if (!source) throw new TypeError(`No ${type} source`);
  return source.srcset;
}
const cssUrl = (url: string) => `url("${url.replace(/["\\\n]/g, (c) => (c === "\n" ? "\\a " : "\\" + c))}")`;
/** CSS `image-set()` with 1x/2x candidates per type (for backgrounds). */
export function imageSet(image: ImageDescriptor): string {
  const parts: string[] = [];
  for (const source of image.sources) {
    const entries = source.srcset.split(/,\s+/).map((part) => {
      const [url, d = "1x"] = part.trim().split(/\s+/) as [string, string?];
      return { url, value: Number(d.slice(0, -1)), unit: d.at(-1) };
    });
    const type = source.type ? ` type("${source.type}")` : "";
    if (entries[0]!.unit === "x") {
      for (const e of entries) parts.push(`${cssUrl(e.url)}${type} ${e.value}x`);
      continue;
    }
    const seen = new Set<string>();
    for (const density of [1, 2]) {
      const need = image.width * density;
      const pick = entries.find((e) => e.value >= need) ?? entries.at(-1)!;
      if (seen.has(pick.url)) continue;
      seen.add(pick.url);
      parts.push(`${cssUrl(pick.url)}${type} ${density}x`);
    }
  }
  return `image-set(${parts.join(", ")})`;
}
