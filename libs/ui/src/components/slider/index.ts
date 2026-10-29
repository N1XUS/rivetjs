// Ported from HeroUI v3.2.6 packages/react/src/components/slider/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified);
// Steps / Mark entries from the HeroUI `v3` branch @ e5feb0a3.
import { SliderFill, SliderMark, SliderMarks, SliderOutput, SliderRoot, SliderSteps, SliderThumb, SliderTrack } from "./slider.tsx";
import type {
  SliderFillProps,
  SliderMarkProps,
  SliderMarksProps,
  SliderOutputProps,
  SliderRootProps,
  SliderStepsProps,
  SliderThumbProps,
  SliderTrackProps,
} from "./slider.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Slider = Object.assign(SliderRoot, {
  Root: SliderRoot,
  Output: SliderOutput,
  Track: SliderTrack,
  Fill: SliderFill,
  Thumb: SliderThumb,
  Steps: SliderSteps,
  Marks: SliderMarks,
  Mark: SliderMark,
});

export type Slider = {
  Props: SliderRootProps;
  RootProps: SliderRootProps;
  OutputProps: SliderOutputProps;
  TrackProps: SliderTrackProps;
  FillProps: SliderFillProps;
  ThumbProps: SliderThumbProps;
  StepsProps: SliderStepsProps;
  MarksProps: SliderMarksProps;
  MarkProps: SliderMarkProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SliderRoot, SliderOutput, SliderTrack, SliderFill, SliderThumb, SliderSteps, SliderMarks, SliderMark };

export type {
  SliderRootProps,
  SliderRootProps as SliderProps,
  SliderOutputProps,
  SliderTrackProps,
  SliderFillProps,
  SliderThumbProps,
  SliderStepsProps,
  SliderMarksProps,
  SliderMarkProps,
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
