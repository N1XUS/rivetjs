// Ported from react-aria `useColorSlider` (packages/react-aria/src/color/useColorSlider.ts), Apache-2.0, © Adobe.
// Rivet:
// - `useColorSlider(opts, state)` → `colorSliderProps(opts, state)`: RA's bags (`trackProps`, `thumbProps`,
//   `inputProps`, `labelProps`, `outputProps`) over `sliderProps` / `sliderThumbProps` (`../slider/behaviour.tsx`)
//   with the transient `sliderView(state)` (`@rivetjs/cdk/color`; upstream spreads useSliderState into the color
//   slider state). Bags read the state when built (custom markup: build them inside a binding); the component binds
//   the parts below (`colorSliderTrackStyle`, `colorSliderThumbStyle`, `colorSliderInputValueText`, …) as accessors.
// - RA's handlers (useSlider track: mouse / pointer / touch down + useMove; useSliderThumb thumb: useKeyboard +
//   useMove + down handlers; input change / focus / blur) are free functions `colorSlider<Part><Event>(e, opts,
//   state)` building `sliderView(state)` inside (this module is `.tsx`: resumable); the useMove bookkeeping is JSON in
//   `opts.interaction` (`createColorSliderInteraction()`).
// - `trackRef` / `inputRef` are accessors (`ref()` from `@rivetjs/runtime/dom`).
// - `inputProps['aria-valuetext'] += …` → `colorSliderInputValueText` (channel value + hue / color name).
// - Deviation (`ColorSliderProps.snap`, default `"release"`, the Slider decision): the thumb follows the pointer freely
//   and animates to the channel step on release (`getThumbPositionPercent`, `Motion1D` in `../slider/state.ts`).
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

import { getDisplayColor, getThumbValueLabel, getValue, sliderView, type ColorSliderProps, type ColorSliderState } from "@rivetjs/cdk/color";
import { getThumbMaxValue, getThumbMinValue, getThumbPositionPercent } from "../slider/state.ts";
import {
  sliderProps,
  sliderThumbBlur,
  sliderThumbFocus,
  sliderThumbInputChange,
  sliderThumbKeyDown,
  sliderThumbMove,
  sliderThumbMoveEnd,
  sliderThumbMoveStart,
  sliderThumbPointerDown,
  sliderThumbProps,
  sliderTrackMove,
  sliderTrackMoveEnd,
  sliderTrackMoveStart,
  sliderTrackPointerDown,
  type AriaSliderThumbOptions,
} from "../slider/behaviour.tsx";
import { moveKeyDown, movePointerDown, type MoveMoveEvent } from "../interactions/move.tsx";
import { colorAreaInputStyle } from "../color-area/behaviour.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";

type Bag = Record<string, unknown>;

export interface AriaColorSliderProps extends ColorSliderProps {
  id?: string;
  /** The content of the visible label (RA `label`; truthy = a label renders). */
  label?: unknown;
  /** The name of the input element, used when submitting an HTML form. */
  name?: string;
  /** The `<form>` element to associate the input with. */
  form?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
}

/** useMove bookkeeping of one move target (JSON). */
interface MoveState {
  didMove: boolean;
  lastPosition: { pageX: number; pageY: number } | null;
  id: number | null;
}

/** Rivet: the hook-local state of a color slider (plain JSON). */
export interface ColorSliderInteraction {
  track: MoveState;
  thumb: MoveState;
}

export const createColorSliderInteraction = (): ColorSliderInteraction => ({
  track: { didMove: false, lastPosition: null, id: null },
  thumb: { didMove: false, lastPosition: null, id: null },
});

export interface AriaColorSliderOptions extends Omit<AriaColorSliderProps, "isDisabled"> {
  /** Whether the slider is disabled: a value, or an accessor that stays live (live props P5; handlers read it at event time). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** The track element (RA `trackRef`). */
  trackRef: () => Element | null | undefined;
  /** The input element (RA `inputRef`). */
  inputRef: () => HTMLInputElement | null | undefined;
  /** Rivet: the locale (RA `useLocale()`). */
  locale: string;
  /** Rivet: the text direction (RA `useLocale()`). */
  direction: "ltr" | "rtl";
  /** Rivet: the hook-local JSON state (`createColorSliderInteraction()`). */
  interaction: ColorSliderInteraction;
}

export interface ColorSliderAria {
  /** Props for the label element. */
  labelProps: Bag;
  /** Props for the track element. */
  trackProps: Bag;
  /** Props for the thumb element. */
  thumbProps: Bag;
  /** Props for the visually hidden range input element. */
  inputProps: Bag;
  /** Props for the output element, displaying the value of the color slider. */
  outputProps: Bag;
}

