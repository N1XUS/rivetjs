// Rivet addition (no HeroUI v3.2.6 counterpart): a surface that morphs between a collapsed element and an expanded panel;
// feature set scoped from public docs of commercial UI kits, independent implementation (see `morph.tsx`).
import { MorphClose, MorphCollapsedContent, MorphExpandedContent, MorphRoot, MorphTrigger } from "./morph.tsx";
import type { MorphCloseProps, MorphCollapsedContentProps, MorphExpandedContentProps, MorphRootProps, MorphTriggerProps } from "./morph.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Morph = Object.assign(MorphRoot, {
  Root: MorphRoot,
  CollapsedContent: MorphCollapsedContent,
  ExpandedContent: MorphExpandedContent,
  Trigger: MorphTrigger,
  Close: MorphClose,
});

export type Morph = {
  Props: MorphRootProps;
  RootProps: MorphRootProps;
  CollapsedContentProps: MorphCollapsedContentProps;
  ExpandedContentProps: MorphExpandedContentProps;
  TriggerProps: MorphTriggerProps;
  CloseProps: MorphCloseProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { MorphRoot, MorphCollapsedContent, MorphExpandedContent, MorphTrigger, MorphClose, MorphContext, useMorph } from "./morph.tsx";
export type {
  MorphRootProps,
  MorphRootProps as MorphProps,
  MorphCollapsedContentProps,
  MorphExpandedContentProps,
  MorphTriggerProps,
  MorphCloseProps,
  MorphAnimation,
  MorphDirection,
  UseMorphReturn,
} from "./morph.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { morphVariants } from "../../../styles/src/components/morph/index.ts";

export type { MorphVariants } from "../../../styles/src/components/morph/index.ts";
