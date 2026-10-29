// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no stepper). Compound API `Stepper.*`; feature set inspired by
// commercial UI kits' public Stepper docs, independent implementation. Behaviour = `@rivetjs/cdk/stepper` (Angular CDK port).
import {
  StepperContent,
  StepperDescription,
  StepperIcon,
  StepperIndicator,
  StepperRoot,
  StepperSeparator,
  StepperStep,
  StepperTitle,
  useStepperStep,
} from "./stepper.tsx";
import type { StepperIndicatorProps, StepperRootProps, StepperSeparatorProps, StepperStepProps, StepperTextProps } from "./stepper.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Stepper = Object.assign(StepperRoot, {
  Root: StepperRoot,
  Step: StepperStep,
  Indicator: StepperIndicator,
  Icon: StepperIcon,
  Content: StepperContent,
  Title: StepperTitle,
  Description: StepperDescription,
  Separator: StepperSeparator,
});

export type Stepper = {
  Props: StepperRootProps;
  RootProps: StepperRootProps;
  StepProps: StepperStepProps;
  IndicatorProps: StepperIndicatorProps;
  IconProps: StepperTextProps;
  ContentProps: StepperTextProps;
  TitleProps: StepperTextProps;
  DescriptionProps: StepperTextProps;
  SeparatorProps: StepperSeparatorProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { StepperRoot, StepperStep, StepperIndicator, StepperIcon, StepperContent, StepperTitle, StepperDescription, StepperSeparator, useStepperStep };

export type {
  StepperRootProps,
  StepperRootProps as StepperProps,
  StepperStepProps,
  StepperIndicatorProps,
  StepperTextProps,
  StepperSeparatorProps,
  StepperStepStatus,
  StepperStepState,
} from "./stepper.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { stepperVariants } from "../../../styles/src/components/stepper/index.ts";

export type { StepperVariants } from "../../../styles/src/components/stepper/index.ts";
