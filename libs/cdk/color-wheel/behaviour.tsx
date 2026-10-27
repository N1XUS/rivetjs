// Ported from react-aria `useColorWheel` (packages/react-aria/src/color/useColorWheel.ts), Apache-2.0, © Adobe.
// Rivet:
// - `useColorWheel(props, state, inputRef)` → `colorWheelProps(props, state)` (RA's `{trackProps, thumbProps,
//   inputProps}`), built from attribute functions (`colorWheelTrackStyle`, `colorWheelThumbStyle`,
//   `colorWheelInputValueText`, `colorWheelInputLabels`, …) and the hook's handlers as free functions
//   (`colorWheelTrackPointerDown`, `colorWheelThumbPointerDown`, `colorWheelThumbKeyDown`,
//   `colorWheelInputChange`, `colorWheelInputFocus`). Components wire the handlers from inline arrows (resumable).
// - `inputRef` is a `ref()` element ref in `props.inputRef`; the hook's refs live in `props.interaction`
//   (`createColorWheelInteraction()`, JSON); `locale` is resolved at render and passed in.
// - `useGlobalListeners` → window `pointerup` listener added / removed by the handlers; `useFormReset` installs
//   on the first focus of the input.
import { untrack } from "@rivetjs/reactivity";
import { focusWithoutScrolling, useFormReset, useLabels } from "@rivetjs/cdk/utils";
import { keyboardKeyDown } from "../interactions/keyboard.tsx";
import { getOwnerWindow, read, type MaybeAccessor } from "../interactions/utils.ts";
import { moveKeyDown, movePointerDown, type MoveMoveEvent } from "../interactions/move.tsx";
import {
  colorWheelDefaultValue,
  colorWheelValue,
  decrementHue,
  getColorWheelThumbPosition,
  incrementHue,
  setColorWheelDragging,
  setColorWheelValue,
  setHue,
  setHueFromPoint,
  type ColorWheelProps,
  type ColorWheelState,
} from "../color/wheel-state.ts";
import { type Color } from "../color/color.ts";
import { colorAreaInputStyle } from "../color-area/behaviour.tsx";

export interface AriaColorWheelProps extends ColorWheelProps {
  /** The element's unique identifier. */
  id?: string;
  /** The name of the input element, used when submitting an HTML form. */
  name?: string;
  /** The `<form>` element to associate the input with (id of a `<form>` in the same document). */
  form?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  "aria-errormessage"?: string;
}

export interface AriaColorWheelOptions extends AriaColorWheelProps {
  /** The outer radius of the color wheel. */
  outerRadius: number;
  /** The inner radius of the color wheel. */
  innerRadius: number;
}

interface MoveState {
  didMove: boolean;
  lastPosition: { pageX: number; pageY: number } | null;
  id: number | null;
}

/** Rivet: the hook's `useRef` values (JSON, resumable). */
export interface ColorWheelInteraction {
  readonly refs: {
    /** `currentPosition` ref. */
    position: { x: number; y: number } | null;
    /** `currentPointer` ref: `active` false = `undefined` upstream. */
    pointer: { active: boolean; id: number | null };
    /** `isOnTrack` ref. */
    onTrack: boolean;
    moveThumb: MoveState;
    moveTrack: MoveState;
    formReset: boolean;
  };
}

/** Rivet options of the free functions: hook props + refs + render-time locale. */
export interface ColorWheelAriaOptions extends Omit<AriaColorWheelOptions, "isDisabled"> {
  /** Whether the color wheel is disabled: a value, or an accessor that stays live (live props P5; handlers read it at event time). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** The visually hidden range input (`inputRef`). */
  inputRef: () => HTMLInputElement | undefined;
  /** Rivet: locale (`useLocale().locale`, resolved at render). */
  locale: string;
  /** Rivet: the hook-local state (`createColorWheelInteraction()`). */
  interaction: ColorWheelInteraction;
}

export interface ColorWheelAria {
  /** Props for the track element. */
  trackProps: Record<string, unknown>;
  /** Props for the thumb element. */
  thumbProps: Record<string, unknown>;
  /** Props for the visually hidden range input element. */
  inputProps: Record<string, unknown>;
}

const newMove = (): MoveState => ({ didMove: false, lastPosition: null, id: null });

/** Rivet: the hook-local state of one color wheel. */
export function createColorWheelInteraction(): ColorWheelInteraction {
  return { refs: { position: null, pointer: { active: false, id: null }, onTrack: false, moveThumb: newMove(), moveTrack: newMove(), formReset: false } };
}

