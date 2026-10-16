// Ported from HeroUI v3.2.6 packages/react/src/components/surface/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof SurfaceRoot>` → `SurfaceRootDivProps` (default-element props; `Parameters<…>[0]` of
// the generic root resolves `E` to its whole constraint); `@heroui/styles` → vendored `styles/`.
import type { SurfaceRootDivProps } from "./surface.tsx";
import { SurfaceRoot } from "./surface.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Surface = Object.assign(SurfaceRoot, {
  Root: SurfaceRoot,
});

export type Surface = {
  Props: SurfaceRootDivProps;
  RootProps: SurfaceRootDivProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SurfaceRoot } from "./surface.tsx";

export type { SurfaceRootProps, SurfaceRootProps as SurfaceProps } from "./surface.tsx";

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/
export { SurfaceContext } from "./surface.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { surfaceVariants } from "../../../styles/src/components/surface/index.ts";

export type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
