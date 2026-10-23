// Ported from react-stately `useColorAreaState` (packages/react-stately/src/color/useColorAreaState.ts), Apache-2.0, © Adobe.
// Rivet: plain signals + JSON (serializable); methods are free functions taking the state first
// (`state.setXValue(v)` → `setXValue(state, v)`; shared names `getValue` / `setValue` / `getDisplayColor` /
// `isDragging` / `setDragging` / `getThumbPosition` dispatch on `state.kind` in `./index.ts`). Values that
// upstream recomputes per render (`value`, `channels`, `xValue`, steps) are accessors. Color stored as a
// string (`./value.ts`); `valueRef` / `isDraggingRef` → `state.refs`.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { clamp, snapValueToStep } from "@rivetjs/cdk/utils";
import { normalizeColor, parseColor, stringifyColor, type Color, type ColorAxes, type ColorChannel, type ColorSpace } from "./color.ts";
import { colorCell, writeColor, type ColorCell, type ColorInput } from "./value.ts";

export interface ColorAreaProps {
  /** The current value (controlled): a two-way signal or a fixed value. */
  value?: ColorInput;
  /** The default value (uncontrolled). */
  defaultValue?: string | Color;
  /**
   * The color space that the color area operates in. The `xChannel` and `yChannel` must be in this
   * color space. If not provided, this defaults to the color space of the `color` or `defaultColor`
   * value.
   */
  colorSpace?: ColorSpace;
  /** Color channel for the horizontal axis. */
  xChannel?: ColorChannel;
  /** Color channel for the vertical axis. */
  yChannel?: ColorChannel;
  /** Whether the ColorArea is disabled. */
  isDisabled?: boolean;
  /** Handler that is called when the value changes, as the user drags. */
  onChange?: (value: Color) => void;
  /** Handler that is called when the user stops dragging. */
  onChangeEnd?: (value: Color) => void;
}

export interface ColorAreaState {
  readonly kind: "area";
  readonly cell: ColorCell<string | Color>;
  readonly colorSpace: ColorSpace | undefined;
  readonly xChannel: ColorChannel | undefined;
  readonly yChannel: ColorChannel | undefined;
  /** Disabled at creation; read `isColorAreaDisabled(state)` (follows a live `disabled`). */
  readonly isDisabled: boolean;
  /** Rivet (live props): the caller's `isDisabled` accessor, when it passed one. */
  readonly disabled?: () => boolean | undefined;
  /** The default value of the color area (lossless color string). */
  readonly defaultValue: string;
  /** Whether the color area is currently being dragged. */
  readonly dragging: Signal<boolean>;
  readonly onChange: ((value: Color) => void) | undefined;
  readonly onChangeEnd: ((value: Color) => void) | undefined;
  /** Upstream refs: last color set (string), dragging flag. */
  readonly refs: { value: string; dragging: boolean };
}

const DEFAULT_COLOR = "#ffffff";

/**
 * Provides state management for a color area component. Color area allows users to adjust two
 * channels of an HSL, HSB or RGB color value against a two-dimensional gradient background.
 */
export function createColorAreaState(props: ColorAreaProps): ColorAreaState {
  let { value, defaultValue } = props;
  const { colorSpace, xChannel, yChannel, onChange, onChangeEnd } = props;

  if (!value && !defaultValue) {
    defaultValue = DEFAULT_COLOR;
  }
  const cell = colorCell<string | Color>(value, (defaultValue ?? DEFAULT_COLOR) as string | Color);
  const initialValue = normalizeColor(untrack(cell.read));
  // Rivet (live props): an `isDisabled` accessor is stored as given (`isColorAreaDisabled` reads it).
  const disabled = typeof (props.isDisabled as unknown) === "function" ? (props.isDisabled as unknown as () => boolean | undefined) : undefined;
  const state: ColorAreaState = {
    kind: "area",
    cell,
    colorSpace,
    xChannel,
    yChannel,
    isDisabled: disabled ? !!untrack(disabled) : (props.isDisabled ?? false),
    ...(disabled ? { disabled } : {}),
    defaultValue: stringifyColor(value !== undefined ? initialValue : normalizeColor(defaultValue!)),
    dragging: signal(false),
    onChange,
    onChangeEnd,
    refs: { value: stringifyColor(colorSpace ? initialValue.toFormat(colorSpace) : initialValue), dragging: false },
  };
  return state;
}

