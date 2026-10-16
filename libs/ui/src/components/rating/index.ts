// Rivet addition (no HeroUI v3.2.6 counterpart): star rating, read-only (fractional) or interactive (native radios);
// feature set inspired by HeroUI Pro's public Rating docs, independent implementation (see `rating.tsx`).
import { RatingRoot } from "./rating.tsx";
import type { RatingProps } from "./rating.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Rating = Object.assign(RatingRoot, { Root: RatingRoot });

export type Rating = { Props: RatingProps; RootProps: RatingProps };

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { RatingRoot } from "./rating.tsx";
export type { RatingProps, RatingProps as RatingRootProps } from "./rating.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { ratingVariants } from "../../../styles/src/components/rating/index.ts";

export type { RatingVariants } from "../../../styles/src/components/rating/index.ts";
