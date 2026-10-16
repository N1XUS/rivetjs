// Ported from react-stately `useSliderState` (packages/react-stately/src/slider/useSliderState.ts), Apache-2.0, © Adobe.
// Rivet:
// - State = plain signals + JSON (serializable, resumable); every `SliderState` method is an exported
//   function taking the state first (`state.setThumbValue(0, 5)` → `setThumbValue(state, 0, 5)`),
//   `state.values` → `sliderValues(state)`, `state.focusedThumb` → `state.focusedThumb()`.
// - `value` (controlled) accepts a two-way `Signal<T>` (the state writes it) or a plain value (fixed:
//   only `onChange` fires, like a React controlled prop). Controlled values are snapped
//   (`restrictValues`) on read. `SliderState.value` may also be an accessor in transient views built
//   per call (the color slider's `sliderView`); stored states hold signals only.
// - Deviation: `numberFormatter` (an `Intl.NumberFormat`, not serializable) → `locale` + `formatOptions`
//   (formatter created on use, `@internationalized/number` `NumberFormatter` cache).
// - React refs (`valuesRef`, `isDraggingsRef`, `isEditablesRef`) → plain `refs` object on the state.
// - Deviation (user decision 2026-10-08): `snap` option, default `"release"`: during a pointer drag the thumb
//   position follows the pointer freely (`dragPercents`, `getThumbPositionPercent`) while the value stays on
//   steps; on release the thumb animates to the stepped position on `@rivetjs/cdk/motion` `Motion1D` (embla's
//   ease-out; `dragPercents` carries the animated position, `snappings` / `isThumbSnapping` flag it; no CSS transition).
//   `snap: "drag"` = upstream behaviour (no free position).
import { signal, untrack, _regionState, type Signal } from "@rivetjs/reactivity";
import { clamp, snapValueToStep } from "@rivetjs/cdk/utils";
import { Motion1D, type Motion1DType } from "../motion/Motion1D.ts";
import { NumberFormatter } from "../number/NumberFormatter.ts";
import { cachedIntl } from "../i18n/intl-cache.ts";

export type Orientation = "horizontal" | "vertical";

/**
 * Rivet deviation: when a stepped thumb snaps during a pointer drag. `"release"` (default): the thumb
 * follows the pointer freely and animates to the closest step on release; `"drag"`: React Aria behaviour
 * (the thumb jumps from step to step during the drag).
 */
export type SliderSnap = "release" | "drag";

/** Controlled value: two-way signal, plain value, or an accessor (controlled by the caller's state, live; live props P5). */
export type SliderValueInput<T> = T | Signal<T> | (() => T);

export interface SliderProps<T = number | number[]> {
  /** The current value (controlled): a two-way signal, a fixed value or an accessor. */
  value?: SliderValueInput<T>;
  /** The default value (uncontrolled). */
  defaultValue?: T;
  /** Handler that is called when the value changes. */
  onChange?: (value: T) => void;
  /**
   * The orientation of the Slider. Live: a value-form prop is read in the bindings and at pointer / key time.
   *
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /** Whether the whole Slider is disabled (a value, or an accessor that stays live). */
  isDisabled?: boolean | (() => boolean | undefined);
  /** Fired when the slider stops moving, due to being let go. */
  onChangeEnd?: (value: T) => void;
  /**
   * The slider's minimum value.
   * Live: a value-form prop (`minValue={m()}`) is read on every use (clamping, page size, thumb positions).
   *
   * @default 0
   */
  minValue?: number;
  /**
   * The slider's maximum value.
   * Live: a value-form prop (`minValue={m()}`) is read on every use (clamping, page size, thumb positions).
   *
   * @default 100
   */
  maxValue?: number;
  /**
   * The slider's step value.
   * Live: a value-form prop (`minValue={m()}`) is read on every use (clamping, page size, thumb positions).
   *
   * @default 1
   */
  step?: number;
  /**
   * Rivet deviation: when the thumb snaps to a step during a pointer drag. `"release"`: free drag, the thumb
   * animates to the closest step on release (`@rivetjs/cdk/motion` `Motion1D`, `data-snapping`); `"drag"`: React
   * Aria behaviour (snaps during the drag). The value, `aria-valuenow` and `onChange` are stepped either way.
   *
   * @default 'release'
   */
  snap?: SliderSnap;
}

