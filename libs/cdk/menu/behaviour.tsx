// Ported from react-aria menu/{useMenuTrigger,useMenu,useMenuItem,useMenuSection,useSubmenuTrigger,utils}.ts
// (packages/react-aria/src/menu) + interactions/useContextMenu.ts, Apache-2.0, © Adobe.
//
// Rivet:
// - Naming: `useMenuTrigger` → `menuTriggerProps(props, state)` → `{ menuTriggerProps, menuProps }`;
//   `useMenu` → `menuProps(props, state)` → the menu element bag; `useMenuItem` → `menuItemProps(props, state)`
//   → `{ menuItemProps, labelProps, descriptionProps, keyboardShortcutProps }`; `useMenuSection` →
//   `menuSectionProps(props)`; `useSubmenuTrigger` → `submenuTriggerProps(props, state)` → `{ submenuTriggerProps,
//   submenuProps, popoverProps }`. Handlers are free functions `menu<Part><Event>(event, props, state)`.
// - Items are not per-item hook instances: ONE delegated handler on the menu element (`menuEvent`) runs
//   useSelectableList + useSelectableItem (the shared collection engine `../_adapters/selection.ts`)
//   and the useMenuItem / useSubmenuTrigger item logic against the DOM as the collection, so items carry
//   no handlers (resumable: nothing loads before the first interaction). Per-item callbacks
//   (`onAction`, `shouldCloseOnSelect`, press / hover / focus events) live in `MenuState.items`
//   (keyed by key; resumable functions), section close rules in `MenuState.sections`.
// - `menuData` WeakMap → the menu state fields `menuAction` / `onClose` / `shouldUseVirtualFocus`.
// - useMenuItem's "Space / Enter → target.click()" runs the click body (`menuItemClick`) directly, so
//   the collection engine does not see a second (virtual) press; the mouse "release over an item the
//   press did not start on" path still dispatches `click()`, marked so `menuEvent` only runs the menu
//   action for it.
// - Interaction state attributes (`data-hovered`, `data-pressed`, `data-focus-visible`) are written
//   on the item elements by the delegated handler (RAC computes them per render).
// - Submenu hover-open timers, press records and safe-triangle cleanups are browser-only WeakMaps.
import { untrack } from "@rivetjs/reactivity";
import { isMac, isIOS } from "@rivetjs/cdk/platform";
import { direction as dirOf } from "@rivetjs/cdk/bidi";
import {
  autoFocusCollection,
  collectionClick,
  collectionDragStart,
  collectionFocusIn,
  collectionFocusOut,
  collectionKeyDown,
  collectionKeyUp,
  collectionKeys,
  collectionMouseDown,
  collectionPointerCancel,
  collectionPointerDown,
  collectionPointerUp,
  collectionScroll,
  itemOf,
  managerOf,
  delegateOf,
  groupManager,
  syncFocus,
  type ItemPressHooks,
} from "../_adapters/selection.ts";
import { domKey, getItemElement, type FocusStrategy, type Key } from "../_adapters/collections.ts";
import { focusWithoutScrolling, isFocusVisible, noteModality, pressEvent, setInteractionModality, type PressEvent } from "../_adapters/interactions.ts";
import { routerOpen, type Router } from "../utils/links.tsx";
import { setDataAttr } from "../utils/data-attrs.tsx";
import type { MenuItemStateSignals } from "../state/menu.ts";
import { formatMessage } from "../_adapters/intl.ts";
import { getItemId, itemDisabled, itemFocused, itemSelected, itemTabIndex, collectionTabIndex } from "../state/list.ts";
import {
  closeMenu,
  closeSubmenu,
  closeAllSubmenus,
  openMenu,
  openSubmenu,
  submenuId,
  toggleMenu,
  type MenuState,
  type MenuTriggerState,
  type MenuTriggerType,
  type SubmenuTriggerState,
} from "../state/menu.ts";
import { setPoint } from "../state/overlays.ts";
import { strings } from "./intl.ts";
import { longPressEnd, longPressStart } from "../interactions/long-press.tsx";
import { safelyMouseToSubmenu } from "./safely-mouse-to-submenu.ts";
import { dispatchVirtualFocus, moveVirtualFocus } from "../selection/dom-utils.ts";

export { getItemId } from "../state/list.ts";
export { submenuId } from "../state/menu.ts";

const str = (v: boolean): "true" | "false" => (v ? "true" : "false");

// =================================================================================================
// useMenuTrigger
// =================================================================================================

export interface AriaMenuTriggerProps {
  /** The type of menu that the menu trigger opens. */
  type?: "menu" | "listbox";
  /** Whether menu trigger is disabled. */
  isDisabled?: boolean;
  /** How menu is triggered. */
  trigger?: MenuTriggerType;
  /** Rivet: locale of the long-press description (RA: useLocalizedStringFormatter). */
  locale?: string;
}

export interface MenuTriggerAria {
  /** Props for the menu trigger element (AriaButtonProps: pass to a Button / its ButtonContext). */
  menuTriggerProps: Record<string, unknown>;
  /** Props for the menu. */
  menuProps: { id: string; "aria-labelledby": string; autoFocus: () => FocusStrategy | true; onClose: () => void };
  /** Rivet: the long-press description to render once (`<span id hidden>{text}</span>`), when `trigger="longPress"`. */
  longPressDescription?: { id: string; text: string };
}

/** Keys the trigger may handle (`data-rk`: a cold key does not scroll while the handler loads). */
export const menuTriggerKeys = (trigger: MenuTriggerType = "press"): string =>
  trigger === "contextMenu"
    ? ""
    : trigger === "longPress"
      ? "Alt+Enter Alt+Space Alt+ArrowDown Alt+ArrowUp"
      : "Enter Space ArrowDown ArrowUp Alt+ArrowDown Alt+ArrowUp";

