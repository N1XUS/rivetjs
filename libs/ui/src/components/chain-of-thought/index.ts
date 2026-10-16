// Rivet addition (no HeroUI v3.2.6 counterpart): collapsible reasoning / agent trace; feature set inspired by HeroUI Pro's
// public ChainOfThought docs, independent implementation (see `chain-of-thought.tsx`).
import { ChainOfThoughtContent, ChainOfThoughtRoot, ChainOfThoughtStep, ChainOfThoughtSteps, ChainOfThoughtTrigger } from "./chain-of-thought.tsx";
import type {
  ChainOfThoughtContentProps,
  ChainOfThoughtRootProps,
  ChainOfThoughtStepProps,
  ChainOfThoughtStepsProps,
  ChainOfThoughtTriggerProps,
} from "./chain-of-thought.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ChainOfThought = Object.assign(ChainOfThoughtRoot, {
  Root: ChainOfThoughtRoot,
  Trigger: ChainOfThoughtTrigger,
  Content: ChainOfThoughtContent,
  Steps: ChainOfThoughtSteps,
  Step: ChainOfThoughtStep,
});

export type ChainOfThought = {
  Props: ChainOfThoughtRootProps;
  RootProps: ChainOfThoughtRootProps;
  TriggerProps: ChainOfThoughtTriggerProps;
  ContentProps: ChainOfThoughtContentProps;
  StepsProps: ChainOfThoughtStepsProps;
  StepProps: ChainOfThoughtStepProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ChainOfThoughtRoot, ChainOfThoughtTrigger, ChainOfThoughtContent, ChainOfThoughtSteps, ChainOfThoughtStep } from "./chain-of-thought.tsx";
export type {
  ChainOfThoughtRootProps,
  ChainOfThoughtRootProps as ChainOfThoughtProps,
  ChainOfThoughtTriggerProps,
  ChainOfThoughtContentProps,
  ChainOfThoughtStepsProps,
  ChainOfThoughtStepProps,
  ChainOfThoughtStepStatus,
} from "./chain-of-thought.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chainOfThoughtVariants } from "../../../styles/src/components/chain-of-thought/index.ts";

export type { ChainOfThoughtVariants } from "../../../styles/src/components/chain-of-thought/index.ts";
