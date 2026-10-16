// Ported from react-aria `useToggleButtonGroup` / `useToggleButtonGroupItem`
// (packages/react-aria/src/button/useToggleButtonGroup.ts), Apache-2.0, © Adobe.
// Rivet:
// - `toggleButtonGroupProps(props, state)` (RA `useToggleButtonGroup`) returns RA's `groupProps` bag: `useToolbar` attributes (`../toolbar/behaviour.ts`
//   `toolbarProps`) with `role="radiogroup"` in single selection, plus `aria-disabled`. `aria-orientation` / `aria-disabled` are
//   accessors over `live.orientation` (3rd argument; else `props.orientation`) / `isGroupDisabled(state)` (live props; the element
//   spread binds them). The toolbar's keyboard
//   handlers (`toolbarKeyDown` / `toolbarFocus` / `toolbarBlur`) are attached by the component.
// - `toggleButtonGroupItemProps(props, state)` (RA `useToggleButtonGroupItem`) returns `{ buttonProps, isSelected,
//   isDisabled }`: `aria-pressed` (multiple) or `role="radio"` + `aria-checked` (single); `isSelected` and the
//   selection attributes are accessors (read inside bindings). RA's `isPressed` is `data-pressed` (press.ts).
// - RA builds a `ToggleState` adapter over the group (`isSelected = selectedKeys.has(id)`, `toggle → toggleKey`);
//   here the press handlers `toggleButtonGroupItem<Event>(event, props, state)` call `toggleKey(state, id)`.
import type { Orientation } from "../collections/types.ts";
import { isGroupDisabled, type ToggleGroupProps, type ToggleGroupState } from "../state/toggle-group.ts";
import { toolbarProps as ariaToolbarProps } from "../toolbar/behaviour.ts";

export interface AriaToggleButtonGroupProps extends ToggleGroupProps {
  /**
   * The orientation of the the toggle button group.
   *
   * @default 'horizontal'
   */
  orientation?: Orientation;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
}

/** Props for the toggle button group container (RA `useToggleButtonGroup` → `groupProps`). */
export function toggleButtonGroupProps(
  props: AriaToggleButtonGroupProps,
  state: ToggleGroupState,
  live?: { readonly orientation?: Orientation },
): Record<string, unknown> {
  const toolbarProps = ariaToolbarProps({ orientation: props.orientation, "aria-label": props["aria-label"], "aria-labelledby": props["aria-labelledby"] });
  return {
    ...toolbarProps,
    role: state.selectionMode === "single" ? "radiogroup" : toolbarProps.role,
    "aria-orientation": () => (live ?? props).orientation ?? "horizontal",
    "aria-disabled": () => (isGroupDisabled(state) ? "true" : undefined),
  };
}

export {
  toggleButtonGroupItemProps,
  toggleButtonGroupItemPressOptions,
  toggleButtonGroupItemPointerDown,
  toggleButtonGroupItemKeyDown,
  toggleButtonGroupItemClick,
  type AriaToggleButtonGroupItemProps,
  type ToggleButtonGroupItemAria,
} from "./item.tsx";
