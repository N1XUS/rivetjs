// Ported from @react-aria/selection (useSelectableCollection.ts), Apache-2.0, © Adobe.
//
// Rivet shape: react-aria returns a props bag with closures; here the behaviour is a set of handler
// bodies taking `(options, event)` — wire them as explicit `onKeyDown` / `onFocusIn` / … attributes
// so they resume — plus attribute accessors (`collectionTabIndex`). React's effects (focus the item
// that became `focusedKey`, scroll it into view, focus the collection when the focused item goes
// away) run synchronously at the end of each handler (`syncFocus`). Options are cheap to rebuild per
// event from serializable state; never capture a `SelectionManager` in a resumable closure.
import { untrack } from "@rivetjs/reactivity";
import { direction as elementDirection } from "../bidi/index.ts";
import { tabbables, isTabbable } from "../a11y/index.ts";
import type { Direction, FocusStrategy, Key, KeyboardDelegate } from "../collections/types.ts";
import type { MultipleSelectionManager } from "./manager.ts";
import {
  dispatchVirtualFocus,
  focusSafely,
  focusWithoutScrolling,
  getInteractionModality,
  isOpeningLink,
  moveVirtualFocus,
  nodeContains,
  openLink,
  scrollIntoView,
  scrollIntoViewport,
  trackModality,
} from "./dom-utils.ts";
import { typeSelectKeyDown, typeSelectKeyDownCapture } from "./type-select.ts";
import { getItemElement, isCtrlKeyPressed, isNonContiguousSelectionModifier, refElement, type RefLike } from "./utils.ts";
import { isMac } from "../platform/index.ts";

/** Custom events for updating an autocomplete's aria-activedescendant (react-aria constants). */
export const CLEAR_FOCUS_EVENT = "react-aria-clear-focus";
export const FOCUS_EVENT = "react-aria-focus";

export type LinkBehavior = "action" | "selection" | "override";

export interface AriaSelectableCollectionOptions {
  /** An interface for reading and updating multiple selection state. */
  selectionManager: MultipleSelectionManager;
  /** A delegate object that implements behavior for keyboard focus movement. */
  keyboardDelegate: KeyboardDelegate;
  /** The collection element (ref or element; handlers default to `event.currentTarget`). */
  ref?: RefLike;
  /** Whether the collection or one of its items should be automatically focused upon render. */
  autoFocus?: boolean | FocusStrategy | undefined;
  /** Whether focus should wrap around when the end/start is reached. */
  shouldFocusWrap?: boolean | undefined;
  /** Whether the collection allows empty selection. */
  disallowEmptySelection?: boolean | undefined;
  /** Whether the collection allows the user to select all items via keyboard shortcut. */
  disallowSelectAll?: boolean | undefined;
  /** Whether pressing Escape should clear selection. Default "clearSelection". */
  escapeKeyBehavior?: "clearSelection" | "none" | undefined;
  /** Whether selection should occur automatically on focus. Default: selectionBehavior === "replace". */
  selectOnFocus?: boolean | undefined;
  /** Whether typeahead is disabled. */
  disallowTypeAhead?: boolean | undefined;
  /** Whether the collection items should use virtual focus instead of being focused directly. */
  shouldUseVirtualFocus?: boolean | undefined;
  /** Whether navigation through tab key is enabled. */
  allowsTabNavigation?: boolean | undefined;
  /** Whether the collection items are contained in a virtual scroller. */
  isVirtualized?: boolean | undefined;
  /** The scrollable body (default: the collection element). */
  scrollRef?: RefLike;
  /** The behavior of links in the collection. Default "action". */
  linkBehavior?: LinkBehavior | undefined;
  /** @private Which item to focus when tabbing into the collection. */
  UNSTABLE_focusOnEntry?: "first" | "last" | undefined;
  /** Reading direction (default: computed from the collection element). */
  direction?: Direction | undefined;
}

type Ev<E extends Event> = E & { currentTarget: EventTarget | null };

