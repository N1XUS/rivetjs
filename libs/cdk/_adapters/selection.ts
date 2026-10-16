// Ported from react-spectrum (react-aria: selection/useSelectableCollection, selection/useSelectableItem,
// selection/useSelectableList, selection/useTypeSelect), Apache-2.0, © Adobe.
//
// LOCAL ADAPTER for the `cdk-collections` branch. The hooks become handler bodies delegated on the
// collection root (one listener per event type for the whole collection: resumable, no per-item
// closures). The React effects ("focus the item when it becomes the focused key", "scroll it into
// view") run imperatively at the end of each handler (`syncFocus`). Transient state (typeahead
// buffer, press in progress) lives in WeakMaps keyed by the selection state; never serialized.
import { untrack } from "@rivetjs/reactivity";
import { direction as dirOf } from "@rivetjs/cdk/bidi";
import { isMac, isCtrlKeyPressed } from "@rivetjs/cdk/platform";
import { tabbables, isTabbable } from "@rivetjs/cdk/a11y";
import {
  COLLECTION_ATTR,
  GroupSelectionManager,
  ListKeyboardDelegate,
  SelectionManager,
  domCollection,
  domKey,
  getItemElement,
  getSearchCollator,
  isNonContiguousSelectionModifier,
  type FocusStrategy,
  type Key,
  type KeyboardDelegate,
  type MultipleSelectionState,
  type Orientation,
} from "./collections.ts";
import {
  cancelLongPress,
  focusSafely,
  focusWithoutScrolling,
  getInteractionModality,
  isFocusVisible,
  isOpeningLink,
  isVirtualClick,
  moveVirtualFocus,
  noteModality,
  openLink,
  pointerTypeOf,
  pressEvent,
  scrollIntoView,
  scrollIntoViewport,
  startLongPress,
  type PointerType,
  type PressEvent,
} from "./interactions.ts";
import { typeSelectKeyDown } from "./type-select.ts";

export type LinkBehavior = "action" | "selection" | "override" | "none";

/** Static (serializable) options of a selectable collection + its items. */
export interface SelectableOptions {
  /** react-aria `autoFocus` (applied by the opener, e.g. a menu trigger: see `autoFocusCollection`). */
  shouldFocusWrap?: boolean;
  disallowEmptySelection?: boolean;
  disallowSelectAll?: boolean;
  escapeKeyBehavior?: "clearSelection" | "none";
  /** Default: `selectionBehavior === "replace"`. */
  selectOnFocus?: boolean;
  disallowTypeAhead?: boolean;
  shouldUseVirtualFocus?: boolean;
  allowsTabNavigation?: boolean;
  linkBehavior?: LinkBehavior;
  orientation?: Orientation;
  layout?: "stack" | "grid";
  // Item options (useSelectableItem / useOption).
  shouldSelectOnPressUp?: boolean;
  allowsDifferentPressOrigin?: boolean;
  shouldFocusOnHover?: boolean;
}

/** A selectable collection: its selection state, static options and action callback. */
export interface SelectableCollection extends MultipleSelectionState {
  readonly options: SelectableOptions;
  /** RAC `onAction(key)` (resumable function prop). */
  readonly onAction?: ((key: Key) => void) | undefined;
  /** Sections with their own selection (RAC `MenuSection selectionMode`), by section key. */
  readonly groups?: Readonly<Record<string, MultipleSelectionState>> | undefined;
}

/** The manager selecting `key`: its section's own (GroupSelectionManager) or the collection's. */
export function groupManager(list: SelectableCollection, root: HTMLElement, manager: SelectionManager, key: Key): SelectionManager {
  if (!list.groups) return manager;
  const section = getItemElement(root, key)?.closest("[data-section]");
  const group = section && root.contains(section) ? list.groups[section.getAttribute("data-key") ?? ""] : undefined;
  return group ? new GroupSelectionManager(manager, group) : manager;
}

/** Extra press callbacks of an item kind (menu items close the menu on press up, …). */
export interface ItemPressHooks {
  onPressStart?(list: SelectableCollection, key: Key, e: PressEvent, root: HTMLElement): void;
  onPressUp?(list: SelectableCollection, key: Key, e: PressEvent, root: HTMLElement): void;
  onPress?(list: SelectableCollection, key: Key, e: PressEvent, root: HTMLElement): void;
  /** Keydown on an item, before the collection handles it; return true when handled. */
  onKeyDown?(list: SelectableCollection, key: Key, e: KeyboardEvent, root: HTMLElement): boolean | void;
  /** Called after the item performed its action (menu: close). */
  onAction?(list: SelectableCollection, key: Key, root: HTMLElement): void;
}

