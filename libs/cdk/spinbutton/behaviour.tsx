// Ported from react-aria `useSpinButton` (packages/react-aria/src/spinbutton/useSpinButton.ts), Apache-2.0, © Adobe.
// Rivet:
// - `useSpinButton(props)` → `spinButtonProps(props, state?)` returning RA's three bags (attributes; changing values are
//   read through `MaybeAccessor` props, so bind the bag inside a binding or pass accessors); RA's handlers are the
//   exported free functions `spinButtonKeyDown` / `KeyUp` (over `interactions/keyboard` + `spinButtonShortcuts`), `spinButtonFocus`, `spinButtonBlur`, `spinButtonIncrementPressStart` /
//   `PressUp` / `PressEnd`, `spinButtonDecrement…` (call them from inline arrows: resumable).
// - React refs / state (`_async` timer, `isSpinning`, `isFocused`, `isUp`, `isIncrementPressed`) → `SpinButtonState`, a
//   plain JSON object (`createSpinButtonState()`); the press "effects" (start spinning after 400 ms mouse / 600 ms
//   touch) run where the pressed state is set. Timers / global listeners live only in the browser.
// - Announce effect (`announce(ariaTextValue)` when it changes while focused) → a reactive effect created by
//   `spinButtonFocus` and disposed by `spinButtonBlur` (browser only, kept in a WeakMap keyed by the state): same
//   trigger (text change while focused), nothing runs before focus.
// - `useLocalizedStringFormatter(intlMessages)` → `formatMessage(strings, props.locale, …)` (`./intl.ts`, generated).
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

import { createRoot, effect, untrack } from "@rivetjs/reactivity";
import { announce, clearAnnouncer } from "../announcer/live-announcer.ts";
import { formatMessage } from "../_adapters/intl.ts";
import { getOwnerWindow, read, type MaybeAccessor } from "../interactions/utils.ts";
import type { PressEvent } from "../interactions/press.tsx";
import { keyboardKeyDown, keyboardKeyUp, type KeyboardShortcutBindings } from "../interactions/keyboard.tsx";
import { strings } from "./intl.ts";

export interface SpinButtonProps {
  /** The current value (NaN / undefined: empty). */
  value?: MaybeAccessor<number | undefined>;
  textValue?: MaybeAccessor<string | undefined>;
  minValue?: MaybeAccessor<number | undefined>;
  maxValue?: MaybeAccessor<number | undefined>;
  isDisabled?: MaybeAccessor<boolean | undefined>;
  isReadOnly?: MaybeAccessor<boolean | undefined>;
  isRequired?: MaybeAccessor<boolean | undefined>;
  onIncrement?: () => void;
  onIncrementPage?: () => void;
  onDecrement?: () => void;
  onDecrementPage?: () => void;
  onDecrementToMin?: () => void;
  onIncrementToMax?: () => void;
  /** Rivet: locale of the "Empty" string (RA: `useLocale()`); default `en-US`. */
  locale?: MaybeAccessor<string | undefined>;
}

/** Rivet: RA's refs / state of one spin button (plain JSON, mutated by the handlers). */
export interface SpinButtonState {
  /** Pending spin timer id (browser). */
  timer: number | undefined;
  isSpinning: boolean;
  isFocused: boolean;
  isUp: boolean;
  isIncrementPressed: "touch" | "mouse" | null;
  isDecrementPressed: "touch" | "mouse" | null;
}

export const createSpinButtonState = (): SpinButtonState => ({
  timer: undefined,
  isSpinning: false,
  isFocused: false,
  isUp: false,
  isIncrementPressed: null,
  isDecrementPressed: null,
});

export interface SpinbuttonAria {
  spinButtonProps: Record<string, unknown>;
  incrementButtonProps: Record<string, unknown>;
  decrementButtonProps: Record<string, unknown>;
}