interface Resolved {
  manager: MultipleSelectionManager;
  delegate: KeyboardDelegate;
  ref: HTMLElement | null;
  scrollRef: HTMLElement | null;
  selectOnFocus: boolean;
  shouldFocusWrap: boolean;
  disallowEmptySelection: boolean;
  disallowSelectAll: boolean;
  escapeKeyBehavior: "clearSelection" | "none";
  shouldUseVirtualFocus: boolean;
  allowsTabNavigation: boolean;
  linkBehavior: LinkBehavior;
  direction: Direction;
  options: AriaSelectableCollectionOptions;
}

function resolve(options: AriaSelectableCollectionOptions, event?: Event): Resolved {
  const ref = refElement(options.ref) ?? ((event?.currentTarget as HTMLElement | null) || null);
  const manager = options.selectionManager;
  return {
    manager,
    delegate: options.keyboardDelegate,
    ref,
    scrollRef: refElement(options.scrollRef) ?? ref,
    selectOnFocus: options.selectOnFocus ?? manager.selectionBehavior === "replace",
    shouldFocusWrap: options.shouldFocusWrap ?? false,
    disallowEmptySelection: options.disallowEmptySelection ?? false,
    disallowSelectAll: options.disallowSelectAll ?? false,
    escapeKeyBehavior: options.escapeKeyBehavior ?? "clearSelection",
    shouldUseVirtualFocus: !!options.shouldUseVirtualFocus,
    allowsTabNavigation: options.allowsTabNavigation ?? false,
    linkBehavior: options.linkBehavior ?? "action",
    direction: options.direction ?? (ref ? elementDirection(ref) : "ltr"),
    options,
  };
}

type ShortcutResult = void | boolean | { shouldContinuePropagation?: boolean; shouldPreventDefault?: boolean };

function navigateToKey(r: Resolved, e: KeyboardEvent, key: Key | null | undefined, childFocus?: FocusStrategy): ShortcutResult {
  const { manager, selectOnFocus, linkBehavior } = r;
  if (key != null) {
    if (manager.isLink(key) && linkBehavior === "selection" && selectOnFocus && !isNonContiguousSelectionModifier(e)) {
      // Set focused key (synchronously brings the item into view), then follow the link.
      manager.setFocusedKey(key, childFocus);
      const item = getItemElement(r.ref, key);
      const itemProps = manager.getItemProps(key);
      if (item) {
        openLink(item, e, itemProps.href);
        return;
      }
      return false;
    }
    manager.setFocusedKey(key, childFocus);
    if (manager.isLink(key) && linkBehavior === "override") return false;
    if (e.shiftKey && manager.selectionMode === "multiple") {
      manager.extendSelection(key);
      return;
    } else if (selectOnFocus && !isNonContiguousSelectionModifier(e)) {
      manager.replaceSelection(key);
      return;
    }
  }
  return false;
}

function arrowDown(r: Resolved, e: KeyboardEvent): ShortcutResult {
  const { manager, delegate } = r;
  if (delegate.getKeyBelow) {
    let nextKey = manager.focusedKey != null ? delegate.getKeyBelow(manager.focusedKey) : delegate.getFirstKey?.();
    if (nextKey == null && r.shouldFocusWrap) nextKey = delegate.getFirstKey?.(manager.focusedKey);
    if (nextKey != null) {
      navigateToKey(r, e, nextKey);
      return;
    }
  }
  return false;
}

function arrowUp(r: Resolved, e: KeyboardEvent): ShortcutResult {
  const { manager, delegate } = r;
  if (delegate.getKeyAbove) {
    let nextKey = manager.focusedKey != null ? delegate.getKeyAbove(manager.focusedKey) : delegate.getLastKey?.();
    if (nextKey == null && r.shouldFocusWrap) nextKey = delegate.getLastKey?.(manager.focusedKey);
    if (nextKey != null) {
      navigateToKey(r, e, nextKey);
      return;
    }
  }
  return false;
}

function arrowLeft(r: Resolved, e: KeyboardEvent): ShortcutResult {
  const { manager, delegate, direction } = r;
  if (delegate.getKeyLeftOf) {
    let nextKey = manager.focusedKey != null ? delegate.getKeyLeftOf(manager.focusedKey) : delegate.getFirstKey?.();
    if (nextKey == null && r.shouldFocusWrap)
      nextKey = direction === "rtl" ? delegate.getFirstKey?.(manager.focusedKey) : delegate.getLastKey?.(manager.focusedKey);
    if (nextKey != null) {
      navigateToKey(r, e, nextKey, direction === "rtl" ? "first" : "last");
      return;
    }
  }
  return false;
}

