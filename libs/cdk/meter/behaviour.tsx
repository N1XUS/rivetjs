// Ported from react-aria `useMeter` (packages/react-aria/src/meter/useMeter.ts), Apache-2.0, © Adobe.
// Rivet: `meterProps(props, locale?)` (RA `useMeter`) over `progressBarProps` (call while rendering: reads the locale context,
// creates ids; value attributes are accessors, see `../progress-bar/behaviour.tsx`). `.tsx`: resumable closures.
import { progressBarProps, type AriaProgressBarBaseProps, type ProgressBarAttrs, type ProgressBarBaseProps } from "../progress-bar/behaviour.tsx";

export { percentageOf, percentageOfProps } from "../progress-bar/behaviour.tsx";

export type MeterProps = ProgressBarBaseProps;
export interface AriaMeterProps extends AriaProgressBarBaseProps {}

export interface MeterAria {
  /** Props for the meter container element. */
  meterProps: ProgressBarAttrs;
  /** Props for the meter's visual label (if any). */
  labelProps: { id?: string };
}

/**
 * Provides the accessibility implementation for a meter component.
 * Meters represent a quantity within a known range, or a fractional value.
 */
export function meterProps(props: AriaMeterProps, locale?: string): MeterAria {
  const bags = progressBarProps(props, locale);
  const labelProps = bags.labelProps;
  return {
    meterProps: { ...bags.progressBarProps, role: "meter" },
    labelProps,
  };
}
