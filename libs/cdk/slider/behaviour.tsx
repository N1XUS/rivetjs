// Ported from react-aria `useSlider`, `useSliderThumb`, slider utils (packages/react-aria/src/slider/useSlider.ts,
// useSliderThumb.ts, utils.ts), Apache-2.0, © Adobe.
// Rivet:
// - `useSlider(props, state, trackRef)` → `sliderProps(props, state)` (`{ labelProps, groupProps, trackProps,
//   outputProps }`), `useSliderThumb(opts, state)` → `sliderThumbProps(opts, state)` (`{ thumbProps, inputProps,
//   labelProps, isDragging, isFocused, isDisabled }`): attribute bags, changing values as accessors (R2 functions:
//   this module is `.tsx`). RA's handlers are free functions `sliderTrack<Event>(event, props, state, track)` /
//   `sliderThumb<Event>(event, opts, state)`; the component binds them from inline arrows and feeds the move
//   callbacks (`sliderTrackMove*`, `sliderThumbMove*`) into `useMove` (`../interactions/move.tsx`).
// - `sliderData` (WeakMap keyed by the state) → `state.refs.data` (plain JSON on the state: survives resume).
// - React refs (`realTimeTrackDraggingIndex`, `currentPosition`, `currentPointer`) → `state.refs.track` /
//   `state.refs.thumbs[index]` (plain JSON, created on first use); global listeners live in a browser WeakMap.
// - `trackRef` / `inputRef` → the elements: track = the handler's `currentTarget` / `opts.trackRef()`; inputs are
//   found by their ids (`getSliderThumbId`).
// - The thumb's "focus the input when it becomes the focused thumb" effect runs where `setFocusedThumb` is called
//   (track press), not as an effect.
// - `setThumbEditable(index, !isDisabled)` ("immediately register editability") runs in `sliderThumbProps`.
// - Deviation (user decision 2026-10-08, `SliderProps.snap`, default `"release"`): pointer drags (thumb and
//   track) also record the free pointer position (`setThumbDragPercent`); the thumb style positions with
//   `getThumbPositionPercent` (the animated position while it snaps to the step after release: `Motion1D` in
//   `state.ts`, no CSS transition) and carries `data-snapping` meanwhile. Keyboard / programmatic changes are stepped.
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { untrack } from "@rivetjs/reactivity";
import { clamp } from "../utils/index.ts";
import { setInteractionModality } from "../interactions/focus-visible.tsx";
import { focusBlur, focusFocus } from "../interactions/focus.tsx";
import { keyboardKeyDown, keyboardKeyUp } from "../interactions/keyboard.tsx";
import type { MoveEndEvent, MoveMoveEvent, MoveStartEvent } from "../interactions/move.tsx";
import { focusWithoutScrolling, getEventTarget, getOwnerDocument, getOwnerWindow, read, type MaybeAccessor } from "../interactions/utils.ts";
import { labelProps as ariaLabelProps } from "../label/behaviour.ts";
import { onFormReset } from "../form/behaviour.ts";
import {
  decrementThumb,
  getPercentValue,
  getThumbMaxValue,
  getThumbMinValue,
  getThumbPercent,
  getThumbPositionPercent,
  getThumbValueLabel,
  incrementThumb,
  isThumbDragging,
  isThumbEditable,
  isSliderDisabled,
  isThumbSnapping,
  setFocusedThumb,
  setThumbDragPercent,
  setThumbDragging,
  setThumbEditable,
  setThumbPercent,
  setThumbValue,
  sliderOrientation,
  sliderPageSize,
  sliderStep,
  sliderValues,
  type Orientation,
  type SliderProps,
  type SliderState,
} from "./state.ts";

type Bag = Record<string, unknown>;

export interface AriaSliderProps<T = number | number[]> extends SliderProps<T> {
  id?: string;
  /** The content of the visible label (RA `label`; truthy = a label renders). */
  label?: unknown;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /** Rivet: text direction (RA `useLocale().direction`). */
  direction?: MaybeAccessor<"ltr" | "rtl" | undefined>;
}