function arrowRight(r: Resolved, e: KeyboardEvent): ShortcutResult {
  const { manager, delegate, direction } = r;
  if (delegate.getKeyRightOf) {
    let nextKey = manager.focusedKey != null ? delegate.getKeyRightOf(manager.focusedKey) : delegate.getFirstKey?.();
    if (nextKey == null && r.shouldFocusWrap)
      nextKey = direction === "rtl" ? delegate.getLastKey?.(manager.focusedKey) : delegate.getFirstKey?.(manager.focusedKey);
    if (nextKey != null) {
      navigateToKey(r, e, nextKey, direction === "rtl" ? "last" : "first");
      return;
    }
  }
  return false;
}

function home(r: Resolved, e: KeyboardEvent): ShortcutResult {
  const { manager, delegate } = r;
  if (delegate.getFirstKey) {
    if (manager.focusedKey === null && e.shiftKey) return false;
    const firstKey = delegate.getFirstKey(manager.focusedKey, isCtrlKeyPressed(e));
    manager.setFocusedKey(firstKey);
    if (firstKey != null) {
      if (isCtrlKeyPressed(e) && e.shiftKey && manager.selectionMode === "multiple") {
        manager.extendSelection(firstKey);
        return;
      } else if (r.selectOnFocus) {
        manager.replaceSelection(firstKey);
        return;
      }
    }
  }
  return false;
}

function end(r: Resolved, e: KeyboardEvent): ShortcutResult {
  const { manager, delegate } = r;
  if (delegate.getLastKey) {
    if (manager.focusedKey === null && e.shiftKey) return false;
    const lastKey = delegate.getLastKey(manager.focusedKey, isCtrlKeyPressed(e));
    manager.setFocusedKey(lastKey);
    if (lastKey != null) {
      if (isCtrlKeyPressed(e) && e.shiftKey && manager.selectionMode === "multiple") {
        manager.extendSelection(lastKey);
        return;
      } else if (r.selectOnFocus) {
        manager.replaceSelection(lastKey);
        return;
      }
    }
  }
  return false;
}

function pageDown(r: Resolved, e: KeyboardEvent): ShortcutResult {
  const { manager, delegate } = r;
  if (delegate.getKeyPageBelow && manager.focusedKey != null) {
    const nextKey = delegate.getKeyPageBelow(manager.focusedKey);
    if (nextKey != null) return navigateToKey(r, e, nextKey);
  }
  return false;
}

function pageUp(r: Resolved, e: KeyboardEvent): ShortcutResult {
  const { manager, delegate } = r;
  if (delegate.getKeyPageAbove && manager.focusedKey != null) {
    const nextKey = delegate.getKeyPageAbove(manager.focusedKey);
    if (nextKey != null) return navigateToKey(r, e, nextKey);
  }
  return false;
}

function selectAllKey(r: Resolved): ShortcutResult {
  if (r.manager.selectionMode === "multiple" && r.disallowSelectAll !== true) {
    r.manager.selectAll();
    return;
  }
  return false;
}

function escape(r: Resolved): ShortcutResult {
  if (r.escapeKeyBehavior === "clearSelection" && !r.disallowEmptySelection && r.manager.selectedKeys.size !== 0) {
    r.manager.clearSelection();
    return;
  }
  return false;
}

function tab(r: Resolved): ShortcutResult {
  if (!r.allowsTabNavigation && r.ref) {
    // Collections are a single tab stop: move focus to the last tabbable element inside, so the
    // browser default Tab continues from there (out of the collection).
    const list = tabbables(r.ref);
    const next = list[list.length - 1];
    const activeElement = r.ref.ownerDocument.activeElement;
    // If the active element is not tabbable but is contained by a tabbable element (a cell), the
    // browser moves focus to the container: special-case it so Tab leaves the grid.
    if (next && (!nodeContains(next, activeElement) || (activeElement && !isTabbable(activeElement)))) focusWithoutScrolling(next);
  }
  return { shouldContinuePropagation: true, shouldPreventDefault: false };
}