/** Selection manager over the rendered collection under `root`. */
export const managerOf = (list: MultipleSelectionState, root: HTMLElement): SelectionManager => new SelectionManager(domCollection(root), list);

/** Keyboard delegate of `root` (useSelectableList's default `ListKeyboardDelegate`). */
export function delegateOf(list: SelectableCollection, root: HTMLElement, manager: SelectionManager): KeyboardDelegate {
  return new ListKeyboardDelegate({
    collection: manager.collection,
    disabledKeys: manager.disabledKeys,
    disabledBehavior: manager.disabledBehavior,
    ref: root,
    collator: getSearchCollator(),
    layout: list.options.layout ?? "stack",
    orientation: list.options.orientation ?? "vertical",
    direction: dirOf(root),
  });
}

const selectOnFocusOf = (list: SelectableCollection) => list.options.selectOnFocus ?? untrack(list.selectionBehavior) === "replace";

// ---------------------------------------------------------------------------------------------
// Focus sync (useSelectableItem's "focus the item when it becomes the focused key" effect and
// useSelectableCollection's "scroll the focused item into view" effect).
// ---------------------------------------------------------------------------------------------

/**
 * Apply the focused key to the DOM: focus the item (or move virtual focus to it) and scroll it into
 * view after keyboard navigation. Call at the end of a handler that may have changed the focused key.
 */
export function syncFocus(list: SelectableCollection, root: HTMLElement, previous: Key | null, force = false): void {
  const key = untrack(list.focusedKey);
  const focused = untrack(list.isFocused);
  const virtual = !!list.options.shouldUseVirtualFocus;
  if (focused && key != null && (key !== previous || force)) {
    const element = getItemElement(root, key);
    if (element) {
      if (virtual) moveVirtualFocus(element);
      else if (document.activeElement !== element) focusSafely(element);
      const modality = getInteractionModality();
      if (modality === "keyboard" || force) {
        scrollIntoView(root, element);
        if (modality !== "virtual") scrollIntoViewport(element, { containingElement: root });
      }
    }
  }
  // The focused key went away (item removed): focus the collection itself.
  if (!virtual && focused && key == null && previous != null && root.isConnected) focusSafely(root);
}

// Typeahead (useTypeSelect): `./type-select.ts` (its own module, so a closed Select trigger's typeahead does not
// load this collection adapter).
export { typeSelectKeyDown, _resetTypeSelect } from "./type-select.ts";

// ---------------------------------------------------------------------------------------------
// Collection keyboard (useSelectableCollection)
// ---------------------------------------------------------------------------------------------

/**
 * Collection keydown: arrows (orientation, RTL), Home / End (Ctrl: global), PageUp / PageDown,
 * Ctrl/Cmd+A, Escape (clear selection), Tab (leave the collection), Shift extends, the platform's
 * non-contiguous modifier moves focus without selecting. Returns true when handled.
 */
