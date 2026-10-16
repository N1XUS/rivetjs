// Ported from react-stately `useColorWheelState` (packages/react-stately/src/color/useColorWheelState.ts), Apache-2.0, © Adobe.
// Rivet: plain signals + JSON (serializable); methods are free functions taking the state first
// (`state.setHue(v)` → `setHue(state, v)`; shared names dispatch on `state.kind` in `./index.ts`).
// Color stored as a string (`./value.ts`); `valueRef` / `isDraggingRef` → `state.refs`.
import { signal, untrack, _regionState, type Signal } from "@rivetjs/reactivity";
import { normalizeColor, parseColor, stringifyColor, type Color } from "./color.ts";
import { colorCell, writeColor, type ColorCell, type ColorInput } from "./value.ts";

export interface ColorWheelProps {
  /** The current value (controlled): a two-way signal or a fixed value. */
  value?: ColorInput;
  /**
   * The default value (uncontrolled).
   *
   * @default 'hsl(0, 100%, 50%)'
   */
  defaultValue?: string | Color;
  /** Whether the ColorWheel is disabled. */
  isDisabled?: boolean;
  /** Handler that is called when the value changes, as the user drags. */
  onChange?: (value: Color) => void;
  /** Handler that is called when the user stops dragging. */
  onChangeEnd?: (value: Color) => void;
}

export interface ColorWheelState {
  readonly kind: "wheel";
  readonly cell: ColorCell<string | Color>;
  /** The default color value (lossless color string). */
  readonly defaultValue: string;
  /** Whether the color wheel is currently being dragged. */
  readonly dragging: Signal<boolean>;
  /** The step value of the hue channel, used when incrementing and decrementing. */
  readonly step: number;
  /** The page step value of the hue channel, used when incrementing and decrementing. */
  readonly pageStep: number;
  /** Whether the color wheel is disabled (at creation; read `isColorWheelDisabled(state)`, follows a live `disabled`). */
  readonly isDisabled: boolean;
  /** Rivet (live props): the caller's `isDisabled` accessor, when it passed one. */
  readonly disabled?: () => boolean | undefined;
  readonly onChange: ((value: Color) => void) | undefined;
  readonly onChangeEnd: ((value: Color) => void) | undefined;
  /** Upstream refs: last color set (string), dragging flag. */
  readonly refs: { value: string; dragging: boolean };
}

const DEFAULT_COLOR = "hsl(0, 100%, 50%)";

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function roundDown(v: number) {
  const r = Math.floor(v);
  if (r === v) {
    return v - 1;
  } else {
    return r;
  }
}

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

// 0deg = 3 o'clock. increases clockwise
function angleToCartesian(angle: number, radius: number): { x: number; y: number } {
  const rad = degToRad(360 - angle + 90);
  const x = Math.sin(rad) * radius;
  const y = Math.cos(rad) * radius;
  return { x, y };
}

function cartesianToAngle(x: number, y: number, radius: number): number {
  const deg = radToDeg(Math.atan2(y / radius, x / radius));
  return (deg + 360) % 360;
}

/**
 * Provides state management for a color wheel component.
 * Color wheels allow users to adjust the hue of an HSL or HSB color value on a circular track.
 */
export function createColorWheelState(props: ColorWheelProps): ColorWheelState {
  const { value: propsValue, onChange, onChangeEnd } = props;
  let { defaultValue } = props;

  if (!propsValue && !defaultValue) {
    defaultValue = DEFAULT_COLOR;
  }

  const cell = colorCell<string | Color>(propsValue, (defaultValue ?? DEFAULT_COLOR) as string | Color);
  const initialValue = normalizeColor(untrack(cell.read));
  // The hue channel range is the same in hsl and hsb.
  const { step, pageSize: pageStep } = parseColor(DEFAULT_COLOR).getChannelRange("hue");
  // Rivet (live props): an `isDisabled` accessor is stored as given (`isColorWheelDisabled` reads it).
  const disabled = typeof (props.isDisabled as unknown) === "function" ? (props.isDisabled as unknown as () => boolean | undefined) : undefined;
  return {
    kind: "wheel",
    cell,
    defaultValue: stringifyColor(propsValue !== undefined ? initialValue : normalizeColor(defaultValue!)),
    dragging: _regionState(() => signal(false)),
    step,
    pageStep,
    isDisabled: disabled ? !!untrack(disabled) : props.isDisabled || false,
    ...(disabled ? { disabled } : {}),
    onChange,
    onChangeEnd,
    refs: { value: stringifyColor(toWheelColor(initialValue)), dragging: false },
  };
}