// Browser-only resources per state (never serialized): announce effect, global listeners.
const live = new WeakMap<
  SpinButtonState,
  { dispose?: () => void; listeners: [EventTarget, string, EventListener, boolean | AddEventListenerOptions | undefined][] }
>();
const resources = (state: SpinButtonState) => {
  let r = live.get(state);
  if (!r) live.set(state, (r = { listeners: [] }));
  return r;
};

function addGlobalListener(state: SpinButtonState, target: EventTarget, type: string, listener: EventListener, options?: boolean | AddEventListenerOptions) {
  resources(state).listeners.push([target, type, listener, options]);
  target.addEventListener(type, listener, options);
}

function removeAllGlobalListeners(state: SpinButtonState) {
  const r = resources(state);
  for (const [target, type, listener, options] of r.listeners) target.removeEventListener(type, listener, options);
  r.listeners = [];
}

/**
 * Replace Unicode hyphen-minus (U+002D) with minus sign (U+2212).
 * This ensures that macOS VoiceOver announces it as "minus" even with other characters between the minus sign
 * and the number (e.g. currency symbol). Otherwise it announces nothing because it assumes the character is a hyphen.
 * In addition, replace the empty string with the word "Empty" so that iOS VoiceOver does not read "50%" for an empty field.
 */
export function spinButtonTextValue(props: SpinButtonProps): string {
  const textValue = read(props.textValue);
  return textValue === "" ? formatMessage(strings, read(props.locale), "Empty") : (textValue || `${read(props.value)}`).replace("-", "−");
}

/** RA `clearAsync`. */
export function spinButtonClearAsync(state: SpinButtonState): void {
  clearTimeout(state.timer);
  state.isSpinning = false;
}

function stepUp(props: SpinButtonProps, state: SpinButtonState) {
  const maxValue = read(props.maxValue);
  const value = read(props.value);
  if (maxValue === undefined || isNaN(maxValue) || value === undefined || isNaN(value) || value < maxValue) {
    props.onIncrement?.();
    incrementPressStart(props, state, 60);
  }
}

function incrementPressStart(props: SpinButtonProps, state: SpinButtonState, initialStepDelay: number) {
  spinButtonClearAsync(state);
  state.isSpinning = true;
  // Start spinning after initial delay
  state.timer = setTimeout(() => stepUp(props, state), initialStepDelay) as unknown as number;
}

function stepDown(props: SpinButtonProps, state: SpinButtonState) {
  const minValue = read(props.minValue);
  const value = read(props.value);
  if (minValue === undefined || isNaN(minValue) || value === undefined || isNaN(value) || value > minValue) {
    props.onDecrement?.();
    decrementPressStart(props, state, 60);
  }
}

function decrementPressStart(props: SpinButtonProps, state: SpinButtonState, initialStepDelay: number) {
  spinButtonClearAsync(state);
  state.isSpinning = true;
  // Start spinning after initial delay
  state.timer = setTimeout(() => stepDown(props, state), initialStepDelay) as unknown as number;
}

// RA: useEffect on isIncrementPressed / isDecrementPressed.
function setIncrementPressed(props: SpinButtonProps, state: SpinButtonState, pressed: "touch" | "mouse" | null) {
  if (state.isIncrementPressed === pressed) return;
  state.isIncrementPressed = pressed;
  if (pressed === "touch") incrementPressStart(props, state, 600);
  else if (pressed) incrementPressStart(props, state, 400);
  else spinButtonClearAsync(state);
}

function setDecrementPressed(props: SpinButtonProps, state: SpinButtonState, pressed: "touch" | "mouse" | null) {
  if (state.isDecrementPressed === pressed) return;
  state.isDecrementPressed = pressed;
  if (pressed === "touch") decrementPressStart(props, state, 600);
  else if (pressed) decrementPressStart(props, state, 400);
  else spinButtonClearAsync(state);
}

const cancelContextMenu = (e: Event) => {
  e.preventDefault();
};

