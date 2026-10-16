// Ported from embla-carousel (packages/embla-carousel-class-names/src/components/Options.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts, formatting; `'embla-carousel'` imports / module augmentation → `../../engine/` files; otherwise verbatim.
import type { CreateOptionsType } from "../../engine/index.ts";

export type ClassNameOptionType = string | string[];

export type ClassNamesListType = {
  snapped: string[];
  inView: string[];
  draggable: string[];
  dragging: string[];
  loop: string[];
};

export type OptionsType = CreateOptionsType<{
  [Key in keyof ClassNamesListType]: ClassNameOptionType;
}>;

export const defaultOptions: OptionsType = {
  active: true,
  breakpoints: {},
  snapped: "is-snapped",
  inView: "is-in-view",
  draggable: "is-draggable",
  dragging: "is-dragging",
  loop: "is-loop",
};
