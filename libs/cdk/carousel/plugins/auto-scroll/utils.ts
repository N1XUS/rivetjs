// Ported from embla-carousel (packages/embla-carousel-auto-scroll/src/components/utils.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts, formatting; `'embla-carousel'` imports / module augmentation → `../../engine/` files; otherwise verbatim.
import type { EmblaCarouselType } from "../../engine/index.ts";
import type { RootNodeType } from "./Options.ts";

export function getAutoScrollRootNode(emblaApi: EmblaCarouselType, rootNode: RootNodeType): HTMLElement {
  const emblaRootNode = emblaApi.rootNode();
  return (rootNode && rootNode(emblaRootNode)) || emblaRootNode;
}
