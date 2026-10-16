// Ported from HeroUI v3.2.6 packages/react/src/components/progress-bar/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof ProgressBarX>` → the default-element prop types (`ProgressBarOutputSpanProps`, …); `@heroui/styles` →
// vendored `styles/`.
import type { ProgressBarFillDivProps, ProgressBarOutputSpanProps, ProgressBarRootProps, ProgressBarTrackDivProps } from "./progress-bar.tsx";
import { ProgressBarFill, ProgressBarOutput, ProgressBarRoot, ProgressBarTrack } from "./progress-bar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ProgressBar = Object.assign(ProgressBarRoot, {
  Root: ProgressBarRoot,
  Output: ProgressBarOutput,
  Track: ProgressBarTrack,
  Fill: ProgressBarFill,
});

export type ProgressBar = {
  Props: ProgressBarRootProps;
  RootProps: ProgressBarRootProps;
  OutputProps: ProgressBarOutputSpanProps;
  TrackProps: ProgressBarTrackDivProps;
  FillProps: ProgressBarFillDivProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ProgressBarRoot, ProgressBarOutput, ProgressBarTrack, ProgressBarFill };

export type {
  ProgressBarRootProps,
  ProgressBarRootProps as ProgressBarProps,
  ProgressBarOutputProps,
  ProgressBarTrackProps,
  ProgressBarFillProps,
} from "./progress-bar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { progressBarVariants } from "../../../styles/src/components/progress-bar/index.ts";

export type { ProgressBarVariants } from "../../../styles/src/components/progress-bar/index.ts";