const thumbRadius = (props: Omit<AriaColorWheelOptions, "isDisabled">): number => (props.innerRadius + props.outerRadius) / 2;

function focusInput(props: ColorWheelAriaOptions): void {
  const input = props.inputRef();
  if (input) focusWithoutScrolling(input);
}

// moveHandler
function moveStart(props: ColorWheelAriaOptions, state: ColorWheelState): void {
  props.interaction.refs.position = null;
  setColorWheelDragging(state, true);
}

function moveMove(props: ColorWheelAriaOptions, state: ColorWheelState, { deltaX, deltaY, pointerType, shiftKey }: MoveMoveEvent): void {
  const refs = props.interaction.refs;
  const radius = thumbRadius(props);
  if (refs.position == null) {
    refs.position = untrack(() => getColorWheelThumbPosition(state, radius));
  }
  refs.position.x += deltaX;
  refs.position.y += deltaY;
  if (pointerType === "keyboard") {
    if (deltaX > 0 || deltaY < 0) {
      incrementHue(state, shiftKey ? state.pageStep : state.step);
    } else if (deltaX < 0 || deltaY > 0) {
      decrementHue(state, shiftKey ? state.pageStep : state.step);
    }
  } else {
    setHueFromPoint(state, refs.position.x, refs.position.y, radius);
  }
}

function moveEnd(props: ColorWheelAriaOptions, state: ColorWheelState): void {
  props.interaction.refs.onTrack = false;
  setColorWheelDragging(state, false);
  focusInput(props);
}

function thumbMove(props: ColorWheelAriaOptions, state: ColorWheelState) {
  return {
    props: { onMoveStart: () => moveStart(props, state), onMove: (e: MoveMoveEvent) => moveMove(props, state, e), onMoveEnd: () => moveEnd(props, state) },
    state: props.interaction.refs.moveThumb,
  };
}

function trackMove(props: ColorWheelAriaOptions, state: ColorWheelState) {
  const refs = props.interaction.refs;
  return {
    props: {
      onMoveStart: () => {
        if (refs.onTrack) moveStart(props, state);
      },
      onMove: (e: MoveMoveEvent) => {
        if (refs.onTrack) moveMove(props, state, e);
      },
      onMoveEnd: () => {
        if (refs.onTrack) moveEnd(props, state);
      },
    },
    state: refs.moveTrack,
  };
}

// Global `pointerup` listener (useGlobalListeners), one per wheel.
const upListeners = new WeakMap<ColorWheelInteraction, { listener: (e: PointerEvent) => void; win: Window }>();

function addUp(props: ColorWheelAriaOptions, state: ColorWheelState, kind: "thumb" | "track"): void {
  const listener = (e: PointerEvent) => (kind === "thumb" ? onThumbUp(props, state, e) : onTrackUp(props, state, e));
  // The element's window (no bare `window`: this module is resume-compiled, server-checked).
  const win = getOwnerWindow(props.inputRef());
  upListeners.set(props.interaction, { listener, win });
  win.addEventListener("pointerup", listener, false);
}

function removeUp(props: ColorWheelAriaOptions): void {
  const entry = upListeners.get(props.interaction);
  if (entry) entry.win.removeEventListener("pointerup", entry.listener, false);
  upListeners.delete(props.interaction);
}

function onThumbDown(props: ColorWheelAriaOptions, state: ColorWheelState, id: number | null): void {
  if (!untrack(() => state.dragging())) {
    props.interaction.refs.pointer = { active: true, id };
    focusInput(props);
    setColorWheelDragging(state, true);
    addUp(props, state, "thumb");
  }
}

function onThumbUp(props: ColorWheelAriaOptions, state: ColorWheelState, e: PointerEvent): void {
  const refs = props.interaction.refs;
  if (refs.pointer.active && e.pointerId === refs.pointer.id) {
    focusInput(props);
    setColorWheelDragging(state, false);
    refs.pointer = { active: false, id: null };
    refs.onTrack = false;
    removeUp(props);
  }
}

