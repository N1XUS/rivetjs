// Ported from HeroUI v3.2.6 packages/react/src/components/disclosure/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types (default-element types for the generic parts); `@heroui/styles` →
// vendored `styles/`.
import { DisclosureBody, DisclosureContent, DisclosureHeading, DisclosureIndicator, DisclosureRoot, DisclosureTrigger } from "./disclosure.tsx";
import type {
  DisclosureBodyDivProps,
  DisclosureContentProps,
  DisclosureHeadingProps,
  DisclosureIndicatorSvgProps,
  DisclosureRootProps,
  DisclosureTriggerProps,
} from "./disclosure.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Disclosure = Object.assign(DisclosureRoot, {
  Root: DisclosureRoot,
  Heading: DisclosureHeading,
  Trigger: DisclosureTrigger,
  Content: DisclosureContent,
  Body: DisclosureBody,
  Indicator: DisclosureIndicator,
});

export type Disclosure = {
  Props: DisclosureRootProps;
  RootProps: DisclosureRootProps;
  HeadingProps: DisclosureHeadingProps;
  TriggerProps: DisclosureTriggerProps;
  ContentProps: DisclosureContentProps;
  BodyProps: DisclosureBodyDivProps;
  IndicatorProps: DisclosureIndicatorSvgProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { DisclosureRoot, DisclosureHeading, DisclosureTrigger, DisclosureContent, DisclosureBody, DisclosureIndicator };

export type {
  DisclosureRootProps,
  DisclosureRootProps as DisclosureProps,
  DisclosureContentProps,
  DisclosureHeadingProps,
  DisclosureTriggerProps,
  DisclosureIndicatorProps,
  DisclosureBodyContentProps,
} from "./disclosure.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { disclosureVariants } from "../../../styles/src/components/disclosure/index.ts";

export type { DisclosureVariants } from "../../../styles/src/components/disclosure/index.ts";
