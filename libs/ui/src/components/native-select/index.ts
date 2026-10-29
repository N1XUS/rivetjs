// Rivet addition (no HeroUI v3.2.6 counterpart): native `<select>` field; feature set scoped from public docs of commercial UI kits,
// independent implementation (see `native-select.tsx`).
import { NativeSelectIndicator, NativeSelectOptGroup, NativeSelectOption, NativeSelectRoot, NativeSelectTrigger } from "./native-select.tsx";
import type {
  NativeSelectIndicatorSpanProps,
  NativeSelectOptGroupProps,
  NativeSelectOptionProps,
  NativeSelectRootProps,
  NativeSelectTriggerProps,
} from "./native-select.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const NativeSelect = Object.assign(NativeSelectRoot, {
  Root: NativeSelectRoot,
  Trigger: NativeSelectTrigger,
  Indicator: NativeSelectIndicator,
  Option: NativeSelectOption,
  OptGroup: NativeSelectOptGroup,
});

export type NativeSelect = {
  Props: NativeSelectRootProps;
  RootProps: NativeSelectRootProps;
  TriggerProps: NativeSelectTriggerProps;
  IndicatorProps: NativeSelectIndicatorSpanProps;
  OptionProps: NativeSelectOptionProps;
  OptGroupProps: NativeSelectOptGroupProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  NativeSelectRoot,
  NativeSelectTrigger,
  NativeSelectIndicator,
  NativeSelectOption,
  NativeSelectOptGroup,
  NativeSelectContext,
} from "./native-select.tsx";
export type {
  NativeSelectItem,
  NativeSelectRootProps,
  NativeSelectRootProps as NativeSelectProps,
  NativeSelectTriggerProps,
  NativeSelectIndicatorProps,
  NativeSelectIndicatorSpanProps,
  NativeSelectOptionProps,
  NativeSelectOptGroupProps,
  NativeSelectRenderProps,
} from "./native-select.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { nativeSelectVariants } from "../../../styles/src/components/native-select/index.ts";

export type { NativeSelectVariants } from "../../../styles/src/components/native-select/index.ts";