/** The trigger's keyboard shortcuts (useKeyboard `shortcuts`); returns whether the key was handled. */
export function menuTriggerKeyDown(e: KeyboardEvent, props: AriaMenuTriggerProps, state: MenuTriggerState): boolean {
  const { isDisabled, trigger = "press" } = props;
  if (isDisabled || trigger === "contextMenu") return false;
  // Exact modifier match, like the shortcut table.
  if (e.ctrlKey || e.metaKey || e.shiftKey) return false;
  let shouldOpen: boolean;
  let focusStrategy: FocusStrategy = "first";
  const key = e.key;
  if (!e.altKey) {
    if (key !== "Enter" && key !== " " && key !== "ArrowDown" && key !== "ArrowUp") return false;
    shouldOpen = trigger !== "longPress";
    if (key === "ArrowUp") focusStrategy = "last";
  } else {
    if (key === "Enter" || key === " ") shouldOpen = trigger === "longPress";
    else if (key === "ArrowDown" || key === "ArrowUp") {
      // Alt+Arrow* opens for both trigger modes.
      shouldOpen = true;
      if (key === "ArrowUp") focusStrategy = "last";
    } else return false;
  }
  // RA: no defaultPrevented check (the Button's usePress already prevented Enter / Space).
  if (!shouldOpen) return false;
  // Rivet: the resumed document listener runs before the lazily installed focus-visible listeners, so
  // record this keydown's modality first (else a programmatically focused trigger stays "virtual" and
  // the menu's autoFocus defers behind the popover's own focus, which wins).
  noteModality(e);
  e.preventDefault();
  e.stopPropagation();
  toggleMenu(state, focusStrategy);
  return true;
}

/** `onPressStart` of a "press" trigger: open on mouse / pen down (touch and keyboard wait). */
export function menuTriggerPressStart(e: PressEvent, props: AriaMenuTriggerProps, state: MenuTriggerState): void {
  // For consistency with native, open the menu on mouse/key down, but touch up.
  if (e.pointerType !== "touch" && e.pointerType !== "keyboard" && !props.isDisabled) {
    // Ensure trigger has focus before opening the menu so it can be restored by FocusScope on close.
    focusWithoutScrolling(e.target as HTMLElement);
    // If opened with a screen reader, auto focus the first item. Otherwise, the menu itself will be focused.
    openMenu(state, e.pointerType === "virtual" ? "first" : null);
  }
}

/** `onPress` of a "press" trigger: touch toggles on press up. */
export function menuTriggerPress(e: PressEvent, props: AriaMenuTriggerProps, state: MenuTriggerState): void {
  if (e.pointerType === "touch" && !props.isDisabled) {
    focusWithoutScrolling(e.target as HTMLElement);
    toggleMenu(state);
  }
}

/** useLongPress `onLongPressStart` of a "longPress" trigger. */
export const menuTriggerLongPressStart = (_e: unknown, _props: AriaMenuTriggerProps, state: MenuTriggerState): void => closeMenu(state);
/** useLongPress `onLongPress` of a "longPress" trigger. */
export const menuTriggerLongPress = (_e: unknown, _props: AriaMenuTriggerProps, state: MenuTriggerState): void => openMenu(state, "first");

// Context-menu bookkeeping (useContextMenu `firedContextMenuEvent`) + the outside right-click closer.
const firedContextMenu = new WeakMap<object, boolean>();
const contextClosers = new WeakMap<object, () => void>();

/** useMenuTrigger's `onContextMenu` (from useContextMenu): anchor at the pointer, open. */
export function menuTriggerContextMenuOpen(target: Element, x: number, y: number, state: MenuTriggerState): void {
  const rect = target.getBoundingClientRect();
  setPoint(state, { x: rect.x + x, y: rect.y + y });
  openMenu(state);
  // Close context menus when right clicking outside. The browser's context menu will appear instead.
  contextClosers.get(state)?.();
  const doc = target.ownerDocument;
  const onMouseDown = (e: MouseEvent) => {
    // Checking if the target is the body works because everything outside the menu is inert.
    if ((e.button === 2 || (e.button === 0 && e.ctrlKey === true)) && e.target === doc.body) closeMenu(state);
  };
  doc.addEventListener("mousedown", onMouseDown);
  const stop = () => {
    doc.removeEventListener("mousedown", onMouseDown);
    contextClosers.delete(state);
  };
  contextClosers.set(state, stop);
}

/** Stop the outside right-click closer (call when a context menu closes). */
export const menuTriggerContextMenuClosed = (state: MenuTriggerState): void => contextClosers.get(state)?.();

/** `contextmenu` on a "contextMenu" trigger (useContextMenu onContextMenu). */
export function menuTriggerContextMenu(e: MouseEvent, props: AriaMenuTriggerProps, state: MenuTriggerState): void {
  if (props.isDisabled) return;
  e.stopPropagation();
  e.preventDefault();
  firedContextMenu.set(state, true);
  const target = e.currentTarget as Element;
  const rect = target.getBoundingClientRect();
  menuTriggerContextMenuOpen(target, e.clientX - rect.x, e.clientY - rect.y, state);
}

/** `keydown` on a "contextMenu" trigger: macOS Ctrl+Enter workaround (useContextMenu). */
export function menuTriggerContextMenuKeyDown(e: KeyboardEvent, props: AriaMenuTriggerProps, state: MenuTriggerState): void {
  if (props.isDisabled || !isMac() || !(e.ctrlKey && e.key === "Enter")) return;
  firedContextMenu.set(state, false);
  const target = e.currentTarget as Element;
  e.stopPropagation();
  setTimeout(() => {
    if (!firedContextMenu.get(state)) {
      const rect = target.getBoundingClientRect();
      menuTriggerContextMenuOpen(target, rect.width / 2, rect.height / 2, state);
    } else firedContextMenu.set(state, false);
  }, 10);
}

