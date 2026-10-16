// Rivet addition (no HeroUI v3.2.6 counterpart): pill number stepper with an animated value; feature set inspired by HeroUI
// Pro's public docs, independent implementation (see `number-stepper.tsx`).
import { NumberStepperDecrementButton, NumberStepperGroup, NumberStepperIncrementButton, NumberStepperRoot, NumberStepperValue } from "./number-stepper.tsx";
import type { NumberStepperButtonProps, NumberStepperGroupProps, NumberStepperRootProps, NumberStepperValueProps } from "./number-stepper.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const NumberStepper = Object.assign(NumberStepperRoot, {
  Root: NumberStepperRoot,
  Group: NumberStepperGroup,
  Value: NumberStepperValue,
  DecrementButton: NumberStepperDecrementButton,
  IncrementButton: NumberStepperIncrementButton,
});

export type NumberStepper = {
  Props: NumberStepperRootProps;
  RootProps: NumberStepperRootProps;
  GroupProps: NumberStepperGroupProps;
  ValueProps: NumberStepperValueProps;
  DecrementButtonProps: NumberStepperButtonProps;
  IncrementButtonProps: NumberStepperButtonProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  NumberStepperRoot,
  NumberStepperGroup,
  NumberStepperValue,
  NumberStepperDecrementButton,
  NumberStepperIncrementButton,
  NumberStepperContext,
} from "./number-stepper.tsx";
export type {
  NumberStepperRootProps,
  NumberStepperRootProps as NumberStepperProps,
  NumberStepperGroupProps,
  NumberStepperValueProps,
  NumberStepperValueRenderProps,
  NumberStepperButtonProps,
  NumberStepperRenderProps,
} from "./number-stepper.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { numberStepperVariants } from "../../../styles/src/components/number-stepper/index.ts";

export type { NumberStepperVariants } from "../../../styles/src/components/number-stepper/index.ts";
