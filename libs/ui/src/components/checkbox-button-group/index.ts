// Rivet addition (no HeroUI v3.2.6 counterpart): checkbox group as selectable cards; feature set inspired by HeroUI Pro's public
// docs, independent implementation (see `checkbox-button-group.tsx`).
import {
  CheckboxButtonGroupIndicator,
  CheckboxButtonGroupItem,
  CheckboxButtonGroupItemContent,
  CheckboxButtonGroupItemIcon,
  CheckboxButtonGroupRoot,
} from "./checkbox-button-group.tsx";
import type {
  CheckboxButtonGroupIndicatorSpanProps,
  CheckboxButtonGroupItemProps,
  CheckboxButtonGroupPartSpanProps,
  CheckboxButtonGroupRootProps,
} from "./checkbox-button-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const CheckboxButtonGroup = Object.assign(CheckboxButtonGroupRoot, {
  Root: CheckboxButtonGroupRoot,
  Item: CheckboxButtonGroupItem,
  Indicator: CheckboxButtonGroupIndicator,
  ItemContent: CheckboxButtonGroupItemContent,
  ItemIcon: CheckboxButtonGroupItemIcon,
});

export type CheckboxButtonGroup = {
  Props: CheckboxButtonGroupRootProps;
  RootProps: CheckboxButtonGroupRootProps;
  ItemProps: CheckboxButtonGroupItemProps;
  IndicatorProps: CheckboxButtonGroupIndicatorSpanProps;
  ItemContentProps: CheckboxButtonGroupPartSpanProps;
  ItemIconProps: CheckboxButtonGroupPartSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  CheckboxButtonGroupRoot,
  CheckboxButtonGroupItem,
  CheckboxButtonGroupIndicator,
  CheckboxButtonGroupItemContent,
  CheckboxButtonGroupItemIcon,
  CheckboxButtonGroupContext,
  CheckboxButtonGroupItemContext,
} from "./checkbox-button-group.tsx";
export type {
  CheckboxButtonGroupItemData,
  CheckboxButtonGroupRootProps,
  CheckboxButtonGroupRootProps as CheckboxButtonGroupProps,
  CheckboxButtonGroupItemProps,
  CheckboxButtonGroupIndicatorProps,
  CheckboxButtonGroupIndicatorSpanProps,
  CheckboxButtonGroupPartProps,
  CheckboxButtonGroupPartSpanProps,
  CheckboxButtonGroupItemRenderProps,
} from "./checkbox-button-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { checkboxButtonGroupVariants } from "../../../styles/src/components/checkbox-button-group/index.ts";

export type { CheckboxButtonGroupVariants } from "../../../styles/src/components/checkbox-button-group/index.ts";