/** iOS long press on a "contextMenu" trigger (iOS fires no contextmenu event). */
export function menuTriggerContextMenuLongPress(e: { target: Element; x: number; y: number }, _props: AriaMenuTriggerProps, state: MenuTriggerState): void {
  if (!firedContextMenu.get(state)) menuTriggerContextMenuOpen(e.target, e.x, e.y, state);
  else firedContextMenu.set(state, false);
}

/** Whether the context-menu trigger uses the iOS long-press path. */
export const contextMenuUsesLongPress = (): boolean => !!isIOS();

/**
 * Provides the behavior and accessibility implementation for a menu trigger (react-aria `useMenuTrigger`).
 * The press / keyboard / context-menu handlers are inline arrows over the exported free functions.
 */
export function menuTriggerProps(props: AriaMenuTriggerProps, state: MenuTriggerState): MenuTriggerAria {
  const { type = "menu", trigger = "press" } = props;
  const menuId = state.menuId;
  // useOverlayTrigger({ type }): aria-haspopup (menu → true), aria-expanded, aria-controls while open.
  const overlay: Record<string, unknown> = {
    "aria-haspopup": type === "menu" ? true : "listbox",
    "aria-expanded": () => state.isOpen(),
    "aria-controls": () => (state.isOpen() ? menuId : undefined),
  };
  let interaction: Record<string, unknown>;
  let longPressDescription: MenuTriggerAria["longPressDescription"];
  if (trigger === "press") {
    interaction = {
      preventFocusOnPress: true,
      onPressStart: (e: PressEvent) => menuTriggerPressStart(e, props, state),
      onPress: (e: PressEvent) => menuTriggerPress(e, props, state),
      // RA useMenuTrigger `default: e.continuePropagation()`: keys the trigger does not handle (Tab) bubble on, so an
      // enclosing FocusScope (sidebar sheet, dialog) still contains Tab.
      onKeyDown: (e: KeyboardEvent) => {
        if (!menuTriggerKeyDown(e, props, state)) (e as KeyboardEvent & { continuePropagation?: () => void }).continuePropagation?.();
      },
    };
  } else if (trigger === "longPress") {
    const text = formatMessage(strings, props.locale, "longPressMessage");
    const descriptionId = state.triggerId + "-desc";
    if (!props.isDisabled) longPressDescription = { id: descriptionId, text };
    // useLongPress (threshold 500) merged into the trigger's press props (RA: `longPressProps` spread on the
    // trigger). Rivet: as press callbacks for the Button's usePress (PressResponder), not a second usePress.
    const lp = {
      props: {
        isDisabled: props.isDisabled,
        accessibilityDescription: text,
        onLongPressStart: (e: unknown) => menuTriggerLongPressStart(e, props, state),
        onLongPress: (e: unknown) => menuTriggerLongPress(e, props, state),
      },
      state: { timer: undefined, globals: [] },
    };
    interaction = {
      onPressStart: (e: PressEvent) => {
        if (!props.isDisabled) longPressStart(lp as never, e as never);
      },
      onPressEnd: (e: PressEvent) => {
        if (!props.isDisabled) longPressEnd(lp as never, e as never);
      },
      "aria-describedby": props.isDisabled ? undefined : descriptionId,
      // RA useMenuTrigger `default: e.continuePropagation()`: keys the trigger does not handle (Tab) bubble on, so an
      // enclosing FocusScope (sidebar sheet, dialog) still contains Tab.
      onKeyDown: (e: KeyboardEvent) => {
        if (!menuTriggerKeyDown(e, props, state)) (e as KeyboardEvent & { continuePropagation?: () => void }).continuePropagation?.();
      },
    };
  } else {
    interaction = {
      onContextMenu: (e: MouseEvent) => menuTriggerContextMenu(e, props, state),
      onKeyDown: (e: KeyboardEvent) => menuTriggerContextMenuKeyDown(e, props, state),
    };
  }
  // Remove aria-haspopup and associated attributes from context menu triggers (w3c/aria#1971).
  const triggerAttrs = trigger === "contextMenu" ? {} : overlay;
  return {
    menuTriggerProps: { ...triggerAttrs, ...interaction, id: state.triggerId, "data-rk": menuTriggerKeys(trigger) || undefined },
    menuProps: {
      id: menuId,
      "aria-labelledby": state.triggerId,
      autoFocus: () => state.focusStrategy() || true,
      onClose: () => closeMenu(state),
    },
    ...(longPressDescription ? { longPressDescription } : {}),
  };
}

// =================================================================================================
// useMenu (+ the delegated item handler)
// =================================================================================================

export interface AriaMenuOptions {
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  id?: string;
  /** Whether pressing the escape key should clear selection in the menu or not. @default 'clearSelection' */
  escapeKeyBehavior?: "clearSelection" | "none";
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
  /** Rivet: the router links in the menu navigate with (RA `useRouter()`); default native. */
  router?: Router;
}

/** Keys the menu may handle (`data-rk`). */
export const menuKeys = (state: MenuState): string => collectionKeys(state.options) + " ArrowLeft ArrowRight Escape";

/** Event types the menu element handles (wire each to `menuEvent`). */
export const MENU_EVENTS = [
  "keydown",
  "keyup",
  "pointerdown",
  "pointerup",
  "pointercancel",
  "click",
  "mousedown",
  "pointerover",
  "pointerout",
  "focusin",
  "focusout",
  "dragstart",
  "scroll",
] as const;

/**
 * Attributes of the menu element (useMenu `menuProps` without handlers: wire `MENU_EVENTS` to
 * `menuEvent`). Accessors bind.
 */
