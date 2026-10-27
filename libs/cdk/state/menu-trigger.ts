// Ported from react-spectrum (react-stately: menu/useMenuTriggerState, menu/useSubmenuTriggerState), Apache-2.0, © Adobe.
//
// Menu trigger state (leaf of `./menu.ts`, re-exported there): the trigger's overlay state (open, focus strategy, the
// stack of open submenus) and one submenu trigger state per SubmenuTrigger. Signals + JSON only. RAC DialogTrigger uses
// it too (`useMenuTriggerState`), so it imports no list / selection / collection code.
import { computed, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/cdk/id";
import type { FocusStrategy } from "../_adapters/collections.ts";
import type { Key } from "./list.ts";
import { closeOverlay, createOverlayTriggerState, openOverlay, toggleOverlay, type OverlayTriggerProps, type OverlayTriggerState } from "./overlays.ts";

/** RAC `MenuTriggerType`. */
export type MenuTriggerType = "press" | "longPress" | "contextMenu";

// --- useMenuTriggerState ------------------------------------------------------------------------

export interface MenuTriggerStateProps extends OverlayTriggerProps {
  /** RAC `trigger`: "press" (default), "longPress" or "contextMenu". */
  trigger?: MenuTriggerType;
}

/** react-stately `RootMenuTriggerState` (methods: `openMenu`, `toggleMenu`, `closeMenu`, `openSubmenuKey`, `closeSubmenuKey`). */
export interface MenuTriggerState extends OverlayTriggerState {
  /** Trigger element id. */
  readonly triggerId: string;
  /** Root menu element id. */
  readonly menuId: string;
  readonly trigger: MenuTriggerType;
  /** Where focus goes when the menu opens (RAC `focusStrategy`; null: the menu / its selection). */
  readonly focusStrategy: Signal<FocusStrategy | null>;
  /** Trigger keys of the open submenus, by level (RAC `expandedKeysStack`). */
  readonly expandedKeysStack: Signal<readonly Key[]>;
}

/** react-stately `useMenuTriggerState`. */
export function createMenuTriggerState(props: MenuTriggerStateProps & { id?: string } = {}): MenuTriggerState {
  // Region state: a resumed page re-creating the menu's region (its first open) keeps it.
  const menuId = props.id ?? createId();
  return {
    ...createOverlayTriggerState(props),
    triggerId: menuId + "-trigger",
    menuId,
    trigger: props.trigger ?? "press",
    focusStrategy: signal<FocusStrategy | null>(null),
    expandedKeysStack: signal<readonly Key[]>([]),
  };
}

/** `open(focusStrategy = null)`. */
export function openMenu(state: MenuTriggerState, focusStrategy: FocusStrategy | null = null): void {
  state.focusStrategy.set(focusStrategy);
  openOverlay(state);
}

/** `toggle(focusStrategy = null)`. */
export function toggleMenu(state: MenuTriggerState, focusStrategy: FocusStrategy | null = null): void {
  state.focusStrategy.set(focusStrategy);
  toggleOverlay(state);
}

/** `close()` = `closeAll`: closes every submenu and the menu. */
export function closeMenu(state: MenuTriggerState): void {
  state.expandedKeysStack.set([]);
  closeOverlay(state);
}

/** `openSubmenu(triggerKey, level)`: the stack keeps levels below `level`, then this key. */
export function openSubmenuKey(state: MenuTriggerState, triggerKey: Key, level: number): void {
  const stack = untrack(state.expandedKeysStack);
  if (level > stack.length) return;
  state.expandedKeysStack.set([...stack.slice(0, level), triggerKey]);
}

/** `closeSubmenu(triggerKey, level)`: closes this level (and the ones above) when it is open. */
export function closeSubmenuKey(state: MenuTriggerState, triggerKey: Key, level: number): void {
  const stack = untrack(state.expandedKeysStack);
  if (stack[level] === triggerKey) state.expandedKeysStack.set(stack.slice(0, level));
}

/** Whether the submenu of `triggerKey` at `level` is open (binding accessor). */
export const isSubmenuOpen = (state: MenuTriggerState, triggerKey: Key, level: number): boolean => state.expandedKeysStack()[level] === triggerKey;

// --- useSubmenuTriggerState ---------------------------------------------------------------------

/** react-stately `SubmenuTriggerState` (methods: `openSubmenu`, `closeSubmenu`, `toggleSubmenu`, `closeAllSubmenus`). */
export interface SubmenuTriggerState {
  readonly root: MenuTriggerState;
  /** The trigger item's key (Rivet: set by the trigger MenuItem when it renders, `bindSubmenuTrigger`). */
  triggerKey: Key;
  /** The level of the submenu (the stack length when the trigger was created). */
  readonly submenuLevel: number;
  /** Whether the submenu is open (accessor). */
  readonly isOpen: () => boolean;
  readonly focusStrategy: Signal<FocusStrategy | null>;
}

/** react-stately `useSubmenuTriggerState({ triggerKey }, rootState)`; `level` defaults to the current stack length. */
export function createSubmenuTriggerState(props: { triggerKey: Key }, root: MenuTriggerState, level?: number): SubmenuTriggerState {
  const submenuLevel = level ?? untrack(root.expandedKeysStack).length;
  const sub: SubmenuTriggerState = {
    root,
    triggerKey: props.triggerKey,
    submenuLevel,
    // Reads `triggerKey` at evaluation: the trigger item may bind its own key after creation.
    isOpen: computed(() => String(root.expandedKeysStack()[submenuLevel]) === String(sub.triggerKey)),
    focusStrategy: signal<FocusStrategy | null>(null),
  };
  return sub;
}

/** Rivet: the trigger item of a SubmenuTrigger renders with its own key: bind it (before anything opens). */
export function bindSubmenuTrigger(state: SubmenuTriggerState, triggerKey: Key): void {
  state.triggerKey = triggerKey;
}

/** Submenu `open(focusStrategy)`. */
export function openSubmenu(state: SubmenuTriggerState, focusStrategy?: FocusStrategy | null): void {
  state.focusStrategy.set(focusStrategy ?? null);
  openSubmenuKey(state.root, state.triggerKey, state.submenuLevel);
}

/** Submenu `close()`. */
export function closeSubmenu(state: SubmenuTriggerState): void {
  state.focusStrategy.set(null);
  closeSubmenuKey(state.root, state.triggerKey, state.submenuLevel);
}

/** Submenu `toggle(focusStrategy)`. */
export function toggleSubmenu(state: SubmenuTriggerState, focusStrategy?: FocusStrategy | null): void {
  state.focusStrategy.set(focusStrategy ?? null);
  if (untrack(state.isOpen)) closeSubmenu(state);
  else openSubmenu(state, focusStrategy);
}

/** Submenu `closeAll()`: the root `close`. */
export const closeAllSubmenus = (state: SubmenuTriggerState): void => closeMenu(state.root);