export interface SliderStateOptions<T> extends SliderProps<T> {
  /** Rivet (upstream `numberFormatter`): locale of the value labels, default `en-US`. */
  locale?: string;
  /** Rivet: number format options of the value labels (live: read by every label). */
  formatOptions?: Intl.NumberFormatOptions;
}

export interface SliderState {
  /** Value source (see `SliderProps.value`; an accessor only in transient views); read through `sliderValues(state)`. */
  readonly value: Signal<number | number[]> | (() => number | number[]);
  /** Whether the state writes `value` (uncontrolled or two-way signal). */
  readonly writable: boolean;
  /** `onChange` / `onChangeEnd` receive a number (value or defaultValue was a number) instead of an array. */
  readonly scalar: boolean;
  /** The default values for each thumb. */
  readonly defaultValues: number[];
  readonly minValue: number;
  readonly maxValue: number;
  /** The step amount for the slider. */
  readonly step: number;
  /** The page size for the slider, used to do a bigger step. */
  readonly pageSize: number;
  /** The orientation of the slider. */
  readonly orientation: Orientation;
  /** Whether the slider is disabled (at creation; read `isSliderDisabled(state)` for the current value). */
  readonly isDisabled: boolean;
  /** Rivet: the caller's `isDisabled` accessor (live props), when it passed one. */
  readonly disabled?: () => boolean | undefined;
  /** Whether each thumb is being dragged. */
  readonly draggings: Signal<boolean[]>;
  /** Currently-focused thumb index. */
  readonly focusedThumb: Signal<number | undefined>;
  /** Rivet: when the thumb snaps during a pointer drag (`SliderProps.snap`). */
  readonly snap: SliderSnap;
  /**
   * Rivet: free (unstepped) position of each thumb during a pointer drag, 0–1 (null = not free-dragging;
   * always null on the server). Read through `getThumbPositionPercent`.
   */
  readonly dragPercents: Signal<(number | null)[]>;
  /** Rivet: whether each thumb is animating from its free position to its stepped one (after release). */
  readonly snappings: Signal<boolean[]>;
  readonly onChange: ((value: any) => void) | undefined;
  readonly onChangeEnd: ((value: any) => void) | undefined;
  readonly locale: string;
  readonly formatOptions: Intl.NumberFormatOptions | undefined;
  /** Upstream refs: last values set, dragging flags, editable flags. */
  readonly refs: { values: number[]; draggings: boolean[]; editables: boolean[] };
  /**
   * Rivet (live props): accessors of the live range / orientation / format props (the number fields above hold
   * their creation values); read through `sliderMin` / `sliderMax` / `sliderStep` / `sliderPageSize` /
   * `sliderOrientation` / `sliderFormatOptions`. Absent on the static path.
   */
  readonly live?: SliderLive;
  /**
   * Rivet: label override of a derived state (RA ColorSliderState overrides `getThumbValueLabel` /
   * `getFormattedValue`): `getFormattedValue(state)` (no value) and `getThumbValueLabel` return these.
   */
  readonly format?: { formattedValue: () => string; thumbValueLabel: (index: number) => string };
}

/** Live range / orientation / format accessors of a slider state (live props). */
export interface SliderLive {
  readonly minValue?: () => number | undefined;
  readonly maxValue?: () => number | undefined;
  readonly step?: () => number | undefined;
  readonly orientation?: () => Orientation | undefined;
  readonly formatOptions?: () => Intl.NumberFormatOptions | undefined;
}

const DEFAULT_MIN_VALUE = 0;
const DEFAULT_MAX_VALUE = 100;
const DEFAULT_STEP_VALUE = 1;

const isSignal = <T>(v: unknown): v is Signal<T> => typeof v === "function" && typeof (v as Signal<T>).set === "function";

