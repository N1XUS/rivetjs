// Ported from @react-aria/selection (useSelectableItem.ts), Apache-2.0, © Adobe. The press and long
// press handling it needs from @react-aria/interactions (usePress / useLongPress) is reduced to the
// events the selection logic reads (press start / up / press with pointerType, long press on touch);
// the full press machine (pointer capture, cancel on leave, text selection guards) belongs to the
// cdk-interactions port.
//
// Rivet shape: handler bodies `(options, event)` for delegated wiring on the collection element
// (`closestItem` finds the item and its key), plus attribute accessors and the state flags.
import { untrack } from "@rivetjs/reactivity";
import { domKey } from "../collections/dom.ts";
import type { Key } from "../collections/types.ts";
import type { MultipleSelectionManager, PointerType } from "./manager.ts";
import { isFocusedKey, type KeyedSelectionSource } from "./keyed.ts";
import { focusSafely, isOpeningLink, moveVirtualFocus, openLink, pointerTypeOf, trackModality } from "./dom-utils.ts";
import { getCollectionId, isCtrlKeyPressed, isNonContiguousSelectionModifier, refElement, type RefLike } from "./utils.ts";
import { isTabbable } from "../a11y/index.ts";
import { routerOpen, type Router } from "../utils/links.tsx";

export type ItemLinkBehavior = "action" | "selection" | "override" | "none";

export interface SelectableItemOptions {
  /** An interface for reading and updating multiple selection state. */
  selectionManager: MultipleSelectionManager;
  /** A unique key for the item. */
  key: Key;
  /** The item element (ref or element; handlers default to the item under the event target). */
  ref?: RefLike;
  /** Item id (react-aria `useId(id)`). */
  id?: string | undefined;
  /** Select on press up instead of press down (menus). */
  shouldSelectOnPressUp?: boolean | undefined;
  /** Whether selection may start on another element than the one released on (menu triggers). */
  allowsDifferentPressOrigin?: boolean | undefined;
  /** Whether the option is contained in a virtual scroller. */
  isVirtualized?: boolean | undefined;
  /** Function to focus the item. */
  focus?: (() => void) | undefined;
  /** Whether the option should use virtual focus instead of being focused directly. */
  shouldUseVirtualFocus?: boolean | undefined;
  /** Whether the item is disabled. */
  isDisabled?: boolean | undefined;
  /** Handler that is called when a user performs an action on the item. */
  onAction?: (() => void) | undefined;
  /** The behavior of links in the collection. Default "action". */
  linkBehavior?: ItemLinkBehavior | undefined;
  /** @private RAC: actions override selection. */
  UNSTABLE_itemBehavior?: "action" | undefined;
  /**
   * The router link items open through (react-aria `useRouter()`: `RouterProvider`); absent or native: the
   * browser opens them.
   */
  router?: Router | undefined;
  /**
   * The item's own props (react-aria `manager.getItemProps(key)`): `onPressStart` / `onPressEnd` /
   * `onPressChange` / `onPress` / `onPressUp` / `onClick` chain after the selection logic, `href` /
   * `routerOptions` for links. Default: `selectionManager.getItemProps(key)` (a built collection's node props).
   */
  itemProps?: ItemPressProps | undefined;
}

/** Press callbacks + link props of an item (react-aria's `collectionItemProps` subset). */
export interface ItemPressProps {
  onPressStart?: ((e: ItemPressEventFull) => void) | undefined;
  onPressEnd?: ((e: ItemPressEventFull) => void) | undefined;
  onPressChange?: ((isPressed: boolean) => void) | undefined;
  onPress?: ((e: ItemPressEventFull) => void) | undefined;
  onPressUp?: ((e: ItemPressEventFull) => void) | undefined;
  onClick?: ((e: MouseEvent) => void) | undefined;
  href?: string | undefined;
  routerOptions?: Record<string, unknown> | undefined;
  [key: string]: unknown;
}

/** The press event item press callbacks receive (react-aria PressEvent fields). */
export interface ItemPressEventFull extends ItemPressEvent {
  type: "pressstart" | "pressend" | "pressup" | "press";
  target: Element;
  x: number;
  y: number;
  continuePropagation(): void;
}

