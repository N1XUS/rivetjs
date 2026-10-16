// Ported from HeroUI v3.2.6 packages/react/src/components/skeleton/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof SkeletonRoot>` → the default-element prop type (`SkeletonRootDivProps`); `@heroui/styles` → vendored `styles/`.
import type { SkeletonRootDivProps } from "./skeleton.tsx";
import { SkeletonRoot } from "./skeleton.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Skeleton = Object.assign(SkeletonRoot, {
  Root: SkeletonRoot,
});

export type Skeleton = {
  Props: SkeletonRootDivProps;
  RootProps: SkeletonRootDivProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SkeletonRoot };

export type { SkeletonRootProps, SkeletonRootProps as SkeletonProps } from "./skeleton.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { skeletonVariants } from "../../../styles/src/components/skeleton/index.ts";

export type { SkeletonVariants } from "../../../styles/src/components/skeleton/index.ts";
