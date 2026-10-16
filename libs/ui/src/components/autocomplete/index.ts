// Ported from HeroUI v3.2.6 packages/react/src/components/autocomplete/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import {
  AutocompleteClearButton,
  AutocompleteFilter,
  AutocompleteIndicator,
  AutocompleteItem,
  AutocompletePopover,
  AutocompleteRoot,
  AutocompleteTrigger,
  AutocompleteValue,
} from "./autocomplete.tsx";
import type {
  AutocompleteClearButtonButtonProps,
  AutocompleteFilterProps,
  AutocompleteIndicatorSpanProps,
  AutocompleteItemProps,
  AutocompletePopoverProps,
  AutocompleteRootProps,
  AutocompleteTriggerProps,
  AutocompleteValueProps,
} from "./autocomplete.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Autocomplete = Object.assign(AutocompleteRoot, {
  Root: AutocompleteRoot,
  Trigger: AutocompleteTrigger,
  Value: AutocompleteValue,
  Indicator: AutocompleteIndicator,
  Popover: AutocompletePopover,
  Filter: AutocompleteFilter,
  ClearButton: AutocompleteClearButton,
  Item: AutocompleteItem,
});

export type Autocomplete<M extends "single" | "multiple" = "single", T extends object = object> = {
  Props: AutocompleteRootProps<M, T>;
  RootProps: AutocompleteRootProps<M, T>;
  TriggerProps: AutocompleteTriggerProps;
  ValueProps: AutocompleteValueProps;
  IndicatorProps: AutocompleteIndicatorSpanProps;
  PopoverProps: AutocompletePopoverProps;
  FilterProps: AutocompleteFilterProps;
  ClearButtonProps: AutocompleteClearButtonButtonProps;
  ItemProps: AutocompleteItemProps<T>;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  AutocompleteClearButton,
  AutocompleteFilter,
  AutocompleteTrigger,
  AutocompleteIndicator,
  AutocompleteItem,
  AutocompletePopover,
  AutocompleteRoot,
  AutocompleteValue,
};

export type {
  AutocompleteRootProps,
  AutocompleteRootProps as AutocompleteProps,
  AutocompleteTriggerProps,
  AutocompleteValueProps,
  AutocompleteIndicatorProps,
  AutocompleteIndicatorSpanProps,
  AutocompletePopoverProps,
  AutocompleteFilterProps,
  AutocompleteClearButtonProps,
  AutocompleteClearButtonButtonProps,
  AutocompleteItemProps,
} from "./autocomplete.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { autocompleteVariants } from "../../../styles/src/components/autocomplete/index.ts";

export type { AutocompleteVariants } from "../../../styles/src/components/autocomplete/index.ts";