/** Whether the color wheel is disabled now (its live `isDisabled` accessor, else the creation value). */
export const isColorWheelDisabled = (state: ColorWheelState): boolean => (state.disabled ? !!state.disabled() : state.isDisabled);

function toWheelColor(stateValue: Color): Color {
  const colorSpace = stateValue.getColorSpace();
  return colorSpace === "hsl" || colorSpace === "hsb" ? stateValue : stateValue.toFormat("hsl");
}

/** The current color value represented by the color wheel (hsl / hsb; rgb values convert to hsl). */
export const colorWheelValue = (state: ColorWheelState): Color => toWheelColor(normalizeColor(state.cell.read()));

/** The default color value. */
export const colorWheelDefaultValue = (state: ColorWheelState): Color => parseColor(state.defaultValue);

function setColor(state: ColorWheelState, value: Color): void {
  state.refs.value = stringifyColor(value);
  writeColor(state.cell, value, state.onChange);
}

/** Sets the color value represented by the color wheel, and triggers `onChange`. */
export function setColorWheelValue(state: ColorWheelState, v: string | Color): void {
  setColor(state, normalizeColor(v));
}

/** The current value of the hue channel displayed by the color wheel. */
export const getHue = (state: ColorWheelState): number => colorWheelValue(state).getChannelValue("hue");

/** Sets the hue channel of the current color value and triggers `onChange`. */
export function setHue(state: ColorWheelState, v: number): void {
  const value = untrack(() => colorWheelValue(state));
  const hue = value.getChannelValue("hue");
  if (v > 360) {
    // Make sure you can always get back to 0.
    v = 0;
  }
  v = roundToStep(mod(v, 360), state.step);
  if (hue !== v) {
    setColor(state, value.withChannelValue("hue", v));
  }
}

/**
 * Sets the hue channel of the current color value based on the given coordinates and radius of
 * the color wheel, and triggers `onChange`.
 */
export function setHueFromPoint(state: ColorWheelState, x: number, y: number, radius: number): void {
  setHue(state, cartesianToAngle(x, y, radius));
}

/** Returns the coordinates of the thumb relative to the center point of the color wheel. */
export function getColorWheelThumbPosition(state: ColorWheelState, radius: number): { x: number; y: number } {
  return angleToCartesian(colorWheelValue(state).getChannelValue("hue"), radius);
}

/** Increments the hue by the given amount (defaults to 1). */
export function incrementHue(state: ColorWheelState, stepSize = 1): void {
  const value = untrack(() => colorWheelValue(state));
  const { minValue: minValueX, maxValue: maxValueX } = value.getChannelRange("hue");
  const s = Math.max(stepSize, state.step);
  let newValue = value.getChannelValue("hue") + s;
  if (newValue >= maxValueX) {
    // Make sure you can always get back to 0.
    newValue = minValueX;
  }
  setHue(state, roundToStep(mod(newValue, 360), s));
}

/** Decrements the hue by the given amount (defaults to 1). */
export function decrementHue(state: ColorWheelState, stepSize = 1): void {
  const hue = untrack(() => getHue(state));
  const s = Math.max(stepSize, state.step);
  if (hue === 0) {
    // We can't just subtract step because this might be the case:
    // |(previous step) - 0| < step size
    setHue(state, roundDown(360 / s) * s);
  } else {
    setHue(state, roundToStep(mod(hue - s, 360), s));
  }
}

/** Sets whether the color wheel is being dragged (fires `onChangeEnd` when a drag ends). */
export function setColorWheelDragging(state: ColorWheelState, isDragging: boolean): void {
  const wasDragging = state.refs.dragging;
  state.refs.dragging = isDragging;

  if (state.onChangeEnd && !isDragging && wasDragging) {
    state.onChangeEnd(parseColor(state.refs.value));
  }

  state.dragging.set(isDragging);
}

/** Returns the color that should be displayed in the color wheel instead of `value`. */
export function getColorWheelDisplayColor(state: ColorWheelState): Color {
  return colorWheelValue(state).toFormat("hsl").withChannelValue("saturation", 100).withChannelValue("lightness", 50).withChannelValue("alpha", 1);
}