export function collectionNavigate(
  list: SelectableCollection,
  root: HTMLElement,
  manager: SelectionManager,
  delegate: KeyboardDelegate,
  e: KeyboardEvent,
): boolean {
  const o = list.options;
  const shouldFocusWrap = o.shouldFocusWrap ?? false;
  const selectOnFocus = selectOnFocusOf(list);
  const linkBehavior = o.linkBehavior ?? "action";
  const direction = dirOf(root);

  const navigateToKey = (key: Key | null | undefined, childFocus?: FocusStrategy): void => {
    if (key == null) return;
    if (manager.isLink(key) && linkBehavior === "selection" && selectOnFocus && !isNonContiguousSelectionModifier(e)) {
      manager.setFocusedKey(key, childFocus);
      const item = getItemElement(root, key);
      if (item instanceof HTMLAnchorElement) openLink(item, e);
      return;
    }
    manager.setFocusedKey(key, childFocus);
    if (manager.isLink(key) && linkBehavior === "override") return;
    if (e.shiftKey && manager.selectionMode === "multiple") manager.extendSelection(key);
    else if (selectOnFocus && !isNonContiguousSelectionModifier(e)) manager.replaceSelection(key);
  };

  const step = (next: () => Key | null | undefined, wrap: () => Key | null | undefined, childFocus?: FocusStrategy): boolean => {
    let key = next();
    if (key == null && shouldFocusWrap) key = wrap();
    if (key == null) return false;
    navigateToKey(key, childFocus);
    return true;
  };

  // Exact modifier sets of the original's shortcut bindings: navigation keys accept none, Shift, the
  // non-contiguous modifier (Alt on Mac, Control elsewhere) and both (withShiftSel); Home / End / Mod+A /
  // Escape / Tab ignore key repeats.
  const mac = isMac();
  const allowed = !e.metaKey && (mac ? !e.ctrlKey : !e.altKey);
  const noRepeat = !e.repeat;
  const plain = !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
  const focused = manager.focusedKey;
  if ((e.key === "Home" || e.key === "End") && (!allowed || !noRepeat)) return false;
  if (e.key === "Escape" && (!plain || !noRepeat)) return false;
  if (e.key === "Tab" && (e.metaKey || e.ctrlKey || e.altKey || !noRepeat)) return false;
  if ((e.key === "PageDown" || e.key === "PageUp") && !allowed) return false;
  switch (e.key) {
    case "ArrowDown":
      if (!delegate.getKeyBelow || !allowed) return false;
      return step(
        () => (focused != null ? delegate.getKeyBelow!(focused) : delegate.getFirstKey?.()),
        () => delegate.getFirstKey?.(focused),
      );
    case "ArrowUp":
      if (!delegate.getKeyAbove || !allowed) return false;
      return step(
        () => (focused != null ? delegate.getKeyAbove!(focused) : delegate.getLastKey?.()),
        () => delegate.getLastKey?.(focused),
      );
    case "ArrowLeft":
      if (!delegate.getKeyLeftOf || !allowed) return false;
      return step(
        () => (focused != null ? delegate.getKeyLeftOf!(focused) : delegate.getFirstKey?.()),
        () => (direction === "rtl" ? delegate.getFirstKey?.(focused) : delegate.getLastKey?.(focused)),
        direction === "rtl" ? "first" : "last",
      );
    case "ArrowRight":
      if (!delegate.getKeyRightOf || !allowed) return false;
      return step(
        () => (focused != null ? delegate.getKeyRightOf!(focused) : delegate.getFirstKey?.()),
        () => (direction === "rtl" ? delegate.getLastKey?.(focused) : delegate.getFirstKey?.(focused)),
        direction === "rtl" ? "last" : "first",
      );
    case "Home":
    case "End": {
      const home = e.key === "Home";
      const get = home ? delegate.getFirstKey : delegate.getLastKey;
      if (!get) return false;
      if (focused === null && e.shiftKey) return false;
      const key = get.call(delegate, focused, isCtrlKeyPressed(e));
      manager.setFocusedKey(key);
      if (key != null) {
        if (isCtrlKeyPressed(e) && e.shiftKey && manager.selectionMode === "multiple") manager.extendSelection(key);
        else if (selectOnFocus) manager.replaceSelection(key);
      }
      return true;
    }
    case "PageDown":
    case "PageUp": {
      const get = e.key === "PageDown" ? delegate.getKeyPageBelow : delegate.getKeyPageAbove;
      if (!get || focused == null) return false;
      const key = get.call(delegate, focused);
      if (key == null) return false;
      navigateToKey(key);
      return true;
    }
    case "Escape":
      if ((o.escapeKeyBehavior ?? "clearSelection") === "clearSelection" && !(o.disallowEmptySelection ?? false) && manager.selectedKeys.size !== 0) {
        manager.clearSelection();
        return true;
      }
      return false;
    case "Tab":
      if (!o.allowsTabNavigation) {
        if (e.shiftKey) root.focus();
        else {
          // Treat the collection as one tab stop: move focus to its last tabbable element so the
          // browser's own Tab leaves the collection from there.
          const list = tabbables(root);
          const last = list[list.length - 1];
          const active = document.activeElement;
          if (last && (!last.contains(active) || (active && !isTabbable(active)))) focusWithoutScrolling(last);
        }
      }
      return false; // continue propagation, no preventDefault
  }
  const modOnly = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if ((e.key === "a" || e.key === "A") && modOnly && !e.shiftKey && !e.altKey && noRepeat) {
    if (manager.selectionMode === "multiple" && o.disallowSelectAll !== true) {
      manager.selectAll();
      return true;
    }
    return false;
  }
  return false;
}

/** Keys a collection's keydown may handle (`data-rk`: held while the handler chunk loads). */
export function collectionKeys(options: SelectableOptions): string {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End", "PageUp", "PageDown", "Space", "Enter"];
  if ((options.orientation ?? "vertical") === "horizontal" || options.layout === "grid") keys.push("ArrowLeft", "ArrowRight");
  return keys.join(" ");
}