export function menuProps(props: AriaMenuOptions, state: MenuState): Record<string, unknown> {
  return {
    id: state.id,
    role: "menu",
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": props["aria-describedby"],
    "aria-multiselectable": state.selectionMode === "multiple" ? "true" : undefined,
    "data-collection": state.id,
    "data-rk": menuKeys(state),
    tabIndex: () => collectionTabIndex(state),
  };
}

type Ev<E extends Event = Event> = E & { currentTarget: HTMLElement };

// Transient per-menu bookkeeping (browser only).
interface Interaction {
  pointerType: string;
  key?: string;
}
const interactions = new WeakMap<object, Interaction | null>();
const pressedKeys = new WeakMap<object, Key | null>();
const syntheticClicks = new WeakSet<Element>();
const hovered = new WeakMap<object, HTMLElement | null>();
const hoverTimers = new WeakMap<object, ReturnType<typeof setTimeout>>();
const triangles = new WeakMap<object, () => void>();

const isTrigger = (el: Element): boolean => el.hasAttribute("aria-haspopup");
const isTriggerExpanded = (el: Element): boolean => isTrigger(el) && el.getAttribute("aria-expanded") === "true";
const sectionKeyOf = (root: Element, item: Element): string | undefined => {
  const section = item.closest("[data-section]");
  return section && root.contains(section) ? (section.getAttribute("data-key") ?? undefined) : undefined;
};

/** The selection mode the item renders with (its section's own, else the menu's). */
function selectionModeOf(state: MenuState, root: HTMLElement, item: HTMLElement, key: Key): string {
  return groupManager(state, root, managerOf(state, root), key).selectionMode;
}

/** The user's per-item callbacks (RAC MenuItem props), by key. */
const itemCallbacks = (state: MenuState, key: Key) => state.items?.[String(key)];

const STATE_SIGNAL: Record<string, keyof MenuItemStateSignals> = { pressed: "pressed", hovered: "hovered", "focus-visible": "focusVisible" };

/** Write an item's interaction-state attribute (`data-<name>="true"`) and its render-prop signal, if any. */
function itemAttr(state: MenuState, el: HTMLElement, name: "pressed" | "hovered" | "focus-visible", value: boolean): void {
  setDataAttr(el, "data-" + name, value);
  const key = domKey(el);
  const states = key != null ? itemCallbacks(state, key)?.states : undefined;
  states?.[STATE_SIGNAL[name]!].set(value);
}

/**
 * useMenuItem's `onClick` body: item `onAction` → menu `onAction`, link navigation through the router,
 * then the close rule. `interaction` = how the item was activated.
 */
export function menuItemClick(state: MenuState, root: HTMLElement, item: HTMLElement, e: Event, router?: Router): void {
  const key = domKey(item);
  if (key == null) return;
  const manager = managerOf(state, root);
  if (manager.isDisabled(key)) return;
  const trigger = isTrigger(item);
  // performAction
  if (!trigger) {
    const cb = itemCallbacks(state, key);
    if (cb?.onAction) cb.onAction();
    if (state.menuAction) state.menuAction(key);
    // useSelectableItem under virtual focus: tell the Autocomplete an item action ran (it clears its input focus state).
    if (state.options.shouldUseVirtualFocus) item.dispatchEvent(new CustomEvent("react-aria-item-action", { bubbles: true }));
  }
  // handleLinkClick: a client router navigates (the native one lets the anchor navigate).
  if (item instanceof HTMLAnchorElement && item.href && router && !router.isNative && !e.defaultPrevented) {
    e.preventDefault();
    const m = e as MouseEvent;
    routerOpen(router, item, m, item.getAttribute("href")!, itemCallbacks(state, key)?.routerOptions);
  }
  const interaction = interactions.get(state);
  const selectionMode = selectionModeOf(state, root, item, key);
  const isLink = item instanceof HTMLAnchorElement && !!item.getAttribute("href");
  let shouldClose =
    interaction?.pointerType === "keyboard"
      ? // Always close when pressing Enter key, or if item is not selectable.
        interaction.key === "Enter" || selectionMode === "none" || isLink
      : // Close except if multi-select is enabled.
        selectionMode !== "multiple" || isLink;
  const sectionKey = sectionKeyOf(root, item);
  // MenuItem `shouldCloseOnSelect` ?? MenuSection's ?? Menu's (RAC MenuItemContext chain).
  const override =
    itemCallbacks(state, key)?.shouldCloseOnSelect ??
    (sectionKey !== undefined ? state.sections?.[sectionKey]?.shouldCloseOnSelect : undefined) ??
    state.shouldCloseOnSelect;
  shouldClose = override ?? shouldClose;
  const onClose = state.onClose;
  if (onClose && !trigger && shouldClose) {
    // The menu closes: drop the keyboard press record (its keyup lands elsewhere).
    collectionPointerCancel(state);
    onClose();
  }
  interactions.set(state, null);
}

/** Mouse release over an item the press did not start on (drag from the trigger): `click()` it. */
function synthClick(item: HTMLElement): void {
  syntheticClicks.add(item);
  item.click();
}

// User press callbacks of an item, after the engine's own (RAC: usePress on the item).
const callPress = (state: MenuState, key: Key, name: "onPressStart" | "onPressUp" | "onPress" | "onPressEnd", e: PressEvent) =>
  (itemCallbacks(state, key)?.[name] as ((e: PressEvent) => void) | undefined)?.(e);

