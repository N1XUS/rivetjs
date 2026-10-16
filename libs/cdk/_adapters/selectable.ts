// Selectable collections and items as handler functions: keyboard navigation + selection
// (useSelectableCollection), typeahead (useTypeSelect), focus entry / blur, focus sync, and the item
// press / action / link decisions (useSelectableItem). Ported from react-spectrum (Apache-2.0,
// © Adobe): packages/react-aria/src/selection/{useSelectableCollection,useSelectableItem,
// useTypeSelect,utils}.ts.
//
// LOCAL ADAPTER (aria-grid-tree) until cdk-collections publishes them.
//
// Rivet shape: React re-renders and effects move DOM focus to `focusedKey`; here handlers are plain
// functions run on the event (resumed symbols), so after updating state they call `syncFocus`, which
// does what useSelectableItem's focus effect + useSelectableCollection's scroll effect do. Options
// are built per event from the serializable state + the DOM collection.
import { untrack } from "@rivetjs/reactivity";
import { isMac, isCtrlKeyPressed } from "@rivetjs/cdk/platform";
import { tabbables, isTabbable } from "@rivetjs/cdk/a11y";
import type { Direction, FocusStrategy, Key, KeyboardDelegate } from "./collection.ts";
import { getItemElement } from "./dom-collection.ts";
import type { MultipleSelectionState, SelectionManager } from "./grid-selection.ts";
import { getInteractionModality, pressEvent, setInteractionModality, type PressEvent } from "./press.ts";
import { isOpeningLink, routerOpen, type Router } from "../link/router.ts";

/** Ctrl (Windows / Linux) or Alt (macOS): add to the selection without moving the anchor. */
export function isNonContiguousSelectionModifier(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return isMac() ? e.altKey : e.ctrlKey;
}

export type LinkBehavior = "action" | "selection" | "override" | "none";

export interface SelectableCollectionOptions {
  manager: SelectionManager;
  delegate: KeyboardDelegate;
  /** The collection element. */
  ref: HTMLElement;
  /** Serializable state (typeahead buffer owner). */
  state: MultipleSelectionState;
  direction: Direction;
  shouldFocusWrap?: boolean;
  disallowEmptySelection?: boolean;
  disallowSelectAll?: boolean;
  escapeKeyBehavior?: "clearSelection" | "none";
  /** Default: `selectionBehavior === "replace"`. */
  selectOnFocus?: boolean;
  disallowTypeAhead?: boolean;
  shouldUseVirtualFocus?: boolean;
  allowsTabNavigation?: boolean;
  scrollRef?: HTMLElement;
  linkBehavior?: "action" | "selection" | "override";
  router?: Router;
}

const selectOnFocusOf = (o: SelectableCollectionOptions): boolean => o.selectOnFocus ?? o.manager.selectionBehavior === "replace";

type ShortcutResult = void | false | { shouldContinuePropagation: boolean; shouldPreventDefault: boolean };

/**
 * keydown on the collection element. Returns true when the key was handled (default prevented,
 * propagation stopped as in react-aria's useKeyboard). Typeahead runs first (like its capture handler).
 */
