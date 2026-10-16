// Rivet addition (no HeroUI v3.2.6 / HeroUI Pro counterpart): Masonry + Bento grids on `@rivetjs/cdk/masonry` (see
// `masonry.tsx`). Data-driven components (items + render function), no compound parts.
export { Masonry, Bento } from "./masonry.tsx";
export type { MasonryProps, BentoProps } from "./masonry.tsx";
export { masonrySizes } from "@rivetjs/cdk/masonry";
export type {
  BentoPack,
  BentoRowHeight,
  Columns,
  Gap,
  JustifiedLastRow,
  MasonryHandle,
  MasonryItemState,
  MotionOptions,
  Responsive,
  Key,
  Selection,
  SelectionBehavior,
  SelectionMode,
} from "@rivetjs/cdk/masonry";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { masonryVariants, bentoVariants } from "../../../styles/src/components/masonry/index.ts";

export type { MasonryVariants, BentoVariants } from "../../../styles/src/components/masonry/index.ts";
