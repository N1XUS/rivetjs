// Ported from HeroUI v3.2.6 packages/react/src/components/color-field/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.
import { ColorInputGroupInput, ColorInputGroupPrefix, ColorInputGroupRoot, ColorInputGroupSuffix } from "../color-input-group/index.ts";
import type {
  ColorInputGroupInputProps,
  ColorInputGroupPrefixProps,
  ColorInputGroupRootProps,
  ColorInputGroupSuffixProps,
} from "../color-input-group/index.ts";

import { ColorFieldRoot } from "./color-field.tsx";
import type { ColorFieldRootProps } from "./color-field.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ColorField = Object.assign(ColorFieldRoot, {
  Root: ColorFieldRoot,
  Group: ColorInputGroupRoot,
  Input: ColorInputGroupInput,
  Prefix: ColorInputGroupPrefix,
  Suffix: ColorInputGroupSuffix,
});

export type ColorField = {
  Props: ColorFieldRootProps;
  RootProps: ColorFieldRootProps;
  GroupProps: ColorInputGroupRootProps;
  InputProps: ColorInputGroupInputProps;
  PrefixProps: ColorInputGroupPrefixProps;
  SuffixProps: ColorInputGroupSuffixProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ColorFieldRoot };

export type { ColorFieldRootProps, ColorFieldRootProps as ColorFieldProps, ColorValue } from "./color-field.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { colorFieldVariants } from "../../../styles/src/components/color-field/index.ts";

export type { ColorFieldVariants } from "../../../styles/src/components/color-field/index.ts";