export interface SliderAria {
  /** Props for the label element. */
  labelProps: Bag;
  /** Props for the root element of the slider component; groups slider inputs. */
  groupProps: Bag;
  /** Props for the track element. */
  trackProps: Bag;
  /** Props for the output element, displaying the value of the slider thumbs. */
  outputProps: Bag;
}

/** RA `sliderData` entry: the label id (thumb ids derive from it) and the slider's describedby / details. */
export interface SliderData {
  id: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
}

interface TrackDrag {
  /** RA `realTimeTrackDraggingIndex`. */
  index: number | null;
  /** RA `currentPosition`. */
  position: number | null;
  /** RA `currentPointer`. */
  pointer: number | null | undefined;
}

interface ThumbDrag {
  position: number | null;
  pointer: number | undefined;
}

type SliderRefs = SliderState["refs"] & { data?: SliderData; track?: TrackDrag; thumbs?: Record<number, ThumbDrag> };
const refs = (state: SliderState) => state.refs as SliderRefs;

const trackDrag = (state: SliderState): TrackDrag => (refs(state).track ??= { index: null, position: null, pointer: undefined });
const thumbDrag = (state: SliderState, index: number): ThumbDrag => ((refs(state).thumbs ??= {})[index] ??= { position: null, pointer: undefined });

export function getSliderThumbId(state: SliderState, index: number): string {
  const data = refs(state).data;
  if (!data) {
    throw new Error("Unknown slider state");
  }

  return `${data.id}-${index}`;
}

// Browser-only: the window listeners of a pending track / thumb press (RA useGlobalListeners).
const listeners = new WeakMap<object, (() => void)[]>();
function addGlobalListeners(owner: object, win: Window, onUp: (e: Event) => void): void {
  const list = listeners.get(owner) ?? [];
  listeners.set(owner, list);
  for (const type of ["mouseup", "touchend", "pointerup"]) {
    win.addEventListener(type, onUp, false);
    list.push(() => win.removeEventListener(type, onUp, false));
  }
}
function removeGlobalListeners(owner: object): void {
  for (const remove of listeners.get(owner)?.splice(0) ?? []) remove();
}

// A part's own `orientation` (value or live accessor) wins over the slider's (live: read now).
const isVertical = (state: SliderState, orientation?: MaybeAccessor<Orientation | undefined>) => (read(orientation) ?? sliderOrientation(state)) === "vertical";

/** `aria-orientation` of a thumb input: its own value, else the slider's (a returned arrow when the slider's is live). */
function orientationAttr(own: Orientation | undefined, state: SliderState): Orientation | (() => Orientation) {
  if (own) return own;
  return state.live?.orientation ? liveOrientation(state) : state.orientation;
}
function liveOrientation(state: SliderState): () => Orientation {
  return () => sliderOrientation(state);
}
/** The thumb input's `step`: the value, or a returned arrow when the slider's `step` is live. */
function stepAttr(state: SliderState): number | (() => number) {
  return state.live?.step ? liveStep(state) : state.step;
}
function liveStep(state: SliderState): () => number {
  return () => sliderStep(state);
}

/**
 * Provides the behavior and accessibility implementation for a slider component representing one or
 * more values (RA `useSlider`). The track element (handler `currentTarget`) provides the "length" of the
 * track and accepts click and drag motions: the closest thumb follows them.
 */
export function sliderProps<T extends number | number[]>(props: AriaSliderProps<T>, state: SliderState): SliderAria {
  const { labelProps, fieldProps } = ariaLabelProps(props);

  // Attach id of the label to the state so it can be accessed by the thumbs.
  refs(state).data = {
    id: (labelProps.id ?? fieldProps.id)!,
    "aria-describedby": props["aria-describedby"],
    "aria-details": props["aria-details"],
  };

  let label: Bag = labelProps;
  if (labelProps.for) {
    // Ideally the `for` attribute should point to the first thumb, but VoiceOver on iOS
    // causes this to override the `aria-labelledby` on the thumb. This causes the first
    // thumb to only be announced as the slider label rather than its individual name as well.
    // See https://bugs.webkit.org/show_bug.cgi?id=172464.
    // Rivet: the handler is an inline arrow of an object literal (resumable; a closure assigned afterwards is not).
    const { for: _for, ...rest } = labelProps;
    label = { ...rest, onClick: (e: MouseEvent) => sliderLabelClick(e, state) };
  }

  return {
    labelProps: label,
    // The root element of the Slider will have role="group" to group together
    // all the thumb inputs in the Slider.  The label of the Slider will
    // be used to label the group.
    groupProps: {
      role: "group",
      ...fieldProps,
    },
    trackProps: {
      style: { position: "relative", touchAction: "none" },
    },
    outputProps: {
      for: () =>
        sliderValues(state)
          .map((_, index) => getSliderThumbId(state, index))
          .join(" "),
      "aria-live": "off",
    },
  };
}

