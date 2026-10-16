// @rivetjs/kit/font: `?font` imports (kit Vite plugin) describe a self-hosted font; `<Font preload>`
// adds its head preload. The `@font-face` rules ship in the importing route's CSS.
import { pushHead } from "@rivetjs/kit";
import type { HeadLink } from "./shared.ts";

/** A self-hosted font, as a `?font` import describes it. */
export interface FontDescriptor {
  family: string;
  /** `font-family` value: the font, its metric-matched fallback face (when computed), the generic family. */
  stack: string;
  /** Hashed asset URL. */
  src: string;
  format: "woff2" | "woff" | "truetype" | "opentype";
  weight: string;
  style: string;
  display: string;
  /** `<link rel=preload as=font type crossorigin>` (fonts always need `crossorigin`). */
  preload: HeadLink;
}

/** Use a font: with `preload`, the head preloads it (each preload competes with the LCP image: be selective). */
export function Font(props: { font: FontDescriptor; preload?: boolean }): unknown {
  return props.preload ? pushHead({ links: [props.font.preload] }, "<Font>") : null;
}