/** Whether the color area is disabled now (its live `isDisabled` accessor, else the creation value). */
export const isColorAreaDisabled = (state: ColorAreaState): boolean => (state.disabled ? !!state.disabled() : state.isDisabled);

/** The current color value displayed by the color area (in `colorSpace` when given). */
export function colorAreaValue(state: ColorAreaState): Color {
  const colorValue = normalizeColor(state.cell.read());
  return state.colorSpace && colorValue ? colorValue.toFormat(state.colorSpace) : colorValue;
}

/** The default value of the color area. */
export const colorAreaDefaultValue = (state: ColorAreaState): Color => parseColor(state.defaultValue);

function setColor(state: ColorAreaState, color: Color): void {
  state.refs.value = stringifyColor(color);
  writeColor(state.cell, color, state.onChange);
}

/** Sets the current color value. If a string is passed, it will be parsed to a Color. */
export function setColorAreaValue(state: ColorAreaState, value: string | Color): void {
  setColor(state, normalizeColor(value));
}

/** Returns the xChannel, yChannel and zChannel names based on the color value. */
export function getChannels(state: ColorAreaState): ColorAxes {
  return colorAreaValue(state).getColorSpaceAxes({ xChannel: state.xChannel, yChannel: state.yChannel });
}

/** Step / page step of the x and y channels (upstream `xChannelStep`, `yChannelStep`, `xChannelPageStep`, `yChannelPageStep`). */
export function getChannelSteps(state: ColorAreaState): { xChannelStep: number; yChannelStep: number; xChannelPageStep: number; yChannelPageStep: number } {
  const color = colorAreaValue(state);
  const channels = getChannels(state);
  const x = color.getChannelRange(channels.xChannel);
  const y = color.getChannelRange(channels.yChannel);
  return { xChannelStep: x.step, yChannelStep: y.step, xChannelPageStep: x.pageSize, yChannelPageStep: y.pageSize };
}

function ranges(state: ColorAreaState) {
  const color = colorAreaValue(state);
  const channels = color.getColorSpaceAxes({ xChannel: state.xChannel, yChannel: state.yChannel });
  const { minValue: minValueX, maxValue: maxValueX, step: stepX } = color.getChannelRange(channels.xChannel);
  const { minValue: minValueY, maxValue: maxValueY, step: stepY } = color.getChannelRange(channels.yChannel);
  const xValue = color.getChannelValue(channels.xChannel);
  const yValue = color.getChannelValue(channels.yChannel);
  return { color, channels, minValueX, maxValueX, stepX, minValueY, maxValueY, stepY, xValue, yValue };
}

/** The current value of the horizontal axis channel displayed by the color area. */
export const getXValue = (state: ColorAreaState): number => colorAreaValue(state).getChannelValue(getChannels(state).xChannel);
/** The current value of the vertical axis channel displayed by the color area. */
export const getYValue = (state: ColorAreaState): number => colorAreaValue(state).getChannelValue(getChannels(state).yChannel);

/** Sets the value for the horizontal axis channel displayed by the color area, and triggers `onChange`. */
export function setXValue(state: ColorAreaState, v: number): void {
  const { color, channels, xValue } = untrack(() => ranges(state));
  if (v === xValue) {
    return;
  }
  setColor(state, color.withChannelValue(channels.xChannel, v));
}

/** Sets the value for the vertical axis channel displayed by the color area, and triggers `onChange`. */
export function setYValue(state: ColorAreaState, v: number): void {
  const { color, channels, yValue } = untrack(() => ranges(state));
  if (v === yValue) {
    return;
  }
  setColor(state, color.withChannelValue(channels.yChannel, v));
}

