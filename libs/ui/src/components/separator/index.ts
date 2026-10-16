// Ported from HeroUI v3.2.6 packages/react/src/components/separator/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof SeparatorRoot>` → `SeparatorRootProps` (cdk part props; the root is not generic); `@heroui/styles` → vendored `styles/`.
import { SeparatorRoot } from "./separator.tsx";
import type { SeparatorRootProps } from "./separator.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Separator = Object.assign(SeparatorRoot, {
  Root: SeparatorRoot,
});

export type Separator = {
  Props: SeparatorRootProps;
  RootProps: SeparatorRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SeparatorRoot };

export type { SeparatorRootProps, SeparatorRootProps as SeparatorProps } from "./separator.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { separatorVariants } from "../../../styles/src/components/separator/index.ts";

export type { SeparatorVariants } from "../../../styles/src/components/separator/index.ts";
