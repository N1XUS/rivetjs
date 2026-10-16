// Ported from HeroUI v3.2.6 packages/react/src/components/alert/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof AlertX>` → the default-element prop types (`AlertRootDivProps`, …); `@heroui/styles` → vendored `styles/`.
import type { AlertContentDivProps, AlertDescriptionSpanProps, AlertIndicatorDivProps, AlertRootDivProps, AlertTitlePProps } from "./alert.tsx";
import { AlertContent, AlertDescription, AlertIndicator, AlertRoot, AlertTitle } from "./alert.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Alert = Object.assign(AlertRoot, {
  Root: AlertRoot,
  Indicator: AlertIndicator,
  Content: AlertContent,
  Title: AlertTitle,
  Description: AlertDescription,
});

export type Alert = {
  Props: AlertRootDivProps;
  RootProps: AlertRootDivProps;
  IndicatorProps: AlertIndicatorDivProps;
  ContentProps: AlertContentDivProps;
  TitleProps: AlertTitlePProps;
  DescriptionProps: AlertDescriptionSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { AlertRoot, AlertIndicator, AlertContent, AlertTitle, AlertDescription };

export type { AlertRootProps, AlertRootProps as AlertProps, AlertIndicatorProps, AlertContentProps, AlertTitleProps, AlertDescriptionProps } from "./alert.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { alertVariants } from "../../../styles/src/components/alert/index.ts";

export type { AlertVariants } from "../../../styles/src/components/alert/index.ts";
