// Ported from HeroUI v3.2.6 packages/react/src/components/radio/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
import { RadioContent, RadioControl, RadioIndicator, RadioRoot } from "./radio.tsx";
import type { RadioContentProps, RadioControlProps, RadioIndicatorProps, RadioRootProps } from "./radio.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Radio = Object.assign(RadioRoot, {
  Root: RadioRoot,
  Content: RadioContent,
  Control: RadioControl,
  Indicator: RadioIndicator,
});

export type Radio = {
  Props: RadioRootProps;
  RootProps: RadioRootProps;
  ContentProps: RadioContentProps;
  ControlProps: RadioControlProps;
  IndicatorProps: RadioIndicatorProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { RadioContent, RadioControl, RadioIndicator, RadioRoot };

export type {
  RadioRootProps,
  RadioRootProps as RadioProps,
  RadioContentProps,
  RadioControlProps,
  RadioIndicatorProps,
  RadioFieldRenderProps,
  RadioButtonRenderProps,
} from "./radio.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { radioVariants } from "../../../styles/src/components/radio/index.ts";

export type { RadioVariants } from "../../../styles/src/components/radio/index.ts";