export interface SelectableItemStates {
  /** Whether the item is currently in a pressed state. */
  isPressed: boolean;
  /** Whether the item is currently selected. */
  isSelected: boolean;
  /** Whether the item is currently focused. */
  isFocused: boolean;
  /** Whether the item is non-interactive (selection and actions disabled, not focusable). */
  isDisabled: boolean;
  /** Whether the item may be selected. */
  allowsSelection: boolean;
  /** Whether the item has an action (onAction or link). */
  hasAction: boolean;
}

/** A press event as the selection logic reads it (react-aria PressEvent subset). */
export interface ItemPressEvent {
  pointerType: PointerType;
  key?: string | undefined;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

const pressOf = (e: Event, pointerType: PointerType = pointerTypeOf(e)): ItemPressEvent => {
  const m = e as KeyboardEvent & MouseEvent;
  return { pointerType, key: m.key, shiftKey: !!m.shiftKey, ctrlKey: !!m.ctrlKey, metaKey: !!m.metaKey, altKey: !!m.altKey };
};

interface Derived {
  manager: MultipleSelectionManager;
  key: Key;
  isDisabled: boolean;
  allowsSelection: boolean;
  allowsActions: boolean;
  hasPrimaryAction: boolean;
  hasSecondaryAction: boolean;
  hasAction: boolean;
  hasLinkAction: boolean;
  longPressEnabled: boolean;
  linkBehavior: ItemLinkBehavior;
}

function derive(options: SelectableItemOptions): Derived {
  const { selectionManager: manager, key, onAction } = options;
  const linkBehavior = options.linkBehavior ?? "action";
  const isDisabled = !!options.isDisabled || manager.isDisabled(key);
  // With checkbox selection, onAction (i.e. navigation) becomes primary, and occurs on a single click
  // of the row. With highlight selection, onAction is secondary, and occurs on double click. With
  // touch, onAction occurs on single tap, and long press enters selection mode.
  const isLink = manager.isLink(key);
  const isLinkOverride = isLink && linkBehavior === "override";
  const isActionOverride = !!onAction && options.UNSTABLE_itemBehavior === "action";
  const hasLinkAction = isLink && linkBehavior !== "selection" && linkBehavior !== "none";
  const allowsSelection = !isDisabled && manager.canSelectItem(key) && !isLinkOverride && !isActionOverride;
  const allowsActions = (!!onAction || hasLinkAction) && !isDisabled;
  const hasPrimaryAction = allowsActions && (manager.selectionBehavior === "replace" ? !allowsSelection : !allowsSelection || manager.isEmpty);
  const hasSecondaryAction = allowsActions && allowsSelection && manager.selectionBehavior === "replace";
  const hasAction = hasPrimaryAction || hasSecondaryAction;
  return {
    manager,
    key,
    isDisabled,
    allowsSelection,
    allowsActions,
    hasPrimaryAction,
    hasSecondaryAction,
    hasAction,
    hasLinkAction,
    longPressEnabled: hasAction && allowsSelection,
    linkBehavior,
  };
}

/**
 * `manager.focusedKey === key`; for a cdk `SelectionManager` a keyed read (`keyed.ts`): a binding re-runs only
 * when this key gains or loses focus, not on every focus move.
 */
function focusedKeyIs(manager: MultipleSelectionManager, key: Key): boolean {
  const state = (manager as { selectionState?: KeyedSelectionSource }).selectionState;
  return state ? isFocusedKey(state, key) : manager.focusedKey === key;
}

/** Item state flags (react-aria `useSelectableItem` return minus props). Reads state: use in bindings. */
export function selectableItemStates(options: SelectableItemOptions): SelectableItemStates {
  const d = derive(options);
  const el = refElement(options.ref);
  return {
    isPressed: !!el && pressMemos.get(el)?.pressed === true,
    isSelected: d.manager.isSelected(d.key),
    // Key first: only the focused item reads (and re-runs on) the collection's isFocused.
    isFocused: focusedKeyIs(d.manager, d.key) && d.manager.isFocused,
    isDisabled: d.isDisabled,
    allowsSelection: d.allowsSelection,
    hasAction: d.hasAction,
  };
}

/**
 * Attributes of the item (`tabIndex` roving: 0 for the focused key, -1 otherwise, none with virtual
 * focus or when disabled; `data-key`, `data-collection`, `id`). Reads state: bind as accessors.
 */
export function selectableItemAttrs(options: SelectableItemOptions): Record<string, unknown> {
  const d = derive(options);
  const attrs: Record<string, unknown> = { "data-key": String(d.key), "data-collection": getCollectionId(d.manager.collection), id: options.id };
  if (typeof d.key === "number") attrs["data-key-type"] = "number";
  if (!options.shouldUseVirtualFocus && !d.isDisabled) attrs.tabIndex = focusedKeyIs(d.manager, d.key) ? 0 : -1;
  return attrs;
}

const itemPropsOf = (options: SelectableItemOptions, d: Derived): ItemPressProps | undefined =>
  options.itemProps ?? (d.manager.getItemProps(d.key) as ItemPressProps | undefined);

/** react-aria `router.open(ref.current, e, href, routerOptions)`; without a client router: `openLink`. */
function open(options: SelectableItemOptions, item: HTMLElement, e: ItemPressEvent, href: string | undefined, routerOptions?: Record<string, unknown>): void {
  if (options.router && !options.router.isNative && href != null) routerOpen(options.router, item, e, href, routerOptions);
  else openLink(item, e, href);
}

const pressEventOf = (type: ItemPressEventFull["type"], item: Element, e: ItemPressEvent, source?: Event): ItemPressEventFull => {
  const m = source as MouseEvent | undefined;
  const rect = item.getBoundingClientRect();
  return {
    ...e,
    type,
    target: item,
    x: m && "clientX" in m ? m.clientX - rect.left : rect.width / 2,
    y: m && "clientY" in m ? m.clientY - rect.top : rect.height / 2,
    continuePropagation() {},
  };
};

/** usePress callbacks chained from the item props (react-aria `collectionItemProps` chaining). */
function itemPress(options: SelectableItemOptions, d: Derived, item: HTMLElement, phase: "start" | "up" | "end", e: ItemPressEvent, source?: Event): void {
  const p = itemPropsOf(options, d);
  if (!p) return;
  if (phase === "start") {
    p.onPressStart?.(pressEventOf("pressstart", item, e, source));
    p.onPressChange?.(true);
  } else if (phase === "up") p.onPressUp?.(pressEventOf("pressup", item, e, source));
  else {
    p.onPressEnd?.(pressEventOf("pressend", item, e, source));
    p.onPressChange?.(false);
    p.onPress?.(pressEventOf("press", item, e, source));
  }
}

function onSelect(options: SelectableItemOptions, d: Derived, item: HTMLElement | null, e: ItemPressEvent): void {
  const { manager, key } = d;
  if (e.pointerType === "keyboard" && isNonContiguousSelectionModifier(e)) {
    manager.toggleSelection(key);
    return;
  }
  if (manager.selectionMode === "none") return;
  if (manager.isLink(key)) {
    if (d.linkBehavior === "selection" && item) {
      const itemProps = itemPropsOf(options, d) ?? manager.getItemProps(key);
      open(options, item, e, itemProps?.href as string | undefined, itemProps?.routerOptions as Record<string, unknown> | undefined);
      // Always set selected keys back to what they were so that select and combobox close.
      manager.setSelectedKeys(manager.selectedKeys);
      return;
    } else if (d.linkBehavior === "override" || d.linkBehavior === "none") return;
  }
  if (manager.selectionMode === "single") {
    if (manager.isSelected(key) && !manager.disallowEmptySelection) manager.toggleSelection(key);
    else manager.replaceSelection(key);
  } else if (e && e.shiftKey) manager.extendSelection(key);
  else if (manager.selectionBehavior === "toggle" || (e && (isCtrlKeyPressed(e) || e.pointerType === "touch" || e.pointerType === "virtual"))) {
    // Touch or virtual (VO): toggle, otherwise multi selection is impossible without modifier keys.
    manager.toggleSelection(key);
  } else manager.replaceSelection(key);
}

function performAction(options: SelectableItemOptions, d: Derived, item: HTMLElement | null, e: ItemPressEvent): void {
  if (options.onAction) {
    options.onAction();
    item?.dispatchEvent(new CustomEvent("react-aria-item-action", { bubbles: true }));
  }
  if (d.hasLinkAction && item) {
    const itemProps = itemPropsOf(options, d);
    open(options, item, e, itemProps?.href as string | undefined, itemProps?.routerOptions as Record<string, unknown> | undefined);
  }
}

const isActionKey = (key: string | undefined) => key === "Enter";
const isSelectionKey = (key: string | undefined) => key === " ";

interface PressMemo {
  pressed: boolean;
  /** A virtual pointerdown was seen: the following click is the (virtual) press. */
  virtualPointer?: boolean;
  modality: PointerType | null;
  longPressEnabledOnPressStart: boolean;
  hadPrimaryActionOnPressStart: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | undefined;
  didLongPress: boolean;
  keyboardPressed: boolean;
}
const pressMemos = new WeakMap<Element, PressMemo>();
const memoOf = (el: Element): PressMemo => {
  let m = pressMemos.get(el);
  if (!m) {
    m = {
      pressed: false,
      modality: null,
      longPressEnabledOnPressStart: false,
      hadPrimaryActionOnPressStart: false,
      longPressTimer: undefined,
      didLongPress: false,
      keyboardPressed: false,
    };
    pressMemos.set(el, m);
  }
  return m;
};

/** Long press threshold (react-aria useLongPress default). */
export const LONG_PRESS_THRESHOLD_MS = 500;

function pressStart(options: SelectableItemOptions, d: Derived, item: HTMLElement, e: ItemPressEvent): void {
  const m = memoOf(item);
  m.pressed = true;
  m.modality = e.pointerType;
  m.longPressEnabledOnPressStart = d.longPressEnabled;
  m.hadPrimaryActionOnPressStart = d.hasPrimaryAction;
  m.didLongPress = false;
  // When using virtual focus, make sure the focused key gets updated on press.
  if (options.shouldUseVirtualFocus && e.pointerType !== "touch") {
    d.manager.setFocused(true);
    d.manager.setFocusedKey(d.key);
  }
  if (options.shouldSelectOnPressUp) {
    if (e.pointerType === "keyboard" && (!d.hasAction || isSelectionKey(e.key))) onSelect(options, d, item, e);
    return;
  }
  // Select on mouse down unless there is a primary action which will occur on mouse up. For
  // keyboard, select on key down. If there is an action, the Space key selects on key down, and the
  // Enter key performs onAction on key up.
  if (
    d.allowsSelection &&
    ((e.pointerType === "mouse" && !d.hasPrimaryAction) || (e.pointerType === "keyboard" && (!d.allowsActions || isSelectionKey(e.key))))
  ) {
    onSelect(options, d, item, e);
  }
}

function pressUp(options: SelectableItemOptions, d: Derived, item: HTMLElement, e: ItemPressEvent): void {
  if (options.shouldSelectOnPressUp && options.allowsDifferentPressOrigin && !d.hasPrimaryAction) {
    if (e.pointerType === "mouse" && d.allowsSelection) onSelect(options, d, item, e);
  }
}

function press(options: SelectableItemOptions, d: Derived, item: HTMLElement, e: ItemPressEvent): void {
  const m = memoOf(item);
  m.pressed = false;
  if (options.shouldUseVirtualFocus && e.pointerType === "touch") {
    d.manager.setFocused(true);
    d.manager.setFocusedKey(d.key);
  }
  if (options.shouldSelectOnPressUp) {
    if (!options.allowsDifferentPressOrigin) {
      if (d.hasPrimaryAction || (d.hasSecondaryAction && e.pointerType !== "mouse")) {
        if (e.pointerType === "keyboard" && !isActionKey(e.key)) return;
        performAction(options, d, item, e);
      } else if (e.pointerType !== "keyboard" && d.allowsSelection) onSelect(options, d, item, e);
    } else if (d.hasPrimaryAction) performAction(options, d, item, e);
    else if (e.pointerType !== "keyboard" && e.pointerType !== "mouse" && d.allowsSelection) onSelect(options, d, item, e);
    return;
  }
  // Selection occurs on touch up. Primary actions always occur on pointer up. Both primary and
  // secondary actions occur on Enter key up. Secondary actions occur on double click with a mouse.
  if (
    e.pointerType === "touch" ||
    e.pointerType === "pen" ||
    e.pointerType === "virtual" ||
    (e.pointerType === "keyboard" && d.hasAction && isActionKey(e.key)) ||
    (e.pointerType === "mouse" && m.hadPrimaryActionOnPressStart)
  ) {
    if (d.hasAction) performAction(options, d, item, e);
    else if (d.allowsSelection) onSelect(options, d, item, e);
  }
}

/** Whether `target` is an interactive child of the item, or an item of another collection. */
function isChildInteraction(item: HTMLElement, collectionId: string | undefined, target: Element): boolean {
  let el: Element | null = target;
  while (el && el !== item) {
    const elCollection = el.getAttribute("data-collection");
    if (elCollection != null) return elCollection !== collectionId;
    el = el.parentElement;
  }
  return isTabbable(target);
}

const itemOf = (options: SelectableItemOptions, e: Event): HTMLElement | null => refElement(options.ref) ?? ((e.currentTarget as HTMLElement | null) || null);

/** Interactive when it allows selection, has a primary action, or uses virtual focus (react-aria's press props gate). */
const pressable = (options: SelectableItemOptions, d: Derived) => d.allowsSelection || d.hasPrimaryAction || (!!options.shouldUseVirtualFocus && !d.isDisabled);

/** pointerdown on the item (press start for mouse / pen / touch; long press timer on touch). */
export function selectableItemPointerDown(options: SelectableItemOptions, e: PointerEvent): void {
  const item = itemOf(options, e);
  if (!item) return;
  trackModality(e);
  const d = derive(options);
  const target = e.target as Element | null;
  if (target && target !== item && isChildInteraction(item, getCollectionId(d.manager.collection), target)) {
    e.stopPropagation();
    return;
  }
  if (d.isDisabled) {
    // Prevent focus going to the body when clicking on a disabled item.
    e.preventDefault();
    return;
  }
  // Prevent DOM focus from moving on mouse down when using virtual focus.
  if (options.shouldUseVirtualFocus) e.preventDefault();
  if (e.button !== 0 && e.pointerType === "mouse") return;
  if (!pressable(options, d)) return;
  const pe = pressOf(e);
  // usePress: virtual pointer events (screen readers) only record the pointer type; the click that
  // follows performs the whole press.
  if (pe.pointerType === "virtual") {
    memoOf(item).virtualPointer = true;
    return;
  }
  pressStart(options, d, item, pe);
  itemPress(options, d, item, "start", pe, e);
  const m = memoOf(item);
  clearTimeout(m.longPressTimer);
  if (d.longPressEnabled && pe.pointerType === "touch") {
    m.longPressTimer = setTimeout(() => {
      // Long pressing with touch when selectionBehavior = "replace" switches it to "toggle".
      m.didLongPress = true;
      onSelect(options, derive(options), item, pe);
      d.manager.setSelectionBehavior("toggle");
    }, LONG_PRESS_THRESHOLD_MS);
  }
}

/** pointerup on the item (press up; cancels a pending long press). */
export function selectableItemPointerUp(options: SelectableItemOptions, e: PointerEvent): void {
  const item = itemOf(options, e);
  if (!item) return;
  const m = memoOf(item);
  clearTimeout(m.longPressTimer);
  const d = derive(options);
  const pe = pressOf(e);
  if (pe.pointerType === "virtual") return;
  if (!d.isDisabled && pressable(options, d)) {
    pressUp(options, d, item, pe);
    if (m.pressed) itemPress(options, d, item, "up", pe, e);
  }
}

/** pointercancel / pointerleave: drop the press. */
export function selectableItemPointerCancel(options: SelectableItemOptions, e: PointerEvent): void {
  const item = itemOf(options, e);
  if (!item) return;
  const m = memoOf(item);
  clearTimeout(m.longPressTimer);
  m.pressed = false;
}

/**
 * click on the item: the press (pointer presses that started on the item, and virtual clicks from
 * screen readers / `element.click()`); link clicks are prevented so links open exactly when the
 * selection logic says so.
 */
export function selectableItemClick(options: SelectableItemOptions, e: MouseEvent): void {
  const item = itemOf(options, e);
  if (!item) return;
  const d = derive(options);
  if (d.linkBehavior !== "none" && d.manager.isLink(d.key) && !isOpeningLink()) e.preventDefault();
  if (d.isDisabled || !pressable(options, d)) return;
  // usePress onClick: a click it handles (not one opening a link) stops here, after the item's own onClick.
  if (e.button === 0 && !isOpeningLink()) {
    itemPropsOf(options, d)?.onClick?.(e);
    e.stopPropagation();
  }
  const m = memoOf(item);
  const virtual = (e.detail === 0 || !!m.virtualPointer) && !m.pressed;
  m.virtualPointer = false;
  if (m.didLongPress) {
    m.didLongPress = false;
    m.pressed = false;
    return;
  }
  if (virtual) {
    trackModality(e);
    const pe = pressOf(e, "virtual");
    pressStart(options, d, item, pe);
    itemPress(options, d, item, "start", pe, e);
    press(options, derive(options), item, pe);
    itemPress(options, d, item, "end", pe, e);
    return;
  }
  if (!m.pressed) return;
  const pe = pressOf(e, m.modality ?? "mouse");
  press(options, d, item, pe);
  itemPress(options, d, item, "end", pe, e);
}

/** keydown on the item: Space / Enter start a keyboard press. */
export function selectableItemKeyDown(options: SelectableItemOptions, e: KeyboardEvent): void {
  if (e.key !== " " && e.key !== "Enter") return;
  const item = itemOf(options, e);
  if (!item) return;
  const d = derive(options);
  if (d.isDisabled || !pressable(options, d)) return;
  // Native link Enter would navigate: the selection logic decides instead.
  e.preventDefault();
  if (e.repeat) return;
  trackModality(e);
  memoOf(item).keyboardPressed = true;
  const pe = pressOf(e, "keyboard");
  pressStart(options, d, item, pe);
  itemPress(options, d, item, "start", pe, e);
}

/** keyup on the item: Space / Enter complete a keyboard press. */
export function selectableItemKeyUp(options: SelectableItemOptions, e: KeyboardEvent): void {
  if (e.key !== " " && e.key !== "Enter") return;
  const item = itemOf(options, e);
  if (!item) return;
  const m = memoOf(item);
  if (!m.keyboardPressed) return;
  m.keyboardPressed = false;
  const d = derive(options);
  if (d.isDisabled || !pressable(options, d)) return;
  const pe = pressOf(e, "keyboard");
  itemPress(options, d, item, "up", pe, e);
  press(options, d, item, pe);
  itemPress(options, d, item, "end", pe, e);
  // usePress triggerSyntheticClick: keyboard activation also calls the item's onClick with a synthetic click.
  const onClick = itemPropsOf(options, d)?.onClick;
  if (onClick) {
    const click = new MouseEvent("click", e);
    Object.defineProperty(click, "target", { value: item });
    Object.defineProperty(click, "currentTarget", { value: item });
    onClick(click);
  }
}

/** dblclick: with selectionBehavior "replace", a mouse double click performs the action. */
export function selectableItemDoubleClick(options: SelectableItemOptions, e: MouseEvent): void {
  const item = itemOf(options, e);
  if (!item) return;
  const d = derive(options);
  if (!d.hasSecondaryAction) return;
  if (memoOf(item).modality === "mouse") {
    e.stopPropagation();
    e.preventDefault();
    performAction(options, d, item, pressOf(e, "mouse"));
  }
}

/** focus on the item element itself: it becomes the focused key. */
export function selectableItemFocus(options: SelectableItemOptions, e: FocusEvent): void {
  const item = itemOf(options, e);
  const d = derive(options);
  if (options.shouldUseVirtualFocus || d.isDisabled) return;
  if (e.target === item && untrack(() => d.manager.focusedKey) !== d.key) d.manager.setFocusedKey(d.key);
}

/** dragstart: no native drag after a touch long press that selected. */
export function selectableItemDragStart(options: SelectableItemOptions, e: DragEvent): void {
  const item = itemOf(options, e);
  if (!item) return;
  const m = memoOf(item);
  if (m.modality === "touch" && m.longPressEnabledOnPressStart) e.preventDefault();
}

/**
 * Focus the item when it is the focused key of a focused collection (react-aria's item effect),
 * or move virtual focus to it. `selectableCollection*` handlers call this through `syncFocus`.
 */
export function focusSelectableItem(options: SelectableItemOptions): void {
  const item = refElement(options.ref);
  const { selectionManager: manager, key } = options;
  if (key !== manager.focusedKey || !manager.isFocused) return;
  if (!options.shouldUseVirtualFocus) {
    if (options.focus) options.focus();
    else if (item && item.ownerDocument.activeElement !== item) focusSafely(item);
  } else moveVirtualFocus(item);
}

/** The collection item element containing `target` (inside `collection`), with its key. */
export function closestItem(collection: Element, target: EventTarget | null, selector = "[data-key]"): { element: HTMLElement; key: Key } | null {
  let el = target instanceof Element ? target.closest<HTMLElement>(selector) : null;
  while (el && !collection.contains(el)) el = null;
  if (!el || el === collection) return null;
  const key = domKey(el);
  return key == null ? null : { element: el, key };
}