/**
 * Provides state management for a slider component. Stores values for all thumbs,
 * formats values for localization, and provides methods to update the position
 * of any thumbs.
 */
export function createSliderState<T extends number | number[]>(props: SliderStateOptions<T>): SliderState {
  const { isDisabled: disabledInput = false } = props;
  // Rivet (live props): a range / orientation / format prop may be an accessor (the component's live boundary);
  // the state keeps its creation value and the accessor (`live`), readers resolve the current one.
  const given = props as unknown as Record<"minValue" | "maxValue" | "step" | "orientation" | "formatOptions", unknown>;
  let live: Record<string, unknown> | undefined;
  const now = <V>(key: keyof typeof given): V | undefined => {
    const v = given[key];
    if (typeof v !== "function") return v as V | undefined;
    (live ??= {})[key] = v;
    return untrack(v as () => V | undefined);
  };
  const minValue = now<number>("minValue") ?? DEFAULT_MIN_VALUE;
  const maxValue = now<number>("maxValue") ?? DEFAULT_MAX_VALUE;
  const step = now<number>("step") ?? DEFAULT_STEP_VALUE;
  const orientation = now<Orientation>("orientation") ?? "horizontal";
  const formatOptions = now<Intl.NumberFormatOptions>("formatOptions");

  const pageSize = pageSizeOf(minValue, maxValue, step);

  const restrict = (values: number[]) => restrictValues(values, minValue, maxValue, step);
  const defaultValue = restrict(convertValue(props.defaultValue) ?? [minValue]);

  let value: Signal<number | number[]> | (() => number | number[]);
  let writable = true;
  const input = props.value;
  if (input === undefined) value = _regionState(() => signal<number | number[]>(defaultValue));
  else if (isSignal<number | number[]>(input)) value = input;
  else if (typeof input === "function") {
    // Rivet (live props): a controlled accessor — read live, changes reported through onChange only.
    value = input as () => number | number[];
    writable = false;
  } else {
    value = _regionState(() => signal<number | number[]>(input as number | number[]));
    writable = false;
  }

  const initialValues = restrict(convertValue(untrack(value))!);
  const count = initialValues.length;
  return {
    value,
    writable,
    scalar: typeof (typeof input === "function" ? untrack(input as () => unknown) : input) === "number" || typeof props.defaultValue === "number",
    defaultValues: props.defaultValue !== undefined ? defaultValue : initialValues,
    minValue,
    maxValue,
    step,
    pageSize,
    orientation,
    isDisabled: typeof disabledInput === "function" ? !!untrack(disabledInput) : disabledInput,
    ...(typeof disabledInput === "function" ? { disabled: disabledInput } : {}),
    draggings: _regionState(() => signal<boolean[]>(new Array(count).fill(false))),
    focusedThumb: _regionState(() => signal<number | undefined>(undefined)),
    snap: props.snap ?? "release",
    dragPercents: _regionState(() => signal<(number | null)[]>(new Array(count).fill(null))),
    snappings: _regionState(() => signal<boolean[]>(new Array(count).fill(false))),
    onChange: props.onChange,
    onChangeEnd: props.onChangeEnd,
    locale: props.locale ?? "en-US",
    formatOptions,
    ...(live ? { live: live as SliderLive } : {}),
    refs: { values: initialValues, draggings: new Array(count).fill(false), editables: new Array(count).fill(true) },
  };
}

/** Page step: at least the step and always a multiple of it. */
function pageSizeOf(minValue: number, maxValue: number, step: number): number {
  let calcPageSize = (maxValue - minValue) / 10;
  calcPageSize = snapValueToStep(calcPageSize, 0, calcPageSize + step, step);
  return Math.max(calcPageSize, step);
}

