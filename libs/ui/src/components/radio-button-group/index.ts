// Rivet addition (no HeroUI v3.2.6 counterpart): radio group as selectable cards; feature set inspired by HeroUI Pro's public
// docs, independent implementation (see `radio-button-group.tsx`).
import {
  RadioButtonGroupIndicator,
  RadioButtonGroupItem,
  RadioButtonGroupItemContent,
  RadioButtonGroupItemIcon,
  RadioButtonGroupRoot,
} from "./radio-button-group.tsx";
import type {
  RadioButtonGroupIndicatorSpanProps,
  RadioButtonGroupItemProps,
  RadioButtonGroupPartSpanProps,
  RadioButtonGroupRootProps,
} from "./radio-button-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const RadioButtonGroup = Object.assign(RadioButtonGroupRoot, {
  Root: RadioButtonGroupRoot,
  Item: RadioButtonGroupItem,
  Indicator: RadioButtonGroupIndicator,
  ItemContent: RadioButtonGroupItemContent,
  ItemIcon: RadioButtonGroupItemIcon,
});

export type RadioButtonGroup = {
  Props: RadioButtonGroupRootProps;
  RootProps: RadioButtonGroupRootProps;
  ItemProps: RadioButtonGroupItemProps;
  IndicatorProps: RadioButtonGroupIndicatorSpanProps;
  ItemContentProps: RadioButtonGroupPartSpanProps;
  ItemIconProps: RadioButtonGroupPartSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  RadioButtonGroupRoot,
  RadioButtonGroupItem,
  RadioButtonGroupIndicator,
  RadioButtonGroupItemContent,
  RadioButtonGroupItemIcon,
  RadioButtonGroupContext,
  RadioButtonGroupItemContext,
} from "./radio-button-group.tsx";
export type {
  RadioButtonGroupItemData,
  RadioButtonGroupRootProps,
  RadioButtonGroupRootProps as RadioButtonGroupProps,
  RadioButtonGroupItemProps,
  RadioButtonGroupIndicatorProps,
  RadioButtonGroupIndicatorSpanProps,
  RadioButtonGroupPartProps,
  RadioButtonGroupPartSpanProps,
  RadioButtonGroupItemRenderProps,
} from "./radio-button-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { radioButtonGroupVariants } from "../../../styles/src/components/radio-button-group/index.ts";

export type { RadioButtonGroupVariants } from "../../../styles/src/components/radio-button-group/index.ts";
