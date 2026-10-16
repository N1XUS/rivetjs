// Ported from HeroUI v3.2.6 packages/react/src/components/progress-circle/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof ProgressCircleX>` → the default-element prop types (`ProgressCircleTrackSvgProps`, …); `@heroui/styles`
// → vendored `styles/`.
import type {
  ProgressCircleFillCircleCircleProps,
  ProgressCircleRootProps,
  ProgressCircleTrackCircleCircleProps,
  ProgressCircleTrackSvgProps,
} from "./progress-circle.tsx";
import { ProgressCircleFillCircle, ProgressCircleRoot, ProgressCircleTrack, ProgressCircleTrackCircle } from "./progress-circle.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ProgressCircle = Object.assign(ProgressCircleRoot, {
  Root: ProgressCircleRoot,
  Track: ProgressCircleTrack,
  TrackCircle: ProgressCircleTrackCircle,
  FillCircle: ProgressCircleFillCircle,
});

export type ProgressCircle = {
  Props: ProgressCircleRootProps;
  RootProps: ProgressCircleRootProps;
  TrackProps: ProgressCircleTrackSvgProps;
  TrackCircleProps: ProgressCircleTrackCircleCircleProps;
  FillCircleProps: ProgressCircleFillCircleCircleProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ProgressCircleRoot, ProgressCircleTrack, ProgressCircleTrackCircle, ProgressCircleFillCircle };

export type {
  ProgressCircleRootProps,
  ProgressCircleRootProps as ProgressCircleProps,
  ProgressCircleTrackProps,
  ProgressCircleTrackCircleProps,
  ProgressCircleFillCircleProps,
} from "./progress-circle.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { progressCircleVariants } from "../../../styles/src/components/progress-circle/index.ts";

export type { ProgressCircleVariants } from "../../../styles/src/components/progress-circle/index.ts";