function onTrackDown(props: ColorWheelAriaOptions, state: ColorWheelState, track: Element, id: number | null, pageX: number, pageY: number): void {
  const refs = props.interaction.refs;
  const rect = track.getBoundingClientRect();
  const x = pageX - rect.x - rect.width / 2;
  const y = pageY - rect.y - rect.height / 2;
  const radius = Math.sqrt(x * x + y * y);
  if (props.innerRadius < radius && radius < props.outerRadius && !untrack(() => state.dragging()) && !refs.pointer.active) {
    refs.onTrack = true;
    refs.pointer = { active: true, id };
    setHueFromPoint(state, x, y, radius);

    focusInput(props);
    setColorWheelDragging(state, true);
    addUp(props, state, "track");
  }
}

function onTrackUp(props: ColorWheelAriaOptions, state: ColorWheelState, e: PointerEvent): void {
  const refs = props.interaction.refs;
  if (refs.onTrack && refs.pointer.active && e.pointerId === refs.pointer.id) {
    refs.onTrack = false;
    refs.pointer = { active: false, id: null };
    setColorWheelDragging(state, false);
    focusInput(props);
    removeUp(props);
  }
}

const ignoredButton = (e: PointerEvent): boolean => e.pointerType === "mouse" && (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey);

/** Track `pointerdown` (RA trackInteractions: track down + track useMove). No-op when disabled. */
export function colorWheelTrackPointerDown(e: PointerEvent, props: ColorWheelAriaOptions, state: ColorWheelState): void {
  if (read(props.isDisabled)) return;
  if (!ignoredButton(e)) onTrackDown(props, state, e.currentTarget as Element, e.pointerId, e.clientX, e.clientY);
  movePointerDown(trackMove(props, state), e);
}

/** Thumb `pointerdown` (RA thumbInteractions: thumb down + thumb useMove). No-op when disabled. */
export function colorWheelThumbPointerDown(e: PointerEvent, props: ColorWheelAriaOptions, state: ColorWheelState): void {
  if (read(props.isDisabled)) return;
  if (!ignoredButton(e)) onThumbDown(props, state, e.pointerId);
  movePointerDown(thumbMove(props, state), e);
}

/** Keys `colorWheelThumbKeyDown` handles (thumb `data-rk`: held while a cold chunk loads). */
export const COLOR_WHEEL_KEYS = "ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown";

/** Thumb `keydown` (RA useKeyboard shortcuts PageUp / PageDown + useMove arrow keys). */
export function colorWheelThumbKeyDown(e: KeyboardEvent, props: ColorWheelAriaOptions, state: ColorWheelState): void {
  if (read(props.isDisabled)) return;
  keyboardKeyDown(
    {
      shortcuts: {
        PageUp: () => {
          setColorWheelDragging(state, true);
          incrementHue(state, state.pageStep);
          setColorWheelDragging(state, false);
        },
        PageDown: () => {
          setColorWheelDragging(state, true);
          decrementHue(state, state.pageStep);
          setColorWheelDragging(state, false);
        },
      },
      allowRepeats: true,
    },
    e,
  );
  moveKeyDown(thumbMove(props, state), e);
}

/** Input `change`. */
export function colorWheelInputChange(e: Event, _props: ColorWheelAriaOptions, state: ColorWheelState): void {
  setHue(state, parseFloat((e.target as HTMLInputElement).value));
}

/** Rivet: input `focus` installs `useFormReset` once. */
export function colorWheelInputFocus(_e: FocusEvent, props: ColorWheelAriaOptions, state: ColorWheelState): void {
  if (props.interaction.refs.formReset) return;
  props.interaction.refs.formReset = true;
  const defaultValue = untrack(() => colorWheelDefaultValue(state));
  useFormReset(props.inputRef(), defaultValue, (value: Color) => setColorWheelValue(state, value));
}