/** RA label `onClick`: Safari does not focus `<input type="range">` on a label click; focus the first thumb (focus ring shown). */
export function sliderLabelClick(event: MouseEvent, state: SliderState): void {
  (getOwnerDocument(getEventTarget(event)).getElementById(getSliderThumbId(state, 0)) as HTMLElement | null)?.focus();
  setInteractionModality("keyboard");
}

function focusThumb(state: SliderState, index: number, from: EventTarget | null): void {
  const input = getOwnerDocument(from).getElementById(getSliderThumbId(state, index)) as HTMLElement | null;
  if (input) focusWithoutScrolling(input);
}

function onDownTrack(
  e: Event,
  props: AriaSliderProps<any>,
  state: SliderState,
  track: Element,
  id: number | undefined,
  clientX: number,
  clientY: number,
): void {
  // We only trigger track-dragging if the user clicks on the track itself and nothing is currently being dragged.
  const values = untrack(() => sliderValues(state));
  if (track && !isSliderDisabled(state) && values.every((_, i) => !untrack(() => isThumbDragging(state, i)))) {
    const vertical = isVertical(state, props.orientation);
    const { height, width, top, left } = track.getBoundingClientRect();
    const size = vertical ? height : width;
    // Find the closest thumb
    const trackPosition = vertical ? top : left;
    const clickPosition = vertical ? clientY : clientX;
    const offset = clickPosition - trackPosition;
    let percent = offset / size;
    if (read(props.direction) === "rtl" || vertical) {
      percent = 1 - percent;
    }
    const value = getPercentValue(state, percent);

    // to find the closet thumb we split the array based on the first thumb position to the "right/end" of the click.
    let closestThumb;
    const split = values.findIndex((v) => value - v < 0);
    if (split === 0) {
      // If the index is zero then the closetThumb is the first one
      closestThumb = split;
    } else if (split === -1) {
      // If no index is found they've clicked past all the thumbs
      closestThumb = values.length - 1;
    } else {
      const lastLeft = values[split - 1]!;
      const firstRight = values[split]!;
      // Pick the last left/start thumb, unless they are stacked on top of each other, then pick the right/end one
      if (Math.abs(lastLeft - value) < Math.abs(firstRight - value)) {
        closestThumb = split - 1;
      } else {
        closestThumb = split;
      }
    }

    const drag = trackDrag(state);
    // Confirm that the found closest thumb is editable, not disabled, and move it
    if (closestThumb >= 0 && isThumbEditable(state, closestThumb)) {
      // Don't unfocus anything
      e.preventDefault();

      drag.index = closestThumb;
      setFocusedThumb(state, closestThumb);
      // RA useSliderThumb effect: the focused thumb focuses its input.
      focusThumb(state, closestThumb, track);
      drag.pointer = id;

      setThumbDragging(state, drag.index, true);
      setThumbValue(state, closestThumb, value);
      // Rivet (snap: "release"): the thumb jumps to the pointer, not to the step.
      setThumbDragPercent(state, closestThumb, clamp(percent, 0, 1));

      removeGlobalListeners(drag);
      addGlobalListeners(drag, getOwnerWindow(track), (event) => onUpTrack(event, state));
    } else {
      drag.index = null;
    }
  }
}

function onUpTrack(e: Event, state: SliderState): void {
  const drag = trackDrag(state);
  const id = (e as PointerEvent).pointerId ?? (e as TouchEvent).changedTouches?.[0]!.identifier;
  if (id === drag.pointer) {
    if (drag.index != null) {
      setThumbDragging(state, drag.index, false);
      drag.index = null;
    }
    removeGlobalListeners(drag);
  }
}

