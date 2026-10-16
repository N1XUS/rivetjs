// Ported from HeroUI v3.2.6 packages/react/src/components/link/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof LinkRoot>` → `LinkRootProps`, `LinkIcon` → `LinkIconSpanProps` (default-element type); `@heroui/styles` →
// vendored `styles/`.
import { LinkIcon, LinkRoot } from "./link.tsx";
import type { LinkIconSpanProps, LinkRootProps } from "./link.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Link = Object.assign(LinkRoot, {
  Root: LinkRoot,
  Icon: LinkIcon,
});

export type Link = {
  Props: LinkRootProps;
  RootProps: LinkRootProps;
  IconProps: LinkIconSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { LinkRoot, LinkIcon };

export type { LinkRootProps, LinkIconProps, LinkRootProps as LinkProps } from "./link.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { linkVariants } from "../../../styles/src/components/link/index.ts";

export type { LinkVariants } from "../../../styles/src/components/link/index.ts";
