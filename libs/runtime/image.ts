import { attribute, template, type TemplateRecord } from "./template.ts";
import { pictureHtml, preloadHtml, preloadLink, type PictureProps, type SizesProp } from "./image-markup.ts";
import type { ImageDescriptor } from "./image-plan.ts";
export * from "./image-markup.ts";
export * from "./image-cdn.ts";
export type { ImageDescriptor, ImageSource, ImageFormat, Layout, Placeholder } from "./image-plan.ts";

/** Props of `<ImagePreload>`. */
export interface ImagePreloadProps {
  image: ImageDescriptor;
  sizes?: SizesProp;
  media?: string;
  fetchpriority?: "high" | "low" | "auto";
}
// `server.ts` `VARIANT_VALUE`: a server `t()` value outside JSX (one value per locale variant).
const VARIANT_VALUE = Symbol.for("rivet.variantValue");
const translated = (value: unknown): boolean => value !== null && typeof value === "object" && VARIANT_VALUE in value;
/**
 * Responsive image; static markup, no client code. Server target (Vite resolves `/image/dom` for the browser). A translated
 * `alt` / `title` (`alt={t("…")}`: one value per locale) is an attribute slot the renderer resolves for the page's locale.
 */
export function Picture(props: PictureProps): TemplateRecord {
  const alt = translated(props.alt),
    title = translated(props.title);
  if (!alt && !title) return template([pictureHtml(props)]);
  // Placeholders: `alt=""` / `title=""` are written once each (values are escaped, so the text cannot occur inside one).
  const html = pictureHtml({ ...props, ...(alt ? { alt: "" } : {}), ...(title ? { title: "" } : {}) });
  const fragments: string[] = [],
    slots: ReturnType<typeof attribute>[] = [];
  let rest = html;
  for (const [name, on] of [
    ["alt", alt],
    ["title", title],
  ] as const) {
    if (!on) continue;
    const at = rest.indexOf(` ${name}=""`);
    fragments.push(rest.slice(0, at));
    slots.push(attribute(name, props[name]));
    rest = rest.slice(at + name.length + 4);
  }
  fragments.push(rest);
  return template(fragments, slots);
}
/** `<link rel=preload as=image>` for the best source; valid anywhere in the document. */
export function ImagePreload(props: ImagePreloadProps): TemplateRecord {
  return template([preloadHtml(preloadLink(props.image, props))]);
}
