// Rivet addition (no HeroUI v3.2.6 counterpart): shimmering label; feature set inspired by HeroUI Pro's public TextShimmer
// docs, independent implementation (see `text-shimmer.tsx`).
import { TextShimmerRoot } from "./text-shimmer.tsx";
import type { TextShimmerProps } from "./text-shimmer.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const TextShimmer = Object.assign(TextShimmerRoot, { Root: TextShimmerRoot });

export type TextShimmer = {
  Props: TextShimmerProps;
  RootProps: TextShimmerProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { TextShimmerRoot } from "./text-shimmer.tsx";
export type { TextShimmerProps, TextShimmerProps as TextShimmerRootProps } from "./text-shimmer.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { textShimmerVariants } from "../../../styles/src/components/text-shimmer/index.ts";

export type { TextShimmerVariants } from "../../../styles/src/components/text-shimmer/index.ts";
