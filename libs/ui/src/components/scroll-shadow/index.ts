// Ported from HeroUI v3.2.6 packages/react/src/components/scroll-shadow/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof ScrollShadowRoot>` → `ScrollShadowRootProps`; `@heroui/styles` → vendored `styles/`.
import type { ScrollShadowRootProps } from "./scroll-shadow.tsx";
import { ScrollShadowRoot } from "./scroll-shadow.tsx";

/* -------------------------------------------------------------------------------------------------
 * Component
 * -----------------------------------------------------------------------------------------------*/
export const ScrollShadow = Object.assign(ScrollShadowRoot, {
  Root: ScrollShadowRoot,
});

export type ScrollShadow = {
  Props: ScrollShadowRootProps;
  RootProps: ScrollShadowRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ScrollShadowRoot };

export type { ScrollShadowRootProps, ScrollShadowRootProps as ScrollShadowProps, ScrollShadowVisibility } from "./scroll-shadow.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { scrollShadowVariants } from "../../../styles/src/components/scroll-shadow/index.ts";

export type { ScrollShadowVariants } from "../../../styles/src/components/scroll-shadow/index.ts";

/* -------------------------------------------------------------------------------------------------
 * Hooks
 * -----------------------------------------------------------------------------------------------*/
export { useScrollShadow } from "./use-scroll-shadow.tsx";

export type { UseScrollShadowProps } from "./use-scroll-shadow.tsx";
