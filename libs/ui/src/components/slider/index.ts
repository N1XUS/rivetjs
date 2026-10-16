// Ported from HeroUI v3.2.6 packages/react/src/components/slider/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
import { SliderFill, SliderMarks, SliderOutput, SliderRoot, SliderThumb, SliderTrack } from "./slider.tsx";
import type { SliderFillProps, SliderMarksProps, SliderOutputProps, SliderRootProps, SliderThumbProps, SliderTrackProps } from "./slider.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Slider = Object.assign(SliderRoot, {
  Root: SliderRoot,
  Output: SliderOutput,
  Track: SliderTrack,
  Fill: SliderFill,
  Thumb: SliderThumb,
  Marks: SliderMarks,
});

export type Slider = {
  Props: SliderRootProps;
  RootProps: SliderRootProps;
  OutputProps: SliderOutputProps;
  TrackProps: SliderTrackProps;
  FillProps: SliderFillProps;
  ThumbProps: SliderThumbProps;
  MarksProps: SliderMarksProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SliderRoot, SliderOutput, SliderTrack, SliderFill, SliderThumb, SliderMarks };

export type {
  SliderRootProps,
  SliderRootProps as SliderProps,
  SliderOutputProps,
  SliderTrackProps,
  SliderFillProps,
  SliderThumbProps,
  SliderMarksProps,
  SliderRenderProps,
  SliderTrackRenderProps,
  SliderFillRenderProps,
  SliderThumbRenderProps,
  SliderState,
} from "./slider.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { sliderVariants } from "../../../styles/src/components/slider/index.ts";

export type { SliderVariants } from "../../../styles/src/components/slider/index.ts";
