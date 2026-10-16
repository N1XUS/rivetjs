// Rivet addition (no HeroUI v3.2.6 counterpart): settings-cell slider; feature set inspired by HeroUI Pro's public docs,
// independent implementation (see `cell-slider.tsx`).
import { CellSliderFill, CellSliderLabel, CellSliderOutput, CellSliderRoot, CellSliderThumb, CellSliderTrack } from "./cell-slider.tsx";
import type {
  CellSliderFillProps,
  CellSliderLabelProps,
  CellSliderOutputProps,
  CellSliderRootProps,
  CellSliderThumbProps,
  CellSliderTrackProps,
} from "./cell-slider.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const CellSlider = Object.assign(CellSliderRoot, {
  Root: CellSliderRoot,
  Label: CellSliderLabel,
  Output: CellSliderOutput,
  Track: CellSliderTrack,
  Fill: CellSliderFill,
  Thumb: CellSliderThumb,
});

export type CellSlider = {
  Props: CellSliderRootProps;
  RootProps: CellSliderRootProps;
  LabelProps: CellSliderLabelProps;
  OutputProps: CellSliderOutputProps;
  TrackProps: CellSliderTrackProps;
  FillProps: CellSliderFillProps;
  ThumbProps: CellSliderThumbProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { CellSliderRoot, CellSliderLabel, CellSliderOutput, CellSliderTrack, CellSliderFill, CellSliderThumb, CellSliderContext } from "./cell-slider.tsx";
export type {
  CellSliderRootProps,
  CellSliderRootProps as CellSliderProps,
  CellSliderLabelProps,
  CellSliderOutputProps,
  CellSliderTrackProps,
  CellSliderFillProps,
  CellSliderThumbProps,
  CellSliderRenderProps,
} from "./cell-slider.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { cellSliderVariants } from "../../../styles/src/components/cell-slider/index.ts";

export type { CellSliderVariants } from "../../../styles/src/components/cell-slider/index.ts";
