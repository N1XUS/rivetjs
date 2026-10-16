// Ported from react-stately `useToggleState` (packages/react-stately/src/toggle/useToggleState.ts), Apache-2.0, © Adobe.
// Toggle state (ToggleButton, Checkbox, Switch): pure signals, serializable, server-safe.
// Rivet: RA `isSelected` (plain value or two-way Signal) / `defaultSelected` / `onChange` through
// `controllable` (react-stately useControlledState port); `isSelected` may also be an accessor
// (`() => boolean`: controlled by the caller's state, live without re-creating the state; changes are
// reported through `onChange`). `selected` reads the shown value; `setSelected` / `toggle` are free functions.
import { untrack, type Signal } from "@rivetjs/reactivity";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";

export interface ToggleState {
  /** The shown selection (read `state.selected()` in bindings; change with `setSelected`). */
  readonly selected: () => boolean;
  /** RA `useControlledState` state behind `selected`. */
  readonly controlled: ControlledState<boolean>;
  /** RA `defaultSelected`: value restored on form reset (`defaultSelected ?? initial`). */
  readonly defaultSelected: boolean;
  /** Rivet: `isDisabled` when created (RA hooks check it; `toggle` ignores a disabled state). */
  readonly disabled: boolean;
  /** Rivet: the caller's `isDisabled` accessor (read by `toggle`), when it passed one. */
  readonly isDisabled?: () => boolean | undefined;
  readonly readOnly: boolean;
  /** Rivet: the caller's `isReadOnly` accessor (live props), when it passed one. */
  readonly isReadOnly?: () => boolean | undefined;
}

/** RA `ToggleStateOptions`. */
export interface ToggleStateOptions {
  /** Whether the element should be selected (controlled): a plain value, a two-way Signal or an accessor. */
  isSelected?: boolean | Signal<boolean> | (() => boolean);
  /** Whether the element should be selected (uncontrolled). */
  defaultSelected?: boolean;
  /** Handler that is called when the element's selection state changes. */
  onChange?: (isSelected: boolean) => void;
  /** Whether the input can be selected but not changed by the user (a value, or an accessor that stays live). */
  isReadOnly?: boolean | (() => boolean | undefined) | undefined;
  /** Whether the input is disabled (a value, or an accessor that stays live). */
  isDisabled?: boolean | (() => boolean | undefined) | undefined;
}

/** RA `useToggleState`. */
export function createToggleState(options: ToggleStateOptions = {}): ToggleState {
  const isDisabled = options.isDisabled;
  const isReadOnly = options.isReadOnly;
  const controlled = controllable<boolean>(options.isSelected, options.defaultSelected || false, options.onChange);
  return {
    selected: controlled.value,
    controlled,
    defaultSelected: options.defaultSelected ?? untrack(controlled.value),
    disabled: !!untrack(() => (typeof isDisabled === "function" ? isDisabled() : isDisabled)),
    ...(typeof isDisabled === "function" ? { isDisabled } : {}),
    readOnly: !!untrack(() => (typeof isReadOnly === "function" ? isReadOnly() : isReadOnly)),
    ...(typeof isReadOnly === "function" ? { isReadOnly } : {}),
  };
}

/** RA `setSelected`: ignored while read-only; calls `onChange` when the value changes. */
export function setSelected(state: ToggleState, value: boolean): void {
  if (isToggleReadOnly(state)) return;
  setControlledValue(state.controlled, value);
}

/** RA `toggle`: flip unless read-only (Rivet: also unless disabled — the hooks never toggle a disabled control). */
export function toggle(state: ToggleState): void {
  if (isToggleReadOnly(state) || (state.isDisabled ? !!state.isDisabled() : state.disabled)) return;
  setSelected(state, !isToggleSelected(state));
}

/** The current selection including a write earlier in the same task (RA `isSelected` after setState). */
export const isToggleSelected = (state: ToggleState): boolean => untrack(() => controlledValue(state.controlled));

/** Whether the state is read-only now (its live `isReadOnly` accessor, else the creation value). */
export const isToggleReadOnly = (state: ToggleState): boolean => (state.isReadOnly ? !!untrack(state.isReadOnly) : state.readOnly);
