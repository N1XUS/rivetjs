// Ported from react-spectrum (react-stately: menu/useMenuTriggerState, menu/useSubmenuTriggerState,
// tree/useTreeState for menus; react-aria-components Menu.tsx MenuSection selection), Apache-2.0, © Adobe.
//
// Menu state: the trigger's overlay state (open, focus strategy, the stack of open submenus), one
// submenu trigger state per SubmenuTrigger, and one list state per menu (root and each submenu):
// selection, focus, actions. Signals + JSON only.
// Rivet:
// - methods are free functions (`openMenu`, `toggleMenu`, `closeMenu`, `openSubmenuKey`, `openSubmenu`, …).
// - the menu's collection is the rendered DOM (items need no serialized model): MenuItem / MenuSection /
//   SubmenuTrigger register their callbacks, disabled flags, section selection and submenu states into
//   the menu state at render (`registerMenuItem`, `registerMenuSection`, `registerSubmenu`).
import { computed, signal, untrack, _regionState, type Signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/cdk/id";
import { createMultipleSelectionState, type FocusStrategy, type MultipleSelectionState } from "../_adapters/collections.ts";
import type { PressEvent } from "../interactions/press.tsx";
import type { HoverEvent } from "../interactions/hover.tsx";
import { closeOverlay, createOverlayTriggerState, openOverlay, toggleOverlay, type OverlayTriggerProps, type OverlayTriggerState } from "./overlays.ts";
import { createListState, getItemId, type Key, type ListProps, type ListState, type Selection, type SelectionMode } from "./list.ts";

export type { Key, Selection, SelectionMode, FocusStrategy };

/** RAC `MenuTriggerType`. */
export type MenuTriggerType = "press" | "longPress" | "contextMenu";

/** Per-item callbacks / options of a rendered MenuItem (RAC `MenuItem` props), registered at render by key. */
export interface MenuItemCallbacks {
  /** Item action (RAC `MenuItem onAction`), called before the menu's `onAction`. */
  onAction?: () => void;
  /** Overrides the section's / menu's `shouldCloseOnSelect`. */
  shouldCloseOnSelect?: boolean;
  /** Router options of a link item (`routerOptions`). */
  routerOptions?: Record<string, unknown>;
  onPressStart?: (e: PressEvent) => void;
  onPressEnd?: (e: PressEvent) => void;
  onPressUp?: (e: PressEvent) => void;
  onPress?: (e: PressEvent) => void;
  onPressChange?: (isPressed: boolean) => void;
  onHoverStart?: (e: HoverEvent) => void;
  onHoverEnd?: (e: HoverEvent) => void;
  onHoverChange?: (isHovering: boolean) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  /** Interaction-state signals of the item, when its render props are functions (the menu's handler writes them with the `data-*` attributes). */
  states?: MenuItemStateSignals;
}

/** RAC MenuItem render-prop states written from the delegated handler (`data-hovered` / `data-pressed` / `data-focus-visible`). */
export interface MenuItemStateSignals {
  hovered: Signal<boolean>;
  pressed: Signal<boolean>;
  focusVisible: Signal<boolean>;
}

/** Options of a rendered MenuSection, by section key. */
export interface MenuSectionOptions {
  shouldCloseOnSelect?: boolean;
}

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
  return _regionState(() => {
    const menuId = props.id ?? createId();
    return {
      ...createOverlayTriggerState(props),
      triggerId: menuId + "-trigger",
      menuId,
      trigger: props.trigger ?? "press",
      focusStrategy: signal<FocusStrategy | null>(null),
      expandedKeysStack: signal<readonly Key[]>([]),
    };
  });
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
  return _regionState(() => {
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
  });
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

// --- Menu (tree) state --------------------------------------------------------------------------

export interface MenuState extends ListState {
  /** 0: root menu; n: submenu depth. */
  readonly level: number;
  /** The root trigger state (a standalone menu creates its own). */
  readonly root: MenuTriggerState;
  /** Submenu: its trigger's state and the parent menu's id. */
  readonly submenuTrigger?: SubmenuTriggerState | undefined;
  readonly parentId?: string | undefined;
  /** RAC `Menu onAction(key)` (useMenu `menuData.onAction`). */
  readonly menuAction?: ((key: Key) => void) | undefined;
  /** RAC `Menu onClose` (default: the trigger's close). */
  readonly onClose?: (() => void) | undefined;
  readonly shouldCloseOnSelect?: boolean | undefined;
  /** Item callbacks / options, by key (registered by MenuItem at render). */
  readonly items: Record<string, MenuItemCallbacks>;
  /** Section options, by section key (registered by MenuSection). */
  readonly sections: Record<string, MenuSectionOptions>;
  /** Submenu trigger states of this menu's SubmenuTrigger items, by trigger key. */
  readonly submenus: Record<string, SubmenuTriggerState>;
  /** Hover-open delays of submenu trigger items, by key (ms). */
  readonly delays: Record<string, number>;
  /** Rivet: number of rendered items (live collection: RAC `collection.size` for `isEmpty`). */
  readonly itemCount: Signal<number>;
}

export interface MenuProps extends Omit<
  ListProps,
  | "items"
  | "selectionBehavior"
  | "shouldSelectOnPressUp"
  | "allowsDifferentPressOrigin"
  | "linkBehavior"
  | "followFocus"
  | "selected"
  | "defaultSelected"
  | "onAction"
  | "selectedKeys"
> {
  /** The currently selected keys (a Signal: two-way; a plain value: the initial selection, changes reported to `onSelectionChange`). */
  selectedKeys?: Signal<Selection> | "all" | Iterable<Key>;
  onAction?: (key: Key) => void;
  onClose?: () => void;
  shouldCloseOnSelect?: boolean;
}

/** react-stately `useTreeState` for a menu + RAC menu context (`menuData`: action, close; section selection). */
export function createMenuState(
  props: MenuProps,
  context: { root?: MenuTriggerState; level?: number; submenuTrigger?: SubmenuTriggerState; parentId?: string; id?: string } = {},
): MenuState {
  // Region state: a resumed page re-creating the menu's region (its first open) keeps it.
  return _regionState((): MenuState => {
    const { onAction, selectedKeys, ...listProps } = props;
    const list = createListState({
      ...listProps,
      ...(selectedKeys !== undefined ? { selectedKeys: toSelectionSignal(selectedKeys) } : {}),
      ...(context.id ? { id: context.id } : {}),
      selectionMode: props.selectionMode ?? "none",
      // useMenu: wrap focus; useMenuItem: select on press up, from a press that started elsewhere (the
      // trigger); links are handled by the menu item (linkBehavior "none").
      shouldFocusWrap: props.shouldFocusWrap ?? true,
      linkBehavior: "none",
      shouldSelectOnPressUp: true,
      allowsDifferentPressOrigin: true,
      // Menus open with focus on the menu (or the strategy's item): no server tab stop.
      focusedKey: props.focusedKey ?? null,
    });
    return {
      ...list,
      level: context.level ?? 0,
      root: context.root ?? createMenuTriggerState({ id: list.id }),
      submenuTrigger: context.submenuTrigger,
      parentId: context.parentId,
      menuAction: onAction,
      onClose: props.onClose,
      shouldCloseOnSelect: props.shouldCloseOnSelect,
      items: {},
      sections: {},
      submenus: {},
      delays: {},
      groups: {},
      itemCount: signal(0),
    };
  });
}

/** Register a rendered MenuItem's callbacks / disabled flag (RAC: the collection node's props). */
export function registerMenuItem(state: MenuState, key: Key, item: MenuItemCallbacks & { isDisabled?: boolean }): void {
  const { isDisabled, ...callbacks } = item;
  if (isDisabled) state.disabledKeys.add(key);
  let any = false;
  for (const name in callbacks) if ((callbacks as Record<string, unknown>)[name] !== undefined) any = true;
  if (any) state.items[String(key)] = callbacks;
}

/** Register a MenuSection: its close rule and own selection (RAC `GroupSelectionManager`). */
export function registerMenuSection(
  state: MenuState,
  key: Key,
  section: MenuSectionOptions & {
    selectionMode?: SelectionMode;
    selectedKeys?: Signal<Selection> | "all" | Iterable<Key>;
    defaultSelectedKeys?: "all" | Iterable<Key>;
    onSelectionChange?: (keys: Selection) => void;
    disallowEmptySelection?: boolean;
  },
): void {
  if (section.shouldCloseOnSelect !== undefined) state.sections[String(key)] = { shouldCloseOnSelect: section.shouldCloseOnSelect };
  if (section.selectionMode == null) return;
  (state.groups as Record<string, MultipleSelectionState>)[String(key)] = createMultipleSelectionState({
    selectionMode: section.selectionMode,
    ...(section.selectedKeys ? { selectedKeys: toSelectionSignal(section.selectedKeys) } : {}),
    ...(section.defaultSelectedKeys ? { defaultSelectedKeys: section.defaultSelectedKeys } : {}),
    ...(section.onSelectionChange ? { onSelectionChange: section.onSelectionChange } : {}),
    ...(section.disallowEmptySelection !== undefined ? { disallowEmptySelection: section.disallowEmptySelection } : {}),
    disabledKeys: state.disabledKeys,
  });
}

/** Register a SubmenuTrigger item of `state` (its trigger state + hover delay). */
export function registerSubmenu(state: MenuState, key: Key, sub: SubmenuTriggerState, delay?: number): void {
  state.submenus[String(key)] = sub;
  if (delay !== undefined) state.delays[String(key)] = delay;
}

const isSignal = (v: unknown): v is Signal<Selection> => typeof v === "function" && typeof (v as Signal<Selection>).set === "function";

/** A controlled selection: a Signal as is; a plain value → a signal starting at it (Deviation: the adapter selection writes it). */
function toSelectionSignal(keys: Signal<Selection> | (() => Selection) | "all" | Iterable<Key>): Signal<Selection> {
  // A Signal (two-way) or a read-only accessor (live prop, `liveKeys`: controlled, never written) as is.
  if (typeof keys === "function") return keys as Signal<Selection>;
  return signal<Selection>(keys === "all" ? "all" : new Set(keys as Iterable<Key>));
}

/** Id of the submenu of `key` in menu `parent` (its trigger item is `getItemId(parent, key)`). */
export const submenuId = (parent: { id: string }, key: Key): string => getItemId(parent, key) + "-menu";

/** The selection state an item renders from: its section's own, else the menu's. */
export function selectionOf(state: MenuState, sectionKey: Key | undefined): MultipleSelectionState & { selectionMode: SelectionMode } {
  return (sectionKey !== undefined && state.groups?.[String(sectionKey)]) || state;
}