/** RA track `onMouseDown`. */
export function sliderTrackMouseDown(e: MouseEvent, props: AriaSliderProps<any>, state: SliderState, track: Element): void {
  if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey) {
    return;
  }
  onDownTrack(e, props, state, track, undefined, e.clientX, e.clientY);
}

/** RA track `onPointerDown`. */
export function sliderTrackPointerDown(e: PointerEvent, props: AriaSliderProps<any>, state: SliderState, track: Element): void {
  if (e.pointerType === "mouse" && (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey)) {
    return;
  }
  onDownTrack(e, props, state, track, e.pointerId, e.clientX, e.clientY);
}

/** RA track `onTouchStart`. */
export function sliderTrackTouchStart(e: TouchEvent, props: AriaSliderProps<any>, state: SliderState, track: Element): void {
  onDownTrack(e, props, state, track, e.changedTouches[0]!.identifier, e.changedTouches[0]!.clientX, e.changedTouches[0]!.clientY);
}

/** RA track useMove `onMoveStart`. */
export function sliderTrackMoveStart(_e: MoveStartEvent, state: SliderState): void {
  trackDrag(state).position = null;
}

/** RA track useMove `onMove`. */
export function sliderTrackMove({ deltaX, deltaY }: MoveMoveEvent, props: AriaSliderProps<any>, state: SliderState, track: Element | null): void {
  if (!track) {
    return;
  }
  const drag = trackDrag(state);
  const vertical = isVertical(state, props.orientation);
  const { height, width } = track.getBoundingClientRect();
  const size = vertical ? height : width;

  if (drag.position == null && drag.index != null) {
    // Rivet: from the free position (track press with snap: "release"), else the stepped one (upstream).
    drag.position = untrack(() => getThumbPositionPercent(state, drag.index!)) * size;
  }

  let delta = vertical ? deltaY : deltaX;
  if (vertical || read(props.direction) === "rtl") {
    delta = -delta;
  }

  drag.position = (drag.position ?? 0) + delta;

  if (drag.index != null) {
    const percent = clamp(drag.position / size, 0, 1);
    setThumbPercent(state, drag.index, percent);
    setThumbDragPercent(state, drag.index, percent);
  }
}

/** RA track useMove `onMoveEnd`. */
export function sliderTrackMoveEnd(_e: MoveEndEvent, state: SliderState): void {
  const drag = trackDrag(state);
  if (drag.index != null) {
    setThumbDragging(state, drag.index, false);
    drag.index = null;
  }
}

// ---- useSliderThumb ----

export interface AriaSliderThumbProps {
  /**
   * The orientation of the Slider.
   *
   * @deprecated - pass to the slider instead.
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /** Whether the Thumb is disabled (a value, or an accessor that stays live). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /**
   * Index of the thumb within the slider.
   *
   * @default 0
   */
  index?: number;
  /** @deprecated */
  isRequired?: boolean;
  /** @deprecated */
  isInvalid?: boolean;
  /** @deprecated */
  validationState?: "valid" | "invalid";
  /** The content of the thumb's visible label (truthy = a label renders). */
  label?: unknown;
  /** Whether the element should receive focus on render. */
  autoFocus?: boolean;
  name?: string;
  form?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  "aria-errormessage"?: string;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
  /** Rivet: text direction (RA `useLocale().direction`). */
  direction?: MaybeAccessor<"ltr" | "rtl" | undefined>;
}

export interface AriaSliderThumbOptions extends AriaSliderThumbProps {
  /** The track element (RA `trackRef`). */
  trackRef: () => Element | null | undefined;
  /** The thumb's input element (RA `inputRef`); default: found by id. */
  inputRef?: () => HTMLInputElement | null | undefined;
}

export interface SliderThumbAria {
  /** Props for the root thumb element; handles the dragging motion. */
  thumbProps: Bag;
  /** Props for the visually hidden range input element. */
  inputProps: Bag;
  /** Props for the label element for this thumb (optional). */
  labelProps: Bag;
  /** Whether this thumb is currently being dragged. */
  isDragging: () => boolean;
  /** Whether the thumb is currently focused. */
  isFocused: () => boolean;
  /** Whether the thumb is disabled (at creation; `isSliderThumbDisabled(opts, state)` reads the current value). */
  isDisabled: boolean;
}