/** The slider's current minimum (its live `minValue`, else the creation value). */
export function sliderMin(state: SliderState): number {
  const live = state.live?.minValue;
  return live ? (live() ?? DEFAULT_MIN_VALUE) : state.minValue;
}
/** The slider's current maximum. */
export function sliderMax(state: SliderState): number {
  const live = state.live?.maxValue;
  return live ? (live() ?? DEFAULT_MAX_VALUE) : state.maxValue;
}
/** The slider's current step. */
export function sliderStep(state: SliderState): number {
  const live = state.live?.step;
  return live ? (live() ?? DEFAULT_STEP_VALUE) : state.step;
}
/** The slider's current page size (derived from the current range and step when one of them is live). */
export function sliderPageSize(state: SliderState): number {
  const live = state.live;
  return live && (live.minValue || live.maxValue || live.step) ? pageSizeOf(sliderMin(state), sliderMax(state), sliderStep(state)) : state.pageSize;
}
/** The slider's current orientation. */
export function sliderOrientation(state: SliderState): Orientation {
  const live = state.live?.orientation;
  return live ? (live() ?? "horizontal") : state.orientation;
}
/** The slider's current number format options. */
export function sliderFormatOptions(state: SliderState): Intl.NumberFormatOptions | undefined {
  const live = state.live?.formatOptions;
  return live ? live() : state.formatOptions;
}

function restrictValues(values: number[], minValue: number, maxValue: number, step: number): number[] {
  return values.map((val, idx) => {
    const min = idx === 0 ? minValue : values[idx - 1];
    const max = idx === values.length - 1 ? maxValue : values[idx + 1];
    return snapValueToStep(val, min, max, step);
  });
}

/** Values managed by the slider by thumb index (upstream `state.values`). */
export function sliderValues(state: SliderState): number[] {
  return restrictValues(convertValue(state.value())!, sliderMin(state), sliderMax(state), sliderStep(state));
}

/** Get the value for the specified thumb. */
export const getThumbValue = (state: SliderState, index: number): number => sliderValues(state)[index]!;

/** Returns the value as a percent between the min and max of the slider. */
export function getValuePercent(state: SliderState, value: number): number {
  const min = sliderMin(state);
  return (value - min) / (sliderMax(state) - min);
}

/** Returns the specified thumb's value as a percentage from 0 to 1. */
export const getThumbPercent = (state: SliderState, index: number): number => getValuePercent(state, getThumbValue(state, index));

/** Returns the min allowed value for the specified thumb. */
export function getThumbMinValue(state: SliderState, index: number): number {
  return index === 0 ? sliderMin(state) : sliderValues(state)[index - 1]!;
}

/** Returns the max allowed value for the specified thumb. */
export function getThumbMaxValue(state: SliderState, index: number): number {
  const values = sliderValues(state);
  return index === values.length - 1 ? sliderMax(state) : values[index + 1]!;
}

/** Returns if the specified thumb is editable. */
export function isThumbEditable(state: SliderState, index: number): boolean {
  return state.refs.editables[index]!;
}

/** Set the specified thumb's editable state. */
export function setThumbEditable(state: SliderState, index: number, editable: boolean): void {
  state.refs.editables[index] = editable;
}

function setValues(state: SliderState, values: number[]): void {
  // useControlledState: no change → no write, no onChange.
  const current = untrack(() => sliderValues(state));
  if (values.length === current.length && values.every((v, i) => Object.is(v, current[i]))) return;
  state.refs.values = values;
  const next = state.scalar ? values[0]! : values;
  if (state.writable) (state.value as Signal<number | number[]>).set(next);
  state.onChange?.(next);
}

/**
 * Sets the value for the specified thumb.
 * The actual value set will be clamped and rounded according to min/max/step.
 */
export function setThumbValue(state: SliderState, index: number, value: number): void {
  if (isSliderDisabled(state) || !isThumbEditable(state, index)) {
    return;
  }
  // Rivet: a keyboard / programmatic change during the release animation puts the thumb on its new step at once.
  if (!state.refs.draggings[index]) endThumbSnap(state, index);
  const thisMin = untrack(() => getThumbMinValue(state, index));
  const thisMax = untrack(() => getThumbMaxValue(state, index));

  // Round value to multiple of step, clamp value between min and max
  value = snapValueToStep(
    value,
    thisMin,
    thisMax,
    untrack(() => sliderStep(state)),
  );
  const newValues = replaceIndex(
    untrack(() => sliderValues(state)),
    index,
    value,
  );
  setValues(state, newValues);
}

