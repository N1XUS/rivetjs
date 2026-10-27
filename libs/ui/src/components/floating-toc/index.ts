// Rivet addition (no HeroUI v3.2.6 counterpart): floating table of contents (bar indicators + a popover list) on
// `@rivetjs/cdk/dialog` + `@rivetjs/cdk/popover`; feature set inspired by HeroUI Pro's public Floating TOC docs, independent
// implementation (see `floating-toc.tsx`).
import { FloatingTocBar, FloatingTocContent, FloatingTocItem, FloatingTocRoot, FloatingTocTrigger } from "./floating-toc.tsx";
import type { FloatingTocBarProps, FloatingTocContentProps, FloatingTocItemProps, FloatingTocRootProps, FloatingTocTriggerProps } from "./floating-toc.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const FloatingToc = Object.assign(FloatingTocRoot, {
  Root: FloatingTocRoot,
  Trigger: FloatingTocTrigger,
  Bar: FloatingTocBar,
  Content: FloatingTocContent,
  Item: FloatingTocItem,
});

export type FloatingToc = {
  Props: FloatingTocRootProps;
  RootProps: FloatingTocRootProps;
  TriggerProps: FloatingTocTriggerProps;
  BarProps: FloatingTocBarProps;
  ContentProps: FloatingTocContentProps;
  ItemProps: FloatingTocItemProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { FloatingTocRoot, FloatingTocTrigger, FloatingTocBar, FloatingTocContent, FloatingTocItem } from "./floating-toc.tsx";
export type {
  FloatingTocRootProps,
  FloatingTocRootProps as FloatingTocProps,
  FloatingTocTriggerProps,
  FloatingTocBarProps,
  FloatingTocContentProps,
  FloatingTocItemProps,
} from "./floating-toc.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { floatingTocVariants } from "../../../styles/src/components/floating-toc/index.ts";

export type { FloatingTocVariants } from "../../../styles/src/components/floating-toc/index.ts";