/** Provides the behavior and accessibility implementation for a spin button (RA `useSpinButton`). */
export function spinButtonProps(props: SpinButtonProps): SpinbuttonAria {
  const value = () => read(props.value);
  return {
    spinButtonProps: {
      role: "spinbutton",
      "aria-valuenow": () => {
        const v = value();
        return v !== undefined && !isNaN(v) ? v : undefined;
      },
      "aria-valuetext": () => spinButtonTextValue(props),
      "aria-valuemin": () => read(props.minValue),
      "aria-valuemax": () => read(props.maxValue),
      "aria-disabled": () => read(props.isDisabled) || undefined,
      "aria-readonly": () => read(props.isReadOnly) || undefined,
      "aria-required": () => read(props.isRequired) || undefined,
    },
    incrementButtonProps: {},
    decrementButtonProps: {},
  };
}

/** Keys the spin button shortcuts handle (`data-rk` of a field's input: held while a cold chunk loads). */
export const SPIN_KEYS = "ArrowUp ArrowDown PageUp PageDown Home End";

/** `data-rk` of a spin field's input: `SPIN_KEYS` unless disabled / read-only (an accessor when either flag is live). */
export function spinKeysAttr(
  isDisabled: MaybeAccessor<boolean | undefined>,
  isReadOnly: MaybeAccessor<boolean | undefined>,
): string | undefined | (() => string | undefined) {
  return typeof isDisabled === "function" || typeof isReadOnly === "function"
    ? () => (read(isDisabled) || read(isReadOnly) ? undefined : SPIN_KEYS)
    : isDisabled || isReadOnly
      ? undefined
      : SPIN_KEYS;
}

/** RA's `useKeyboard` shortcuts of the spin button (a handler returning `false` = not handled). */
export function spinButtonShortcuts(props: SpinButtonProps): KeyboardShortcutBindings {
  const { onIncrement, onIncrementPage, onDecrement, onDecrementPage, onDecrementToMin, onIncrementToMax } = props;
  return {
    PageUp: () => {
      if (onIncrementPage) {
        onIncrementPage();
        return;
      }
      if (onIncrement) {
        onIncrement();
        return;
      }
      return false;
    },
    ArrowUp: () => {
      if (onIncrement) {
        onIncrement();
        return;
      }
      return false;
    },
    PageDown: () => {
      if (onDecrementPage) {
        onDecrementPage();
        return;
      }
      if (onDecrement) {
        onDecrement();
        return;
      }
      return false;
    },
    ArrowDown: () => {
      if (onDecrement) {
        onDecrement();
        return;
      }
      return false;
    },
    Home: () => {
      if (onDecrementToMin) {
        onDecrementToMin();
        return;
      }
      return false;
    },
    End: () => {
      if (onIncrementToMax) {
        onIncrementToMax();
        return;
      }
      return false;
    },
  };
}

/** RA `keyboardProps.onKeyDown` of the spin button (`useKeyboard({ isDisabled: isDisabled || isReadOnly, shortcuts, allowRepeats })`). */
export function spinButtonKeyDown(event: KeyboardEvent, props: SpinButtonProps, _state?: SpinButtonState): void {
  keyboardKeyDown({ isDisabled: read(props.isDisabled) || read(props.isReadOnly), shortcuts: spinButtonShortcuts(props), allowRepeats: true }, event);
}

/** RA `keyboardProps.onKeyUp` of the spin button. */
export function spinButtonKeyUp(event: KeyboardEvent, props: SpinButtonProps, _state?: SpinButtonState): void {
  keyboardKeyUp({ isDisabled: read(props.isDisabled) || read(props.isReadOnly), shortcuts: spinButtonShortcuts(props), allowRepeats: true }, event);
}