// ---------------------------------------------------------------------------------------------
// Items (useSelectableItem)
// ---------------------------------------------------------------------------------------------

/** The item element an event happened in (an own `[data-key]` of `root`, not a section). */
export function itemOf(root: Element, target: EventTarget | null): HTMLElement | null {
  let el = target instanceof Element ? target : ((target as Node | null)?.parentElement ?? null);
  for (; el && el !== root; el = el.parentElement) {
    if (el.hasAttribute(COLLECTION_ATTR)) return null; // nested collection
    if (el.hasAttribute("data-key") && !el.hasAttribute("data-section")) return el as HTMLElement;
  }
  return null;
}

interface ItemModel {
  key: Key;
  isDisabled: boolean;
  allowsSelection: boolean;
  allowsActions: boolean;
  hasPrimaryAction: boolean;
  hasSecondaryAction: boolean;
  hasAction: boolean;
  hasLinkAction: boolean;
  longPressEnabled: boolean;
}

function model(list: SelectableCollection, manager: SelectionManager, key: Key): ItemModel {
  const linkBehavior = list.options.linkBehavior ?? "action";
  const isDisabled = manager.isDisabled(key);
  const isLink = manager.isLink(key);
  const isLinkOverride = isLink && linkBehavior === "override";
  const hasLinkAction = isLink && linkBehavior !== "selection" && linkBehavior !== "none";
  const allowsSelection = !isDisabled && manager.canSelectItem(key) && !isLinkOverride;
  const allowsActions = (!!list.onAction || hasLinkAction) && !isDisabled;
  const hasPrimaryAction = allowsActions && (manager.selectionBehavior === "replace" ? !allowsSelection : !allowsSelection || manager.isEmpty);
  const hasSecondaryAction = allowsActions && allowsSelection && manager.selectionBehavior === "replace";
  const hasAction = hasPrimaryAction || hasSecondaryAction;
  return {
    key,
    isDisabled,
    allowsSelection,
    allowsActions,
    hasPrimaryAction,
    hasSecondaryAction,
    hasAction,
    hasLinkAction,
    longPressEnabled: hasAction && allowsSelection,
  };
}

/** RAC item state flags of `key` for custom markup (`allowsSelection`, `hasAction`). */
export function itemStates(list: SelectableCollection, root: HTMLElement, key: Key): Pick<ItemModel, "allowsSelection" | "hasAction" | "isDisabled"> {
  const { allowsSelection, hasAction, isDisabled } = model(list, managerOf(list, root), key);
  return { allowsSelection, hasAction, isDisabled };
}

function onSelect(list: SelectableCollection, manager: SelectionManager, root: HTMLElement, key: Key, e: PressEvent): void {
  const linkBehavior = list.options.linkBehavior ?? "action";
  if (e.pointerType === "keyboard" && isNonContiguousSelectionModifier(e)) {
    manager.toggleSelection(key);
    return;
  }
  if (manager.selectionMode === "none") return;
  if (manager.isLink(key)) {
    if (linkBehavior === "selection") {
      const el = getItemElement(root, key);
      if (el instanceof HTMLAnchorElement) openLink(el, e);
      // Keep the selection as it was, so Select / ComboBox still close.
      manager.setSelectedKeys(manager.selectedKeys);
      return;
    }
    if (linkBehavior === "override" || linkBehavior === "none") return;
  }
  if (manager.selectionMode === "single") {
    if (manager.isSelected(key) && !manager.disallowEmptySelection) manager.toggleSelection(key);
    else manager.replaceSelection(key);
  } else if (e.shiftKey) manager.extendSelection(key);
  else if (
    manager.selectionBehavior === "toggle" ||
    isCtrlKeyPressed(e as unknown as KeyboardEvent) ||
    e.pointerType === "touch" ||
    e.pointerType === "virtual"
  )
    manager.toggleSelection(key);
  else manager.replaceSelection(key);
}

function performAction(list: SelectableCollection, root: HTMLElement, m: ItemModel, e: PressEvent, hooks?: ItemPressHooks): void {
  if (list.onAction) {
    list.onAction(m.key);
    getItemElement(root, m.key)?.dispatchEvent(new CustomEvent("react-aria-item-action", { bubbles: true }));
  }
  if (m.hasLinkAction) {
    const el = getItemElement(root, m.key);
    if (el instanceof HTMLAnchorElement) openLink(el, e);
  }
  hooks?.onAction?.(list, m.key, root);
}

