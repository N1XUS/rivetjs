// Ported from @react-aria/selection (useSelectableList.ts), Apache-2.0, © Adobe.
import type { Collection, Key, KeyboardDelegate, LayoutDelegate, Node, Orientation } from "../collections/types.ts";
import { ListKeyboardDelegate, searchCollator } from "./list-keyboard-delegate.ts";
import {
  selectableCollectionBlur,
  selectableCollectionKeyDownCapture,
  selectableCollectionFocus,
  selectableCollectionKeyDown,
  selectableCollectionMouseDown,
  useSelectableCollection,
  type AriaSelectableCollectionOptions,
  type SelectableCollectionAria,
} from "./selectable-collection.ts";
import { refElement } from "./utils.ts";
import { direction as elementDirection } from "../bidi/index.ts";

export interface AriaSelectableListOptions extends Omit<AriaSelectableCollectionOptions, "keyboardDelegate"> {
  /** State of the collection. */
  collection: Collection<Node<unknown>>;
  /** A delegate object that implements behavior for keyboard focus movement. */
  keyboardDelegate?: KeyboardDelegate | undefined;
  /** A delegate object that provides layout information (default: the DOM). */
  layoutDelegate?: LayoutDelegate | undefined;
  /** The item keys that are disabled. */
  disabledKeys: Set<Key>;
  /** The primary orientation of the items. Default "vertical". */
  orientation?: Orientation | undefined;
  /** Locale for the typeahead collator (default: `document.documentElement.lang`). */
  locale?: string | undefined;
}

/** The selectable-collection options of a list: a `ListKeyboardDelegate` unless one is given. */
export function selectableListOptions(props: AriaSelectableListOptions, event?: Event): AriaSelectableCollectionOptions {
  const ref = refElement(props.ref) ?? ((event?.currentTarget as HTMLElement | null) || null);
  const delegate =
    props.keyboardDelegate ||
    new ListKeyboardDelegate({
      collection: props.collection,
      disabledKeys: props.disabledKeys,
      disabledBehavior: props.selectionManager.disabledBehavior,
      ref,
      collator: searchCollator(props.locale),
      layoutDelegate: props.layoutDelegate,
      orientation: props.orientation,
      direction: props.direction ?? (ref ? elementDirection(ref) : undefined),
    });
  return { ...props, ref, keyboardDelegate: delegate };
}

/** keydown (capture) on the list element. */
export const selectableListKeyDownCapture = (props: AriaSelectableListOptions, e: KeyboardEvent & { currentTarget: EventTarget | null }): boolean =>
  selectableCollectionKeyDownCapture(selectableListOptions(props, e), e);
/** keydown on the list element. */
export const selectableListKeyDown = (props: AriaSelectableListOptions, e: KeyboardEvent & { currentTarget: EventTarget | null }): boolean =>
  selectableCollectionKeyDown(selectableListOptions(props, e), e);
/** focusin on the list element. */
export const selectableListFocus = (props: AriaSelectableListOptions, e: FocusEvent & { currentTarget: EventTarget | null }): void =>
  selectableCollectionFocus(selectableListOptions(props, e), e);
/** focusout on the list element. */
export const selectableListBlur = (props: AriaSelectableListOptions, e: FocusEvent & { currentTarget: EventTarget | null }): void =>
  selectableCollectionBlur(selectableListOptions(props, e), e);
/** mousedown on the list element. */
export const selectableListMouseDown = (props: AriaSelectableListOptions, e: MouseEvent & { currentTarget: EventTarget | null }): void =>
  selectableCollectionMouseDown(selectableListOptions(props, e), e);

/** react-aria `useSelectableList` shape (imperative wiring). */
export function useSelectableList(props: AriaSelectableListOptions): { listProps: SelectableCollectionAria["collectionProps"] } {
  return { listProps: useSelectableCollection(selectableListOptions(props)).collectionProps };
}
