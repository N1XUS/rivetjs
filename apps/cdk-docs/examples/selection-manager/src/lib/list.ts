import type { Key } from "@rivetjs/cdk/collections/types";
import { domCollection } from "@rivetjs/cdk/collections/dom";
import { SelectionManager } from "@rivetjs/cdk/selection/manager";
import type { MultipleSelectionState } from "@rivetjs/cdk/selection/state";
import { selectableListBlur, selectableListFocus, selectableListKeyDown, type AriaSelectableListOptions } from "@rivetjs/cdk/selection/selectable-list";
import {
  closestItem,
  selectableItemClick,
  selectableItemFocus,
  selectableItemKeyDown,
  selectableItemKeyUp,
  selectableItemPointerDown,
  selectableItemPointerUp,
  type SelectableItemOptions,
} from "@rivetjs/cdk/selection/selectable-item";

type ListEvent<E extends Event> = E & { currentTarget: HTMLElement };

// The collection and the manager are classes: rebuild them from the state and the DOM per event.
const manager = (state: MultipleSelectionState, list: HTMLElement) => new SelectionManager(domCollection(list), state);

const listOptions = (state: MultipleSelectionState, list: HTMLElement): AriaSelectableListOptions => {
  const selectionManager = manager(state, list);
  return { selectionManager, collection: selectionManager.collection, disabledKeys: state.disabledKeys, ref: list, shouldFocusWrap: true };
};

/** The item under the event target, with its options (useSelectableItem), or null. */
function item(state: MultipleSelectionState, e: ListEvent<Event>): SelectableItemOptions | null {
  const hit = closestItem(e.currentTarget, e.target);
  return hit ? { selectionManager: manager(state, e.currentTarget), key: hit.key, ref: hit.element } : null;
}

// Item handlers first (React: the item's handler runs before the list's), then the list's.
export function onKeyDown(state: MultipleSelectionState, e: ListEvent<KeyboardEvent>): void {
  const options = item(state, e);
  if (options) selectableItemKeyDown(options, e);
  selectableListKeyDown(listOptions(state, e.currentTarget), e);
}
export function onKeyUp(state: MultipleSelectionState, e: ListEvent<KeyboardEvent>): void {
  const options = item(state, e);
  if (options) selectableItemKeyUp(options, e);
}
export function onPointerDown(state: MultipleSelectionState, e: ListEvent<PointerEvent>): void {
  const options = item(state, e);
  if (options) selectableItemPointerDown(options, e);
}
export function onPointerUp(state: MultipleSelectionState, e: ListEvent<PointerEvent>): void {
  const options = item(state, e);
  if (options) selectableItemPointerUp(options, e);
}
export function onClick(state: MultipleSelectionState, e: ListEvent<MouseEvent>): void {
  const options = item(state, e);
  if (options) selectableItemClick(options, e);
}
export function onFocusIn(state: MultipleSelectionState, e: ListEvent<FocusEvent>): void {
  const options = item(state, e);
  if (options) selectableItemFocus(options, e);
  selectableListFocus(listOptions(state, e.currentTarget), e);
}
export function onFocusOut(state: MultipleSelectionState, e: ListEvent<FocusEvent>): void {
  selectableListBlur(listOptions(state, e.currentTarget), e);
}

/** Roving tabindex of an item (reads the focused key: use in a binding). */
export const tabIndexOf = (state: MultipleSelectionState, key: Key): number => (state.focusedKey() === key ? 0 : -1);
