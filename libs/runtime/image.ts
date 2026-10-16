import { template, type TemplateRecord } from "./template.ts";
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
/** Responsive image; static markup, no client code. Server target (Vite resolves `/image/dom` for the browser). */
export function Picture(props: PictureProps): TemplateRecord {
  return template([pictureHtml(props)]);
}
/** `<link rel=preload as=image>` for the best source; valid anywhere in the document. */
export function ImagePreload(props: ImagePreloadProps): TemplateRecord {
  return template([preloadHtml(preloadLink(props.image, props))]);
}
