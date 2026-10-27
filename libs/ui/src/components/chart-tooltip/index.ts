// Rivet addition (no HeroUI v3.2.6 counterpart): a composable tooltip card for chart data points; feature set inspired by
// HeroUI Pro's public Chart Tooltip docs, independent implementation (see `chart-tooltip.tsx`).
import {
  ChartTooltipContent,
  ChartTooltipHeader,
  ChartTooltipIndicator,
  ChartTooltipItem,
  ChartTooltipLabel,
  ChartTooltipRoot,
  ChartTooltipValue,
} from "./chart-tooltip.tsx";
import type { ChartTooltipContentProps, ChartTooltipIndicatorProps, ChartTooltipPayloadEntry, ChartTooltipRootProps } from "./chart-tooltip.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ChartTooltip = Object.assign(ChartTooltipRoot, {
  Root: ChartTooltipRoot,
  Header: ChartTooltipHeader,
  Item: ChartTooltipItem,
  Indicator: ChartTooltipIndicator,
  Label: ChartTooltipLabel,
  Value: ChartTooltipValue,
  Content: ChartTooltipContent,
});

export type ChartTooltip = {
  Props: ChartTooltipRootProps;
  RootProps: ChartTooltipRootProps;
  IndicatorProps: ChartTooltipIndicatorProps;
  ContentProps: ChartTooltipContentProps;
  PayloadEntry: ChartTooltipPayloadEntry;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  ChartTooltipRoot,
  ChartTooltipHeader,
  ChartTooltipItem,
  ChartTooltipIndicator,
  ChartTooltipLabel,
  ChartTooltipValue,
  ChartTooltipContent,
  ChartTooltipContext,
} from "./chart-tooltip.tsx";
export type {
  ChartTooltipRootProps,
  ChartTooltipRootProps as ChartTooltipProps,
  ChartTooltipIndicatorProps,
  ChartTooltipContentProps,
  ChartTooltipPayloadEntry,
} from "./chart-tooltip.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chartTooltipVariants } from "../../../styles/src/components/chart-tooltip/index.ts";

export type { ChartTooltipVariants } from "../../../styles/src/components/chart-tooltip/index.ts";