/**
 * Sets the x and y channels of the current color value based on a percentage of the width and
 * height of the color area, and triggers `onChange`.
 */
export function setColorFromPoint(state: ColorAreaState, x: number, y: number): void {
  const { color, channels, minValueX, maxValueX, stepX, minValueY, maxValueY, stepY, xValue, yValue } = untrack(() => ranges(state));
  let newXValue = minValueX + clamp(x, 0, 1) * (maxValueX - minValueX);
  let newYValue = minValueY + (1 - clamp(y, 0, 1)) * (maxValueY - minValueY);
  let newColor: Color | undefined;
  if (newXValue !== xValue) {
    // Round new value to multiple of step, clamp value between min and max
    newXValue = snapValueToStep(newXValue, minValueX, maxValueX, stepX);
    newColor = color.withChannelValue(channels.xChannel, newXValue);
  }
  if (newYValue !== yValue) {
    // Round new value to multiple of step, clamp value between min and max
    newYValue = snapValueToStep(newYValue, minValueY, maxValueY, stepY);
    newColor = (newColor || color).withChannelValue(channels.yChannel, newYValue);
  }
  if (newColor) {
    setColor(state, newColor);
  }
}

/** Returns the coordinates of the thumb relative to the upper left corner of the color area as a percentage. */
export function getColorAreaThumbPosition(state: ColorAreaState): { x: number; y: number } {
  const { minValueX, maxValueX, minValueY, maxValueY, xValue, yValue } = ranges(state);
  const x = (xValue - minValueX) / (maxValueX - minValueX);
  const y = 1 - (yValue - minValueY) / (maxValueY - minValueY);
  return { x, y };
}

/** Increments the value of the horizontal axis channel by the channel step or page amount. */
export function incrementX(state: ColorAreaState, stepSize = 1): void {
  const { minValueX, maxValueX, stepX, xValue } = untrack(() => ranges(state));
  setXValue(state, xValue + stepSize > maxValueX ? maxValueX : snapValueToStep(xValue + stepSize, minValueX, maxValueX, stepX));
}

/** Increments the value of the vertical axis channel by the channel step or page amount. */
export function incrementY(state: ColorAreaState, stepSize = 1): void {
  const { minValueY, maxValueY, stepY, yValue } = untrack(() => ranges(state));
  setYValue(state, yValue + stepSize > maxValueY ? maxValueY : snapValueToStep(yValue + stepSize, minValueY, maxValueY, stepY));
}

/** Decrements the value of the horizontal axis channel by the channel step or page amount. */
export function decrementX(state: ColorAreaState, stepSize = 1): void {
  const { minValueX, maxValueX, stepX, xValue } = untrack(() => ranges(state));
  setXValue(state, snapValueToStep(xValue - stepSize, minValueX, maxValueX, stepX));
}

/** Decrements the value of the vertical axis channel by the channel step or page amount. */
export function decrementY(state: ColorAreaState, stepSize = 1): void {
  const { minValueY, maxValueY, stepY, yValue } = untrack(() => ranges(state));
  setYValue(state, snapValueToStep(yValue - stepSize, minValueY, maxValueY, stepY));
}

/** Sets whether the color area is being dragged (fires `onChangeEnd` when a drag ends). */
export function setColorAreaDragging(state: ColorAreaState, isDragging: boolean): void {
  const wasDragging = state.refs.dragging;
  state.refs.dragging = isDragging;

  if (state.onChangeEnd && !isDragging && wasDragging) {
    state.onChangeEnd(parseColor(state.refs.value));
  }

  state.dragging.set(isDragging);
}

/** Returns the color that should be displayed in the color area thumb instead of `value`. */
export const getColorAreaDisplayColor = (state: ColorAreaState): Color => colorAreaValue(state).withChannelValue("alpha", 1);