const menuHooks = (state: MenuState): ItemPressHooks => ({
  onPressStart(_list, key, e, root) {
    const el = getItemElement(root, key);
    if (el) itemAttr(state, el, "pressed", true);
    pressedKeys.set(state, key);
    itemCallbacks(state, key)?.onPressChange?.(true);
    callPress(state, key, "onPressStart", e);
  },
  onPressUp(_list, key, e, root) {
    if (e.pointerType !== "keyboard") interactions.set(state, { pointerType: e.pointerType });
    // If interacting with mouse, allow the user to mouse down on the trigger button, drag, and release
    // over an item (matching native behavior).
    const el = getItemElement(root, key);
    if (e.pointerType === "mouse" && el && pressedKeys.get(state) !== key) synthClick(el);
    callPress(state, key, "onPressUp", e);
  },
  onPress(_list, key, e, root) {
    endPress(state, root, key, e);
    callPress(state, key, "onPress", e);
  },
});

function endPress(state: MenuState, root: HTMLElement, key: Key | null | undefined, e?: PressEvent): void {
  const pressed = pressedKeys.get(state);
  if (pressed == null) return;
  pressedKeys.set(state, null);
  const el = getItemElement(root, pressed);
  if (el) itemAttr(state, el, "pressed", false);
  itemCallbacks(state, pressed)?.onPressChange?.(false);
  if (e && key != null) callPress(state, pressed, "onPressEnd", e);
}

/** Hover start / end of an item (useHover in useMenuItem + useSubmenuTrigger `onHoverChange`). */
function hoverItem(state: MenuState, root: HTMLElement, item: HTMLElement | null, e: PointerEvent): void {
  const previous = hovered.get(state) ?? null;
  if (previous === item) return;
  if (previous) {
    itemAttr(state, previous, "hovered", false);
    const key = domKey(previous);
    if (key != null) {
      const cb = itemCallbacks(state, key);
      cb?.onHoverEnd?.({ type: "hoverend", pointerType: e.pointerType as "mouse" | "pen", target: previous });
      cb?.onHoverChange?.(false);
    }
    // useSubmenuTrigger onHoverChange(false): cancel the open timer.
    clearTimeout(hoverTimers.get(state));
    hoverTimers.delete(state);
  }
  hovered.set(state, item);
  if (!item) return;
  const key = domKey(item);
  if (key == null) return;
  const manager = managerOf(state, root);
  if (manager.isDisabled(key)) return;
  itemAttr(state, item, "hovered", true);
  // Hovering over an already expanded sub dialog trigger should keep focus in the dialog.
  if (!isFocusVisible() && !isTriggerExpanded(item)) {
    const before = manager.focusedKey;
    manager.setFocused(true);
    manager.setFocusedKey(key);
    syncFocus(state, root, before);
  }
  const cb = itemCallbacks(state, key);
  cb?.onHoverStart?.({ type: "hoverstart", pointerType: e.pointerType as "mouse" | "pen", target: item });
  cb?.onHoverChange?.(true);
  // useSubmenuTrigger onHoverChange(true): open after `delay`.
  const sub = state.submenus?.[String(key)];
  if (sub && !untrack(sub.isOpen) && !hoverTimers.has(state)) {
    const delay = state.delays?.[String(key)] ?? 200;
    hoverTimers.set(
      state,
      setTimeout(() => {
        hoverTimers.delete(state);
        openSubmenuFrom(sub, item);
      }, delay),
    );
  }
}

/** useSubmenuTrigger `onSubmenuOpen(focusStrategy)` + the safe-triangle tracking while it is open. */
function openSubmenuFrom(sub: SubmenuTriggerState, item: HTMLElement, focusStrategy?: FocusStrategy | null): void {
  openSubmenu(sub, focusStrategy);
}

/**
 * Attach the safe-triangle pointer tracking (useSafelyMouseToSubmenu) for an open submenu: call from
 * the submenu popover's open path with the parent menu and submenu elements; returns the cleanup.
 */
export function menuSubmenuOpened(
  sub: SubmenuTriggerState,
  parentMenu: HTMLElement | null,
  submenu: HTMLElement | null,
  options?: { isDisabled?: boolean; preventPointerDown?: boolean },
): () => void {
  triangles.get(sub)?.();
  const stop = safelyMouseToSubmenu(parentMenu, submenu, options);
  const cleanup = () => {
    stop();
    triangles.delete(sub);
  };
  triangles.set(sub, cleanup);
  return cleanup;
}

/** The submenu closed: stop its safe-triangle tracking. */
export const menuSubmenuClosed = (sub: SubmenuTriggerState): void => triangles.get(sub)?.();

const isRtl = (el: Element): boolean => dirOf(el) === "rtl";

/** Keydown of a submenu trigger item (useSubmenuTrigger `submenuTriggerKeyboardProps`); true when handled. */
export function submenuTriggerKeyDown(e: KeyboardEvent, item: HTMLElement, sub: SubmenuTriggerState, isDisabled = false): boolean {
  if (isDisabled) return false;
  const rtl = isRtl(item);
  const openKey = rtl ? "ArrowLeft" : "ArrowRight";
  const closeKey = rtl ? "ArrowRight" : "ArrowLeft";
  if (e.key === openKey) {
    if (!untrack(sub.isOpen)) openSubmenu(sub, "first");
    // Focus moves into the submenu once it renders (its autoFocus "first").
    const submenu = item.ownerDocument.getElementById(submenuId({ id: menuIdOf(item) }, sub.triggerKey));
    if (submenu && item.ownerDocument.activeElement === item) focusWithoutScrolling(submenu);
    return true;
  }
  if (e.key === closeKey && untrack(sub.isOpen)) {
    closeSubmenu(sub);
    return true;
  }
  return false;
}

const menuIdOf = (item: Element): string => item.closest('[role="menu"]')?.id ?? "";

/**
 * Keydown on a submenu (useSubmenuTrigger `submenuProps` keyboard): ArrowLeft (ltr) / ArrowRight (rtl) /
 * Escape close this level and focus its trigger item. True when handled.
 */