export function selectableCollectionKeyDown(o: SelectableCollectionOptions, e: KeyboardEvent): boolean {
  setInteractionModality("keyboard");
  if (!o.ref.contains(e.target as Node)) return false;
  if (!o.disallowTypeAhead && typeSelectKeyDown(o, e)) {
    syncFocus(o);
    return true;
  }
  const { manager, delegate } = o;
  const direction = o.direction;
  const selectOnFocus = selectOnFocusOf(o);
  const navigateToKey = (key: Key | null | undefined, childFocus?: FocusStrategy): ShortcutResult => {
    if (key != null) {
      if (manager.isLink(key) && o.linkBehavior === "selection" && selectOnFocus && !isNonContiguousSelectionModifier(e)) {
        manager.setFocusedKey(key, childFocus);
        syncFocus(o);
        const item = getItemElement(o.ref, key);
        const props = manager.getItemProps(key);
        if (item && props?.href) {
          routerOpen(o.router, item, e, props.href, props.routerOptions);
          return;
        }
        return false;
      }
      manager.setFocusedKey(key, childFocus);
      if (manager.isLink(key) && o.linkBehavior === "override") return false;
      if (e.shiftKey && manager.selectionMode === "multiple") {
        manager.extendSelection(key);
        return;
      } else if (selectOnFocus && !isNonContiguousSelectionModifier(e)) {
        manager.replaceSelection(key);
        return;
      }
    }
    return false;
  };

  const arrowDown = (): ShortcutResult => {
    if (!delegate.getKeyBelow) return false;
    let next = manager.focusedKey != null ? delegate.getKeyBelow(manager.focusedKey) : delegate.getFirstKey?.();
    if (next == null && o.shouldFocusWrap) next = delegate.getFirstKey?.(manager.focusedKey);
    if (next != null) {
      navigateToKey(next);
      return;
    }
    return false;
  };
  const arrowUp = (): ShortcutResult => {
    if (!delegate.getKeyAbove) return false;
    let next = manager.focusedKey != null ? delegate.getKeyAbove(manager.focusedKey) : delegate.getLastKey?.();
    if (next == null && o.shouldFocusWrap) next = delegate.getLastKey?.(manager.focusedKey);
    if (next != null) {
      navigateToKey(next);
      return;
    }
    return false;
  };
  const arrowLeft = (): ShortcutResult => {
    if (!delegate.getKeyLeftOf) return false;
    let next = manager.focusedKey != null ? delegate.getKeyLeftOf(manager.focusedKey) : delegate.getFirstKey?.();
    if (next == null && o.shouldFocusWrap) next = direction === "rtl" ? delegate.getFirstKey?.(manager.focusedKey) : delegate.getLastKey?.(manager.focusedKey);
    if (next != null) {
      navigateToKey(next, direction === "rtl" ? "first" : "last");
      return;
    }
    return false;
  };
  const arrowRight = (): ShortcutResult => {
    if (!delegate.getKeyRightOf) return false;
    let next = manager.focusedKey != null ? delegate.getKeyRightOf(manager.focusedKey) : delegate.getFirstKey?.();
    if (next == null && o.shouldFocusWrap) next = direction === "rtl" ? delegate.getLastKey?.(manager.focusedKey) : delegate.getFirstKey?.(manager.focusedKey);
    if (next != null) {
      navigateToKey(next, direction === "rtl" ? "last" : "first");
      return;
    }
    return false;
  };
  const home = (): ShortcutResult => {
    if (!delegate.getFirstKey) return false;
    if (manager.focusedKey === null && e.shiftKey) return false;
    const first = delegate.getFirstKey(manager.focusedKey, isCtrlKeyPressed(e));
    manager.setFocusedKey(first);
    if (first != null) {
      if (isCtrlKeyPressed(e) && e.shiftKey && manager.selectionMode === "multiple") {
        manager.extendSelection(first);
        return;
      } else if (selectOnFocus) {
        manager.replaceSelection(first);
        return;
      }
    }
    return false;
  };
  const end = (): ShortcutResult => {
    if (!delegate.getLastKey) return false;
    if (manager.focusedKey === null && e.shiftKey) return false;
    const last = delegate.getLastKey(manager.focusedKey, isCtrlKeyPressed(e));
    manager.setFocusedKey(last);
    if (last != null) {
      if (isCtrlKeyPressed(e) && e.shiftKey && manager.selectionMode === "multiple") {
        manager.extendSelection(last);
        return;
      } else if (selectOnFocus) {
        manager.replaceSelection(last);
        return;
      }
    }
    return false;
  };
  const pageDown = (): ShortcutResult => {
    if (delegate.getKeyPageBelow && manager.focusedKey != null) {
      const next = delegate.getKeyPageBelow(manager.focusedKey);
      if (next != null) return navigateToKey(next);
    }
    return false;
  };
  const pageUp = (): ShortcutResult => {
    if (delegate.getKeyPageAbove && manager.focusedKey != null) {
      const next = delegate.getKeyPageAbove(manager.focusedKey);
      if (next != null) return navigateToKey(next);
    }
    return false;
  };
  const selectAllKey = (): ShortcutResult => {
    if (manager.selectionMode === "multiple" && o.disallowSelectAll !== true) {
      manager.selectAll();
      return;
    }
    return false;
  };
  const escape = (): ShortcutResult => {
    if ((o.escapeKeyBehavior ?? "clearSelection") === "clearSelection" && !o.disallowEmptySelection && manager.selectedKeys.size !== 0) {
      manager.clearSelection();
      return;
    }
    return false;
  };
  const tab = (): ShortcutResult => {
    if (!o.allowsTabNavigation) {
      // Treat the collection as one tab stop: move focus to its last tabbable element so the
      // browser's Tab continues after the collection.
      const list = tabbables(o.ref);
      const next = list[list.length - 1];
      const active = document.activeElement;
      if (next && (!next.contains(active) || (active && !isTabbable(active)))) next.focus({ preventScroll: true });
    }
    return { shouldContinuePropagation: true, shouldPreventDefault: false };
  };
  const shiftTab = (): ShortcutResult => {
    if (!o.allowsTabNavigation) o.ref.focus({ preventScroll: true });
    return { shouldContinuePropagation: true, shouldPreventDefault: false };
  };

  // Shortcut table (useKeyboard): arrows / pages with Shift, Shift+Alt|Ctrl, Alt|Ctrl; Home / End
  // the same (no repeats); Mod+A; Escape; Tab; Shift+Tab. Other modifier combinations pass through.
  const mods = (e.altKey ? "A" : "") + (e.ctrlKey ? "C" : "") + (e.metaKey ? "M" : "") + (e.shiftKey ? "S" : "");
  const nonContiguous = isMac() ? "A" : "C";
  const selMods = new Set(["", "S", nonContiguous, nonContiguous + "S"].map((m) => [...m].sort().join("")));
  const sortedMods = [...mods].sort().join("");
  let action: (() => ShortcutResult) | undefined;
  const key = e.key;
  const repeatable: Record<string, () => ShortcutResult> = {
    ArrowDown: arrowDown,
    ArrowUp: arrowUp,
    ArrowLeft: arrowLeft,
    ArrowRight: arrowRight,
    PageDown: pageDown,
    PageUp: pageUp,
  };
  if (repeatable[key] && selMods.has(sortedMods)) action = repeatable[key];
  else if (!e.repeat && (key === "Home" || key === "End") && selMods.has(sortedMods)) action = key === "Home" ? home : end;
  else if (!e.repeat && key.toLowerCase() === "a" && sortedMods === (isMac() ? "M" : "C")) action = selectAllKey;
  else if (!e.repeat && key === "Escape" && sortedMods === "") action = escape;
  else if (!e.repeat && key === "Tab" && sortedMods === "") action = tab;
  else if (!e.repeat && key === "Tab" && sortedMods === "S") action = shiftTab;
  if (!action) return false;
  const result = action();
  let prevent: boolean, stop: boolean;
  if (result === undefined) ((prevent = true), (stop = true));
  else if (result === false) ((prevent = false), (stop = false));
  else ((prevent = result.shouldPreventDefault), (stop = !result.shouldContinuePropagation));
  if (prevent) e.preventDefault();
  if (stop) e.stopPropagation();
  syncFocus(o);
  return prevent;
}