/** Whether the slider is disabled now (its live `isDisabled` accessor, else the creation value). */
export const isSliderDisabled = (state: SliderState): boolean => (state.disabled ? !!state.disabled() : state.isDisabled);

/** Whether the specific thumb is being dragged. */
export const isThumbDragging = (state: SliderState, index: number): boolean => state.draggings()[index] ?? false;

/** Set is dragging on the specified thumb. */
export function setThumbDragging(state: SliderState, index: number, dragging: boolean): void {
  if (isSliderDisabled(state) || !isThumbEditable(state, index)) {
    return;
  }
  if (dragging) {
    state.refs.values = untrack(() => sliderValues(state));
  }

  const wasDragging = state.refs.draggings[index];
  state.refs.draggings = replaceIndex(state.refs.draggings, index, dragging);
  state.draggings.set(state.refs.draggings);

  if (!dragging) releaseThumbPosition(state, index);

  // Call onChangeEnd if no handles are dragging.
  if (state.onChangeEnd && wasDragging && !state.refs.draggings.some(Boolean)) {
    state.onChangeEnd(state.scalar ? state.refs.values[0] : state.refs.values);
  }
}

/**
 * Rivet: the thumb's visual position, 0–1: the free pointer position during a pointer drag (`snap: "release"`),
 * else the stepped value's percent (`getThumbPercent`). Position thumbs / fills with it.
 */
export function getThumbPositionPercent(state: SliderState, index: number): number {
  return state.dragPercents()[index] ?? getThumbPercent(state, index);
}

/**
 * Rivet: sets the free position (0–1) of a thumb being dragged by a pointer, clamped to the track and to the
 * neighbouring thumbs' values. No-op with `snap: "drag"`, disabled or not editable. Cancels a running snap.
 */
export function setThumbDragPercent(state: SliderState, index: number, percent: number): void {
  if (state.snap !== "release" || isSliderDisabled(state) || !isThumbEditable(state, index)) return;
  const min = untrack(() => getValuePercent(state, getThumbMinValue(state, index)));
  const max = untrack(() => getValuePercent(state, getThumbMaxValue(state, index)));
  const next = clamp(percent, min, max);
  endThumbSnap(state, index);
  const current = untrack(state.dragPercents);
  if (current[index] !== next) state.dragPercents.set(replaceIndex(current, index, next));
}

/** Rivet: whether the thumb is animating to its stepped position after a free drag (`data-snapping`). */
export const isThumbSnapping = (state: SliderState, index: number): boolean => state.snappings()[index] ?? false;

/** Rivet: ends the snap animation of a thumb: stops it and puts the thumb on its stepped position. */
export function endThumbSnap(state: SliderState, index: number): void {
  const motions = snapMotions.get(state.refs);
  const motion = motions?.[index];
  if (motion) {
    motion.stop();
    delete motions![index];
    const percents = untrack(state.dragPercents);
    if (percents[index] != null) state.dragPercents.set(replaceIndex(percents, index, null));
  }
  const current = untrack(state.snappings);
  if (current[index]) state.snappings.set(replaceIndex(current, index, false));
}

// Browser-only: running snap animations by thumb index, keyed by the state's refs (kept out of the JSON state).
const snapMotions = new WeakMap<object, Record<number, Motion1DType>>();

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Drag end: animate the free position to the stepped one on `@rivetjs/cdk/motion` (`Motion1D`: embla's
 * ease-out, the same motion as the carousel / sheet), then drop it. Jumps when already there, with reduced
 * motion, or without `requestAnimationFrame`.
 */
