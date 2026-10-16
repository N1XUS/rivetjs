// Ported from HeroUI v3.2.6 packages/react/src/components/color-swatch-picker/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.
import { ColorSwatchPickerIndicator, ColorSwatchPickerItem, ColorSwatchPickerRoot, ColorSwatchPickerSwatch } from "./color-swatch-picker.tsx";
import type {
  ColorSwatchPickerIndicatorSpanProps,
  ColorSwatchPickerItemProps,
  ColorSwatchPickerRootProps,
  ColorSwatchPickerSwatchProps,
} from "./color-swatch-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ColorSwatchPicker = Object.assign(ColorSwatchPickerRoot, {
  Root: ColorSwatchPickerRoot,
  Item: ColorSwatchPickerItem,
  Swatch: ColorSwatchPickerSwatch,
  Indicator: ColorSwatchPickerIndicator,
});

export type ColorSwatchPicker = {
  Props: ColorSwatchPickerRootProps;
  RootProps: ColorSwatchPickerRootProps;
  ItemProps: ColorSwatchPickerItemProps;
  SwatchProps: ColorSwatchPickerSwatchProps;
  IndicatorProps: ColorSwatchPickerIndicatorSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ColorSwatchPickerRoot, ColorSwatchPickerItem, ColorSwatchPickerSwatch, ColorSwatchPickerIndicator };

export type {
  ColorSwatchPickerRootProps,
  ColorSwatchPickerRootProps as ColorSwatchPickerProps,
  ColorSwatchPickerItemProps,
  ColorSwatchPickerSwatchProps,
  ColorSwatchPickerIndicatorProps,
} from "./color-swatch-picker.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { colorSwatchPickerVariants } from "../../../styles/src/components/color-swatch-picker/index.ts";

export type { ColorSwatchPickerVariants } from "../../../styles/src/components/color-swatch-picker/index.ts";
