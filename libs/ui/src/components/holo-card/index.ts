// Rivet addition (no HeroUI v3.2.6 counterpart): 3D tilting card with a pointer-tracked holographic glare; feature set
// scoped from public docs of commercial UI kits, independent implementation (see `holo-card.tsx`).
import {
  HoloCardContent,
  HoloCardFrame,
  HoloCardImage,
  HoloCardInset,
  HoloCardPattern,
  HoloCardRoot,
  HoloCardRotator,
  HoloCardShine,
  HoloCardShinePattern,
  HoloCardSurface,
} from "./holo-card.tsx";
import type { HoloCardContentProps, HoloCardDivProps, HoloCardRootProps } from "./holo-card.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const HoloCard = Object.assign(HoloCardRoot, {
  Root: HoloCardRoot,
  Rotator: HoloCardRotator,
  Frame: HoloCardFrame,
  Surface: HoloCardSurface,
  Image: HoloCardImage,
  Inset: HoloCardInset,
  Pattern: HoloCardPattern,
  Content: HoloCardContent,
  Shine: HoloCardShine,
  ShinePattern: HoloCardShinePattern,
});

export type HoloCard = {
  Props: HoloCardRootProps;
  RootProps: HoloCardRootProps;
  ContentProps: HoloCardContentProps;
  DivProps: HoloCardDivProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  HoloCardRoot,
  HoloCardRotator,
  HoloCardFrame,
  HoloCardSurface,
  HoloCardImage,
  HoloCardInset,
  HoloCardPattern,
  HoloCardContent,
  HoloCardShine,
  HoloCardShinePattern,
} from "./holo-card.tsx";
export type { HoloCardRootProps, HoloCardRootProps as HoloCardProps, HoloCardContentProps, HoloCardDivProps } from "./holo-card.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { holoCardVariants } from "../../../styles/src/components/holo-card/index.ts";

export type { HoloCardVariants } from "../../../styles/src/components/holo-card/index.ts";