function releaseThumbPosition(state: SliderState, index: number): void {
  const current = untrack(state.dragPercents);
  const free = current[index];
  if (free == null) return;
  const stepped = untrack(() => getThumbPercent(state, index));
  // A second release (thumb move end + the global pointerup) retargets the running snap instead of restarting it.
  const running = snapMotions.get(state.refs)?.[index];
  if (running) {
    running.to(stepped);
    return;
  }
  if (Math.abs(free - stepped) <= 1e-9 || prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
    state.dragPercents.set(replaceIndex(current, index, null));
    return;
  }
  endThumbSnap(state, index);
  state.snappings.set(replaceIndex(untrack(state.snappings), index, true));
  let motions = snapMotions.get(state.refs);
  if (!motions) snapMotions.set(state.refs, (motions = {}));
  const motion = Motion1D({
    value: free,
    render: (percent) => {
      const percents = untrack(state.dragPercents);
      if (percents[index] !== percent) state.dragPercents.set(replaceIndex(percents, index, percent));
    },
    onSettle: () => endThumbSnap(state, index),
  });
  motions[index] = motion;
  motion.to(stepped);
}

/** Set focused true on specified thumb. This will remove focus from any thumb that had it before. */
export function setFocusedThumb(state: SliderState, index: number | undefined): void {
  state.focusedThumb.set(index);
}

function formatterOf(state: SliderState): Intl.NumberFormat {
  return new NumberFormatter(state.locale, sliderFormatOptions(state)) as unknown as Intl.NumberFormat;
}

/** Returns the string label for the value, per props.formatOptions. */
export function getFormattedValue(state: SliderState, valueParam?: number | number[]): string {
  if (valueParam === undefined) {
    if (state.format) return state.format.formattedValue();
    valueParam = sliderValues(state);
  }
  if (typeof valueParam === "number") {
    valueParam = [valueParam];
  }
  const formatter = formatterOf(state);

  switch (valueParam.length) {
    case 0:
      return "";
    case 1:
      return formatter.format(valueParam[0]!);
    case 2:
      return formatter.formatRange(valueParam[0]!, valueParam[1]!);
    default: {
      const formatted = valueParam.map((value) => formatter.format(value));
      const listFormat = cachedIntl(Intl.ListFormat, formatter.resolvedOptions().locale, { type: "unit" });
      return listFormat.format(formatted);
    }
  }
}

/** Returns the string label for the specified thumb's value, per props.formatOptions. */
export const getThumbValueLabel = (state: SliderState, index: number): string =>
  state.format ? state.format.thumbValueLabel(index) : getFormattedValue(state, getThumbValue(state, index));

function getRoundedValue(state: SliderState, value: number) {
  const min = sliderMin(state),
    step = sliderStep(state);
  return Math.round((value - min) / step) * step + min;
}

/** Converts a percent along track (between 0 and 1) to the corresponding value. */
export function getPercentValue(state: SliderState, percent: number): number {
  const min = sliderMin(state),
    max = sliderMax(state);
  const val = percent * (max - min) + min;
  return clamp(getRoundedValue(state, val), min, max);
}

/** Sets value for the specified thumb by percent offset (between 0 and 1). */
export function setThumbPercent(state: SliderState, index: number, percent: number): void {
  setThumbValue(state, index, getPercentValue(state, percent));
}

/** Increments the value of the thumb by the step or page amount. */
export function incrementThumb(state: SliderState, index: number, stepSize: number = 1): void {
  untrack(() => {
    const step = sliderStep(state);
    const s = Math.max(stepSize, step);
    setThumbValue(state, index, snapValueToStep(getThumbValue(state, index) + s, sliderMin(state), sliderMax(state), step));
  });
}

/** Decrements the value of the thumb by the step or page amount. */
export function decrementThumb(state: SliderState, index: number, stepSize: number = 1): void {
  untrack(() => {
    const step = sliderStep(state);
    const s = Math.max(stepSize, step);
    setThumbValue(state, index, snapValueToStep(getThumbValue(state, index) - s, sliderMin(state), sliderMax(state), step));
  });
}

function replaceIndex<T>(array: T[], index: number, value: T): T[] {
  if (array[index] === value) {
    return array;
  }

  return [...array.slice(0, index), value, ...array.slice(index + 1)];
}

function convertValue(value?: number | number[]): number[] | undefined {
  if (value == null) {
    return undefined;
  }

  return Array.isArray(value) ? value : [value];
}
