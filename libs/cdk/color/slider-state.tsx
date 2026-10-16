// Ported from react-stately `useColorSliderState` (packages/react-stately/src/color/useColorSliderState.ts), Apache-2.0, © Adobe.
// Rivet: plain signals + JSON (serializable); methods are free functions taking the state first.
// Upstream spreads `useSliderState` into the result; here `state.slider` is the stored `SliderState`
// data (drag / focus / editable flags) and `sliderView(state)` builds, per call, a transient
// `SliderState` whose value reads the color channel and whose writes set the color — pass it to the
// `@rivetjs/cdk/slider/state` functions (`setThumbValue(sliderView(state), 0, v)`). Color-specific
// members (`value`, `setValue`, `getDisplayColor`, `getThumbValueLabel`, `getFormattedValue`, `step`,
// `pageSize`, `isDragging`) are functions / fields here. Color stored as a string (`./value.ts`).
// Deviation: `snap` (Slider free drag + animated snap on release, default `"release"`) passes through to the slider state.
import { untrack } from "@rivetjs/reactivity";
import { createSliderState, isThumbDragging, type Orientation, type SliderSnap, type SliderState } from "../slider/state.ts";
import { normalizeColor, parseColor, type Color, type ColorChannel, type ColorSpace } from "./color.ts";
import { colorCell, writeColor, type ColorCell, type ColorInput } from "./value.ts";

export interface ColorSliderProps {
  /** The current value (controlled): a two-way signal or a fixed value. */
  value?: ColorInput;
  /** The default value (uncontrolled). */
  defaultValue?: string | Color;
  /**
   * The color space that the slider operates in. The `channel` must be in this color space.
   * If not provided, this defaults to the color space of the `color` or `defaultColor` value.
   */
  colorSpace?: ColorSpace;
  /** The color channel that the slider manipulates. */
  channel: ColorChannel;
  /** Handler that is called when the value changes, as the user drags. */
  onChange?: (value: Color) => void;
  /** Handler that is called when the user stops dragging. */
  onChangeEnd?: (value: Color) => void;
  /**
   * The orientation of the Slider.
   *
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /** Whether the whole Slider is disabled. */
  isDisabled?: boolean;
  /**
   * Rivet deviation (the Slider `snap` decision): `"release"` (default): during a pointer drag the thumb follows the
   * pointer freely and animates to the closest channel step on release (`data-snapping`); `"drag"`: React Aria
   * behaviour (snaps during the drag). The color value and `onChange` are stepped either way.
   *
   * @default 'release'
   */
  snap?: SliderSnap;
}

export interface ColorSliderStateOptions extends ColorSliderProps {
  /** The locale to use for formatting the color channel value. */
  locale: string;
}

export interface ColorSliderState {
  readonly kind: "slider";
  readonly cell: ColorCell<string | Color>;
  readonly channel: ColorChannel;
  readonly colorSpace: ColorSpace | undefined;
  readonly locale: string;
  /** Stored slider data (flags, refs); use `sliderView(state)` with the slider functions. */
  readonly slider: SliderState;
  /** The step of the channel. */
  readonly step: number;
  /** The page size of the channel. */
  readonly pageSize: number;
  readonly onChange: ((value: Color) => void) | undefined;
  readonly onChangeEnd: ((value: Color) => void) | undefined;
}

/**
 * Provides state management for a color slider component.
 * Color sliders allow users to adjust an individual channel of a color value.
 */
export function createColorSliderState(props: ColorSliderStateOptions): ColorSliderState {
  const { channel, colorSpace, value, defaultValue, onChange, locale, onChangeEnd, ...otherProps } = props;
  if (value == null && defaultValue == null) {
    throw new Error("useColorSliderState requires a value or defaultValue");
  }

  const cell = colorCell<string | Color>(value, defaultValue as string | Color);
  const toSpace = (c: Color) => (colorSpace && c ? c.toFormat(colorSpace) : c);
  const color = toSpace(normalizeColor(untrack(cell.read)));
  const defaultColor = toSpace(defaultValue != null ? normalizeColor(defaultValue) : normalizeColor(untrack(cell.read)));
  const range = color.getChannelRange(channel);
  const slider = createSliderState({
    minValue: range.minValue,
    maxValue: range.maxValue,
    step: range.step,
    ...otherProps,
    locale,
    value: color.getChannelValue(channel),
    defaultValue: defaultColor.getChannelValue(channel),
  });
  return { kind: "slider", cell, channel, colorSpace, locale, slider, step: range.step, pageSize: range.pageSize, onChange, onChangeEnd };
}

/** The current color value represented by the color slider. */
export function colorSliderValue(state: ColorSliderState): Color {
  const colorValue = normalizeColor(state.cell.read());
  return state.colorSpace && colorValue ? colorValue.toFormat(state.colorSpace) : colorValue;
}

/** Sets the current color value. If a string is passed, it will be parsed to a Color. */
export function setColorSliderValue(state: ColorSliderState, value: string | Color): void {
  writeColor(state.cell, normalizeColor(value), state.onChange);
}

/**
 * Transient `SliderState` over the color channel (upstream: the spread `useSliderState` result): reads
 * the channel value, writes `color.withChannelValue(channel, v)` (`onChange`), `onChangeEnd` with the color.
 * Build it per call; never store it (it holds closures).
 */
export function sliderView(state: ColorSliderState): SliderState {
  const view = {
    ...state.slider,
    // Upstream returns the channel's step / pageSize over the slider state's.
    step: state.step,
    pageSize: state.pageSize,
    // Upstream overrides getThumbValueLabel / getFormattedValue: the channel value formatted for the color.
    format: {
      formattedValue: () => getColorSliderFormattedValue(state),
      thumbValueLabel: (_index: number) => getColorSliderThumbValueLabel(state),
    },
    value: () => colorSliderValue(state).getChannelValue(state.channel),
    writable: false,
    scalar: true,
    onChange: (v: number) => writeColor(state.cell, untrack(() => colorSliderValue(state)).withChannelValue(state.channel, v), state.onChange),
    // onChange will have already been called with the right value, this is just to trigger onChangeEnd
    onChangeEnd: (v: number) => state.onChangeEnd?.(untrack(() => colorSliderValue(state)).withChannelValue(state.channel, v)),
  };
  return view;
}

/** Returns the color that should be displayed in the slider instead of `value` or the optional parameter. */
export function getColorSliderDisplayColor(state: ColorSliderState): Color {
  const color = colorSliderValue(state);
  switch (state.channel) {
    case "hue":
      return parseColor(`hsl(${color.getChannelValue("hue")}, 100%, 50%)`);
    case "lightness":
    case "brightness":
    case "saturation":
    case "red":
    case "green":
    case "blue":
      return color.withChannelValue("alpha", 1);
    case "alpha": {
      return color;
    }
    default:
      throw new Error("Unknown color channel: " + state.channel);
  }
}

/** The thumb's value label: the channel value formatted for `locale`. */
export const getColorSliderThumbValueLabel = (state: ColorSliderState): string => colorSliderValue(state).formatChannelValue(state.channel, state.locale);

/** The formatted value: the channel value formatted for `locale`. */
export const getColorSliderFormattedValue = (state: ColorSliderState): string => colorSliderValue(state).formatChannelValue(state.channel, state.locale);

/** Whether the color slider is currently being dragged. */
export const isColorSliderDragging = (state: ColorSliderState): boolean => isThumbDragging(state.slider, 0);