interface PressRecord {
  key: Key;
  pointerType: PointerType;
  pointerId?: number;
  hadPrimaryAction: boolean;
  longPressEnabled: boolean;
  longPressed: boolean;
}

const presses = new WeakMap<object, PressRecord>();
const modalities = new WeakMap<object, PointerType>();

function pressStart(list: SelectableCollection, root: HTMLElement, manager: SelectionManager, key: Key, e: PressEvent, hooks?: ItemPressHooks): void {
  manager = groupManager(list, root, manager, key);
  const m = model(list, manager, key);
  const o = list.options;
  modalities.set(list, e.pointerType);
  presses.set(list, { key, pointerType: e.pointerType, hadPrimaryAction: m.hasPrimaryAction, longPressEnabled: m.longPressEnabled, longPressed: false });
  if (o.shouldUseVirtualFocus && e.pointerType !== "touch" && !m.isDisabled) {
    manager.setFocused(true);
    manager.setFocusedKey(key);
  }
  if (o.shouldSelectOnPressUp) {
    if (e.pointerType === "keyboard" && (!m.hasAction || e.key === " ") && m.allowsSelection) onSelect(list, manager, root, key, e);
  } else if (
    m.allowsSelection &&
    ((e.pointerType === "mouse" && !m.hasPrimaryAction) || (e.pointerType === "keyboard" && (!m.allowsActions || e.key === " ")))
  ) {
    onSelect(list, manager, root, key, e);
  }
  hooks?.onPressStart?.(list, key, e, root);
}

function pressUp(list: SelectableCollection, root: HTMLElement, manager: SelectionManager, key: Key, e: PressEvent, hooks?: ItemPressHooks): void {
  manager = groupManager(list, root, manager, key);
  const m = model(list, manager, key);
  const o = list.options;
  if (o.shouldSelectOnPressUp && o.allowsDifferentPressOrigin && !m.hasPrimaryAction && e.pointerType === "mouse" && m.allowsSelection)
    onSelect(list, manager, root, key, e);
  hooks?.onPressUp?.(list, key, e, root);
}

function press(list: SelectableCollection, root: HTMLElement, manager: SelectionManager, key: Key, e: PressEvent, hooks?: ItemPressHooks): void {
  manager = groupManager(list, root, manager, key);
  const m = model(list, manager, key);
  const o = list.options;
  const record = presses.get(list);
  if (o.shouldUseVirtualFocus && e.pointerType === "touch" && !m.isDisabled) {
    manager.setFocused(true);
    manager.setFocusedKey(key);
  }
  if (record?.longPressed) return;
  if (o.shouldSelectOnPressUp) {
    if (!o.allowsDifferentPressOrigin) {
      if (m.hasPrimaryAction || (m.hasSecondaryAction && e.pointerType !== "mouse")) {
        if (e.pointerType === "keyboard" && e.key !== "Enter") return void hooks?.onPress?.(list, key, e, root);
        performAction(list, root, m, e, hooks);
      } else if (e.pointerType !== "keyboard" && m.allowsSelection) onSelect(list, manager, root, key, e);
    } else if (m.hasPrimaryAction) performAction(list, root, m, e, hooks);
    else if (e.pointerType !== "keyboard" && e.pointerType !== "mouse" && m.allowsSelection) onSelect(list, manager, root, key, e);
  } else if (
    e.pointerType === "touch" ||
    e.pointerType === "pen" ||
    e.pointerType === "virtual" ||
    (e.pointerType === "keyboard" && m.hasAction && e.key === "Enter") ||
    (e.pointerType === "mouse" && record?.hadPrimaryAction)
  ) {
    if (m.hasAction) performAction(list, root, m, e, hooks);
    else if (m.allowsSelection) onSelect(list, manager, root, key, e);
  }
  hooks?.onPress?.(list, key, e, root);
}

// Whether the event target is an interactive child of the item (a nested collection item or a
// tabbable control): such presses do not select the item.
function isChildInteraction(root: Element, item: HTMLElement, target: Element): boolean {
  const collection = root.getAttribute(COLLECTION_ATTR);
  for (let el: Element | null = target; el && el !== item; el = el.parentElement) {
    const c = el.getAttribute(COLLECTION_ATTR);
    if (c != null) return c !== collection;
  }
  return target !== item && isTabbable(target);
}

// ---------------------------------------------------------------------------------------------
// Delegated handler bodies (wire on the collection root)
// ---------------------------------------------------------------------------------------------

type Ev<E extends Event> = E & { currentTarget: HTMLElement };

