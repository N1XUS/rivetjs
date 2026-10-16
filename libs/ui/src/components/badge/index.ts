// Ported from HeroUI v3.2.6 packages/react/src/components/badge/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof BadgeX>` → the default-element prop types (`BadgeRootSpanProps`, …); `@heroui/styles` → vendored `styles/`.
import type { BadgeAnchorSpanProps, BadgeLabelSpanProps, BadgeRootSpanProps } from "./badge.tsx";
import { BadgeAnchor, BadgeLabel, BadgeRoot } from "./badge.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Badge = Object.assign(BadgeRoot, {
  Anchor: BadgeAnchor,
  Label: BadgeLabel,
  Root: BadgeRoot,
});

export type Badge = {
  AnchorProps: BadgeAnchorSpanProps;
  LabelProps: BadgeLabelSpanProps;
  Props: BadgeRootSpanProps;
  RootProps: BadgeRootSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { BadgeRoot, BadgeLabel, BadgeAnchor };

export type { BadgeRootProps, BadgeRootProps as BadgeProps, BadgeLabelProps, BadgeAnchorProps } from "./badge.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { badgeVariants } from "../../../styles/src/components/badge/index.ts";

export type { BadgeVariants } from "../../../styles/src/components/badge/index.ts";
