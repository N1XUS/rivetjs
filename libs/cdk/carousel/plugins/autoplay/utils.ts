// Ported from embla-carousel (packages/embla-carousel-autoplay/src/components/utils.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts, formatting; `'embla-carousel'` imports / module augmentation → `../../engine/` files; otherwise verbatim.
import type { EmblaCarouselType } from "../../engine/index.ts";
import type { DelayOptionType, RootNodeType } from "./Options.ts";

export function normalizeDelay(emblaApi: EmblaCarouselType, delay: DelayOptionType): number[] {
  const scrollSnaps = emblaApi.scrollSnapList();

  if (typeof delay === "number") {
    return scrollSnaps.map(() => delay);
  }
  return delay(scrollSnaps, emblaApi);
}

export function getAutoplayRootNode(emblaApi: EmblaCarouselType, rootNode: RootNodeType): HTMLElement {
  const emblaRootNode = emblaApi.rootNode();
  return (rootNode && rootNode(emblaRootNode)) || emblaRootNode;
}