/** keydown on the collection root (items + collection + typeahead). `root` defaults to currentTarget. */
export function collectionKeyDown(list: SelectableCollection, e: Ev<KeyboardEvent>, root: HTMLElement = e.currentTarget, hooks?: ItemPressHooks): boolean {
  noteModality(e);
  const manager = managerOf(list, root);
  const delegate = delegateOf(list, root, manager);
  const previous = manager.focusedKey;
  let handled = false;
  const virtual = list.options.shouldUseVirtualFocus;
  const itemEl = virtual ? (previous != null ? getItemElement(root, previous) : null) : itemOf(root, e.target);
  const key = itemEl ? domKey(itemEl) : null;
  // Typeahead first (its Space handling ran in the capture phase in the original).
  if (!list.options.disallowTypeAhead && typeSelectKeyDown(list, root, manager, delegate, e)) handled = true;
  else if (key != null && hooks?.onKeyDown?.(list, key, e, root)) handled = true;
  else if (key != null && (e.key === "Enter" || e.key === " ") && !(e.key === " " && itemEl instanceof HTMLAnchorElement)) {
    // usePress keyboard press start (Space / Enter; links: Enter only).
    if (!(isMac() && e.key === "Enter") || !(itemEl instanceof HTMLAnchorElement)) e.preventDefault();
    e.stopPropagation();
    if (!e.repeat && !presses.get(list)) {
      if (!model(list, manager, key).isDisabled || virtual) pressStart(list, root, manager, key, pressEvent("pressstart", "keyboard", itemEl!, e), hooks);
      const record = presses.get(list);
      if (record) record.pointerType = "keyboard";
      else presses.set(list, { key, pointerType: "keyboard", hadPrimaryAction: false, longPressEnabled: false, longPressed: false });
    }
    handled = true;
  } else if (collectionNavigate(list, root, manager, delegate, e)) {
    handled = true;
    if (e.key !== "Tab") e.preventDefault();
  }
  syncFocus(list, root, previous);
  return handled;
}

/** keyup on the collection root: completes a keyboard press. */
export function collectionKeyUp(list: SelectableCollection, e: Ev<KeyboardEvent>, root: HTMLElement = e.currentTarget, hooks?: ItemPressHooks): void {
  const record = presses.get(list);
  if (!record || record.pointerType !== "keyboard" || (e.key !== "Enter" && e.key !== " ")) return;
  presses.delete(list);
  const manager = managerOf(list, root);
  const previous = manager.focusedKey;
  const el = getItemElement(root, record.key);
  if (!el) return;
  if (!(isMac() && e.key === "Enter") || !(el instanceof HTMLAnchorElement)) e.preventDefault();
  const pe = pressEvent("press", "keyboard", el, e);
  pressUp(list, root, manager, record.key, pe, hooks);
  if (!manager.isDisabled(record.key) || list.options.shouldUseVirtualFocus) press(list, root, manager, record.key, pe, hooks);
  syncFocus(list, root, previous);
}

/** pointerdown on the collection root. */
export function collectionPointerDown(list: SelectableCollection, e: Ev<PointerEvent>, root: HTMLElement = e.currentTarget, hooks?: ItemPressHooks): void {
  noteModality(e);
  if (e.button !== 0) return;
  const item = itemOf(root, e.target);
  if (!item) return;
  if (e.target instanceof Element && isChildInteraction(root, item, e.target)) return;
  const pointerType = pointerTypeOf(e);
  if (pointerType === "virtual") return; // the click handler takes it (VoiceOver on iOS)
  const manager = managerOf(list, root);
  const previous = manager.focusedKey;
  const key = domKey(item)!;
  const m = model(list, manager, key);
  if (m.isDisabled && !list.options.shouldUseVirtualFocus) return;
  // usePress focuses the pressed element itself unless focus is virtual.
  if (!list.options.shouldUseVirtualFocus && !m.isDisabled) focusWithoutScrolling(item);
  pressStart(list, root, manager, key, pressEvent("pressstart", pointerType, item, e), hooks);
  const record = presses.get(list)!;
  record.pointerId = e.pointerId;
  if (m.longPressEnabled && pointerType === "touch") {
    startLongPress(list, () => {
      const r = presses.get(list);
      if (!r || r.key !== key) return;
      r.longPressed = true;
      const mgr = managerOf(list, root);
      onSelect(list, mgr, root, key, pressEvent("pressstart", "touch", item, e));
      mgr.setSelectionBehavior("toggle");
    });
  }
  syncFocus(list, root, previous);
}

