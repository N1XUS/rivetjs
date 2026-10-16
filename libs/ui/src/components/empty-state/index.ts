// Ported from HeroUI v3.2.6 packages/react/src/components/empty-state/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof EmptyStateRoot>` → the default-element prop type (`EmptyStateRootDivProps`); `@heroui/styles` → vendored `styles/`.
import type { EmptyStateRootDivProps } from "./empty-state.tsx";
import { EmptyStateRoot } from "./empty-state.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const EmptyState = Object.assign(EmptyStateRoot, {
  Root: EmptyStateRoot,
});

export type EmptyState = {
  Props: EmptyStateRootDivProps;
  RootProps: EmptyStateRootDivProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { EmptyStateRoot };

export type { EmptyStateRootProps, EmptyStateRootProps as EmptyStateProps } from "./empty-state.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { emptyStateVariants } from "../../../styles/src/components/empty-state/index.ts";

export type { EmptyStateVariants } from "../../../styles/src/components/empty-state/index.ts";
