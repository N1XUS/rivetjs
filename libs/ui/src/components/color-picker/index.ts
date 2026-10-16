// Ported from HeroUI v3.2.6 packages/react/src/components/color-picker/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.
import { ColorPickerPopover, ColorPickerRoot, ColorPickerTrigger } from "./color-picker.tsx";
import type { ColorPickerPopoverProps, ColorPickerRootProps, ColorPickerTriggerProps } from "./color-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ColorPicker = Object.assign(ColorPickerRoot, {
  Root: ColorPickerRoot,
  Trigger: ColorPickerTrigger,
  Popover: ColorPickerPopover,
});

export type ColorPicker = {
  Props: ColorPickerRootProps;
  RootProps: ColorPickerRootProps;
  TriggerProps: ColorPickerTriggerProps;
  PopoverProps: ColorPickerPopoverProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ColorPickerRoot, ColorPickerTrigger, ColorPickerPopover };

export type { ColorPickerRootProps, ColorPickerRootProps as ColorPickerProps, ColorPickerTriggerProps, ColorPickerPopoverProps } from "./color-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { colorPickerVariants } from "../../../styles/src/components/color-picker/index.ts";

export type { ColorPickerVariants } from "../../../styles/src/components/color-picker/index.ts";
