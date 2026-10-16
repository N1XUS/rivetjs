// Ported from react-aria `useProgressBar` (packages/react-aria/src/progress/useProgressBar.ts), Apache-2.0, © Adobe.
// Rivet:
// - `progressBarProps(props, locale?)` (RA `useProgressBar`) returns `{ progressBarProps, labelProps }`; call it
//   while rendering (it reads the locale context and creates ids, like the hook).
// - value props are `MaybeAccessor`s (a number or `() => number`), and the value-dependent attributes of the bag
//   (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`) are accessors: read them inside bindings
//   so a changing value updates the attributes only (accessor rule). `.tsx`: the accessors are resumable closures.
// - The visual label (`label`) only decides whether a label id is created (RA `useLabel` with
//   `labelElementType: 'span'`); RAC passes `createSlot`'s "a Label rendered" flag.
// - `useNumberFormatter` → `NumberFormatter` (`@rivetjs/cdk/number`, cached Intl formatter per locale + options),
//   created inside the `aria-valuetext` accessor so the accessor only captures plain data (locale, options).
import { clamp } from "../utils/index.ts";
import { NumberFormatter, type NumberFormatOptions } from "../number/NumberFormatter.ts";
import { useLocale } from "../i18n/index.ts";
import { labelAria } from "../label/behaviour.ts";
import { read, type MaybeAccessor } from "../interactions/utils.ts";

export interface ProgressBarBaseProps {
  /**
   * The current value (controlled; a number or an accessor).
   *
   * @default 0
   */
  value?: MaybeAccessor<number | undefined>;
  /**
   * The smallest value allowed for the input.
   *
   * @default 0
   */
  minValue?: MaybeAccessor<number | undefined>;
  /**
   * The largest value allowed for the input.
   *
   * @default 100
   */
  maxValue?: MaybeAccessor<number | undefined>;
  /** The content to display as the label (here: whether a visible label renders). */
  label?: unknown;
  /**
   * The display format of the value label (live: a value or an accessor, read inside `aria-valuetext`).
   *
   * @default { style: 'percent' }
   */
  formatOptions?: MaybeAccessor<NumberFormatOptions | undefined>;
  /** The content to display as the value's label (e.g. 1 of 4). */
  valueLabel?: MaybeAccessor<string | undefined>;
}

export interface AriaProgressBarBaseProps extends ProgressBarBaseProps {
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
}

export interface ProgressBarProps extends ProgressBarBaseProps {
  /** Whether presentation is indeterminate when progress isn't known. */
  isIndeterminate?: MaybeAccessor<boolean | undefined>;
}

export interface AriaProgressBarProps extends ProgressBarProps, AriaProgressBarBaseProps {}

export interface ProgressBarAttrs {
  id: string;
  role: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /** Accessor: the clamped value, `undefined` while indeterminate. */
  "aria-valuenow": () => number | undefined;
  "aria-valuemin": () => number;
  "aria-valuemax": () => number;
  /** Accessor: `valueLabel` or the formatted value, `undefined` while indeterminate. */
  "aria-valuetext": () => string | undefined;
}

export interface ProgressBarAria {
  /** Props for the progress bar container element. */
  progressBarProps: ProgressBarAttrs;
  /** Props for the progress bar's visual label element (if any). */
  labelProps: { id?: string };
}

/** The resolved range of `props`: `[value (clamped), minValue, maxValue]`. */
function rangeOf(props: ProgressBarBaseProps): [number, number, number] {
  const minValue = read(props.minValue) ?? 0;
  const maxValue = read(props.maxValue) ?? 100;
  return [clamp(read(props.value) ?? 0, minValue, maxValue), minValue, maxValue];
}

/**
 * Provides the accessibility implementation for a progress bar component.
 * Progress bars show either determinate or indeterminate progress of an operation
 * over time.
 */
export function progressBarProps(props: AriaProgressBarProps, locale: string = useLocale().locale): ProgressBarAria {
  const { labelProps, fieldProps } = labelAria({
    id: props.id,
    label: props.label,
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    // Progress bar is not an HTML input element so it shouldn't be labeled by a <label> element.
    labelElementType: "span",
  });

  const isIndeterminate = () => !!read(props.isIndeterminate);
  const valueText = (): string | undefined => {
    if (isIndeterminate()) return undefined;
    const valueLabel = read(props.valueLabel);
    if (valueLabel) return valueLabel;
    const [value, minValue, maxValue] = rangeOf(props);
    const range = maxValue - minValue;
    const percentage = range === 0 ? 0 : (value - minValue) / range;
    const formatOptions: NumberFormatOptions = read(props.formatOptions) ?? { style: "percent" };
    // Created per read (the Intl formatter is cached per locale + options): a captured NumberFormatter
    // instance would not serialize into the resumable accessor.
    return new NumberFormatter(locale, formatOptions).format(formatOptions.style === "percent" ? percentage : value);
  };

  const barProps: ProgressBarAttrs = {
    ...fieldProps,
    role: "progressbar",
    "aria-valuenow": () => (isIndeterminate() ? undefined : rangeOf(props)[0]),
    "aria-valuemin": () => read(props.minValue) ?? 0,
    "aria-valuemax": () => read(props.maxValue) ?? 100,
    "aria-valuetext": valueText,
  };
  if (props["aria-describedby"]) barProps["aria-describedby"] = props["aria-describedby"];
  if (props["aria-details"]) barProps["aria-details"] = props["aria-details"];
  return { progressBarProps: barProps, labelProps: { id: labelProps.id } };
}

/** RAC ProgressBar / Meter render value: the value as a percentage (0–100) of the range; 0 for an empty range. */
export function percentageOf(value = 0, minValue = 0, maxValue = 100): number {
  value = clamp(value, minValue, maxValue);
  const range = maxValue - minValue;
  return range === 0 ? 0 : ((value - minValue) / range) * 100;
}

/** `percentageOf` over `MaybeAccessor` props (tracked when they are accessors). */
export function percentageOfProps(props: ProgressBarBaseProps): number {
  return percentageOf(read(props.value) ?? 0, read(props.minValue) ?? 0, read(props.maxValue) ?? 100);
}