// --- typeahead (useTypeSelect) -------------------------------------------------------------------

const TYPEAHEAD_DEBOUNCE_WAIT_MS = 1000;
const searches = new WeakMap<object, { search: string; timeout?: ReturnType<typeof setTimeout> }>();

function getStringForKey(key: string): string {
  if (key.length === 1 || !/^[A-Z]/i.test(key)) return key;
  return "";
}

/** Typeahead step for a keydown; returns true when it consumed the key. */
export function typeSelectKeyDown(
  o: { manager: SelectionManager; delegate: KeyboardDelegate; state: object; ref: Element; onTypeSelect?: (key: Key) => void },
  e: KeyboardEvent,
): boolean {
  const { delegate, manager } = o;
  if (!delegate.getKeyForSearch) return false;
  let entry = searches.get(o.state);
  if (!entry) searches.set(o.state, (entry = { search: "" }));
  const restart = () => {
    clearTimeout(entry!.timeout);
    entry!.timeout = setTimeout(() => (entry!.search = ""), TYPEAHEAD_DEBOUNCE_WAIT_MS);
  };
  // Capture phase rule: a space in the middle of a search extends it.
  if (entry.search.length > 0 && e.key === " ") {
    e.preventDefault();
    e.stopPropagation();
    entry.search += " ";
    let key = delegate.getKeyForSearch(entry.search, manager.focusedKey);
    if (key == null) key = delegate.getKeyForSearch(entry.search);
    if (key != null) {
      manager.setFocusedKey(key);
      o.onTypeSelect?.(key);
    }
    restart();
    return true;
  }
  const character = getStringForKey(e.key);
  if (!character || e.ctrlKey || e.metaKey || e.altKey || !o.ref.contains(e.target as Node) || (entry.search.length === 0 && character === " ")) return false;
  entry.search += character;
  let key = delegate.getKeyForSearch(entry.search, manager.focusedKey);
  if (key == null) key = delegate.getKeyForSearch(entry.search);
  if (key != null) {
    manager.setFocusedKey(key);
    o.onTypeSelect?.(key);
    e.preventDefault();
    e.stopPropagation();
    restart();
    return true;
  }
  entry.search = "";
  clearTimeout(entry.timeout);
  entry.timeout = undefined;
  return false;
}

