// Rivet addition (no HeroUI v3.2.6 counterpart): a settings-row color picker on the ui ColorPicker; feature set inspired by
// commercial UI kits' public Cell Color Picker docs, independent implementation (see `cell-color-picker.tsx`).
import {
  CellColorPickerLabel,
  CellColorPickerPopover,
  CellColorPickerRoot,
  CellColorPickerSwatch,
  CellColorPickerTrigger,
  CellColorPickerValueDisplay,
} from "./cell-color-picker.tsx";
import type { CellColorPickerRootProps, CellColorPickerSpanProps, CellColorPickerTriggerProps } from "./cell-color-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const CellColorPicker = Object.assign(CellColorPickerRoot, {
  Root: CellColorPickerRoot,
  Trigger: CellColorPickerTrigger,
  Label: CellColorPickerLabel,
  ValueDisplay: CellColorPickerValueDisplay,
  Swatch: CellColorPickerSwatch,
  Popover: CellColorPickerPopover,
});

export type CellColorPicker = {
  Props: CellColorPickerRootProps;
  RootProps: CellColorPickerRootProps;
  TriggerProps: CellColorPickerTriggerProps;
  SpanProps: CellColorPickerSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  CellColorPickerRoot,
  CellColorPickerTrigger,
  CellColorPickerLabel,
  CellColorPickerValueDisplay,
  CellColorPickerSwatch,
  CellColorPickerPopover,
} from "./cell-color-picker.tsx";
export type {
  CellColorPickerRootProps,
  CellColorPickerRootProps as CellColorPickerProps,
  CellColorPickerTriggerProps,
  CellColorPickerSpanProps,
} from "./cell-color-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { cellColorPickerVariants } from "../../../styles/src/components/cell-color-picker/index.ts";

export type { CellColorPickerVariants } from "../../../styles/src/components/cell-color-picker/index.ts";