export function submenuKeyDown(e: KeyboardEvent, menu: HTMLElement, state: MenuState): boolean {
  const sub = state.submenuTrigger;
  if (!sub) return false;
  // If focus is not within the menu, assume virtual focus is being used.
  if (!menu.contains(menu.ownerDocument.activeElement)) return false;
  const rtl = isRtl(menu);
  const back = rtl ? "ArrowRight" : "ArrowLeft";
  if (e.key !== back && e.key !== "Escape") return false;
  if (!menu.contains(e.target as Node)) return false;
  closeSubmenu(sub);
  const trigger = state.parentId ? menu.ownerDocument.getElementById(getItemId({ id: state.parentId }, sub.triggerKey)) : null;
  if (!state.options.shouldUseVirtualFocus && trigger) focusWithoutScrolling(trigger);
  e.preventDefault();
  e.stopPropagation();
  return true;
}

// Autocomplete forward typing asked to virtually focus the first item once the collection updates.
const virtualFocusFirst = new WeakSet<object>();

/**
 * `react-aria-focus` on the menu (useSelectableCollection, virtual focus from an Autocomplete input): the
 * menu takes virtual focus; `focusStrategy: "first"` focuses the first item once the items update.
 */
export function menuVirtualFocus(e: Event, state: MenuState): void {
  if (!state.options.shouldUseVirtualFocus) return;
  const ev = e as Ev<CustomEvent<{ focusStrategy?: FocusStrategy }>>;
  ev.stopPropagation();
  managerOf(state, ev.currentTarget).setFocused(true);
  if (ev.detail?.focusStrategy === "first") virtualFocusFirst.add(state);
}

/** `react-aria-clear-focus` on the menu (virtual focus): drop virtual focus, optionally the focused key. */
export function menuClearVirtualFocus(e: Event, state: MenuState): void {
  if (!state.options.shouldUseVirtualFocus) return;
  const ev = e as Ev<CustomEvent<{ clearFocusKey?: boolean }>>;
  ev.stopPropagation();
  const manager = managerOf(state, ev.currentTarget);
  manager.setFocused(false);
  if (ev.detail?.clearFocusKey) manager.setFocusedKey(null);
}

/**
 * The menu's items changed (filtered / loaded; call from a client effect): with a pending "virtual focus
 * first" request, focus the first item, or clear the active descendant when nothing is focusable
 * (useSelectableCollection's collection-update effect).
 */
export function menuCollectionUpdated(state: MenuState, root: HTMLElement): void {
  if (!virtualFocusFirst.has(state)) return;
  const manager = managerOf(state, root);
  const firstKey = delegateOf(state, root, manager).getFirstKey?.() ?? null;
  if (firstKey == null) {
    const previousActiveElement = root.ownerDocument.activeElement;
    moveVirtualFocus(root);
    if (previousActiveElement) dispatchVirtualFocus(previousActiveElement, null);
    // All keys disabled (not a loading state): stop trying.
    if (manager.collection.size > 0) virtualFocusFirst.delete(state);
  } else {
    const previous = manager.focusedKey;
    manager.setFocusedKey(firstKey);
    syncFocus(state, root, previous);
    virtualFocusFirst.delete(state);
  }
}

/**
 * The menu element's delegated handler: useMenu (useSelectableList) + every item's useMenuItem /
 * useSubmenuTrigger. Wire `MENU_EVENTS` as `on…={(e) => menuEvent(e, props, state)}`.
 */
