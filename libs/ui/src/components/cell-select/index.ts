// Rivet addition (no HeroUI v3.2.6 counterpart): settings-row select; feature set inspired by HeroUI Pro's public docs,
// independent implementation (see `cell-select.tsx`).
import { CellSelectIndicator, CellSelectItem, CellSelectLabel, CellSelectPopover, CellSelectRoot, CellSelectTrigger, CellSelectValue } from "./cell-select.tsx";
import type {
  CellSelectIndicatorProps,
  CellSelectItemProps,
  CellSelectLabelProps,
  CellSelectPopoverProps,
  CellSelectRootProps,
  CellSelectTriggerProps,
  CellSelectValueProps,
} from "./cell-select.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const CellSelect = Object.assign(CellSelectRoot, {
  Root: CellSelectRoot,
  Trigger: CellSelectTrigger,
  Label: CellSelectLabel,
  Value: CellSelectValue,
  Indicator: CellSelectIndicator,
  Popover: CellSelectPopover,
  Item: CellSelectItem,
});

export type CellSelect<M extends "single" | "multiple" = "single", T extends object = object> = {
  Props: CellSelectRootProps<M, T>;
  RootProps: CellSelectRootProps<M, T>;
  TriggerProps: CellSelectTriggerProps;
  LabelProps: CellSelectLabelProps;
  ValueProps: CellSelectValueProps;
  IndicatorProps: CellSelectIndicatorProps;
  PopoverProps: CellSelectPopoverProps;
  ItemProps: CellSelectItemProps<T>;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  CellSelectRoot,
  CellSelectTrigger,
  CellSelectLabel,
  CellSelectValue,
  CellSelectIndicator,
  CellSelectPopover,
  CellSelectItem,
  CellSelectContext,
} from "./cell-select.tsx";
export type {
  CellSelectRootProps,
  CellSelectRootProps as CellSelectProps,
  CellSelectTriggerProps,
  CellSelectLabelProps,
  CellSelectValueProps,
  CellSelectIndicatorProps,
  CellSelectPopoverProps,
  CellSelectItemProps,
  CellSelectValueRenderProps,
} from "./cell-select.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { cellSelectVariants } from "../../../styles/src/components/cell-select/index.ts";

export type { CellSelectVariants } from "../../../styles/src/components/cell-select/index.ts";