/** `data-rk` of the thumb input: every key `sliderThumbKeyDown` / the keyboard `useMove` handles. */
const THUMB_KEYS = "ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown Home End";
const thumbIndex = (opts: AriaSliderThumbOptions) => opts.index ?? 0;
const thumbDisabled = (opts: AriaSliderThumbOptions, state: SliderState) => !!read(opts.isDisabled) || isSliderDisabled(state);
/** Whether the thumb is disabled now (its own or the slider's `isDisabled`, live accessors read). */
export const isSliderThumbDisabled = thumbDisabled;
/** Whether the thumb's / slider's `isDisabled` is a live accessor (live props P5): the bags then hold accessors. */
const liveDisabled = (opts: AriaSliderThumbOptions, state: SliderState) => typeof opts.isDisabled === "function" || !!state.disabled;

// Returned arrows (resumable symbols): an arrow inside a conditional expression is not R2-wrapped.
/** `enabled` while the thumb is enabled, else `undefined` (live `isDisabled`). */
function liveThumbAttr<V>(opts: AriaSliderThumbOptions, state: SliderState, enabled: V): () => V | undefined {
  return () => (thumbDisabled(opts, state) ? undefined : enabled);
}
/** `true` while the thumb is disabled, else `undefined` (live `isDisabled`). */
function liveThumbDisabledAttr(opts: AriaSliderThumbOptions, state: SliderState): () => true | undefined {
  return () => thumbDisabled(opts, state) || undefined;
}

/** Provides behavior and accessibility for a thumb of a slider component (RA `useSliderThumb`). */
export function sliderThumbProps(opts: AriaSliderThumbOptions, state: SliderState): SliderThumbAria {
  const index = thumbIndex(opts);
  const { isRequired, validationState, isInvalid, name, form } = opts;
  const ownOrientation = opts.orientation;
  const isDisabled = untrack(() => thumbDisabled(opts, state));
  const live = liveDisabled(opts, state);
  const data = refs(state).data!;
  const { labelProps, fieldProps } = ariaLabelProps({
    ...opts,
    id: getSliderThumbId(state, index),
    "aria-labelledby": `${data.id} ${opts["aria-labelledby"] ?? ""}`.trim(),
  });

  // Immediately register editability with the state (Rivet: a live `isDisabled` keeps the thumb editable and
  // the handlers / state setters check the current value instead).
  setThumbEditable(state, index, live || !isDisabled);

  const describedBy = [data["aria-describedby"], opts["aria-describedby"]].filter(Boolean).join(" ");
  const details = [data["aria-details"], opts["aria-details"]].filter(Boolean).join(" ");
  // We install mouse handlers for the drag motion on the thumb div, but
  // not the key handler for moving the thumb with the slider.  Instead,
  // we focus the range input, and let the browser handle the keyboard
  // interactions; we then listen to input's onChange to update state.
  return {
    inputProps: {
      ...fieldProps,
      type: "range",
      tabIndex: live ? liveThumbAttr(opts, state, 0) : !isDisabled ? 0 : undefined,
      min: () => getThumbMinValue(state, index),
      max: () => getThumbMaxValue(state, index),
      step: stepAttr(state),
      value: () => sliderValues(state)[index],
      name,
      form,
      disabled: live ? liveThumbDisabledAttr(opts, state) : isDisabled || undefined,
      autoFocus: opts.autoFocus,
      "aria-orientation": orientationAttr(ownOrientation, state),
      // Rivet: keys the thumb handles (shortcuts + useMove arrows): a cold keydown on a resumed page
      // keeps them from the native range input (which would move by its own page size) while the chunk loads.
      "data-rk": live ? liveThumbAttr(opts, state, THUMB_KEYS) : isDisabled ? undefined : THUMB_KEYS,
      "aria-valuetext": () => getThumbValueLabel(state, index),
      "aria-required": isRequired || undefined,
      "aria-invalid": isInvalid || validationState === "invalid" || undefined,
      "aria-errormessage": opts["aria-errormessage"],
      "aria-describedby": describedBy || undefined,
      "aria-details": details || undefined,
    },
    thumbProps: {
      style: () => {
        // Rivet: the free drag position with snap: "release" (= the stepped percent otherwise).
        let thumbPosition = getThumbPositionPercent(state, index);
        const vertical = isVertical(state, ownOrientation);
        if (vertical || read(opts.direction) === "rtl") {
          thumbPosition = 1 - thumbPosition;
        }
        return {
          position: "absolute",
          [vertical ? "top" : "left"]: `${thumbPosition * 100}%`,
          transform: "translate(-50%, -50%)",
          touchAction: "none",
        };
      },
      "data-snapping": () => isThumbSnapping(state, index) || undefined,
    },
    labelProps: { ...labelProps },
    isDragging: () => isThumbDragging(state, index),
    isDisabled,
    isFocused: () => state.focusedThumb() === index,
  };
}