export function menuEvent(event: Event, props: AriaMenuOptions, state: MenuState, root?: HTMLElement): void {
  const e = event as Ev;
  const el = root ?? e.currentTarget;
  const hooks = menuHooks(state);
  const item = itemOf(el, e.target);
  switch (e.type) {
    case "keydown": {
      const k = e as Ev<KeyboardEvent>;
      // mergeProps(domProps, { onKeyDown, onKeyUp }, menu): the user's handler first.
      props.onKeyDown?.(k);
      if (state.level > 0 && submenuKeyDown(k, el, state)) return;
      const key = item ? domKey(item) : null;
      if (item && key != null) {
        const sub = state.submenus?.[String(key)];
        if (sub && submenuTriggerKeyDown(k, item, sub, managerOf(state, el).isDisabled(key))) {
          k.preventDefault();
          k.stopPropagation();
          return;
        }
        if (k.key === "Enter" || k.key === " ") {
          interactions.set(state, { pointerType: "keyboard", key: k.key });
          if (sub) {
            // Submenu triggers: Space / Enter open with the first item focused (virtual / keyboard press start).
            k.preventDefault();
            if (!managerOf(state, el).isDisabled(key)) openSubmenu(sub, "first");
            setInteractionModality("keyboard");
            return;
          }
          if (item instanceof HTMLAnchorElement) {
            // Links with real DOM focus activate on Enter natively (the click runs the action); Space clicks.
            if (k.key === " ") {
              k.preventDefault();
              synthClick(item);
            }
            setInteractionModality("keyboard");
            return;
          }
        }
      }
      // Don't clear the menu selected keys if the user presses escape since escape closes the menu.
      if (k.key !== "Escape" || state.options.shouldUseVirtualFocus) collectionKeyDown(state, k, el, hooks);
      if (item && key != null && (k.key === "Enter" || k.key === " ") && !(item instanceof HTMLAnchorElement)) {
        menuItemClick(state, el, item, k, props.router);
        // click above sets modality to "virtual", set it back to keyboard so focus moves properly.
        setInteractionModality("keyboard");
      }
      return;
    }
    case "keyup":
      props.onKeyUp?.(e as Ev<KeyboardEvent>);
      collectionKeyUp(state, e as Ev<KeyboardEvent>, el, hooks);
      return endPress(state, el, null);
    case "pointerdown": {
      const p = e as Ev<PointerEvent>;
      // Submenu triggers keep DOM focus and are not selectable (useMenuItem `isTrigger`).
      if (item && isTrigger(item)) return triggerPressStart(state, el, item, p);
      return collectionPointerDown(state, p, el, hooks);
    }
    case "pointerup": {
      const p = e as Ev<PointerEvent>;
      if (item && isTrigger(item)) return triggerPressEnd(state, el, item, p);
      collectionPointerUp(state, p, el, hooks);
      return endPress(state, el, null);
    }
    case "pointercancel":
      collectionPointerCancel(state);
      return endPress(state, el, null);
    case "click": {
      if (!item) return;
      const m = e as Ev<MouseEvent>;
      if (syntheticClicks.has(item)) {
        syntheticClicks.delete(item);
        return menuItemClick(state, el, item, m, props.router);
      }
      if (isTrigger(item)) return;
      collectionClick(state, m, el, hooks);
      if (!interactions.get(state)) interactions.set(state, { pointerType: m.detail === 0 ? "virtual" : "mouse" });
      return menuItemClick(state, el, item, m, props.router);
    }
    case "mousedown": {
      // Prevent DOM focus from moving on mouse down when using virtual focus or on a submenu trigger.
      if (item && (isTrigger(item) || state.options.shouldUseVirtualFocus)) return void e.preventDefault();
      return collectionMouseDown(state, e as Ev<MouseEvent>, el);
    }
    case "pointerover":
    case "pointerout": {
      const p = e as Ev<PointerEvent>;
      if (p.pointerType === "touch") return;
      const next = p.type === "pointerover" ? item : itemOf(el, p.relatedTarget);
      return hoverItem(state, el, next, p);
    }
    case "focusin": {
      const f = e as Ev<FocusEvent>;
      collectionFocusIn(state, f, el);
      focusItemAttrs(state, el);
      // useSubmenuTrigger: focus moved to another item of this menu while a submenu is open → close it.
      const stack = untrack(state.root.expandedKeysStack);
      const openKey = stack[state.level];
      if (openKey !== undefined && item && String(domKey(item)) !== String(openKey)) {
        const sub = state.submenus?.[String(openKey)];
        if (sub) closeSubmenu(sub);
      }
      if (item) {
        const key = domKey(item);
        const cb = key != null ? itemCallbacks(state, key) : undefined;
        cb?.onFocus?.(f);
        cb?.onFocusChange?.(true);
      }
      return;
    }
    case "focusout": {
      const f = e as Ev<FocusEvent>;
      collectionFocusOut(state, f, el);
      if (item) {
        itemAttr(state, item, "focus-visible", false);
        const key = domKey(item);
        const cb = key != null ? itemCallbacks(state, key) : undefined;
        cb?.onBlur?.(f);
        cb?.onFocusChange?.(false);
      }
      return;
    }
    case "dragstart":
      return collectionDragStart(state, e);
    case "scroll":
      return collectionScroll(state, e);
  }
}

// data-focus-visible on the focused item (RAC: isFocused && manager.isFocused && isFocusVisible() && !expanded trigger).
function focusItemAttrs(state: MenuState, root: HTMLElement): void {
  const key = untrack(state.focusedKey);
  const item = key != null ? getItemElement(root, key) : null;
  if (item) itemAttr(state, item, "focus-visible", untrack(state.isFocused) && isFocusVisible() && !isTriggerExpanded(item));
}

// Submenu trigger press (usePress in useMenuItem with useSubmenuTrigger's onPressStart / onPress).
const triggerPresses = new WeakMap<object, { key: Key; pointerType: string }>();

function triggerPressStart(state: MenuState, root: HTMLElement, item: HTMLElement, e: PointerEvent): void {
  if (e.button !== 0) return;
  const key = domKey(item);
  if (key == null || managerOf(state, root).isDisabled(key)) return;
  const pointerType = e.pointerType === "touch" || e.pointerType === "pen" ? e.pointerType : "mouse";
  triggerPresses.set(state, { key, pointerType });
  itemAttr(state, item, "pressed", true);
  callPress(state, key, "onPressStart", pressEvent("pressstart", pointerType, item, e));
}

function triggerPressEnd(state: MenuState, root: HTMLElement, item: HTMLElement, e: PointerEvent): void {
  const record = triggerPresses.get(state);
  triggerPresses.delete(state);
  itemAttr(state, item, "pressed", false);
  const key = domKey(item);
  if (!record || key == null || String(record.key) !== String(key)) return;
  const sub = state.submenus?.[String(key)];
  const pe = pressEvent("press", record.pointerType as PressEvent["pointerType"], item, e);
  // For touch or on a desktop device with a small screen open on press up.
  if (sub && (record.pointerType === "touch" || record.pointerType === "mouse")) {
    clearTimeout(hoverTimers.get(state));
    hoverTimers.delete(state);
    openSubmenu(sub);
  }
  callPress(state, key, "onPress", pe);
}

/** Focus the menu per its `autoFocus` (react-aria useSelectableList `autoFocus`): call when it opens. */
export function menuAutoFocus(state: MenuState, menu: HTMLElement, autoFocus: boolean | FocusStrategy | null | undefined): void {
  if (!autoFocus) return;
  autoFocusCollection(state, menu, autoFocus);
}

// =================================================================================================
// useMenuItem / useMenuSection / useSubmenuTrigger attribute bags (custom markup)
// =================================================================================================

