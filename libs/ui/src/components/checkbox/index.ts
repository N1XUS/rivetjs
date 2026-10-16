// Ported from HeroUI v3.2.6 packages/react/src/components/checkbox/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
import { CheckboxContent, CheckboxControl, CheckboxIndicator, CheckboxRoot } from "./checkbox.tsx";
import type { CheckboxContentProps, CheckboxControlProps, CheckboxIndicatorProps, CheckboxRootProps } from "./checkbox.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Checkbox = Object.assign(CheckboxRoot, {
  Root: CheckboxRoot,
  Content: CheckboxContent,
  Control: CheckboxControl,
  Indicator: CheckboxIndicator,
});

export type Checkbox = {
  Props: CheckboxRootProps;
  RootProps: CheckboxRootProps;
  ContentProps: CheckboxContentProps;
  ControlProps: CheckboxControlProps;
  IndicatorProps: CheckboxIndicatorProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { CheckboxContent, CheckboxControl, CheckboxIndicator, CheckboxRoot };

export type {
  CheckboxRootProps,
  CheckboxRootProps as CheckboxProps,
  CheckboxContentProps,
  CheckboxControlProps,
  CheckboxIndicatorProps,
  CheckboxFieldRenderProps,
  CheckboxButtonRenderProps,
  /** @deprecated Use {@link CheckboxFieldRenderProps} for the root render prop, or {@link CheckboxButtonRenderProps} for content/control/indicator. */
  CheckboxFieldRenderProps as CheckboxRenderProps,
} from "./checkbox.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { checkboxVariants } from "../../../styles/src/components/checkbox/index.ts";

export type { CheckboxVariants } from "../../../styles/src/components/checkbox/index.ts";
