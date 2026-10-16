// Ported from react-aria (src/tag/useTagGroup.ts, src/tag/useTag.ts), Apache-2.0, © Adobe.
//
// Behaviour of a tag group (a focusable list of labels, categories, keywords or filters with keyboard
// navigation, selection and removal) on the @react-aria/gridlist port: `tagGroupProps` for the grid
// element, `tagProps` + `tagKeyDown` / `tagRemove` for each tag row.
//
// Rivet:
// - useTagGroup → `tagGroupOptions(props)` (the gridList options it forces: horizontal keyboard delegate,
//   `shouldFocusWrap`, `linkBehavior: "override"`, `keyboardNavigationBehavior: "tab"`) +
//   `tagGroupProps(props, state, isFocusWithin)` (grid attributes: role grid / group, aria-live). Wire the
//   `gridList<Event>` handlers of `../grid-list/behaviour.ts` on the grid with `tagGroupOptions(...)`
//   and a `tagGroupKeyboardDelegate(state, el, direction)` per event.
// - The RA `hookData` WeakMap (state → onRemove) is the `onRemove` option of `tagProps` / `tagKeyDown`.
// - useTag's remove description (`useDescription`, keyboard / virtual modality) is attached from the
//   row's focus handler (`tagFocus`) and removed on blur (`tagBlur`) instead of on every render.
// - useTag's useFocusable (item FocusEvents) → `tagFocus` / `tagBlur` call `onFocus` / `onBlur` /
//   `onFocusChange` of the tag when the row itself gets / loses focus.
import type { Collection, Direction, Key, Node } from "../collections/types.ts";
import { ListKeyboardDelegate } from "../selection/list-keyboard-delegate.ts";
import { hasFocusedKey, isFocusedKey, type KeyedSelectionSource } from "../selection/keyed.ts";
import { keyboardKeyDown } from "../interactions/keyboard.tsx";
import { getInteractionModality } from "../interactions/focus-visible.tsx";
import { useDescription } from "../utils/index.ts";
import { formatMessage } from "../_adapters/intl.ts";
import {
  gridListItemKeyDown,
  gridListItemProps,
  gridListProps,
  type AriaGridListItemOptions,
  type AriaGridListOptions,
  type GridListItemAria,
  type GridListStateLike,
} from "../grid-list/behaviour.ts";
import { strings as intlMessages } from "./intl.ts";

export interface AriaTagGroupOptions extends AriaGridListOptions {
  /** Handler that is called when a user deletes a tag. */
  onRemove?: ((keys: Set<Key>) => void) | undefined;
}

/** The gridList options useTagGroup forces (react-aria `useGridList({...props, shouldFocusWrap, linkBehavior, keyboardNavigationBehavior})`). */
export function tagGroupOptions<O extends AriaGridListOptions>(props: O): O {
  return { ...props, shouldFocusWrap: true, linkBehavior: "override", keyboardNavigationBehavior: "tab" };
}

/** react-aria useTagGroup's default keyboard delegate: horizontal list navigation (RTL aware). */
export function tagGroupKeyboardDelegate(state: GridListStateLike<any>, el: HTMLElement, direction: Direction): ListKeyboardDelegate<unknown> {
  return new ListKeyboardDelegate({
    collection: state.collection as Collection<Node<unknown>>,
    ref: el,
    orientation: "horizontal",
    direction,
    disabledKeys: state.disabledKeys,
    disabledBehavior: state.selectionManager.disabledBehavior,
  });
}

/**
 * Attributes of the tag grid element (react-aria `useTagGroup` gridProps): the gridList attributes plus
 * role `grid` (`group` while empty), `aria-atomic`, `aria-relevant`, `aria-live` (polite while focus is
 * within). Reads state: bind values as accessors.
 */
export function tagGroupProps(props: AriaTagGroupOptions, state: GridListStateLike<any>, isFocusWithin: boolean): Record<string, unknown> {
  const { gridProps } = gridListProps(tagGroupOptions(props), state);
  return {
    ...gridProps,
    role: state.collection.size ? "grid" : "group",
    "aria-atomic": false,
    "aria-relevant": "additions",
    "aria-live": isFocusWithin ? "polite" : "off",
  };
}

export interface AriaTagOptions extends AriaGridListItemOptions {
  /** Handler that is called when a user deletes a tag (the TagGroup's `onRemove`). */
  onRemove?: ((keys: Set<Key>) => void) | undefined;
  /** Id of the remove button (react-aria `useId()` in useTag). */
  removeButtonId: string;
  "aria-label"?: string | undefined;
  "aria-errormessage"?: string | undefined;
}

export interface TagAria extends Omit<GridListItemAria, "descriptionProps"> {
  /** Props for the tag remove button (a Button's props). */
  removeButtonProps: { "aria-label": string; "aria-labelledby": string; isDisabled: boolean; id: string };
  /** Whether the tag can be removed. */
  allowsRemoving: boolean;
}

