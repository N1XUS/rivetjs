// Ported from react-aria `useToggleButtonGroupItem` (packages/react-aria/src/button/useToggleButtonGroup.ts), Apache-2.0, © Adobe.
// Rivet: split from `behaviour.ts` so `ToggleButton` (which renders group items) does not pull the toolbar
// behaviour. `toggleButtonGroupItemProps(props, state)` returns `{ buttonProps, isSelected, isDisabled }`;
// press handlers `toggleButtonGroupItem<Event>(event, props, state)` toggle the item's key (RA's ToggleState
// adapter: `toggle → state.toggleKey(id)`), then call the item's `onPress`.
import type { Key } from "../collections/types.ts";
import { isGroupDisabled, isKeySelected, toggleKey, type ToggleGroupState } from "../state/toggle-group.ts";
import { pressClick, pressKeyDown, pressPointerDown, type PressEvent, type PressOptions } from "../button/press.ts";

export interface AriaToggleButtonGroupItemProps extends PressOptions {
  /** An identifier for the item in the `selectedKeys` of a ToggleButtonGroup. */
  id: Key;
  /** Whether the item is disabled (the group's `isDisabled` disables every item). */
  isDisabled?: boolean;
}

export interface ToggleButtonGroupItemAria {
  /** Props for the button element. */
  buttonProps: Record<string, unknown>;
  /** Whether the button is selected (accessor, tracked). */
  isSelected: () => boolean;
  /** Whether the button is disabled. */
  isDisabled: boolean;
}

/** Accessibility attributes of a toggle button inside a group (RA `useToggleButtonGroupItem`). */
export function toggleButtonGroupItemProps(props: AriaToggleButtonGroupItemProps, state: ToggleGroupState): ToggleButtonGroupItemAria {
  const id = props.id;
  const isDisabled = !!(props.isDisabled || isGroupDisabled(state));
  const isSelected = () => isKeySelected(state, id);
  const selection =
    state.selectionMode === "single"
      ? { role: "radio", "aria-checked": () => (isSelected() ? "true" : "false") }
      : { "aria-pressed": () => (isSelected() ? "true" : "false") };
  return {
    buttonProps: { type: "button", ...selection, "data-selected": () => (isSelected() ? "true" : undefined), disabled: isDisabled || undefined },
    isSelected,
    isDisabled,
  };
}

/**
 * Press options of a group item: `onPress` toggles the item's key first, then calls the item's `onPress`
 * (RA `useToggleButton` chains `state.toggle`). Built per event (functions created in .ts modules are not resumable).
 */
export function toggleButtonGroupItemPressOptions(props: AriaToggleButtonGroupItemProps, state: ToggleGroupState): PressOptions {
  const { id, onPress } = props;
  return {
    ...props,
    isDisabled: !!(props.isDisabled || isGroupDisabled(state)),
    onPress: (event: PressEvent) => {
      toggleKey(state, id);
      onPress?.(event);
    },
  };
}

/** pointerdown on a group item. */
export const toggleButtonGroupItemPointerDown = (e: PointerEvent, props: AriaToggleButtonGroupItemProps, state: ToggleGroupState): void =>
  pressPointerDown(toggleButtonGroupItemPressOptions(props, state), e);
/** keydown on a group item. */
export const toggleButtonGroupItemKeyDown = (e: KeyboardEvent, props: AriaToggleButtonGroupItemProps, state: ToggleGroupState): void =>
  pressKeyDown(toggleButtonGroupItemPressOptions(props, state), e);
/** click on a group item. */
export const toggleButtonGroupItemClick = (e: MouseEvent, props: AriaToggleButtonGroupItemProps, state: ToggleGroupState): void =>
  pressClick(toggleButtonGroupItemPressOptions(props, state), e);
