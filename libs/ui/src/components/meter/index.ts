// Ported from HeroUI v3.2.6 packages/react/src/components/meter/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof MeterX>` → the default-element prop types (`MeterOutputSpanProps`, …); `@heroui/styles` →
// vendored `styles/`.
import type { MeterFillDivProps, MeterOutputSpanProps, MeterRootProps, MeterTrackDivProps } from "./meter.tsx";
import { MeterFill, MeterOutput, MeterRoot, MeterTrack } from "./meter.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Meter = Object.assign(MeterRoot, {
  Root: MeterRoot,
  Output: MeterOutput,
  Track: MeterTrack,
  Fill: MeterFill,
});

export type Meter = {
  Props: MeterRootProps;
  RootProps: MeterRootProps;
  OutputProps: MeterOutputSpanProps;
  TrackProps: MeterTrackDivProps;
  FillProps: MeterFillDivProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { MeterRoot, MeterOutput, MeterTrack, MeterFill };

export type { MeterRootProps, MeterRootProps as MeterProps, MeterOutputProps, MeterTrackProps, MeterFillProps } from "./meter.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { meterVariants } from "../../../styles/src/components/meter/index.ts";

export type { MeterVariants } from "../../../styles/src/components/meter/index.ts";