/** pointerup on the collection root (press up anywhere in it; press when it ends on the pressed item). */
export function collectionPointerUp(list: SelectableCollection, e: Ev<PointerEvent>, root: HTMLElement = e.currentTarget, hooks?: ItemPressHooks): void {
  noteModality(e);
  if (e.button !== 0) return;
  cancelLongPress(list);
  const item = itemOf(root, e.target);
  const record = presses.get(list);
  if (record?.pointerType !== "keyboard") presses.delete(list);
  if (!item) return;
  const pointerType = pointerTypeOf(e);
  if (pointerType === "virtual") return;
  const manager = managerOf(list, root);
  const previous = manager.focusedKey;
  const key = domKey(item)!;
  if (manager.isDisabled(key) && !list.options.shouldUseVirtualFocus) return;
  const pe = pressEvent("pressup", pointerType, item, e);
  pressUp(list, root, manager, key, pe, hooks);
  if (record && record.pointerId === e.pointerId && String(record.key) === String(key)) {
    presses.set(list, record);
    press(list, root, manager, key, { ...pe, type: "press" }, hooks);
    presses.delete(list);
  }
  syncFocus(list, root, previous);
}

/** pointercancel on the collection root. */
export function collectionPointerCancel(list: SelectableCollection): void {
  cancelLongPress(list);
  presses.delete(list);
}

/** click on the collection root: virtual clicks (screen readers) press; link clicks are ours to open. */
export function collectionClick(list: SelectableCollection, e: Ev<MouseEvent>, root: HTMLElement = e.currentTarget, hooks?: ItemPressHooks): void {
  noteModality(e);
  const item = itemOf(root, e.target);
  if (!item) return;
  const linkBehavior = list.options.linkBehavior ?? "action";
  if (linkBehavior !== "none" && item instanceof HTMLAnchorElement && !isOpeningLink()) e.preventDefault();
  if (!isVirtualClick(e) || isOpeningLink()) return;
  const manager = managerOf(list, root);
  const previous = manager.focusedKey;
  const key = domKey(item)!;
  if (manager.isDisabled(key) && !list.options.shouldUseVirtualFocus) return;
  if (!list.options.shouldUseVirtualFocus) focusWithoutScrolling(item);
  pressStart(list, root, manager, key, pressEvent("pressstart", "virtual", item, e), hooks);
  const pe = pressEvent("press", "virtual", item, e);
  pressUp(list, root, manager, key, pe, hooks);
  press(list, root, manager, key, pe, hooks);
  presses.delete(list);
  syncFocus(list, root, previous);
}

/** dblclick on the collection root: the secondary action (selectionBehavior "replace"). */
export function collectionDoubleClick(list: SelectableCollection, e: Ev<MouseEvent>, root: HTMLElement = e.currentTarget, hooks?: ItemPressHooks): void {
  const item = itemOf(root, e.target);
  if (!item) return;
  const manager = managerOf(list, root);
  const m = model(list, manager, domKey(item)!);
  if (m.hasSecondaryAction && modalities.get(list) === "mouse") {
    e.stopPropagation();
    e.preventDefault();
    performAction(list, root, m, pressEvent("press", "mouse", item, e), hooks);
  }
}

/** mousedown on the collection root: keep DOM focus where it is for virtual focus / disabled items / scrollbars. */
export function collectionMouseDown(list: SelectableCollection, e: Ev<MouseEvent>, root: HTMLElement = e.currentTarget): void {
  if (e.target === root) {
    // A click on the scrollbar must not focus the collection.
    e.preventDefault();
    return;
  }
  const item = itemOf(root, e.target);
  if (!item) {
    // Section headings (virtual focus): keep focus in the input.
    if (list.options.shouldUseVirtualFocus) e.preventDefault();
    return;
  }
  if (e.target instanceof Element && isChildInteraction(root, item, e.target)) return;
  if (list.options.shouldUseVirtualFocus || item.getAttribute("aria-disabled") === "true" || item.hasAttribute("data-disabled")) e.preventDefault();
}

/** dragstart on the collection root: no native drag while a touch long press selects. */
export function collectionDragStart(list: SelectableCollection, e: Event): void {
  if (modalities.get(list) === "touch" && presses.get(list)?.longPressEnabled) e.preventDefault();
}

