// @rivetjs/kit/image: the runtime `Picture` plus the head preload a priority image needs. Both
// targets: `@rivetjs/kit` and `@rivetjs/runtime/image` resolve to their DOM entries in browsers.
import { Picture as RuntimePicture, ImagePreload, preloadLink, type ArtDirection, type ImageDescriptor, type PictureProps as RuntimePictureProps } from "@rivetjs/runtime/image";
import { pushHead } from "@rivetjs/kit";
import type { HeadLink } from "./shared.ts";
export { ImagePreload };
export type { ArtDirection, ImageDescriptor } from "@rivetjs/runtime/image";

/** Props of the kit `<Picture>`: the runtime props plus a head preload. */
export interface PictureProps extends RuntimePictureProps {
  /**
   * Head `<link rel=preload as=image>` for the best source (`imagesrcset`/`imagesizes`/`type`):
   * `auto` (default) when `priority`. Art direction preloads once per media, mutually exclusive.
   */
  preload?: boolean | "auto";
}

const isDescriptor = (value: ImageDescriptor | ArtDirection): value is ImageDescriptor =>
  typeof (value as ImageDescriptor).src === "string" && Array.isArray((value as ImageDescriptor).sources);

/** Preload links for an image (one per media for art direction; later medias exclude earlier ones). */
export function imagePreloads(image: ImageDescriptor | ArtDirection, sizes?: RuntimePictureProps["sizes"]): HeadLink[] {
  const options = sizes !== undefined ? { sizes } : {};
  if (isDescriptor(image)) return [preloadLink(image, options) as HeadLink];
  const links: HeadLink[] = [];
  const previous: string[] = [];
  const not = (media: string) => `(not (${media}))`;
  for (const [media, descriptor] of Object.entries(image)) {
    if (media === "default") continue;
    links.push(preloadLink(descriptor, { ...options, media: [media, ...previous.map(not)].join(" and ") }) as HeadLink);
    previous.push(media);
  }
  links.push(preloadLink(image.default, previous.length ? { ...options, media: previous.map(not).join(" and ") } : options) as HeadLink);
  return links;
}

/** Responsive `<picture>` / `<img>`; `priority` also preloads it from the head (kit head hold). */
export function Picture(props: PictureProps): unknown {
  const { preload = "auto", ...picture } = props;
  const wanted = preload === true || (preload === "auto" && picture.priority === true);
  // `sizes="auto"` stays lazy: nothing to preload.
  const late = wanted && picture.sizes !== "auto" ? pushHead({ links: imagePreloads(picture.image, picture.sizes) }, "<Picture>") : null;
  const markup = RuntimePicture(picture);
  return late ? [late, markup] : markup;
}
/** `<Picture as="img">`. */
export const Image = (props: Omit<PictureProps, "as">): unknown => Picture({ ...props, as: "img" });