function thumbInput(opts: AriaSliderThumbOptions, state: SliderState, from: EventTarget | null): HTMLInputElement | null {
  return opts.inputRef?.() ?? (getOwnerDocument(from).getElementById(getSliderThumbId(state, thumbIndex(opts))) as HTMLInputElement | null);
}

function focusInput(opts: AriaSliderThumbOptions, state: SliderState, from: EventTarget | null): void {
  const input = thumbInput(opts, state, from);
  if (input) focusWithoutScrolling(input);
}

/** keydown of the thumb (RA useKeyboard shortcuts PageUp / PageDown / Home / End; arrows go through useMove). */
export function sliderThumbKeyDown(e: KeyboardEvent, opts: AriaSliderThumbOptions, state: SliderState): void {
  if (thumbDisabled(opts, state)) return;
  const index = thumbIndex(opts);
  const keyboardUpdate = (cb: () => void) => {
    // remember to set this so that onChangeEnd is fired
    setThumbDragging(state, index, true);
    cb();
    setThumbDragging(state, index, false);
  };
  keyboardKeyDown(
    {
      shortcuts: {
        PageUp: () =>
          keyboardUpdate(() =>
            incrementThumb(
              state,
              index,
              untrack(() => sliderPageSize(state)),
            ),
          ),
        PageDown: () =>
          keyboardUpdate(() =>
            decrementThumb(
              state,
              index,
              untrack(() => sliderPageSize(state)),
            ),
          ),
        Home: () =>
          keyboardUpdate(() =>
            setThumbValue(
              state,
              index,
              untrack(() => getThumbMinValue(state, index)),
            ),
          ),
        End: () =>
          keyboardUpdate(() =>
            setThumbValue(
              state,
              index,
              untrack(() => getThumbMaxValue(state, index)),
            ),
          ),
      },
      allowRepeats: true,
    },
    e,
  );
}

/** RA thumb useMove `onMoveStart`. */
export function sliderThumbMoveStart(_e: MoveStartEvent, opts: AriaSliderThumbOptions, state: SliderState): void {
  if (thumbDisabled(opts, state)) return;
  const index = thumbIndex(opts);
  thumbDrag(state, index).position = null;
  setThumbDragging(state, index, true);
}

/** RA thumb useMove `onMove` (pointer drag, or arrow keys with `pointerType: 'keyboard'`). */
export function sliderThumbMove({ deltaX, deltaY, pointerType, shiftKey }: MoveMoveEvent, opts: AriaSliderThumbOptions, state: SliderState): void {
  const index = thumbIndex(opts);
  const track = opts.trackRef();
  if (!track) {
    return;
  }
  const vertical = untrack(() => isVertical(state, opts.orientation));
  const reverseX = read(opts.direction) === "rtl";
  const drag = thumbDrag(state, index);
  const { width, height } = track.getBoundingClientRect();
  const size = vertical ? height : width;

  if (drag.position == null) {
    drag.position = untrack(() => getThumbPercent(state, index)) * size;
  }
  if (pointerType === "keyboard") {
    if ((deltaX > 0 && reverseX) || (deltaX < 0 && !reverseX) || deltaY > 0) {
      decrementThumb(
        state,
        index,
        untrack(() => (shiftKey ? sliderPageSize(state) : sliderStep(state))),
      );
    } else {
      incrementThumb(
        state,
        index,
        untrack(() => (shiftKey ? sliderPageSize(state) : sliderStep(state))),
      );
    }
  } else {
    let delta = vertical ? deltaY : deltaX;
    if (vertical || reverseX) {
      delta = -delta;
    }

    drag.position += delta;
    const percent = clamp(drag.position / size, 0, 1);
    setThumbPercent(state, index, percent);
    setThumbDragPercent(state, index, percent);
  }
}

