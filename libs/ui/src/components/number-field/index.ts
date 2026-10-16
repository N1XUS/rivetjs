// Ported from HeroUI v3.2.6 packages/react/src/components/number-field/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
import { NumberFieldDecrementButton, NumberFieldGroup, NumberFieldIncrementButton, NumberFieldInput, NumberFieldRoot } from "./number-field.tsx";
import type {
  NumberFieldDecrementButtonProps,
  NumberFieldGroupProps,
  NumberFieldIncrementButtonProps,
  NumberFieldInputProps,
  NumberFieldRootProps,
} from "./number-field.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const NumberField = Object.assign(NumberFieldRoot, {
  Root: NumberFieldRoot,
  Group: NumberFieldGroup,
  Input: NumberFieldInput,
  IncrementButton: NumberFieldIncrementButton,
  DecrementButton: NumberFieldDecrementButton,
});

export type NumberField = {
  Props: NumberFieldRootProps;
  RootProps: NumberFieldRootProps;
  GroupProps: NumberFieldGroupProps;
  InputProps: NumberFieldInputProps;
  IncrementButtonProps: NumberFieldIncrementButtonProps;
  DecrementButtonProps: NumberFieldDecrementButtonProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { NumberFieldDecrementButton, NumberFieldGroup, NumberFieldIncrementButton, NumberFieldInput, NumberFieldRoot };

export type {
  NumberFieldRootProps,
  NumberFieldRootProps as NumberFieldProps,
  NumberFieldGroupProps,
  NumberFieldInputProps,
  NumberFieldIncrementButtonProps,
  NumberFieldDecrementButtonProps,
} from "./number-field.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { numberFieldVariants } from "../../../styles/src/components/number-field/index.ts";

export type { NumberFieldVariants } from "../../../styles/src/components/number-field/index.ts";
