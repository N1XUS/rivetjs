// Ported from HeroUI v3.2.6 packages/react/src/components/radio-group/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
import { RadioGroupRoot } from "./radio-group.tsx";
import type { RadioGroupRootProps } from "./radio-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const RadioGroup = Object.assign(RadioGroupRoot, {
  Root: RadioGroupRoot,
});

export type RadioGroup = {
  Props: RadioGroupRootProps;
  RootProps: RadioGroupRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { RadioGroupRoot };
export type { RadioGroupItem, RadioGroupRootProps, RadioGroupRootProps as RadioGroupProps } from "./radio-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { radioGroupVariants } from "../../../styles/src/components/radio-group/index.ts";

export type { RadioGroupVariants } from "../../../styles/src/components/radio-group/index.ts";
