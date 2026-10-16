// Ported from embla-carousel (packages/embla-carousel-auto-scroll/src/components/Options.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts, formatting; `'embla-carousel'` imports / module augmentation → `../../engine/` files; otherwise verbatim.
import type { CreateOptionsType } from "../../engine/index.ts";

export type RootNodeType = null | ((emblaRoot: HTMLElement) => HTMLElement | null);

export type OptionsType = CreateOptionsType<{
  direction: "forward" | "backward";
  speed: number;
  startDelay: number;
  playOnInit: boolean;
  stopOnFocusIn: boolean;
  stopOnInteraction: boolean;
  stopOnMouseEnter: boolean;
  rootNode: RootNodeType;
}>;

export const defaultOptions: OptionsType = {
  direction: "forward",
  speed: 2,
  startDelay: 1000,
  active: true,
  breakpoints: {},
  playOnInit: true,
  stopOnFocusIn: true,
  stopOnInteraction: true,
  stopOnMouseEnter: false,
  rootNode: null,
};