/** Test hook: forget a typeahead buffer. */
export function _resetTypeSelect(owner: object): void {
  searches.delete(owner);
}

// --- focus ---------------------------------------------------------------------------------------

/**
 * focusin on the collection element (useSelectableCollection onFocus): marks it focused and, when
 * nothing was focused yet, focuses the first / last selected or first / last item depending on the
 * direction focus came from.
 */
export function selectableCollectionFocusIn(o: SelectableCollectionOptions, e: FocusEvent): void {
  const { manager, delegate } = o;
  if (manager.isFocused) {
    if (!o.ref.contains(e.target as Node)) manager.setFocused(false);
    // Focus moved onto an item by pointer / Tab: keep focusedKey on it.
    return;
  }
  if (!o.ref.contains(e.target as Node)) return;
  manager.setFocused(true);
  const selectOnFocus = selectOnFocusOf(o);
  const go = (key: Key | null | undefined) => {
    if (key != null) {
      manager.setFocusedKey(key);
      if (selectOnFocus && !manager.isSelected(key)) manager.replaceSelection(key);
    }
  };
  if (manager.focusedKey == null) {
    const related = e.relatedTarget as Element | null;
    if (related && o.ref.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING) go(manager.lastSelectedKey ?? delegate.getLastKey?.());
    else go(manager.firstSelectedKey ?? delegate.getFirstKey?.());
  } else if (e.target === o.ref) {
    // Focus landed on the collection itself (it is the tab stop): forward it to the focused item.
  }
  if (manager.focusedKey != null) {
    const element = getItemElement(o.ref, manager.focusedKey);
    if (element && !element.contains(document.activeElement) && !o.shouldUseVirtualFocus) element.focus({ preventScroll: true });
    if (element && getInteractionModality() === "keyboard") scrollIntoViewport(element, o.ref);
  }
}

/** focusout on the collection element (useSelectableCollection onBlur). */
export function selectableCollectionFocusOut(o: { manager: SelectionManager }, e: FocusEvent): void {
  const current = e.currentTarget as Element | null;
  if (!current?.contains(e.relatedTarget as Node)) o.manager.setFocused(false);
}

/** mousedown on the collection: clicking the scrollbar of the scroll container does not focus it. */
export function selectableCollectionMouseDown(o: { ref: HTMLElement; scrollRef?: HTMLElement }, e: MouseEvent): void {
  if ((o.scrollRef ?? o.ref) === e.target) e.preventDefault();
}

/** Tab stop of the collection element: 0 until an item is focused (then the item is the stop). */
export const collectionTabIndex = (state: MultipleSelectionState, shouldUseVirtualFocus = false): number | undefined =>
  shouldUseVirtualFocus ? undefined : state.focusedKey() == null ? 0 : -1;