const tagDisabled = (props: AriaTagOptions, state: GridListStateLike<any>): boolean =>
  state.disabledKeys.has(props.node.key) || !!(props.node.props as { isDisabled?: boolean } | undefined)?.isDisabled;

/**
 * Provides the behavior and accessibility implementation for a tag (react-aria `useTag`): row
 * attributes (gridList item + roving tabIndex: every enabled tag is tabbable until one is focused),
 * grid cell attributes, the remove button's props. Reads state: bind values as accessors. Wire the
 * `gridListItem<Event>` handlers on the row, with `tagKeyDown` for keydown and `tagFocus` / `tagBlur`.
 */
export function tagProps(props: AriaTagOptions, state: GridListStateLike<any>): TagAria {
  const { rowProps, gridCellProps, descriptionProps: _, ...states } = gridListItemProps(props, state);
  const isDisabled = tagDisabled(props, state);
  // Rivet: keyed reads (`selection/keyed.ts`): a focus move re-runs the two tags involved, not every tag.
  const manager = state.selectionManager;
  const keyed = (manager as { selectionState?: KeyedSelectionSource }).selectionState;
  const isItemFocused = keyed ? isFocusedKey(keyed, props.node.key) : props.node.key === manager.focusedKey;
  const isFocused = keyed ? hasFocusedKey(keyed) : manager.focusedKey != null;
  return {
    removeButtonProps: {
      "aria-label": formatMessage(intlMessages, props.locale, "removeButtonLabel"),
      "aria-labelledby": `${props.removeButtonId} ${rowProps.id as string}`,
      isDisabled,
      id: props.removeButtonId,
    },
    rowProps: { ...rowProps, tabIndex: !isDisabled && (isItemFocused || !isFocused) ? 0 : -1 },
    gridCellProps: { ...gridCellProps, "aria-errormessage": props["aria-errormessage"], "aria-label": props["aria-label"] },
    ...states,
    allowsRemoving: !!props.onRemove,
  };
}

/** react-aria useTag's Delete / Backspace shortcut: the selection when this tag is selected, else this tag. */
function removeKeys(props: AriaTagOptions, state: GridListStateLike<any>): Set<Key> {
  const manager = state.selectionManager;
  const key = props.node.key;
  return manager.isSelected(key) ? new Set(manager.selectedKeys as Iterable<Key>) : new Set([key]);
}

/** keydown on the tag row: gridList item keys, then Delete / Backspace remove (repeats allowed). */
export function tagKeyDown(e: KeyboardEvent & { currentTarget: EventTarget | null }, props: AriaTagOptions, state: GridListStateLike<any>): void {
  gridListItemKeyDown(e, props, state);
  const onRemove = props.onRemove;
  if (!onRemove || tagDisabled(props, state)) return;
  keyboardKeyDown(
    {
      shortcuts: { Delete: () => onRemove(removeKeys(props, state)), Backspace: () => onRemove(removeKeys(props, state)) },
      allowRepeats: true,
    },
    e,
  );
}

/** The remove button's press (react-aria useTag `removeButtonProps.onPress`). */
export function tagRemove(props: Pick<AriaTagOptions, "onRemove" | "node">): void {
  props.onRemove?.(new Set([props.node.key]));
}

const cleanups = new WeakMap<Element, () => void>();

/** The tag's own focus events (react-aria useFocusable on the row: target is the row). */
export interface TagFocusEvents {
  onFocus?: ((e: FocusEvent) => void) | undefined;
  onBlur?: ((e: FocusEvent) => void) | undefined;
  onFocusChange?: ((isFocused: boolean) => void) | undefined;
}

/** focus on the tag row: item focus events + the remove description (keyboard / virtual modality). */
export function tagFocus(e: FocusEvent, props: Pick<AriaTagOptions, "onRemove" | "locale"> & TagFocusEvents): void {
  const row = e.currentTarget as Element;
  if (e.target !== row) return;
  props.onFocus?.(e);
  props.onFocusChange?.(true);
  let modality = getInteractionModality();
  if (modality === "virtual" && typeof window !== "undefined" && "ontouchstart" in window) modality = "pointer";
  const description =
    props.onRemove && (modality === "keyboard" || modality === "virtual") ? formatMessage(intlMessages, props.locale, "removeDescription") : "";
  cleanups.get(row)?.();
  cleanups.set(row, useDescription(row, description));
}

/** blur on the tag row. */
export function tagBlur(e: FocusEvent, props: TagFocusEvents): void {
  const row = e.currentTarget as Element;
  if (e.target !== row) return;
  cleanups.get(row)?.();
  cleanups.delete(row);
  props.onBlur?.(e);
  props.onFocusChange?.(false);
}