/** RA `onFocus` (spin button and stepper buttons): starts announcing text changes. */
export function spinButtonFocus(_event: Event | null, props: SpinButtonProps, state: SpinButtonState): void {
  state.isFocused = true;
  const r = resources(state);
  if (r.dispose) return;
  let previous = untrack(() => spinButtonTextValue(props));
  r.dispose = createRoot((dispose) => {
    effect(() => {
      const text = spinButtonTextValue(props);
      if (text === previous) return;
      previous = text;
      if (state.isFocused) {
        clearAnnouncer("assertive");
        announce(text, "assertive");
      }
    });
    return dispose;
  }).value;
}

/** RA `onBlur`. */
export function spinButtonBlur(_event: Event | null, _props: SpinButtonProps, state: SpinButtonState): void {
  state.isFocused = false;
  const r = resources(state);
  r.dispose?.();
  r.dispose = undefined;
}

/** RA cleanup on unmount (`clearAsync`, global listeners). */
export function spinButtonDispose(state: SpinButtonState): void {
  spinButtonClearAsync(state);
  removeAllGlobalListeners(state);
  live.get(state)?.dispose?.();
  live.delete(state);
}

// For touch users, if they move their finger like they're scrolling, we don't want to trigger a spin.
const pointerCancel = (state: SpinButtonState) => () => spinButtonClearAsync(state);

export function spinButtonIncrementPressStart(e: PressEvent, props: SpinButtonProps, state: SpinButtonState): void {
  spinButtonClearAsync(state);
  if (e.pointerType !== "touch") {
    props.onIncrement?.();
    setIncrementPressed(props, state, "mouse");
  } else {
    addGlobalListener(state, getOwnerWindow(e.target), "pointercancel", pointerCancel(state), { capture: true });
    state.isUp = false;
    // For touch users, don't trigger a decrement on press start, we'll wait for the press end to trigger it if
    // the control isn't spinning.
    setIncrementPressed(props, state, "touch");
  }
  addGlobalListener(state, getOwnerWindow(e.target), "contextmenu", cancelContextMenu);
}

export function spinButtonIncrementPressUp(e: PressEvent, props: SpinButtonProps, state: SpinButtonState): void {
  spinButtonClearAsync(state);
  if (e.pointerType === "touch") {
    state.isUp = true;
  }
  removeAllGlobalListeners(state);
  setIncrementPressed(props, state, null);
}

export function spinButtonIncrementPressEnd(e: PressEvent, props: SpinButtonProps, state: SpinButtonState): void {
  spinButtonClearAsync(state);
  if (e.pointerType === "touch") {
    if (!state.isSpinning && state.isUp) {
      props.onIncrement?.();
    }
  }
  state.isUp = false;
  setIncrementPressed(props, state, null);
}

export function spinButtonDecrementPressStart(e: PressEvent, props: SpinButtonProps, state: SpinButtonState): void {
  spinButtonClearAsync(state);
  if (e.pointerType !== "touch") {
    props.onDecrement?.();
    setDecrementPressed(props, state, "mouse");
  } else {
    addGlobalListener(state, getOwnerWindow(e.target), "pointercancel", pointerCancel(state), { capture: true });
    state.isUp = false;
    // For touch users, don't trigger a decrement on press start, we'll wait for the press end to trigger it if
    // the control isn't spinning.
    setDecrementPressed(props, state, "touch");
  }
}

export function spinButtonDecrementPressUp(e: PressEvent, props: SpinButtonProps, state: SpinButtonState): void {
  spinButtonClearAsync(state);
  if (e.pointerType === "touch") {
    state.isUp = true;
  }
  removeAllGlobalListeners(state);
  setDecrementPressed(props, state, null);
}

export function spinButtonDecrementPressEnd(e: PressEvent, props: SpinButtonProps, state: SpinButtonState): void {
  spinButtonClearAsync(state);
  if (e.pointerType === "touch") {
    if (!state.isSpinning && state.isUp) {
      props.onDecrement?.();
    }
  }
  state.isUp = false;
  setDecrementPressed(props, state, null);
}