/** Move DOM focus to the focused key and keep it visible (useSelectableItem focus effect + scroll effect). */
export function syncFocus(o: { manager: SelectionManager; ref: HTMLElement; shouldUseVirtualFocus?: boolean; scrollRef?: HTMLElement }): void {
  const { manager } = o;
  const key = manager.focusedKey;
  if (!manager.isFocused) return;
  if (key == null) {
    if (!o.shouldUseVirtualFocus && !o.ref.contains(document.activeElement)) o.ref.focus({ preventScroll: true });
    return;
  }
  const element = getItemElement(o.ref, key);
  if (!element) return;
  if (!o.shouldUseVirtualFocus && document.activeElement !== element) focusSafely(element);
  if (getInteractionModality() === "keyboard") {
    scrollIntoView(o.scrollRef ?? o.ref, element);
    scrollIntoViewport(element, o.ref);
  }
}

/** focusSafely: focus without scrolling (scrolling is done by syncFocus for keyboard modality). */
export function focusSafely(element: HTMLElement): void {
  element.focus({ preventScroll: true });
}

/** Scroll `element` into the visible area of `scrollView` (nearest edge). */
export function scrollIntoView(scrollView: HTMLElement, element: HTMLElement): void {
  if (scrollView === element || !scrollView.contains(element)) return;
  const view = scrollView.getBoundingClientRect(),
    target = element.getBoundingClientRect();
  const style = getComputedStyle(scrollView);
  const top = view.top + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.scrollPaddingTop) || 0);
  const bottom = top + scrollView.clientHeight - (parseFloat(style.scrollPaddingTop) || 0) - (parseFloat(style.scrollPaddingBottom) || 0);
  const left = view.left + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.scrollPaddingLeft) || 0);
  const right = left + scrollView.clientWidth - (parseFloat(style.scrollPaddingLeft) || 0) - (parseFloat(style.scrollPaddingRight) || 0);
  let y = scrollView.scrollTop,
    x = scrollView.scrollLeft;
  if (target.top < top || target.bottom > bottom) {
    const start = target.top - top,
      endDelta = target.bottom - bottom;
    y += Math.abs(start) <= Math.abs(endDelta) ? start : endDelta;
  }
  if (target.left < left || target.right > right) {
    const start = target.left - left,
      endDelta = target.right - right;
    x += Math.abs(start) <= Math.abs(endDelta) ? start : endDelta;
  }
  if (y !== scrollView.scrollTop || x !== scrollView.scrollLeft) scrollView.scrollTo({ left: x, top: y });
}

/** Scroll the page so `element` is visible (react-aria scrollIntoViewport). */
export function scrollIntoViewport(element: Element | null, containingElement?: Element | null): void {
  if (!element?.isConnected) return;
  const before = element.getBoundingClientRect();
  element.scrollIntoView?.({ block: "nearest" });
  const after = element.getBoundingClientRect();
  if (Math.abs(before.left - after.left) > 1 || Math.abs(before.top - after.top) > 1) {
    containingElement?.scrollIntoView?.({ block: "center", inline: "center" });
    element.scrollIntoView?.({ block: "nearest" });
  }
}

// --- selectable item (useSelectableItem) ----------------------------------------------------------

export interface SelectableItemOptions {
  manager: SelectionManager;
  key: Key;
  element: HTMLElement;
  shouldSelectOnPressUp?: boolean;
  allowsDifferentPressOrigin?: boolean;
  shouldUseVirtualFocus?: boolean;
  isDisabled?: boolean;
  /** Item action (RAC `onAction(key)` bound to this key). */
  onAction?: () => void;
  linkBehavior?: LinkBehavior;
  router?: Router;
  /** RAC UNSTABLE_itemBehavior. */
  itemBehavior?: "action";
}

export interface SelectableItemFlags {
  isDisabled: boolean;
  allowsSelection: boolean;
  allowsActions: boolean;
  hasPrimaryAction: boolean;
  hasSecondaryAction: boolean;
  hasAction: boolean;
  longPressEnabled: boolean;
  hasLinkAction: boolean;
}

