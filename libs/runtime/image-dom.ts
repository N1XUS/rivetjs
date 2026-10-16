import { _tpl } from "./dom-v2.ts";
import { pictureHtml, preloadHtml, preloadLink, type PictureProps } from "./image-markup.ts";
import type { ImagePreloadProps } from "./image.ts";
export * from "./image-markup.ts";
export * from "./image-cdn.ts";
export type { ImageDescriptor, ImageSource, ImageFormat, Layout, Placeholder } from "./image-plan.ts";
export type { ImagePreloadProps } from "./image.ts";

// One cloner per markup (bounded): `_tpl` parses once per document, clones per call.
const clones = new Map<string, () => Node>();
function clone(html: string): Node {
  let found = clones.get(html);
  if (!found) {
    if (clones.size >= 256) clones.delete(clones.keys().next().value!);
    clones.set(html, (found = _tpl(html)));
  }
  return found();
}
export function Picture(props: PictureProps): Node {
  return clone(pictureHtml(props));
}
export function ImagePreload(props: ImagePreloadProps): Node {
  return clone(preloadHtml(preloadLink(props.image, props)));
}