/** The slider props RA passes to useSlider (default aria-label: the channel name). */
export function colorSliderAriaLabel(opts: AriaColorSliderOptions, state: ColorSliderState): string | undefined {
  // Provide a default aria-label if there is no other label provided.
  if (!opts.label && !opts["aria-label"] && !opts["aria-labelledby"]) {
    return getValue(state).getChannelName(state.channel, opts.locale);
  }
  return opts["aria-label"];
}

/** The thumb options RA passes to useSliderThumb. */
export function colorSliderThumbOptions(opts: AriaColorSliderOptions): AriaSliderThumbOptions {
  return {
    index: 0,
    orientation: opts.orientation,
    isDisabled: opts.isDisabled,
    name: opts.name,
    form: opts.form,
    trackRef: opts.trackRef,
    inputRef: opts.inputRef,
    direction: opts.direction,
  };
}

/** RA `generateBackground`: the channel gradient of the track. */
export function colorSliderTrackBackground(opts: Pick<AriaColorSliderOptions, "orientation" | "direction">, state: ColorSliderState): string {
  const value = getDisplayColor(state);
  const channel = state.channel;
  const view = sliderView(state);
  let to: string;
  if (opts.orientation === "vertical") {
    to = "top";
  } else if (opts.direction === "ltr") {
    to = "right";
  } else {
    to = "left";
  }
  switch (channel) {
    case "hue": {
      const stops = [0, 60, 120, 180, 240, 300, 360].map((hue) => value.withChannelValue("hue", hue).toString("css")).join(", ");
      return `linear-gradient(to ${to}, ${stops})`;
    }
    case "lightness": {
      // We have to add an extra color stop in the middle so that the hue shows up at all.
      // Otherwise it will always just be black to white.
      const min = getThumbMinValue(view, 0);
      const max = getThumbMaxValue(view, 0);
      const start = value.withChannelValue(channel, min).toString("css");
      const middle = value.withChannelValue(channel, (max - min) / 2).toString("css");
      const end = value.withChannelValue(channel, max).toString("css");
      return `linear-gradient(to ${to}, ${start}, ${middle}, ${end})`;
    }
    case "saturation":
    case "brightness":
    case "red":
    case "green":
    case "blue":
    case "alpha": {
      const start = value.withChannelValue(channel, getThumbMinValue(view, 0)).toString("css");
      const end = value.withChannelValue(channel, getThumbMaxValue(view, 0)).toString("css");
      return `linear-gradient(to ${to}, ${start}, ${end})`;
    }
    default:
      throw new Error("Unknown color channel: " + channel);
  }
}

/** Inline style of the track: useSlider's track style + forced colors off + the gradient. */
export function colorSliderTrackStyle(opts: Pick<AriaColorSliderOptions, "orientation" | "direction">, state: ColorSliderState): Record<string, string> {
  return { position: "relative", touchAction: "none", forcedColorAdjust: "none", background: colorSliderTrackBackground(opts, state) };
}

/** Inline style of the thumb: useSliderThumb's position + forced colors off (Rivet: the free / snapping position, `snap`). */
export function colorSliderThumbStyle(opts: Pick<AriaColorSliderOptions, "orientation" | "direction">, state: ColorSliderState): Record<string, string> {
  const view = sliderView(state);
  const vertical = (opts.orientation ?? view.orientation) === "vertical";
  let thumbPosition = getThumbPositionPercent(view, 0);
  if (vertical || opts.direction === "rtl") {
    thumbPosition = 1 - thumbPosition;
  }
  return {
    position: "absolute",
    [vertical ? "top" : "left"]: `${thumbPosition * 100}%`,
    transform: "translate(-50%, -50%)",
    touchAction: "none",
    forcedColorAdjust: "none",
  };
}

/** Visually hidden style of the range input (useVisuallyHidden + opacity / full size / no pointer events). */
export const colorSliderInputStyle = colorAreaInputStyle;

/** `aria-valuetext` of the input: the channel value, then the hue name (hue) or color name (not alpha). */
export function colorSliderInputValueText(opts: Pick<AriaColorSliderOptions, "locale">, state: ColorSliderState): string {
  const value = getDisplayColor(state);
  let text = getThumbValueLabel(state);
  if (state.channel === "hue") {
    text += `, ${value.getHueName(opts.locale)}`;
  } else if (state.channel !== "alpha") {
    text += `, ${value.getColorName(opts.locale)}`;
  }
  return text;
}

/**
 * Provides the behavior and accessibility implementation for a color slider component.
 * Color sliders allow users to adjust an individual channel of a color value.
 */
