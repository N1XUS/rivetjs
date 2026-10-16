// Ported from HeroUI v3.2.6 packages/react/src/components/color-input-group/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.
import { ColorInputGroupInput, ColorInputGroupPrefix, ColorInputGroupRoot, ColorInputGroupSuffix } from "./color-input-group.tsx";
import type { ColorInputGroupInputProps, ColorInputGroupPrefixProps, ColorInputGroupRootProps, ColorInputGroupSuffixProps } from "./color-input-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ColorInputGroup = Object.assign(ColorInputGroupRoot, {
  Root: ColorInputGroupRoot,
  Input: ColorInputGroupInput,
  Prefix: ColorInputGroupPrefix,
  Suffix: ColorInputGroupSuffix,
});

export type ColorInputGroup = {
  Props: ColorInputGroupRootProps;
  RootProps: ColorInputGroupRootProps;
  InputProps: ColorInputGroupInputProps;
  PrefixProps: ColorInputGroupPrefixProps;
  SuffixProps: ColorInputGroupSuffixProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ColorInputGroupRoot, ColorInputGroupInput, ColorInputGroupPrefix, ColorInputGroupSuffix };

export type {
  ColorInputGroupRootProps,
  ColorInputGroupRootProps as ColorInputGroupProps,
  ColorInputGroupInputProps,
  ColorInputGroupPrefixProps,
  ColorInputGroupSuffixProps,
} from "./color-input-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { colorInputGroupVariants } from "../../../styles/src/components/color-input-group/index.ts";

export type { ColorInputGroupVariants } from "../../../styles/src/components/color-input-group/index.ts";