function shiftTab(r: Resolved): ShortcutResult {
  if (!r.allowsTabNavigation && r.ref) r.ref.focus();
  return { shouldContinuePropagation: true, shouldPreventDefault: false };
}

/** Shortcut match: `Key`, `Key+Shift`, `Key+Alt|Control` (non-contiguous), `Key+Shift+Alt|Control`. */
function withShiftSel(e: KeyboardEvent): boolean {
  // The non-contiguous modifier (Alt on Mac, Control elsewhere) and Shift are allowed; others not.
  return isMac() ? !e.ctrlKey && !e.metaKey : !e.altKey && !e.metaKey;
}

function runShortcut(e: KeyboardEvent, action: () => ShortcutResult): boolean {
  let result = action();
  let handled: { shouldContinuePropagation?: boolean; shouldPreventDefault?: boolean };
  if (result === undefined) handled = { shouldContinuePropagation: false, shouldPreventDefault: true };
  else if (typeof result === "boolean") handled = { shouldContinuePropagation: !result, shouldPreventDefault: result };
  else handled = result;
  if (handled.shouldPreventDefault) e.preventDefault();
  if (!handled.shouldContinuePropagation) e.stopPropagation();
  return !handled.shouldContinuePropagation;
}

/** Keys the collection handles on keydown (for `data-rk`, held while a cold chunk loads). */
export const selectableCollectionKeys = "ArrowDown ArrowUp ArrowLeft ArrowRight Home End PageUp PageDown";

/**
 * keydown, capture phase, on the collection element (react-aria's `onKeyDownCapture` of the type
 * select): while a search is in progress, Space extends it and is stopped before items see it.
 * Delegated wiring calls this first; returns whether it handled the event.
 */
export function selectableCollectionKeyDownCapture(options: AriaSelectableCollectionOptions, e: Ev<KeyboardEvent>): boolean {
  if (options.disallowTypeAhead) return false;
  const r = resolve(options, e);
  trackModality(e);
  const before = untrack(() => r.manager.focusedKey);
  const handled = typeSelectKeyDownCapture(r.ref ?? options, { keyboardDelegate: r.delegate, selectionManager: r.manager }, e);
  if (handled) syncFocus(options, before, e);
  return handled;
}

/**
 * keydown (bubble phase) on the collection element: arrow / Home / End / Page navigation, Shift
 * range extension, Mod+A, Escape, Tab, then typeahead. Item-level Space / Enter presses belong to
 * `selectableItemKeyDown` (on the item, before this). Returns whether the event was handled.
 */
export function selectableCollectionKeyDown(options: AriaSelectableCollectionOptions, e: Ev<KeyboardEvent>): boolean {
  const r = resolve(options, e);
  trackModality(e);
  const before = untrack(() => r.manager.focusedKey);
  let handled = false;
  // Events from portals (not inside the collection element) are ignored.
  if (!r.ref || nodeContains(r.ref, e.target as Node)) {
    if (!e.isComposing) handled = shortcut(r, e);
    if (!handled && !options.disallowTypeAhead) handled = typeSelectKeyDown(r.ref ?? options, { keyboardDelegate: r.delegate, selectionManager: r.manager }, e);
  }
  syncFocus(options, before, e);
  return handled;
}

function shortcut(r: Resolved, e: KeyboardEvent): boolean {
  const key = e.key;
  const repeatable: Record<string, (r: Resolved, e: KeyboardEvent) => ShortcutResult> = {
    ArrowDown: arrowDown,
    ArrowUp: arrowUp,
    ArrowLeft: arrowLeft,
    ArrowRight: arrowRight,
    PageDown: pageDown,
    PageUp: pageUp,
  };
  const fn = repeatable[key];
  if (fn) return withShiftSel(e) ? runShortcut(e, () => fn(r, e)) : false;
  if (e.repeat) return false;
  if (key === "Home" || key === "End") return withShiftSel(e) ? runShortcut(e, () => (key === "Home" ? home : end)(r, e)) : false;
  const mod = isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (key.toLowerCase() === "a" && mod && !e.shiftKey && !e.altKey) return runShortcut(e, () => selectAllKey(r));
  const noMods = !e.altKey && !e.ctrlKey && !e.metaKey;
  if (key === "Escape" && noMods && !e.shiftKey) return runShortcut(e, () => escape(r));
  if (key === "Tab" && noMods) return runShortcut(e, () => (e.shiftKey ? shiftTab(r) : tab(r)));
  return false;
}

