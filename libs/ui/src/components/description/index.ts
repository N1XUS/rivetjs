// Ported from HeroUI v3.2.6 packages/react/src/components/description/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof DescriptionRoot>` → `DescriptionRootProps` (cdk part props; the root is not generic); `@heroui/styles` → vendored `styles/`.
import { DescriptionRoot } from "./description.tsx";
import type { DescriptionRootProps } from "./description.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Description = Object.assign(DescriptionRoot, {
  Root: DescriptionRoot,
});

export type Description = {
  Props: DescriptionRootProps;
  RootProps: DescriptionRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { DescriptionRoot };

export type { DescriptionRootProps, DescriptionRootProps as DescriptionProps } from "./description.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { descriptionVariants } from "../../../styles/src/components/description/index.ts";

export type { DescriptionVariants } from "../../../styles/src/components/description/index.ts";
