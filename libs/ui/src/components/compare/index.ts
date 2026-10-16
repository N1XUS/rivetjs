// Rivet addition (no HeroUI v3.2.6 / HeroUI Pro counterpart): before / after comparison with a draggable divider on
// `@rivetjs/cdk/compare` (see `compare.tsx`).
import { CompareAfter, CompareBefore, CompareDivider, CompareHandle, CompareLabel, CompareRoot, CompareThumb } from "./compare.tsx";
import type {
  CompareAfterProps,
  CompareBeforeProps,
  CompareDividerProps,
  CompareHandleProps,
  CompareLabelProps,
  CompareRootProps,
  CompareThumbProps,
} from "./compare.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Compare = Object.assign(CompareRoot, {
  Root: CompareRoot,
  Before: CompareBefore,
  After: CompareAfter,
  Handle: CompareHandle,
  Divider: CompareDivider,
  Thumb: CompareThumb,
  Label: CompareLabel,
});

export type Compare = {
  Props: CompareRootProps;
  RootProps: CompareRootProps;
  BeforeProps: CompareBeforeProps;
  AfterProps: CompareAfterProps;
  HandleProps: CompareHandleProps;
  DividerProps: CompareDividerProps;
  ThumbProps: CompareThumbProps;
  LabelProps: CompareLabelProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { CompareRoot, CompareBefore, CompareAfter, CompareHandle, CompareDivider, CompareThumb, CompareLabel } from "./compare.tsx";
export type {
  CompareRootProps,
  CompareRootProps as CompareProps,
  CompareBeforeProps,
  CompareAfterProps,
  CompareHandleProps,
  CompareDividerProps,
  CompareThumbProps,
  CompareLabelProps,
} from "./compare.tsx";
export { CompareContext, createCompareState, type CompareState, type CompareOrientation, type CompareMotionOptions } from "@rivetjs/cdk/compare";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { compareVariants } from "../../../styles/src/components/compare/index.ts";

export type { CompareVariants } from "../../../styles/src/components/compare/index.ts";