/** The item's interaction flags (also usable in render bindings with a data collection). */
export function selectableItemFlags(o: SelectableItemOptions): SelectableItemFlags {
  const { manager, key } = o;
  const linkBehavior = o.linkBehavior ?? "action";
  const isDisabled = !!o.isDisabled || manager.isDisabled(key);
  const isLinkOverride = manager.isLink(key) && linkBehavior === "override";
  const isActionOverride = !!o.onAction && o.itemBehavior === "action";
  const hasLinkAction = manager.isLink(key) && linkBehavior !== "selection" && linkBehavior !== "none";
  const allowsSelection = !isDisabled && manager.canSelectItem(key) && !isLinkOverride && !isActionOverride;
  const allowsActions = (!!o.onAction || hasLinkAction) && !isDisabled;
  const hasPrimaryAction = allowsActions && (manager.selectionBehavior === "replace" ? !allowsSelection : !allowsSelection || manager.isEmpty);
  const hasSecondaryAction = allowsActions && allowsSelection && manager.selectionBehavior === "replace";
  const hasAction = hasPrimaryAction || hasSecondaryAction;
  return {
    isDisabled,
    allowsSelection,
    allowsActions,
    hasPrimaryAction,
    hasSecondaryAction,
    hasAction,
    longPressEnabled: hasAction && allowsSelection,
    hasLinkAction,
  };
}

/** onSelect of useSelectableItem. */
export function selectItem(o: SelectableItemOptions, e: PressEvent): void {
  const { manager, key } = o;
  const linkBehavior = o.linkBehavior ?? "action";
  if (e.pointerType === "keyboard" && isNonContiguousSelectionModifier(e)) {
    manager.toggleSelection(key);
    return;
  }
  if (manager.selectionMode === "none") return;
  if (manager.isLink(key)) {
    if (linkBehavior === "selection") {
      const props = manager.getItemProps(key);
      if (props?.href) routerOpen(o.router, o.element, e, props.href, props.routerOptions);
      manager.setSelectedKeys(manager.selectedKeys);
      return;
    } else if (linkBehavior === "override" || linkBehavior === "none") return;
  }
  if (manager.selectionMode === "single") {
    if (manager.isSelected(key) && !manager.disallowEmptySelection) manager.toggleSelection(key);
    else manager.replaceSelection(key);
  } else if (e.shiftKey) manager.extendSelection(key);
  else if (manager.selectionBehavior === "toggle" || isCtrlKeyPressed(e as unknown as MouseEvent) || e.pointerType === "touch" || e.pointerType === "virtual")
    manager.toggleSelection(key);
  else manager.replaceSelection(key);
}

/** Run the item action: `onAction` and/or open its link. */
export function performItemAction(o: SelectableItemOptions, e: PressEvent, flags: SelectableItemFlags): void {
  if (o.onAction) {
    o.onAction();
    o.element.dispatchEvent(new CustomEvent("react-aria-item-action", { bubbles: true }));
  }
  if (flags.hasLinkAction) {
    const props = o.manager.getItemProps(o.key);
    if (props?.href) routerOpen(o.router, o.element, e, props.href, props.routerOptions);
  }
}

const isActionKey = (key: string | undefined) => key === "Enter";
const isSelectionKey = (key: string | undefined) => key === " ";

/** Per-item press bookkeeping between press start and press (transient). */
const pressStarts = new WeakMap<Element, { pointerType: string; hadPrimaryAction: boolean; longPressEnabled: boolean }>();

/** onPressStart of useSelectableItem. */
export function selectableItemPressStart(o: SelectableItemOptions, e: PressEvent): void {
  const flags = selectableItemFlags(o);
  pressStarts.set(o.element, { pointerType: e.pointerType, hadPrimaryAction: flags.hasPrimaryAction, longPressEnabled: flags.longPressEnabled });
  if (o.shouldUseVirtualFocus && e.pointerType !== "touch") {
    o.manager.setFocused(true);
    o.manager.setFocusedKey(o.key);
  }
  if (o.shouldSelectOnPressUp) {
    if (e.pointerType === "keyboard" && (!flags.hasAction || isSelectionKey(e.key))) selectItem(o, e);
    return;
  }
  // Select on mouse down unless a primary action happens on mouse up; keyboard: select on key
  // down, Space selects and Enter performs the action when the item has one.
  if (
    flags.allowsSelection &&
    ((e.pointerType === "mouse" && !flags.hasPrimaryAction) || (e.pointerType === "keyboard" && (!flags.allowsActions || isSelectionKey(e.key))))
  )
    selectItem(o, e);
}

