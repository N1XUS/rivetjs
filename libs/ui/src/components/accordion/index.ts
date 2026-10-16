// Ported from HeroUI v3.2.6 packages/react/src/components/accordion/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types (default-element types for the generic parts); `@heroui/styles` →
// vendored `styles/`.
import { AccordionBody, AccordionHeading, AccordionIndicator, AccordionItem, AccordionPanel, AccordionRoot, AccordionTrigger } from "./accordion.tsx";
import type {
  AccordionBodyDivProps,
  AccordionHeadingProps,
  AccordionIndicatorSvgProps,
  AccordionItemProps,
  AccordionPanelProps,
  AccordionRootProps,
  AccordionTriggerProps,
} from "./accordion.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Accordion = Object.assign(AccordionRoot, {
  Root: AccordionRoot,
  Item: AccordionItem,
  Heading: AccordionHeading,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
  Indicator: AccordionIndicator,
  Body: AccordionBody,
});

export type Accordion = {
  Props: AccordionRootProps;
  RootProps: AccordionRootProps;
  ItemProps: AccordionItemProps;
  HeadingProps: AccordionHeadingProps;
  TriggerProps: AccordionTriggerProps;
  PanelProps: AccordionPanelProps;
  IndicatorProps: AccordionIndicatorSvgProps;
  BodyProps: AccordionBodyDivProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { AccordionRoot, AccordionItem, AccordionHeading, AccordionTrigger, AccordionPanel, AccordionIndicator, AccordionBody };

export type {
  AccordionRootProps,
  AccordionRootProps as AccordionProps,
  AccordionItemProps,
  AccordionHeadingProps,
  AccordionTriggerProps,
  AccordionPanelProps,
  AccordionIndicatorProps,
  AccordionBodyProps,
} from "./accordion.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { accordionVariants } from "../../../styles/src/components/accordion/index.ts";

export type { AccordionVariants } from "../../../styles/src/components/accordion/index.ts";