export function colorSliderProps(opts: AriaColorSliderOptions, state: ColorSliderState): ColorSliderAria {
  const view = sliderView(state);
  const { groupProps, trackProps, labelProps, outputProps } = sliderProps({ ...opts, "aria-label": colorSliderAriaLabel(opts, state) } as never, view);
  const thumb = sliderThumbProps(colorSliderThumbOptions(opts), view);
  // A live `isDisabled` (accessor) keeps the handlers: they check the current value.
  const isDisabled = typeof opts.isDisabled !== "function" && !!opts.isDisabled;
  return {
    trackProps: {
      ...groupProps,
      ...trackProps,
      ...(isDisabled
        ? {}
        : {
            onPointerDown: (e: PointerEvent) => colorSliderTrackPointerDown(e, opts, state),
          }),
      style: colorSliderTrackStyle(opts, state),
    },
    inputProps: {
      ...thumb.inputProps,
      "aria-valuetext": colorSliderInputValueText(opts, state),
      onChange: (e: Event) => colorSliderInputChange(e, opts, state),
      onFocus: (e: FocusEvent) => colorSliderInputFocus(e, opts, state),
      onBlur: (e: FocusEvent) => colorSliderInputBlur(e, opts, state),
      style: colorSliderInputStyle,
    },
    thumbProps: {
      ...(isDisabled
        ? {}
        : {
            onKeyDown: (e: KeyboardEvent) => colorSliderThumbKeyDown(e, opts, state),
            onPointerDown: (e: PointerEvent) => colorSliderThumbPointerDown(e, opts, state),
          }),
      style: colorSliderThumbStyle(opts, state),
    },
    labelProps,
    outputProps,
  };
}

// ---- handlers (RA merged props, in mergeProps order) ----

function trackMove(opts: AriaColorSliderOptions, state: ColorSliderState) {
  const track = opts.trackRef() ?? null;
  return {
    props: {
      onMoveStart: () => sliderTrackMoveStart({} as never, sliderView(state)),
      onMove: (e: MoveMoveEvent) => sliderTrackMove(e, { orientation: opts.orientation, direction: opts.direction } as never, sliderView(state), track),
      onMoveEnd: () => sliderTrackMoveEnd({} as never, sliderView(state)),
    },
    state: opts.interaction.track,
  };
}

function thumbMove(opts: AriaColorSliderOptions, state: ColorSliderState) {
  const thumbOpts = colorSliderThumbOptions(opts);
  return {
    props: {
      onMoveStart: () => sliderThumbMoveStart({} as never, thumbOpts, sliderView(state)),
      onMove: (e: MoveMoveEvent) => sliderThumbMove(e, thumbOpts, sliderView(state)),
      onMoveEnd: () => sliderThumbMoveEnd({} as never, thumbOpts, sliderView(state)),
    },
    state: opts.interaction.thumb,
  };
}

/** Track `pointerdown` (useSlider: the closest thumb jumps to the press, then useMove drags it). */
export function colorSliderTrackPointerDown(e: PointerEvent, opts: AriaColorSliderOptions, state: ColorSliderState): void {
  if (read(opts.isDisabled)) return;
  const track = e.currentTarget as Element;
  sliderTrackPointerDown(e, { orientation: opts.orientation, direction: opts.direction, isDisabled: opts.isDisabled } as never, sliderView(state), track);
  movePointerDown(trackMove(opts, state), e);
}

/** Thumb `keydown` (useSliderThumb: useKeyboard PageUp / PageDown / Home / End, then useMove arrows). */
export function colorSliderThumbKeyDown(e: KeyboardEvent, opts: AriaColorSliderOptions, state: ColorSliderState): void {
  if (read(opts.isDisabled)) return;
  sliderThumbKeyDown(e, colorSliderThumbOptions(opts), sliderView(state));
  moveKeyDown(thumbMove(opts, state), e);
}

/** Thumb `pointerdown` (useMove, then useSliderThumb's onPointerDown: focus the input, dragging). */
export function colorSliderThumbPointerDown(e: PointerEvent, opts: AriaColorSliderOptions, state: ColorSliderState): void {
  if (read(opts.isDisabled)) return;
  movePointerDown(thumbMove(opts, state), e);
  sliderThumbPointerDown(e, colorSliderThumbOptions(opts), sliderView(state));
}

/** Range input `change` / `input`. */
export function colorSliderInputChange(e: Event, opts: AriaColorSliderOptions, state: ColorSliderState): void {
  sliderThumbInputChange(e, colorSliderThumbOptions(opts), sliderView(state));
}

/** Range input `focus`. */
export function colorSliderInputFocus(e: FocusEvent, opts: AriaColorSliderOptions, state: ColorSliderState): void {
  sliderThumbFocus(e, colorSliderThumbOptions(opts), sliderView(state));
}

/** Range input `blur`. */
export function colorSliderInputBlur(e: FocusEvent, opts: AriaColorSliderOptions, state: ColorSliderState): void {
  sliderThumbBlur(e, colorSliderThumbOptions(opts), sliderView(state));
}