/** onPressUp (allowsDifferentPressOrigin + shouldSelectOnPressUp). */
export function selectableItemPressUp(o: SelectableItemOptions, e: PressEvent): void {
  const flags = selectableItemFlags(o);
  if (o.shouldSelectOnPressUp && o.allowsDifferentPressOrigin && !flags.hasPrimaryAction && e.pointerType === "mouse" && flags.allowsSelection)
    selectItem(o, e);
}

/** onPress of useSelectableItem. */
export function selectableItemPress(o: SelectableItemOptions, e: PressEvent): void {
  const flags = selectableItemFlags(o);
  const start = pressStarts.get(o.element);
  pressStarts.delete(o.element);
  if (o.shouldUseVirtualFocus && e.pointerType === "touch") {
    o.manager.setFocused(true);
    o.manager.setFocusedKey(o.key);
  }
  if (o.shouldSelectOnPressUp) {
    if (!o.allowsDifferentPressOrigin) {
      if (flags.hasPrimaryAction || (flags.hasSecondaryAction && e.pointerType !== "mouse")) {
        if (e.pointerType === "keyboard" && !isActionKey(e.key)) return;
        performItemAction(o, e, flags);
      } else if (e.pointerType !== "keyboard" && flags.allowsSelection) selectItem(o, e);
    } else if (flags.hasPrimaryAction) performItemAction(o, e, flags);
    else if (e.pointerType !== "keyboard" && e.pointerType !== "mouse" && flags.allowsSelection) selectItem(o, e);
    return;
  }
  if (
    e.pointerType === "touch" ||
    e.pointerType === "pen" ||
    e.pointerType === "virtual" ||
    (e.pointerType === "keyboard" && flags.hasAction && isActionKey(e.key)) ||
    (e.pointerType === "mouse" && !!start?.hadPrimaryAction)
  ) {
    if (flags.hasAction) performItemAction(o, e, flags);
    else if (flags.allowsSelection) selectItem(o, e);
  }
}

/** Double click: secondary action with a mouse (selectionBehavior "replace"). Returns true when handled. */
export function selectableItemDoubleClick(o: SelectableItemOptions, e: MouseEvent, lastPointerType: string | undefined): boolean {
  const flags = selectableItemFlags(o);
  if (!flags.hasSecondaryAction || lastPointerType !== "mouse") return false;
  e.stopPropagation();
  e.preventDefault();
  performItemAction(o, pressEvent("press", "mouse", o.element, e), flags);
  return true;
}

/** Long press with touch: select and switch to toggle behaviour (selection mode). */
export function selectableItemLongPress(o: SelectableItemOptions, e: PressEvent): void {
  if (e.pointerType !== "touch") return;
  selectItem(o, e);
  o.manager.setSelectionBehavior("toggle");
}

/** Link items: clicks are cancelled unless the click is openLink's own synthetic one. */
export function selectableItemLinkClick(o: { manager: SelectionManager; key: Key; linkBehavior?: LinkBehavior }, e: MouseEvent): void {
  if ((o.linkBehavior ?? "action") !== "none" && o.manager.isLink(o.key) && !isOpeningLink()) e.preventDefault();
}

/** Whether a press target inside the item belongs to a nested interactive element or another collection. */
export function isChildInteraction(item: Element, target: Element, collectionId: string | null): boolean {
  let el: Element | null = target;
  while (el && el !== item) {
    const owner = el.getAttribute("data-collection");
    if (owner != null && el.hasAttribute("data-key")) return owner !== collectionId;
    el = el.parentElement;
  }
  return isTabbable(target);
}

/** Roving tabindex of an item (reads `focusedKey`): 0 for the focused key, -1 otherwise; none when disabled or virtual focus. */
export function itemTabIndex(state: MultipleSelectionState, key: Key, disabled = false, shouldUseVirtualFocus = false): number | undefined {
  if (shouldUseVirtualFocus || disabled) return undefined;
  const focused = state.focusedKey();
  return focused != null && String(focused) === String(key) ? 0 : -1;
}

/** Whether `key` is the focused key (reads signals). */
export const isItemFocused = (state: MultipleSelectionState, key: Key): boolean => {
  const focused = state.focusedKey();
  return state.isFocused() && focused != null && String(focused) === String(key);
};

/** Untracked focused key. */
export const focusedKeyOf = (state: MultipleSelectionState): Key | null => untrack(state.focusedKey);
