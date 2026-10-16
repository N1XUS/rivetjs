// Ported from react-aria `useToggleButton` (packages/react-aria/src/button/useToggleButton.ts), Apache-2.0, © Adobe.
// ToggleButton behaviour: a native <button type="button"> with aria-pressed; presses toggle the state.
import { untrack } from "@rivetjs/reactivity";
import { toggle, type ToggleState } from "../state/toggle.ts";
import { pressClick, pressKeyDown, pressPointerDown, type PressEvent, type PressOptions } from "../button/press.ts";

/** Attributes for custom markup (`<button {...toggleButtonAttrs(s)} onClick={() => toggleButtonPress(s)}>`). */
export function toggleButtonAttrs(state: ToggleState): Record<string, unknown> {
  return {
    type: "button",
    "aria-pressed": () => (state.selected() ? "true" : "false"),
    "data-selected": () => (state.selected() ? "true" : undefined),
    disabled: state.disabled || undefined,
  };
}

/** Press handler body: toggle (RA chains `state.toggle` before `onPress`). */
export function toggleButtonPress(state: ToggleState): void {
  toggle(state);
}

/**
 * Press options of a toggle button: `onPress` toggles first, then calls the caller's `onPress`.
 * Build it inside handlers (functions created in .ts modules are not resumable).
 */
export function toggleButtonPressOptions(state: ToggleState, options: PressOptions): PressOptions {
  const { onPress } = options;
  return {
    ...options,
    isDisabled: state.disabled,
    onPress: (event: PressEvent) => {
      toggle(state);
      onPress?.(event);
    },
  };
}

export const toggleButtonPointerDown = (state: ToggleState, options: PressOptions, e: PointerEvent) => pressPointerDown(toggleButtonPressOptions(state, options), e);
export const toggleButtonKeyDown = (state: ToggleState, options: PressOptions, e: KeyboardEvent) => pressKeyDown(toggleButtonPressOptions(state, options), e);
export const toggleButtonClick = (state: ToggleState, options: PressOptions, e: MouseEvent) => pressClick(toggleButtonPressOptions(state, options), e);

export const isToggleSelected = (state: ToggleState): boolean => untrack(state.selected);