interface CollectionMemo {
  scrollTop: number;
  scrollLeft: number;
  shouldVirtualFocusFirst: boolean;
  lastFocusedKey: Key | null;
  didAutoFocus: boolean;
  autoFocusPending: boolean;
}
const memos = new WeakMap<object, CollectionMemo>();
const memoOf = (owner: object): CollectionMemo => {
  let m = memos.get(owner);
  if (!m)
    memos.set(owner, (m = { scrollTop: 0, scrollLeft: 0, shouldVirtualFocusFirst: false, lastFocusedKey: null, didAutoFocus: false, autoFocusPending: true }));
  return m;
};

/** scroll on the scrollable body: remember the position (restored when focus re-enters). */
export function selectableCollectionScroll(options: AriaSelectableCollectionOptions, e: Ev<Event>): void {
  const r = resolve(options, e);
  const m = memoOf(r.ref ?? options);
  m.scrollTop = r.scrollRef?.scrollTop ?? 0;
  m.scrollLeft = r.scrollRef?.scrollLeft ?? 0;
}

/**
 * focus (wire as `onFocusIn`: Rivet delegates `focusin`) on the collection element. Restores the
 * last focused item, or picks the first / last (selected) item depending on where focus came from.
 */
export function selectableCollectionFocus(options: AriaSelectableCollectionOptions, e: Ev<FocusEvent>): void {
  const r = resolve(options, e);
  const { manager, delegate } = r;
  const target = e.target as Node | null;
  const current = (r.ref ?? e.currentTarget) as Element | null;
  if (manager.isFocused) {
    // If a focus event bubbled through a portal, reset focus state.
    if (!nodeContains(current, target)) manager.setFocused(false);
    return;
  }
  // Focus events can bubble through portals. Ignore these events.
  if (!nodeContains(current, target)) return;

  const modality = getInteractionModality();
  manager.setFocused(true);
  const navigate = (key: Key | undefined | null) => {
    if (key != null) {
      manager.setFocusedKey(key);
      if (r.selectOnFocus && !manager.isSelected(key)) manager.replaceSelection(key);
    }
  };
  const m = memoOf(r.ref ?? options);
  if (options.UNSTABLE_focusOnEntry && (modality === "keyboard" || modality === "virtual")) {
    navigate(options.UNSTABLE_focusOnEntry === "first" ? delegate.getFirstKey?.() : delegate.getLastKey?.());
  } else if (manager.focusedKey == null) {
    // No focused key yet: detect whether the user is tabbing forward or backward into the
    // collection and focus the first or last item accordingly.
    const relatedTarget = e.relatedTarget as Element | null;
    if (relatedTarget && current && current.compareDocumentPosition(relatedTarget) & Node.DOCUMENT_POSITION_FOLLOWING) {
      navigate(manager.lastSelectedKey ?? delegate.getLastKey?.());
    } else navigate(manager.firstSelectedKey ?? delegate.getFirstKey?.());
  } else if (r.scrollRef) {
    // Restore the scroll position to what it was before.
    r.scrollRef.scrollTop = m.scrollTop;
    r.scrollRef.scrollLeft = m.scrollLeft;
  }

  if (manager.focusedKey != null && r.scrollRef) {
    // Refocus and scroll the focused item into view if it exists within the scrollable region.
    const element = getItemElement(r.ref, manager.focusedKey);
    if (element) {
      // This prevents a flash of focus on the first/last element in the collection, or the collection itself.
      if (!nodeContains(element, element.ownerDocument.activeElement) && !r.shouldUseVirtualFocus) focusWithoutScrolling(element);
      if (modality === "keyboard" || (options.UNSTABLE_focusOnEntry && modality === "virtual")) scrollIntoViewport(element, { containingElement: r.ref });
    }
  }
  m.lastFocusedKey = manager.focusedKey;
}