// Creates an SVG path string for a circle.
function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx}, ${cy} m ${-r}, 0 a ${r}, ${r}, 0, 1, 0, ${r * 2}, 0 a ${r}, ${r}, 0, 1, 0 ${-r * 2}, 0`;
}

/** Track style: size, conic hue gradient, ring clip path. */
export function colorWheelTrackStyle(props: Omit<AriaColorWheelOptions, "isDisabled">): Record<string, string> {
  const { outerRadius, innerRadius } = props;
  return {
    position: "relative",
    touchAction: "none",
    width: `${outerRadius * 2}px`,
    height: `${outerRadius * 2}px`,
    background: `
          conic-gradient(
            from 90deg,
            hsl(0, 100%, 50%),
            hsl(30, 100%, 50%),
            hsl(60, 100%, 50%),
            hsl(90, 100%, 50%),
            hsl(120, 100%, 50%),
            hsl(150, 100%, 50%),
            hsl(180, 100%, 50%),
            hsl(210, 100%, 50%),
            hsl(240, 100%, 50%),
            hsl(270, 100%, 50%),
            hsl(300, 100%, 50%),
            hsl(330, 100%, 50%),
            hsl(360, 100%, 50%)
          )
        `,
    clipPath: `path(evenodd, "${circlePath(outerRadius, outerRadius, outerRadius)} ${circlePath(outerRadius, outerRadius, innerRadius)}")`,
    forcedColorAdjust: "none",
  };
}

/** Thumb style: absolute position on the ring (reads the state). */
export function colorWheelThumbStyle(props: Omit<AriaColorWheelOptions, "isDisabled">, state: ColorWheelState): Record<string, string> {
  const { x, y } = getColorWheelThumbPosition(state, thumbRadius(props));
  return {
    position: "absolute",
    left: (props.outerRadius + x).toFixed(3) + "px",
    top: (props.outerRadius + y).toFixed(3) + "px",
    transform: "translate(-50%, -50%)",
    touchAction: "none",
    forcedColorAdjust: "none",
  };
}

/** Input labelling (`useLabels`; default `aria-label` = the localized hue channel name). */
export function colorWheelInputLabels(
  props: ColorWheelAriaOptions,
  state: ColorWheelState,
): { id?: string; "aria-label"?: string; "aria-labelledby"?: string } {
  let ariaLabel = props["aria-label"];
  if (ariaLabel == null && props["aria-labelledby"] == null) {
    ariaLabel = untrack(() => colorWheelValue(state)).getChannelName("hue", props.locale);
  }
  return useLabels({ id: props.id, "aria-label": ariaLabel, "aria-labelledby": props["aria-labelledby"] });
}

/** Input range attributes (strings, as upstream). */
export function colorWheelInputRange(state: ColorWheelState): { min: string; max: string; step: string } {
  const { minValue, maxValue, step } = colorWheelValue(state).getChannelRange("hue");
  return { min: String(minValue), max: String(maxValue), step: String(step) };
}

/** Input `aria-valuetext` ("<hue>°, <hue name>"). */
export function colorWheelInputValueText(props: { locale: string }, state: ColorWheelState): string {
  const value = colorWheelValue(state);
  return `${value.formatChannelValue("hue", props.locale)}, ${value.getHueName(props.locale)}`;
}

/** Input value. */
export const colorWheelInputValue = (state: ColorWheelState): string => `${colorWheelValue(state).getChannelValue("hue")}`;

/** The visually hidden input style (same as the color area inputs). */
export const colorWheelInputStyle = colorAreaInputStyle;

/**
 * react-aria `useColorWheel`: the three attribute bags (values read now; handler closures not resumable —
 * components wire the exported handler functions from inline arrows instead).
 */
export function colorWheelProps(props: ColorWheelAriaOptions, state: ColorWheelState): ColorWheelAria {
  // Values read now; a live `isDisabled` (accessor) keeps the handlers (they check the current value).
  const isDisabled = typeof props.isDisabled !== "function" && !!props.isDisabled;
  const disabledNow = read(props.isDisabled);
  return {
    trackProps: {
      ...(isDisabled ? {} : { onPointerDown: (e: PointerEvent) => colorWheelTrackPointerDown(e, props, state) }),
      style: colorWheelTrackStyle(props),
    },
    thumbProps: {
      ...(isDisabled
        ? {}
        : {
            onPointerDown: (e: PointerEvent) => colorWheelThumbPointerDown(e, props, state),
            onKeyDown: (e: KeyboardEvent) => colorWheelThumbKeyDown(e, props, state),
          }),
      style: colorWheelThumbStyle(props, state),
    },
    inputProps: {
      ...colorWheelInputLabels(props, state),
      type: "range",
      ...colorWheelInputRange(state),
      "aria-valuetext": colorWheelInputValueText(props, state),
      disabled: disabledNow,
      value: colorWheelInputValue(state),
      name: props.name,
      form: props.form,
      onChange: (e: Event) => colorWheelInputChange(e, props, state),
      onFocus: (e: FocusEvent) => colorWheelInputFocus(e, props, state),
      style: colorWheelInputStyle,
      "aria-errormessage": props["aria-errormessage"],
      "aria-describedby": props["aria-describedby"],
      "aria-details": props["aria-details"],
    },
  };
}