export interface AriaMenuItemProps {
  /** The unique key for the menu item. */
  key: Key;
  /** Whether the menu item is disabled (RAC MenuItem `isDisabled`; also `disabledKeys`). */
  isDisabled?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  /** What kind of popup the item opens (submenu triggers). */
  "aria-haspopup"?: "menu" | "dialog";
  "aria-expanded"?: () => boolean;
  "aria-controls"?: () => string | undefined;
  /** Rivet: whether a label / description / keyboard shortcut element is rendered (RA `useSlotId`). */
  hasLabel?: boolean;
  hasDescription?: boolean;
  hasKeyboardShortcut?: boolean;
}

export interface MenuItemAria {
  menuItemProps: Record<string, unknown>;
  labelProps: { id: string };
  descriptionProps: { id: string };
  keyboardShortcutProps: { id: string };
}

/** Item attributes (useMenuItem `menuItemProps` without handlers: the menu's `menuEvent` handles them). */
export function menuItemProps(props: AriaMenuItemProps, state: MenuState, selectionMode: string = state.selectionMode): MenuItemAria {
  const { key } = props;
  const id = getItemId(state, key);
  const trigger = !!props["aria-haspopup"];
  let role = "menuitem";
  if (!trigger) {
    if (selectionMode === "single") role = "menuitemradio";
    else if (selectionMode === "multiple") role = "menuitemcheckbox";
  }
  const labelId = id + "-label",
    descriptionId = id + "-description",
    keyboardId = id + "-kbd";
  const describedBy =
    [props["aria-describedby"], props.hasDescription ? descriptionId : undefined, props.hasKeyboardShortcut ? keyboardId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  const disabled = props.isDisabled ?? false;
  const expanded = props["aria-expanded"];
  return {
    menuItemProps: {
      id,
      role,
      "data-key": String(key),
      "data-key-type": typeof key === "number" ? "number" : undefined,
      "aria-disabled": itemDisabled(state, key, disabled) ? "true" : undefined,
      "aria-label": props["aria-label"],
      "aria-labelledby": props.hasLabel === false ? undefined : labelId,
      "aria-describedby": describedBy,
      "aria-haspopup": props["aria-haspopup"],
      "aria-expanded": expanded ? () => str(expanded()) : undefined,
      "aria-controls": props["aria-controls"],
      "aria-checked": selectionMode !== "none" && !trigger ? () => str(!!itemSelected(state, key, disabled)) : undefined,
      // If a submenu is expanded, set the tabIndex to -1 so that shift tabbing goes out of the menu.
      tabIndex: () => {
        const t = itemTabIndex(state, key, disabled);
        return t != null && expanded?.() && !state.options.shouldUseVirtualFocus ? -1 : t;
      },
      "data-disabled": itemDisabled(state, key, disabled) ? "true" : undefined,
      "data-focused": () => (itemFocused(state, key) ? "true" : undefined),
      "data-selected": () => (selectionMode !== "none" && itemSelected(state, key, disabled) ? "true" : undefined),
      "data-selection-mode": selectionMode === "none" ? undefined : selectionMode,
      "data-has-submenu": trigger ? "true" : undefined,
      "data-open": expanded ? () => (expanded() ? "true" : undefined) : undefined,
    },
    labelProps: { id: labelId },
    descriptionProps: { id: descriptionId },
    keyboardShortcutProps: { id: keyboardId },
  };
}

export interface AriaMenuSectionProps {
  /** Whether the section has a heading (RA `heading`). */
  heading?: boolean;
  /** An accessibility label for the section. Required if `heading` is not present. */
  "aria-label"?: string;
  /** Rivet: id of the heading (RA useId), derived from the section key. */
  headingId: string;
}

/** useMenuSection: `{ itemProps, headingProps, groupProps }`. */
export function menuSectionProps(props: AriaMenuSectionProps): {
  itemProps: { role: "presentation" };
  headingProps: Record<string, unknown>;
  groupProps: Record<string, unknown>;
} {
  const { heading, "aria-label": ariaLabel, headingId } = props;
  return {
    itemProps: { role: "presentation" },
    // Technically, menus cannot contain headings according to ARIA. We hide the heading from
    // assistive technology, using role="presentation", and only use it as a label for the nested group.
    headingProps: heading ? { id: headingId, role: "presentation" } : {},
    groupProps: { role: "group", "aria-label": ariaLabel, "aria-labelledby": heading ? headingId : undefined },
  };
}

export interface AriaSubmenuTriggerProps {
  /** Whether the submenu trigger is disabled. */
  isDisabled?: boolean;
  /** The type of the contents that the submenu trigger opens. */
  type?: "dialog" | "menu";
  /** The delay time in milliseconds for the submenu to appear after hovering over the trigger. @default 200 */
  delay?: number;
  /** Rivet: the parent menu's state (ids). */
  parent: MenuState;
}

/** useSubmenuTrigger: `{ submenuTriggerProps, submenuProps, popoverProps }` (handlers: `menuEvent` + `submenuKeyDown`). */
export function submenuTriggerProps(props: AriaSubmenuTriggerProps, state: SubmenuTriggerState) {
  const { isDisabled, type = "menu", parent } = props;
  const submenuTriggerId = getItemId(parent, state.triggerKey);
  const overlayId = submenuId(parent, state.triggerKey);
  return {
    submenuTriggerProps: {
      id: submenuTriggerId,
      "aria-controls": () => (state.isOpen() ? overlayId : undefined),
      "aria-haspopup": !isDisabled ? type : undefined,
      "aria-expanded": () => state.isOpen(),
      isOpen: () => state.isOpen(),
    },
    submenuProps: {
      id: overlayId,
      "aria-labelledby": submenuTriggerId,
      submenuLevel: state.submenuLevel,
      ...(type === "menu" ? { onClose: () => closeAllSubmenus(state), autoFocus: () => state.focusStrategy() ?? undefined } : {}),
    },
    popoverProps: {
      isNonModal: true,
      shouldCloseOnInteractOutside: (target: Element) => target.id !== submenuTriggerId,
    },
  };
}
