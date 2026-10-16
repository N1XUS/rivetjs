// Ported from embla-carousel (packages/embla-carousel-autoplay/src/components/Options.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts, formatting; `'embla-carousel'` imports / module augmentation → `../../engine/` files; otherwise verbatim.
import type { CreateOptionsType, EmblaCarouselType } from "../../engine/index.ts";

export type DelayOptionType = number | ((scrollSnaps: number[], emblaApi: EmblaCarouselType) => number[]);

export type RootNodeType = null | ((emblaRoot: HTMLElement) => HTMLElement | null);

export type OptionsType = CreateOptionsType<{
  delay: DelayOptionType;
  jump: boolean;
  playOnInit: boolean;
  stopOnFocusIn: boolean;
  stopOnInteraction: boolean;
  stopOnMouseEnter: boolean;
  stopOnLastSnap: boolean;
  rootNode: RootNodeType;
}>;

export const defaultOptions: OptionsType = {
  active: true,
  breakpoints: {},
  delay: 4000,
  jump: false,
  playOnInit: true,
  stopOnFocusIn: true,
  stopOnInteraction: true,
  stopOnMouseEnter: false,
  stopOnLastSnap: false,
  rootNode: null,
};
