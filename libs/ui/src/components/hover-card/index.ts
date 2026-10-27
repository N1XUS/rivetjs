// Rivet addition (no HeroUI v3.2.6 counterpart): hover preview card; feature set inspired by HeroUI Pro's public Hover Card
// docs, independent implementation (see `hover-card.tsx`).
import { HoverCardArrow, HoverCardContent, HoverCardRoot, HoverCardTrigger } from "./hover-card.tsx";
import type { HoverCardArrowProps, HoverCardContentProps, HoverCardRootProps, HoverCardTriggerProps } from "./hover-card.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const HoverCard = Object.assign(HoverCardRoot, {
  Root: HoverCardRoot,
  Trigger: HoverCardTrigger,
  Content: HoverCardContent,
  Arrow: HoverCardArrow,
});

export type HoverCard = {
  Props: HoverCardRootProps;
  RootProps: HoverCardRootProps;
  TriggerProps: HoverCardTriggerProps;
  ContentProps: HoverCardContentProps;
  ArrowProps: HoverCardArrowProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { HoverCardRoot, HoverCardTrigger, HoverCardContent, HoverCardArrow } from "./hover-card.tsx";
export type {
  HoverCardRootProps,
  HoverCardRootProps as HoverCardProps,
  HoverCardTriggerProps,
  HoverCardTriggerSpanProps,
  HoverCardContentProps,
  HoverCardArrowProps,
} from "./hover-card.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { hoverCardVariants } from "../../../styles/src/components/hover-card/index.ts";

export type { HoverCardVariants } from "../../../styles/src/components/hover-card/index.ts";