/** blur (wire as `onFocusOut`) on the collection element. */
export function selectableCollectionBlur(options: AriaSelectableCollectionOptions, e: Ev<FocusEvent>): void {
  const r = resolve(options, e);
  // Don't set blurred and then focused again if moving focus within the collection.
  if (!nodeContains((r.ref ?? e.currentTarget) as Node | null, e.relatedTarget as Node | null)) r.manager.setFocused(false);
}

/** mousedown on the collection element: clicking the scrollbar must not focus the collection. */
export function selectableCollectionMouseDown(options: AriaSelectableCollectionOptions, e: Ev<MouseEvent>): void {
  const r = resolve(options, e);
  trackModality(e);
  if (r.scrollRef === e.target) e.preventDefault();
}

/** `FOCUS_EVENT` (virtual focus, autocomplete): the collection takes virtual focus. */
export function selectableCollectionVirtualFocus(options: AriaSelectableCollectionOptions, e: Ev<CustomEvent<{ focusStrategy?: FocusStrategy }>>): void {
  if (!options.shouldUseVirtualFocus) return;
  const r = resolve(options, e);
  e.stopPropagation();
  r.manager.setFocused(true);
  // If the user is typing forwards, autofocus the first option in the list.
  if (e.detail?.focusStrategy === "first") memoOf(r.ref ?? options).shouldVirtualFocusFirst = true;
}

/** `CLEAR_FOCUS_EVENT` (virtual focus): drop virtual focus, optionally clearing the focused key. */
export function selectableCollectionClearVirtualFocus(options: AriaSelectableCollectionOptions, e: Ev<CustomEvent<{ clearFocusKey?: boolean }>>): void {
  if (!options.shouldUseVirtualFocus) return;
  const r = resolve(options, e);
  e.stopPropagation();
  r.manager.setFocused(false);
  if (e.detail?.clearFocusKey) r.manager.setFocusedKey(null);
}

/**
 * Collection contents changed (call from the component's effect after a filter / load): with a
 * pending "virtual focus first" request, focus the first key, or clear the active descendant when
 * nothing is focusable.
 */
export function selectableCollectionUpdated(options: AriaSelectableCollectionOptions): void {
  const r = resolve(options);
  const m = memoOf(r.ref ?? options);
  if (!m.shouldVirtualFocusFirst) return;
  const firstKey = r.delegate.getFirstKey?.() ?? null;
  if (firstKey == null) {
    const previousActiveElement = r.ref?.ownerDocument.activeElement ?? null;
    moveVirtualFocus(r.ref);
    if (previousActiveElement) dispatchVirtualFocus(previousActiveElement, null);
    // All keys disabled (not a loading state): stop trying.
    if (r.manager.collection.size > 0) m.shouldVirtualFocusFirst = false;
  } else {
    r.manager.setFocusedKey(firstKey);
    m.shouldVirtualFocusFirst = false;
  }
}

/**
 * Auto focus (react-aria's mount effect for `autoFocus`): focus the first selectable selected key,
 * else the first / last key, else the collection. Call once the collection element is connected
 * (e.g. from a `clientEffect`). Returns whether it ran (retries while the collection is empty).
 */
export function selectableCollectionAutoFocus(options: AriaSelectableCollectionOptions): boolean {
  const r = resolve(options);
  const { manager, delegate } = r;
  const m = memoOf(r.ref ?? options);
  if (!options.autoFocus || !m.autoFocusPending) return false;
  let focusedKey: Key | null = null;
  if (options.autoFocus === "first") focusedKey = delegate.getFirstKey?.() ?? null;
  if (options.autoFocus === "last") focusedKey = delegate.getLastKey?.() ?? null;
  // If there are any selected keys, make the first one the new focus target.
  const selectedKeys = manager.selectedKeys;
  if (selectedKeys.size) {
    for (const key of selectedKeys) {
      if (manager.canSelectItem(key)) {
        focusedKey = key;
        break;
      }
    }
  }
  manager.setFocused(true);
  manager.setFocusedKey(focusedKey);
  if (focusedKey != null && r.selectOnFocus && !selectedKeys.size && manager.canSelectItem(focusedKey)) manager.replaceSelection(focusedKey);
  // If no default focus key is selected, focus the collection itself.
  if (focusedKey == null && !r.shouldUseVirtualFocus && r.ref) focusSafely(r.ref);
  // Wait until the collection has items to autofocus.
  if (manager.collection.size > 0) {
    m.autoFocusPending = false;
    m.didAutoFocus = true;
  }
  syncFocus(options, null);
  return true;
}