/** RA thumb useMove `onMoveEnd`. */
export function sliderThumbMoveEnd(_e: MoveEndEvent, opts: AriaSliderThumbOptions, state: SliderState): void {
  setThumbDragging(state, thumbIndex(opts), false);
}

function onDown(e: Event, opts: AriaSliderThumbOptions, state: SliderState, id?: number): void {
  const index = thumbIndex(opts);
  const thumb = e.currentTarget as Element;
  focusInput(opts, state, thumb);
  const drag = thumbDrag(state, index);
  drag.pointer = id;
  setThumbDragging(state, index, true);

  removeGlobalListeners(drag);
  addGlobalListeners(drag, getOwnerWindow(thumb), (event) => {
    const pointer = (event as PointerEvent).pointerId ?? (event as TouchEvent).changedTouches?.[0]!.identifier;
    if (pointer === drag.pointer) {
      focusInput(opts, state, thumb);
      setThumbDragging(state, index, false);
      removeGlobalListeners(drag);
    }
  });
}

/** RA thumb `onMouseDown`. */
export function sliderThumbMouseDown(e: MouseEvent, opts: AriaSliderThumbOptions, state: SliderState): void {
  if (thumbDisabled(opts, state)) return;
  if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey) {
    return;
  }
  onDown(e, opts, state);
}

/** RA thumb `onPointerDown`. */
export function sliderThumbPointerDown(e: PointerEvent, opts: AriaSliderThumbOptions, state: SliderState): void {
  if (thumbDisabled(opts, state)) return;
  if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey) {
    return;
  }
  onDown(e, opts, state, e.pointerId);
}

/** RA thumb `onTouchStart`. */
export function sliderThumbTouchStart(e: TouchEvent, opts: AriaSliderThumbOptions, state: SliderState): void {
  if (thumbDisabled(opts, state)) return;
  onDown(e, opts, state, e.changedTouches[0]!.identifier);
}

/** `change` / `input` of the range input: the browser moved the value (keyboard, assistive technology). */
export function sliderThumbInputChange(e: Event, opts: AriaSliderThumbOptions, state: SliderState): void {
  const input = getEventTarget(e) as HTMLInputElement;
  // RA useFormReset(inputRef, state.defaultValues[index], v => state.setThumbValue(index, v))
  const index = thumbIndex(opts);
  onFormReset(state.refs, input, () => setThumbValue(state, index, state.defaultValues[index]!));
  setThumbValue(state, index, parseFloat(input.value));
  // React re-renders the controlled range input with the snapped value.
  const value = String(untrack(() => sliderValues(state))[index]);
  if (input.value !== value) input.value = value;
}

/** focus of the range input (RA useFocusable: `setFocusedThumb(index)` + user focus events). */
export function sliderThumbFocus(e: FocusEvent, opts: AriaSliderThumbOptions, state: SliderState): void {
  focusFocus({ onFocus: (event) => (setFocusedThumb(state, thumbIndex(opts)), opts.onFocus?.(event)), onFocusChange: opts.onFocusChange }, e);
}

/** blur of the range input. */
export function sliderThumbBlur(e: FocusEvent, opts: AriaSliderThumbOptions, state: SliderState): void {
  focusBlur({ onBlur: (event) => (setFocusedThumb(state, undefined), opts.onBlur?.(event)), onFocusChange: opts.onFocusChange }, e);
}

/** keydown / keyup of the range input (RA useFocusable → useKeyboard with the user's handlers). */
export function sliderThumbInputKeyDown(e: KeyboardEvent, opts: AriaSliderThumbOptions, _state: SliderState): void {
  if (opts.onKeyDown) keyboardKeyDown({ onKeyDown: opts.onKeyDown }, e);
}
export function sliderThumbInputKeyUp(e: KeyboardEvent, opts: AriaSliderThumbOptions, _state: SliderState): void {
  if (opts.onKeyUp) keyboardKeyUp({ onKeyUp: opts.onKeyUp }, e);
}
