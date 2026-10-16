// Ported from HeroUI v3.2.6 packages/react/src/components/color-slider/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.
import { ColorSliderOutput, ColorSliderRoot, ColorSliderThumb, ColorSliderTrack } from "./color-slider.tsx";
import type { ColorSliderOutputProps, ColorSliderRootProps, ColorSliderThumbProps, ColorSliderTrackProps } from "./color-slider.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ColorSlider = Object.assign(ColorSliderRoot, {
  Root: ColorSliderRoot,
  Output: ColorSliderOutput,
  Track: ColorSliderTrack,
  Thumb: ColorSliderThumb,
});

export type ColorSlider = {
  Props: ColorSliderRootProps;
  RootProps: ColorSliderRootProps;
  OutputProps: ColorSliderOutputProps;
  TrackProps: ColorSliderTrackProps;
  ThumbProps: ColorSliderThumbProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ColorSliderRoot, ColorSliderOutput, ColorSliderTrack, ColorSliderThumb };

export type {
  ColorSliderRootProps,
  ColorSliderRootProps as ColorSliderProps,
  ColorSliderOutputProps,
  ColorSliderTrackProps,
  ColorSliderThumbProps,
  // Channel types for type-safe usage
  HSLChannel,
  HSBChannel,
  RGBChannel,
  HSLHSBSharedChannel,
  AlphaChannel,
  ColorSliderChannelProps,
} from "./color-slider.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { colorSliderVariants } from "../../../styles/src/components/color-slider/index.ts";

export type { ColorSliderVariants } from "../../../styles/src/components/color-slider/index.ts";