/** pointerover on the collection root: `shouldFocusOnHover` (menus, pickers) focuses the hovered item. */
export function collectionPointerOver(list: SelectableCollection, e: Ev<PointerEvent>, root: HTMLElement = e.currentTarget): void {
  if (!list.options.shouldFocusOnHover || e.pointerType === "touch") return;
  const item = itemOf(root, e.target);
  if (!item) return;
  const manager = managerOf(list, root);
  const key = domKey(item)!;
  if (manager.isDisabled(key) || isFocusVisible()) return;
  const previous = manager.focusedKey;
  manager.setFocused(true);
  manager.setFocusedKey(key);
  syncFocus(list, root, previous);
}

const scrollPositions = new WeakMap<object, { top: number; left: number }>();

/** scroll on the collection root (remembered, restored when focus re-enters). */
export function collectionScroll(list: SelectableCollection, e: Ev<Event>): void {
  scrollPositions.set(list, { top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft });
}

/** focusin on the collection root: item focus → focused key; entering → first / last / selected item. */
export function collectionFocusIn(list: SelectableCollection, e: Ev<FocusEvent>, root: HTMLElement = e.currentTarget): void {
  const manager = managerOf(list, root);
  const previous = manager.focusedKey;
  const virtual = !!list.options.shouldUseVirtualFocus;
  // useSelectableItem onFocus: the focused item becomes the focused key.
  const item = itemOf(root, e.target);
  if (item && !virtual && e.target === item && !manager.isDisabled(domKey(item)!)) manager.setFocusedKey(domKey(item));
  if (manager.isFocused) return;
  if (!root.contains(e.target as Node)) return;
  const modality = getInteractionModality();
  manager.setFocused(true);
  const selectOnFocus = selectOnFocusOf(list);
  const delegate = delegateOf(list, root, manager);
  const go = (key: Key | null | undefined) => {
    if (key == null) return;
    manager.setFocusedKey(key);
    if (selectOnFocus && !manager.isSelected(key)) manager.replaceSelection(key);
  };
  if (manager.focusedKey == null) {
    // Tabbing in backwards (focus came from after the collection) starts at the end.
    const related = e.relatedTarget as Element | null;
    if (related && root.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING) go(manager.lastSelectedKey ?? delegate.getLastKey?.());
    else go(manager.firstSelectedKey ?? delegate.getFirstKey?.());
  } else {
    // The server pre-sets the tab stop (RAC starts with focusedKey null): tabbing in with an empty
    // selection-follows-focus collection selects it, as RAC's first focus does.
    if (selectOnFocus && modality !== "pointer" && manager.isEmpty && !manager.isDisabled(manager.focusedKey)) manager.replaceSelection(manager.focusedKey);
    const saved = scrollPositions.get(list);
    if (saved) {
      root.scrollTop = saved.top;
      root.scrollLeft = saved.left;
    }
  }
  if (manager.focusedKey != null) {
    const element = getItemElement(root, manager.focusedKey);
    if (element) {
      if (!element.contains(document.activeElement) && !virtual) focusWithoutScrolling(element);
      if (modality === "keyboard") scrollIntoViewport(element, { containingElement: root });
    }
  }
  syncFocus(list, root, previous);
}

/** focusout on the collection root: leaving the collection clears `isFocused`. */
export function collectionFocusOut(list: SelectableCollection, e: Ev<FocusEvent>, root: HTMLElement = e.currentTarget): void {
  if (!root.contains(e.relatedTarget as Node | null)) list.isFocused.set(false);
}

/**
 * Focus the collection per a focus strategy (react-aria `autoFocus`): the first selected selectable
 * item, else the first / last item, else the collection itself (non-virtual).
 */
export function autoFocusCollection(list: SelectableCollection, root: HTMLElement, strategy: boolean | FocusStrategy): void {
  const manager = managerOf(list, root);
  const delegate = delegateOf(list, root, manager);
  const previous = manager.focusedKey;
  let focusedKey: Key | null = null;
  if (strategy === "first") focusedKey = delegate.getFirstKey?.() ?? null;
  if (strategy === "last") focusedKey = delegate.getLastKey?.() ?? null;
  const selectedKeys = manager.selectedKeys;
  if (selectedKeys.size) {
    for (const key of selectedKeys)
      if (manager.canSelectItem(key)) {
        focusedKey = key;
        break;
      }
  }
  manager.setFocused(true);
  manager.setFocusedKey(focusedKey);
  if (focusedKey != null && selectOnFocusOf(list) && !selectedKeys.size && manager.canSelectItem(focusedKey)) manager.replaceSelection(focusedKey);
  if (focusedKey == null && !list.options.shouldUseVirtualFocus) focusSafely(root);
  syncFocus(list, root, previous === focusedKey ? null : previous, true);
}
