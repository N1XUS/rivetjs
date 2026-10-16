// Ported from HeroUI v3.2.6 packages/react/src/components/label/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof LabelRoot>` → `LabelRootProps` (cdk part props; the root is not generic); `@heroui/styles` → vendored `styles/`.
import { LabelRoot } from "./label.tsx";
import type { LabelRootProps } from "./label.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Label = Object.assign(LabelRoot, {
  Root: LabelRoot,
});

export type Label = {
  Props: LabelRootProps;
  RootProps: LabelRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { LabelRoot };

export type { LabelRootProps, LabelRootProps as LabelProps } from "./label.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { labelVariants } from "../../../styles/src/components/label/index.ts";

export type { LabelVariants } from "../../../styles/src/components/label/index.ts";