/**
 * react-aria's post-render effects, run after a handler changed state: move DOM (or virtual) focus
 * to the focused item, scroll it into view (keyboard modality / after auto focus), and focus the
 * collection when the focused item went away.
 */
export function syncFocus(options: AriaSelectableCollectionOptions, previousKey: Key | null, event?: Event): void {
  const r = resolve(options, event);
  const { manager } = r;
  const m = memoOf(r.ref ?? options);
  const focusedKey = untrack(() => manager.focusedKey);
  const isFocused = untrack(() => manager.isFocused);
  const changed = focusedKey !== previousKey;
  if (isFocused && focusedKey != null && (changed || m.didAutoFocus) && r.ref) {
    const element = getItemElement(r.ref, focusedKey);
    if (element) {
      // useSelectableItem: focus the item that became the focused key.
      if (!r.shouldUseVirtualFocus) {
        if (element.ownerDocument.activeElement !== element) focusSafely(element);
      } else moveVirtualFocus(element);
      const modality = getInteractionModality();
      if ((modality === "keyboard" || m.didAutoFocus) && r.scrollRef) {
        scrollIntoView(r.scrollRef, element);
        // Avoid scroll in iOS VO, since it may cause overlay to close.
        if (modality !== "virtual") scrollIntoViewport(element, { containingElement: r.ref });
      }
    }
  }
  // If the focused key becomes null (e.g. the last item is deleted), focus the whole collection.
  if (!r.shouldUseVirtualFocus && isFocused && focusedKey == null && previousKey != null && r.ref) focusSafely(r.ref);
  m.lastFocusedKey = focusedKey;
  m.didAutoFocus = false;
  // Any other focused key change clears a pending "virtual focus first".
  if (changed && manager.collection.size > 0) m.shouldVirtualFocusFirst = false;
}

/**
 * tabIndex of the collection element: tabbable while nothing inside is focused (marshalled to the
 * first / last item on focus); undefined with virtual focus. Reads `focusedKey` (bind as accessor).
 */
export function collectionTabIndex(manager: Pick<MultipleSelectionManager, "focusedKey">, shouldUseVirtualFocus?: boolean): number | undefined {
  if (shouldUseVirtualFocus) return undefined;
  return manager.focusedKey == null ? 0 : -1;
}

export interface SelectableCollectionAria {
  /** Props for the collection element (client-side / imperative wiring; not resumable). */
  collectionProps: {
    tabIndex: number | undefined;
    "data-collection"?: string | undefined;
    onKeyDownCapture: (e: KeyboardEvent) => void;
    onKeyDown: (e: KeyboardEvent) => void;
    onFocusIn: (e: FocusEvent) => void;
    onFocusOut: (e: FocusEvent) => void;
    onMouseDown: (e: MouseEvent) => void;
  };
}

/**
 * react-aria `useSelectableCollection` shape for imperative / client-only use (`addEventListener`).
 * Resumable components wire the handler bodies above instead.
 */
export function useSelectableCollection(options: AriaSelectableCollectionOptions & { collectionId?: string }): SelectableCollectionAria {
  return {
    collectionProps: {
      tabIndex: collectionTabIndex(options.selectionManager, options.shouldUseVirtualFocus),
      "data-collection": options.collectionId,
      onKeyDownCapture: (e) => void selectableCollectionKeyDownCapture(options, e as Ev<KeyboardEvent>),
      onKeyDown: (e) => void selectableCollectionKeyDown(options, e as Ev<KeyboardEvent>),
      onFocusIn: (e) => selectableCollectionFocus(options, e as Ev<FocusEvent>),
      onFocusOut: (e) => selectableCollectionBlur(options, e as Ev<FocusEvent>),
      onMouseDown: (e) => selectableCollectionMouseDown(options, e as Ev<MouseEvent>),
    },
  };
}

export { isOpeningLink };
