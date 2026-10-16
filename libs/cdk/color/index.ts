// Ported from @react-stately/color (packages/@react-stately/color/src/index.ts → react-stately src/color/*), Apache-2.0, © Adobe.
// Rivet: `use*State` hooks → `create*State` factories (plain signals + JSON, resumable); state members are
// free functions taking the state first. Members shared by several upstream states (`value`, `setValue`,
// `getDisplayColor`, `isDragging`, `setDragging`, `getThumbPosition`, `increment`, `decrement`,
// `colorValue`, `defaultColorValue`, `setColorValue`) dispatch on `state.kind`.
import {
  getColorAreaDisplayColor,
  getColorAreaThumbPosition,
  colorAreaDefaultValue,
  colorAreaValue,
  setColorAreaDragging,
  setColorAreaValue,
} from "./area-state.ts";
import type { ColorAreaState } from "./area-state.ts";
import { channelFieldColorValue, channelFieldDefaultColorValue, setChannelFieldColorValue, type ColorChannelFieldState } from "./channel-field-state.tsx";
import type { Color } from "./color.ts";
import {
  colorValue as fieldColorValue,
  decrementColorField,
  defaultColorValue as fieldDefaultColorValue,
  incrementColorField,
  setColorValue as setFieldColorValue,
  type ColorFieldState,
} from "./field-state.tsx";
import {
  colorSliderValue,
  getColorSliderDisplayColor,
  getColorSliderFormattedValue,
  getColorSliderThumbValueLabel,
  isColorSliderDragging,
  setColorSliderValue,
  type ColorSliderState,
} from "./slider-state.tsx";
import {
  colorWheelDefaultValue,
  colorWheelValue,
  decrementHue,
  getColorWheelDisplayColor,
  getColorWheelThumbPosition,
  incrementHue,
  setColorWheelDragging,
  setColorWheelValue,
  type ColorWheelState,
} from "./wheel-state.ts";

export { parseColor, getColorChannels, normalizeColor, normalizeHue, toColor, stringifyColor, colorKey } from "./color.ts";
export type { Color, ColorChannel, ColorFormat, ColorSpace, ColorAxes, ColorChannelRange } from "./color.ts";
export type { ColorInput, ColorValue } from "./value.ts";

export {
  createColorAreaState,
  getChannels,
  getChannelSteps,
  getXValue,
  getYValue,
  setXValue,
  setYValue,
  setColorFromPoint,
  incrementX,
  incrementY,
  decrementX,
  decrementY,
} from "./area-state.ts";
export type { ColorAreaProps, ColorAreaState } from "./area-state.ts";
export { createColorSliderState, sliderView } from "./slider-state.tsx";
export type { ColorSliderProps, ColorSliderState, ColorSliderStateOptions } from "./slider-state.tsx";
export { createColorWheelState, getHue, setHue, setHueFromPoint } from "./wheel-state.ts";
export type { ColorWheelProps, ColorWheelState } from "./wheel-state.ts";
export { createColorFieldState, inputValue, setInputValue, commit, incrementToMax, decrementToMin, validate } from "./field-state.tsx";
export type { ColorFieldProps, ColorFieldState } from "./field-state.tsx";
export { createColorChannelFieldState, numberFieldView } from "./channel-field-state.tsx";
export type { ColorChannelFieldProps, ColorChannelFieldState, ColorChannelFieldStateOptions } from "./channel-field-state.tsx";
export { createColorPickerState, getColor, setColor } from "./picker-state.ts";
export type { ColorPickerProps, ColorPickerState } from "./picker-state.ts";

type ValueState = ColorAreaState | ColorSliderState | ColorWheelState;

/** The current color value (area: in `colorSpace`; slider: in `colorSpace`; wheel: hsl / hsb). */
export function getValue(state: ValueState): Color {
  return state.kind === "area" ? colorAreaValue(state) : state.kind === "slider" ? colorSliderValue(state) : colorWheelValue(state);
}

/** The default value (area, wheel). */
export function getDefaultValue(state: ColorAreaState | ColorWheelState): Color {
  return state.kind === "area" ? colorAreaDefaultValue(state) : colorWheelDefaultValue(state);
}

/** Sets the current color value (fires `onChange`). If a string is passed, it will be parsed to a Color. */
export function setValue(state: ValueState, value: string | Color): void {
  if (state.kind === "area") setColorAreaValue(state, value);
  else if (state.kind === "slider") setColorSliderValue(state, value);
  else setColorWheelValue(state, value);
}

/** Returns the color that should be displayed in the thumb / track instead of `value`. */
export function getDisplayColor(state: ValueState): Color {
  return state.kind === "area"
    ? getColorAreaDisplayColor(state)
    : state.kind === "slider"
      ? getColorSliderDisplayColor(state)
      : getColorWheelDisplayColor(state);
}

/** Whether the area / slider / wheel is currently being dragged. */
export function isDragging(state: ValueState): boolean {
  return state.kind === "slider" ? isColorSliderDragging(state) : state.dragging();
}

/** Sets whether the area / wheel is being dragged (`onChangeEnd` fires when a drag ends). Slider: `setThumbDragging(sliderView(state), 0, v)`. */
export function setDragging(state: ColorAreaState | ColorWheelState, value: boolean): void {
  if (state.kind === "area") setColorAreaDragging(state, value);
  else setColorWheelDragging(state, value);
}

/** Thumb position: area — percentages from the upper left corner; wheel — coordinates from the center for `radius`. */
export function getThumbPosition(state: ColorAreaState): { x: number; y: number };
export function getThumbPosition(state: ColorWheelState, radius: number): { x: number; y: number };
export function getThumbPosition(state: ColorAreaState | ColorWheelState, radius?: number): { x: number; y: number } {
  return state.kind === "area" ? getColorAreaThumbPosition(state) : getColorWheelThumbPosition(state, radius!);
}

/** Wheel: increments the hue by `stepSize` (default 1). Field: increments the hex value by one step. */
export function increment(state: ColorWheelState | ColorFieldState, stepSize?: number): void {
  if (state.kind === "wheel") incrementHue(state, stepSize);
  else incrementColorField(state);
}

/** Wheel: decrements the hue by `stepSize` (default 1). Field: decrements the hex value by one step. */
export function decrement(state: ColorWheelState | ColorFieldState, stepSize?: number): void {
  if (state.kind === "wheel") decrementHue(state, stepSize);
  else decrementColorField(state);
}

/** Color slider: the channel value formatted for the slider's locale. */
export const getThumbValueLabel = (state: ColorSliderState): string => getColorSliderThumbValueLabel(state);
/** Color slider: the channel value formatted for the slider's locale. */
export const getFormattedValue = (state: ColorSliderState): string => getColorSliderFormattedValue(state);

/** Field: the parsed color (null / undefined when empty). Channel field: the color (black when empty). */
export function colorValue(state: ColorFieldState): Color | null | undefined;
export function colorValue(state: ColorChannelFieldState): Color;
export function colorValue(state: ColorFieldState | ColorChannelFieldState): Color | null | undefined {
  return state.kind === "field" ? fieldColorValue(state) : channelFieldColorValue(state);
}

/** The default value of the field. */
export function defaultColorValue(state: ColorFieldState | ColorChannelFieldState): Color | null | undefined {
  return state.kind === "field" ? fieldDefaultColorValue(state) : channelFieldDefaultColorValue(state);
}

/** Sets the color value of the field (fires `onChange`). */
export function setColorValue(state: ColorFieldState | ColorChannelFieldState, value: Color | null): void {
  if (state.kind === "field") setFieldColorValue(state, value);
  else setChannelFieldColorValue(state, value);
}
