// Ported from react-aria-components Menu.tsx (MenuTrigger, SubmenuTrigger, Menu, MenuSection, MenuItem,
// MenuLoadMoreItem; MenuContext, MenuStateContext, RootMenuTriggerStateContext, MenuItemContext)
// (packages/react-aria-components/src/Menu.tsx), Apache-2.0, © Adobe.
//
// RAC composition: `<MenuTrigger><Button/><Popover><Menu><MenuItem/>…</Menu></Popover></MenuTrigger>`,
// sections (`MenuSection` + `Header`), `Separator`, `SubmenuTrigger` (`<MenuItem/>` + `<Popover><Menu/></Popover>`),
// `trigger` "press" | "longPress" | "contextMenu".
// Rivet:
// - live collection (`../collections/components.tsx`): parts render their DOM in place (`data-key`); ONE
//   delegated handler on the menu element (`menuEvent`, ./behaviour.tsx) runs useMenu + every useMenuItem /
//   useSubmenuTrigger against the DOM, so items carry no handlers (resumable, nothing loads before the first
//   interaction). Item callbacks (`onAction`, press / hover / focus events, `shouldCloseOnSelect`) are
//   registered into the menu state by key (`registerMenuItem`), section rules by section key.
// - MenuTrigger renders no element: it provides MenuContext / OverlayTriggerStateContext /
//   RootMenuTriggerStateContext / PopoverContext and a `PressResponder` whose trigger props reach the user's
//   `<Button>` (accessors for `aria-expanded` / `aria-controls` / `isPressed`).
// - SubmenuTrigger: the trigger MenuItem binds its own key to the submenu state (`bindSubmenuTrigger`); the
//   submenu Popover is portaled into the root popover's group container; the safe-triangle pointer tracking
//   (useSafelyMouseToSubmenu) attaches while the submenu is mounted.
// - render props are accessors; `data-hovered` / `data-pressed` / `data-focus-visible` are written by the
//   delegated handler (signals only when a `class` / `style` / `children` function asks for them).
// - Inside a `<CollectionVirtualizer layout={ListLayout}>` the menu builds its collection (`builtCollectionOf`): the
//   state's `virtual` (built collection + layout delegate) makes the delegated handler navigate it, items render as
//   views with `aria-posinset` / `aria-setsize`, the menu element is the scroll container. Submenus: not covered.
// - `class` = RAC `className` (defaults `rv-Menu`, `rv-MenuItem`, `rv-MenuSection`, `rv-MenuLoadingIndicator`).
// - SelectableCollectionContext (Autocomplete) merges under the menu props: `shouldUseVirtualFocus` /
//   `disallowTypeAhead` / `autoFocus` may be accessors (read in bindings; a client effect mirrors them into
//   the menu state options the delegated handler reads); `filter` hides items in place (each item's own
//   `Show`, live collection); `onFocusIn` goes on the menu element; `react-aria-focus` /
//   `react-aria-clear-focus` are handled on the menu element.
// `render` (RAC DOMRenderProps) on Menu (`<div>`), MenuSection (`<section>`) and MenuItem (`<div>` / `<a>`): given, the attributes object goes to `render(attrs, renderProps)`. Deviations: no FocusScope around the menu (the popover's focus scope contains focus;
//   a standalone menu has no FocusManager); `isEmpty` counts rendered (visible) items (live collection; a
//   virtualized menu: its rendered window); live-mode filtering keeps empty sections (RAC drops them); no `--trigger-width` on the popover.
import { createRoot, onCleanup, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef, type Ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { createContext } from "@rivetjs/reactivity";
import {
  DEFAULT_SLOT,
  Provider,
  contextProps,
  createSlotId,
  mergeRefValues,
  renderProps,
  slotIdRef,
  type ClassNameOrFunction,
  type ContextValue,
  type RefValue,
  type SlotProps,
  type StyleOrFunction,
} from "../slots/index.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { PressResponder } from "../interactions/pressable.tsx";
import { OverlayTriggerStateContext, PopoverContext } from "../overlay/contexts.ts";
import {
  CollectionRendererContext,
  Collection,
  SectionContext,
  createBranchComponent,
  createLeafComponent,
  builtCollectionOf,
  isCollectionProbe,
  isHidden,
  type CollectionProps,
} from "../collections/components.tsx";
import { itemPosition } from "../collections/nodes.ts";
import type { VirtualCollection } from "../_adapters/selection.ts";
import { CollectionNode, ItemNode, LoaderNode, SectionNode } from "../collections/base.ts";
import { HeaderContext } from "../header/index.tsx";
import { SeparatorContext } from "../separator/index.tsx";
import { TextContext } from "../text/index.tsx";
import { probeSlots } from "#server";
import { KeyboardContext } from "../keyboard/index.tsx";
import { useLocale } from "../i18n/index.ts";
import { idSignal } from "../utils/id.ts";
import { loadMoreSentinel } from "../utils/load-more-sentinel.tsx";
import type { OverlayTriggerProps, OverlayTriggerState, Point } from "../state/overlays.ts";
import { controllable } from "../interactions/controllable.ts";
import type { FocusStrategy } from "../_adapters/collections.ts";
import type { PressEvent } from "../interactions/press.tsx";
import type { HoverEvent } from "../interactions/hover.tsx";
import {
  bindSubmenuTrigger,
  closeMenu,
  createMenuState,
  createMenuTriggerState,
  createSubmenuTriggerState,
  registerMenuItem,
  registerMenuSection,
  registerSubmenu,
  selectionOf,
  submenuId,
  closeAllSubmenus,
  closeSubmenu,
  openSubmenu,
  type Key,
  type MenuItemStateSignals,
  type MenuProps as MenuStateProps,
  type MenuState,
  type MenuTriggerState,
  type MenuTriggerType,
  type Selection,
  type SelectionMode,
  type SubmenuTriggerState,
} from "../state/menu.ts";
import { getItemId, itemDisabled, itemFocused, itemSelected, itemTabIndex, collectionTabIndex } from "../state/list.ts";
import { FieldInputContext, SelectableCollectionContext, type SelectableCollectionContextValue } from "../autocomplete/contexts.ts";
import type { Node } from "../collections/types.ts";
import {
  menuAutoFocus,
  menuClearVirtualFocus,
  menuCollectionUpdated,
  menuEvent,
  menuKeys,
  menuSubmenuClosed,
  menuSubmenuOpened,
  menuTriggerProps,
  menuVirtualFocus,
  type AriaMenuOptions,
} from "./behaviour.tsx";
import { hasLive, isLive, liveAt, liveOptions, liveKeys, liveView } from "../utils/live.tsx";

/** A live MenuItem `isDisabled` (with the Menu's `disabledKeys`): a returned arrow (resumable). */
function liveItemDisabled(state: MenuState, key: Key, own: () => unknown): () => boolean {
  return () => itemDisabled(state, key, !!own());
}
/** `aria-disabled` of a live disabled flag. */
/** `aria-posinset` (0) / `aria-setsize` (1) of a virtualized menu's item (`itemPosition`: per section). */
function menuItemPosition(state: MenuState, key: Key, part: 0 | 1): number | undefined {
  const collection = state.virtual?.collection();
  return collection ? itemPosition(collection as never, key)?.[part] : undefined;
}

function ariaDisabledOf(disabled: () => boolean): () => "true" | undefined {
  return () => (disabled() ? "true" : undefined);
}
/** `data-disabled` of a live disabled flag. */
function dataDisabledOf(disabled: () => boolean): () => "true" | undefined {
  return () => dataBool(disabled());
}
import { liveRenderProps } from "../slots/index.tsx";

export type { Key, Selection, SelectionMode, MenuTriggerType, MenuState, MenuTriggerState, SubmenuTriggerState };

// =================================================================================================
// Contexts
// =================================================================================================

/** RAC `MenuContext`: props for the Menu inside a MenuTrigger / SubmenuTrigger. */
export const MenuContext = createContext<ContextValue<MenuProps<any>, HTMLDivElement>>(null);
/** RAC `MenuStateContext`: the state of the nearest Menu (Rivet: `MenuState`, the menu's tree / list state). */
export const MenuStateContext = createContext<MenuState | null>(null);
/** RAC `RootMenuTriggerStateContext`: the root menu trigger state (open submenus stack). */
export const RootMenuTriggerStateContext = createContext<MenuTriggerState | null>(null);
/** RAC `MenuItemContext` (not exported upstream; Rivet exports it for custom containers). */
export const MenuItemContext = createContext<ContextValue<MenuItemProps<any>, HTMLElement>>(null);
/** Rivet: the key of the MenuSection an item renders in (RAC `SelectionManagerContext` → the section's selection). */
const MenuSectionKeyContext = createContext<Key | null>(null);
/** Rivet: SubmenuTrigger → its trigger MenuItem (binds the key) and its Menu (level, parent). */
interface SubmenuScope {
  sub: SubmenuTriggerState;
  parentId: string;
  delay: number | undefined;
  /** MenuContext / PopoverContext values of the submenu (filled by the trigger item). */
  menu: Record<string, unknown>;
  popover: Record<string, unknown>;
  /** The trigger item element (the submenu popover's `triggerRef`). */
  itemRef: Ref<HTMLElement>;
}
const SubmenuScopeContext = createContext<SubmenuScope | null>(null);
/** Rivet: the nearest Menu's SelectableCollectionContext `filter` + virtual focus accessor, for its items. */
interface MenuCollectionScope {
  filter: ((textValue: string, node: Node<unknown>) => boolean) | undefined;
  virtualFocus: () => boolean;
}
const MenuCollectionScopeContext = createContext<MenuCollectionScope | null>(null);

const isFn = (v: unknown): boolean => typeof v === "function" && !isSlot(v);
const read = <T,>(v: T | (() => T)): T => (typeof v === "function" ? (v as () => T)() : v);

// =================================================================================================
// MenuTrigger
// =================================================================================================

export interface MenuTriggerProps extends OverlayTriggerProps {
  /** The trigger (a `<Button>`) and the `<Popover>` with the `<Menu>`. */
  children?: Content;
  /** How the menu is triggered. Read once at mount (it picks the trigger props and the popover offset). @default 'press' */
  trigger?: MenuTriggerType;
}

/** A menu trigger wraps a button and a popover with a menu, opening the menu on press (RAC `MenuTrigger`). */
export function MenuTrigger(props: MenuTriggerProps) {
  // Live props: a controlled `isOpen={open()}` stays live (accessor; `controllable` reads it, never writes it).
  const state = createMenuTriggerState(liveOptions(props, [], ["isOpen"]));
  const triggerRef = createRef<HTMLButtonElement>();
  // If within a collection (e.g. Tabs), render nothing.
  if (isHidden()) return null;
  const trigger = props.trigger;
  const { locale } = useLocale();
  const { menuTriggerProps: triggerProps, menuProps: triggerMenuProps, longPressDescription } = menuTriggerProps({ trigger, locale }, state);
  // RA mergeIds: a Button `id` / Menu `id` replaces the generated id; aria-labelledby / aria-controls follow it.
  const triggerId = idSignal(state.triggerId),
    menuId = idSignal(state.menuId);
  const mp = { ...triggerMenuProps, "aria-labelledby": () => triggerId(), idRef: menuId };
  const tp = trigger === "contextMenu" ? triggerProps : { ...triggerProps, "aria-controls": () => (state.isOpen() ? menuId() : undefined) };
  const children = props.children;
  const description = longPressDescription;
  return (
    <Provider
      values={[
        [MenuContext, mp],
        [OverlayTriggerStateContext, state],
        [RootMenuTriggerStateContext, state],
        [
          PopoverContext,
          {
            trigger: "MenuTrigger",
            triggerRef,
            placement: "bottom start",
            "aria-labelledby": () => triggerId(),
            ...(trigger === "contextMenu" ? { offset: 0 } : {}),
          },
        ],
      ]}
    >
      <PressResponder {...(tp as object)} ref={triggerRef} isPressed={() => state.isOpen()}>
        {children}
      </PressResponder>
      {description ? (
        <span id={description.id} hidden>
          {description.text}
        </span>
      ) : null}
    </Provider>
  );
}

// =================================================================================================
// SubmenuTrigger
// =================================================================================================

export interface SubmenuTriggerProps {
  /** The trigger `<MenuItem>`, then the `<Popover>` with the submenu. */
  children?: Content;
  /** The delay time in milliseconds for the submenu to appear after hovering over the trigger. Read once at mount (registered with the submenu). @default 200 */
  delay?: number;
}

class SubmenuTriggerNode<T> extends CollectionNode<T> {
  static override readonly type = "submenutrigger";
}

/** A submenu trigger wraps a submenu's trigger item and the submenu itself (RAC `SubmenuTrigger`). */
export const SubmenuTrigger = /*#__PURE__*/ createBranchComponent<SubmenuTriggerProps>(
  SubmenuTriggerNode,
  function SubmenuTrigger(props: SubmenuTriggerProps, _ref: unknown, item: { key: Key }) {
    const { CollectionBranch } = useContext(CollectionRendererContext);
    const state = useContext(MenuStateContext)!;
    const root = useContext(RootMenuTriggerStateContext)!;
    // The trigger item binds its own key (bindSubmenuTrigger) and fills the submenu's Menu / Popover
    // context values (ids from that key) when it renders: it renders before the Popover sibling.
    const sub = createSubmenuTriggerState({ triggerKey: item.key }, root, state.level);
    const itemRef = createRef<HTMLElement>();
    const menu: Record<string, unknown> = {
      onClose: () => closeAllSubmenus(sub),
      autoFocus: () => sub.focusStrategy() ?? undefined,
    };
    const popover: Record<string, unknown> = {
      trigger: "SubmenuTrigger",
      triggerRef: itemRef,
      placement: "end top",
      isNonModal: true,
      // menu["aria-labelledby"] = the trigger item id, filled by bindSubmenuItem.
      shouldCloseOnInteractOutside: (target: Element) => target.id !== menu["aria-labelledby"],
    };
    // The submenu's overlay state (RAC: the SubmenuTriggerState): open = this level of the root stack.
    // Controlled by the accessor; writes (closeOverlay) go through onChange. Object-literal arrows: resume
    // symbols (arrows passed only as call arguments are not).
    const ctl = {
      isOpen: () => sub.isOpen(),
      onChange: (open: boolean) => (open ? openSubmenu(sub) : closeSubmenu(sub)),
    };
    const overlay: OverlayTriggerState = {
      isOpen: sub.isOpen as unknown as Signal<boolean>,
      point: signal<Point | null>(null),
      open: controllable(ctl.isOpen, false, ctl.onChange),
    };
    const delay = props.delay;
    const scope: SubmenuScope = { sub, parentId: state.id, delay, menu, popover, itemRef };
    return (
      <Provider
        values={[
          [SubmenuScopeContext, scope],
          [MenuContext, menu],
          [OverlayTriggerStateContext, overlay],
          [PopoverContext, popover],
        ]}
      >
        {() => CollectionBranch({ collection: null, parent: item as never }) as Content}
      </Provider>
    );
  },
) as (props: SubmenuTriggerProps) => unknown;

/** The trigger item of a SubmenuTrigger: bind its key, fill the submenu Menu / Popover context values. */
function bindSubmenuItem(scope: SubmenuScope, parent: MenuState, key: Key): void {
  bindSubmenuTrigger(scope.sub, key);
  const triggerId = getItemId(parent, key);
  scope.menu.id = submenuId(parent, key);
  scope.menu["aria-labelledby"] = triggerId;
  scope.popover["aria-labelledby"] = triggerId;
}

// =================================================================================================
// Menu
// =================================================================================================

export interface MenuRenderProps {
  /** Whether the menu has no items and should display its empty state. @selector [data-empty] */
  isEmpty: () => boolean;
}

export interface MenuProps<T = object>
  extends
    Omit<MenuStateProps, "onAction" | "focusedKey">,
    CollectionProps<T>,
    SlotProps,
    DOMRenderProps<"div", MenuRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Handler that is called when an item is selected. */
  onAction?: (key: Key) => void;
  /** Whether the menu should close when the menu item is selected. */
  shouldCloseOnSelect?: boolean;
  /** Where the focus should be set (a boolean / strategy, or an accessor: MenuTrigger passes its focus strategy). */
  autoFocus?: boolean | FocusStrategy | (() => boolean | FocusStrategy | undefined);
  /** Whether pressing the escape key should clear selection in the menu or not. @default 'clearSelection' */
  escapeKeyBehavior?: "clearSelection" | "none";
  "aria-label"?: string;
  /** Rivet: or an accessor (MenuTrigger: the trigger id after a Button `id` merged it). */
  "aria-labelledby"?: string | (() => string | undefined);
  "aria-describedby"?: string;
  /** The element's unique id (MenuTrigger / SubmenuTrigger set it). */
  id?: string;
  /** The CSS class for the element. A function may be provided to compute the class based on component state. @default 'rv-Menu' */
  class?: ClassNameOrFunction<MenuRenderProps>;
  /** The inline style for the element. A function may be provided to compute the style based on component state. */
  style?: StyleOrFunction<MenuRenderProps>;
  /** Provides content to display when there are no items in the menu. */
  renderEmptyState?: () => Content;
  ref?: RefValue<HTMLDivElement>;
}

/** Global DOM events the menu handles itself (delegated); the user's handlers run after its own. */
const MENU_OWNED = [
  "onKeyDown",
  "onKeyUp",
  "onPointerDown",
  "onPointerUp",
  "onPointerCancel",
  "onClick",
  "onMouseDown",
  "onPointerOver",
  "onPointerOut",
  "onFocusIn",
  "onFocusOut",
  "onDragStart",
  "onScroll",
  "style",
] as const;

/** A menu displays a list of actions or options that a user can choose (RAC `Menu`). */
export function Menu<T = object>(inProps: MenuProps<T>) {
  const [menuProps, menuRef] = contextProps(inProps, inProps.ref, MenuContext) as [MenuProps<T>, RefValue<HTMLDivElement> | undefined];
  // Inside a collection's build pass a menu registers nothing (RAC: the hidden tree keeps it). Autocomplete's server id
  // probe: merge the own id into the collection id first (as below).
  if (isHidden()) {
    if (isCollectionProbe()) contextProps(menuProps as MenuProps<T> & Record<string, unknown>, undefined, SelectableCollectionContext as never);
    return null;
  }
  // RAC MenuInner: the Autocomplete's collection props merge under the menu props.
  const [props, contextRef] = contextProps(menuProps as MenuProps<T> & Record<string, unknown>, menuRef, SelectableCollectionContext as never) as [
    MenuProps<T> & Omit<SelectableCollectionContextValue<unknown>, "autoFocus" | "id">,
    RefValue<HTMLDivElement> | undefined,
  ];
  const shouldUseVirtualFocus = props.shouldUseVirtualFocus,
    disallowTypeAhead = props.disallowTypeAhead,
    filter = props.filter;
  const virtualFocus = () => !!read(shouldUseVirtualFocus);
  const triggerState = useContext(RootMenuTriggerStateContext);
  const scope = useContext(SubmenuScopeContext);
  const userOnClose = props.onClose;
  const items = props.items,
    children = props.children;
  const content = () => <Collection items={items as never} children={children} />;
  const renderer = useContext(CollectionRendererContext);
  // RAC: inside a Virtualizer the menu renders from its built collection (only the visible window has items; the
  // delegated handler navigates the built collection, page keys use the layout). A local const arrow (resumable)
  // over a per-instance memo key.
  const builtKey = renderer.isVirtualized ? {} : null;
  const virtualCollection = () => builtCollectionOf(builtKey!, content) as unknown as ReturnType<VirtualCollection["collection"]>;
  const virtual: VirtualCollection | undefined = builtKey ? { collection: virtualCollection, layoutDelegate: renderer.layoutDelegate as never } : undefined;
  const state = createMenuState(
    {
      selectionMode: props.selectionMode,
      // Live props: a controlled `selectedKeys={keys()}` stays live (accessor; never written).
      selectedKeys: liveKeys(props, "selectedKeys"),
      defaultSelectedKeys: props.defaultSelectedKeys,
      onSelectionChange: props.onSelectionChange,
      disabledKeys: props.disabledKeys,
      disallowEmptySelection: props.disallowEmptySelection,
      shouldFocusWrap: props.shouldFocusWrap,
      escapeKeyBehavior: props.escapeKeyBehavior,
      onAction: props.onAction,
      // Inline arrow (a resume symbol); upstream: props.onClose ?? the trigger state close.
      onClose: () => (userOnClose ? userOnClose() : triggerState ? closeMenu(triggerState) : undefined),
      shouldCloseOnSelect: props.shouldCloseOnSelect,
      shouldUseVirtualFocus: untrack(virtualFocus),
      disallowTypeAhead: untrack(() => !!read(disallowTypeAhead)),
    } as MenuStateProps,
    {
      ...(triggerState ? { root: triggerState } : {}),
      level: scope ? scope.sub.submenuLevel + 1 : 0,
      ...(scope ? { submenuTrigger: scope.sub, parentId: scope.parentId } : {}),
      ...(props.id ? { id: props.id } : {}),
      ...(virtual ? { virtual } : {}),
    },
  );
  // Unmount: children dispose in creation order before the menu's own cleanups, so the items' count cleanups (below,
  // MenuItem) would write `itemCount` while the empty-state `Show` (a later child) still listens, and its re-run
  // would create a scope under the already disposed menu owner. A scope created before both marks the teardown first.
  createRoot(() => onCleanup(() => void (state.disposing = true)));
  // MenuTrigger's reactive menu id (DialogContext `idRef` pattern): the trigger's aria-controls follows a Menu `id`
  // (RA mergeIds; on a resumed page the merge runs in the browser, where idSignal has no updaters).
  const idRef = (props as { idRef?: Signal<string> }).idRef;
  if (idRef && untrack(idRef) !== state.id) idRef.set(state.id);
  const isEmpty = () => state.itemCount() === 0;
  const rp = untrack(() =>
    renderProps<MenuRenderProps>(
      { class: props.class, style: props.style, defaultClassName: "rv-Menu", values: { isEmpty } },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  const aria: AriaMenuOptions = {
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"] as string | undefined,
    "aria-describedby": props["aria-describedby"],
    escapeKeyBehavior: props.escapeKeyBehavior,
    onKeyDown: (props as Record<string, unknown>).onKeyDown as AriaMenuOptions["onKeyDown"],
    onKeyUp: (props as Record<string, unknown>).onKeyUp as AriaMenuOptions["onKeyUp"],
  };
  const { onPointerDown, onPointerUp, onPointerCancel, onClick, onMouseDown, onPointerOver, onPointerOut, onFocusIn, onFocusOut, onDragStart, onScroll } =
    props as Record<string, ((e: Event) => void) | undefined>;
  const element = createRef<HTMLDivElement>();
  const ref = mergeRefValues(element as RefValue<HTMLDivElement>, contextRef) as Ref<HTMLDivElement>;
  const autoFocus = props.autoFocus;
  // Accessor options (Autocomplete): mirror into the state options the delegated handler reads.
  if (typeof shouldUseVirtualFocus === "function" || typeof disallowTypeAhead === "function")
    clientEffect(() => {
      state.options.shouldUseVirtualFocus = virtualFocus();
      state.options.disallowTypeAhead = !!read(disallowTypeAhead);
    });
  // useSelectableCollection: the items changed (filter / load) → a pending "virtual focus first". React runs
  // it after the commit; here the count changes while the list's DOM is still being reconciled in the same
  // flush (an item's cleanup runs before its parent insertion removes its nodes), so it runs after the flush.
  clientEffect(() => {
    state.itemCount();
    const el = element();
    if (el) queueMicrotask(() => el.isConnected && untrack(() => menuCollectionUpdated(state, el)));
  });
  clientEffect(() => {
    const el = element();
    if (!el) return;
    return untrack(() => {
      menuAutoFocus(state, el, read(autoFocus) ?? false);
      const sub = state.submenuTrigger;
      if (!sub) return;
      const parentMenu = state.parentId ? el.ownerDocument.getElementById(state.parentId) : null;
      menuSubmenuOpened(sub, parentMenu, el);
      return () => menuSubmenuClosed(sub);
    });
  });

  const { CollectionRoot } = renderer;
  // Virtualized: the menu element is the scroll container (RAC scrollRef); its focused item stays rendered and its
  // scroll events reach the renderer.
  const rootCollection = builtKey ? virtualCollection : null;
  const focusedKey = builtKey ? state.focusedKey : undefined;
  const virtualScroll = builtKey ? renderer.onScroll : undefined;
  // Items first (they count themselves for `data-empty`), then the element.
  const body = (
    <Provider
      values={[
        [MenuStateContext, state],
        [SeparatorContext, { elementType: "div" }],
        [SectionContext, { name: "MenuSection", render: MenuSectionInner }],
        [MenuItemContext, { shouldCloseOnSelect: props.shouldCloseOnSelect }],
        [MenuSectionKeyContext, null],
        [SubmenuScopeContext, null],
        [MenuCollectionScopeContext, { filter, virtualFocus }],
        [SelectableCollectionContext, null],
        [FieldInputContext, null],
        // Ensure the root MenuTriggerState is defined, in case Menu is rendered outside a MenuTrigger.
        [RootMenuTriggerStateContext, state.root],
      ]}
    >
      {() => CollectionRoot({ collection: rootCollection as never, content, scrollRef: element, focusedKey }) as Content}
    </Provider>
  );
  const renderEmptyState = props.renderEmptyState;
  const dom = globalDOMProps(props, MENU_OWNED);
  const slot = props.slot || undefined,
    ariaLabel = aria["aria-label"],
    ariaLabelledby = aria["aria-labelledby"],
    ariaDescribedby = aria["aria-describedby"];
  if (props.render) {
    const attrs = {
      ...dom,
      ref,
      id: state.id,
      role: "menu",
      slot,
      class: () => rp.class(),
      style: () => rp.style(),
      "aria-label": ariaLabel,
      "aria-labelledby": () => read(ariaLabelledby as string | (() => string | undefined) | undefined),
      "aria-describedby": ariaDescribedby,
      "aria-multiselectable": state.selectionMode === "multiple" ? "true" : undefined,
      "data-collection": state.id,
      "data-rk": menuKeys(state),
      "data-empty": () => dataBool(isEmpty()),
      tabindex: () => (virtualFocus() ? undefined : collectionTabIndex(state)),
      onKeyDown: (e: KeyboardEvent) => menuEvent(e, aria, state),
      onKeyUp: (e: KeyboardEvent) => menuEvent(e, aria, state),
      onPointerDown: (e: Event) => {
        menuEvent(e, aria, state);
        onPointerDown?.(e);
      },
      onPointerUp: (e: Event) => {
        menuEvent(e, aria, state);
        onPointerUp?.(e);
      },
      onPointerCancel: (e: Event) => {
        menuEvent(e, aria, state);
        onPointerCancel?.(e);
      },
      onClick: (e: Event) => {
        menuEvent(e, aria, state);
        onClick?.(e);
      },
      onMouseDown: (e: Event) => {
        menuEvent(e, aria, state);
        onMouseDown?.(e);
      },
      onPointerOver: (e: Event) => {
        menuEvent(e, aria, state);
        onPointerOver?.(e);
      },
      onPointerOut: (e: Event) => {
        menuEvent(e, aria, state);
        onPointerOut?.(e);
      },
      onFocusIn: (e: Event) => {
        menuEvent(e, aria, state);
        onFocusIn?.(e);
      },
      onFocusOut: (e: Event) => {
        menuEvent(e, aria, state);
        onFocusOut?.(e);
      },
      onDragStart: (e: Event) => {
        menuEvent(e, aria, state);
        onDragStart?.(e);
      },
      onScroll: (e: Event) => {
        virtualScroll?.(e);
        menuEvent(e, aria, state);
        onScroll?.(e);
      },
      // Custom events: the spread takes `on<Type>` keys (no `on:` form). Contract: libs/runtime/dom-v2-spread.ts (~L121) strips
      // `on`, lowercases the rest (`react-aria-focus`) and binds non-delegated types with addEventListener. Tested in
      // render-collections.browser.test.tsx ("Menu virtual-focus custom events").
      "onReact-aria-focus": (e: Event) => menuVirtualFocus(e, state),
      "onReact-aria-clear-focus": (e: Event) => menuClearVirtualFocus(e, state),
      children: () => [
        body,
        renderEmptyState ? (
          <Show when={isEmpty}>
            {() => (
              <div role="menuitem" style={{ display: "contents" }}>
                {renderEmptyState()}
              </div>
            )}
          </Show>
        ) : null,
      ],
    };
    return props.render(attrs as never, { isEmpty });
  }
  return (
    <div
      {...dom}
      ref={ref}
      id={state.id}
      role="menu"
      slot={slot}
      class={rp.class()}
      style={rp.style()}
      aria-label={ariaLabel}
      aria-labelledby={read(ariaLabelledby as string | (() => string | undefined) | undefined)}
      aria-describedby={ariaDescribedby}
      aria-multiselectable={state.selectionMode === "multiple" ? "true" : undefined}
      data-collection={state.id}
      data-rk={menuKeys(state)}
      data-empty={dataBool(isEmpty())}
      tabIndex={virtualFocus() ? undefined : collectionTabIndex(state)}
      onKeyDown={(e: KeyboardEvent) => menuEvent(e, aria, state)}
      onKeyUp={(e: KeyboardEvent) => menuEvent(e, aria, state)}
      onPointerDown={(e: Event) => {
        menuEvent(e, aria, state);
        onPointerDown?.(e);
      }}
      onPointerUp={(e: Event) => {
        menuEvent(e, aria, state);
        onPointerUp?.(e);
      }}
      onPointerCancel={(e: Event) => {
        menuEvent(e, aria, state);
        onPointerCancel?.(e);
      }}
      onClick={(e: Event) => {
        menuEvent(e, aria, state);
        onClick?.(e);
      }}
      onMouseDown={(e: Event) => {
        menuEvent(e, aria, state);
        onMouseDown?.(e);
      }}
      onPointerOver={(e: Event) => {
        menuEvent(e, aria, state);
        onPointerOver?.(e);
      }}
      onPointerOut={(e: Event) => {
        menuEvent(e, aria, state);
        onPointerOut?.(e);
      }}
      onFocusIn={(e: Event) => {
        menuEvent(e, aria, state);
        onFocusIn?.(e);
      }}
      onFocusOut={(e: Event) => {
        menuEvent(e, aria, state);
        onFocusOut?.(e);
      }}
      onDragStart={(e: Event) => {
        menuEvent(e, aria, state);
        onDragStart?.(e);
      }}
      onScroll={(e: Event) => {
        virtualScroll?.(e);
        menuEvent(e, aria, state);
        onScroll?.(e);
      }}
      on:react-aria-focus={(e: Event) => menuVirtualFocus(e, state)}
      on:react-aria-clear-focus={(e: Event) => menuClearVirtualFocus(e, state)}
    >
      {body}
      {renderEmptyState ? (
        <Show when={isEmpty}>
          {() => (
            <div role="menuitem" style={{ display: "contents" }}>
              {renderEmptyState()}
            </div>
          )}
        </Show>
      ) : null}
    </div>
  );
}

// =================================================================================================
// MenuSection
// =================================================================================================

export interface MenuSectionProps<T = object>
  extends CollectionProps<T>, DOMRenderProps<"section", undefined>, Omit<GlobalDOMAttributes<HTMLElement>, "style"> {
  /** The unique id of the section. */
  id?: Key;
  /** The object value that this section represents. When using dynamic collections, this is set automatically. */
  value?: T;
  /** An accessibility label for the section. */
  "aria-label"?: string;
  /** The CSS class for the element. @default 'rv-MenuSection' */
  class?: string;
  style?: Record<string, string | number | undefined>;
  /** Whether the menu should close when the menu item is selected. */
  shouldCloseOnSelect?: boolean;
  /** The type of selection that is allowed in the section (its own selection, RAC GroupSelectionManager). */
  selectionMode?: SelectionMode;
  /** The currently selected keys in the section (a Signal: two-way; a plain value: initial). */
  selectedKeys?: Signal<Selection> | "all" | Iterable<Key>;
  defaultSelectedKeys?: "all" | Iterable<Key>;
  onSelectionChange?: (keys: Selection) => void;
  disallowEmptySelection?: boolean;
  ref?: RefValue<HTMLElement>;
}

const SECTION_OWNED = ["style"] as const;

function MenuSectionInner<T>(props: MenuSectionProps<T>, ref: unknown, section: { key: Key; props?: Record<string, unknown> }, className = "rv-MenuSection") {
  const state = useContext(MenuStateContext)!;
  const { CollectionBranch } = useContext(CollectionRendererContext);
  const closeOnSelect = (useContext(MenuItemContext) as MenuItemProps | null)?.shouldCloseOnSelect;
  const key = section.key;
  registerMenuSection(state, key, {
    shouldCloseOnSelect: props.shouldCloseOnSelect ?? closeOnSelect,
    selectionMode: props.selectionMode,
    selectedKeys: liveKeys(props, "selectedKeys"),
    defaultSelectedKeys: props.defaultSelectedKeys,
    onSelectionChange: props.onSelectionChange,
    disallowEmptySelection: props.disallowEmptySelection,
  } as Parameters<typeof registerMenuSection>[2]);
  // useMenuSection: the heading labels the group when it renders (RA useSlot).
  const heading = createSlotId(getItemId(state, key) + "-heading");
  const body = (
    <Provider
      values={[
        [HeaderContext, { id: heading, role: "presentation" }],
        [MenuSectionKeyContext, key],
        [MenuItemContext, { shouldCloseOnSelect: props.shouldCloseOnSelect ?? closeOnSelect }],
      ]}
    >
      {() => CollectionBranch({ collection: null, parent: section as never }) as Content}
    </Provider>
  );
  const dom = globalDOMProps(props, SECTION_OWNED);
  const sectionRef = mergeRefValues(createRef<HTMLElement>() as RefValue<HTMLElement>, ref as RefValue<HTMLElement> | undefined) as never;
  const ariaLabel = props["aria-label"],
    cls = props.class ?? className,
    style = props.style;
  if (props.render) {
    const attrs = {
      ...dom,
      ref: sectionRef,
      class: cls,
      style,
      role: "group",
      "data-section": "",
      "data-key": String(key),
      "data-key-type": typeof key === "number" ? "number" : undefined,
      "aria-label": ariaLabel,
      "aria-labelledby": () => slotIdRef(heading),
      children: () => body,
    };
    return props.render(attrs as never, undefined);
  }
  return (
    <section
      {...dom}
      ref={sectionRef}
      class={cls}
      style={style}
      role="group"
      data-section=""
      data-key={String(key)}
      data-key-type={typeof key === "number" ? "number" : undefined}
      aria-label={ariaLabel}
      aria-labelledby={slotIdRef(heading)}
    >
      {body}
    </section>
  );
}

/** A MenuSection represents a section within a Menu (RAC `MenuSection`). */
export const MenuSection = /*#__PURE__*/ createBranchComponent(SectionNode, MenuSectionInner as never) as <T = object>(props: MenuSectionProps<T>) => unknown;

// =================================================================================================
// MenuItem
// =================================================================================================

/** RAC `MenuItemRenderProps` (accessors). */
export interface MenuItemRenderProps {
  /** @selector [data-hovered] */
  isHovered: () => boolean;
  /** @selector [data-pressed] */
  isPressed: () => boolean;
  /** @selector [data-selected] */
  isSelected: () => boolean;
  /** @selector [data-focused] */
  isFocused: () => boolean;
  /** @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** @selector [data-disabled] */
  isDisabled: () => boolean;
  /** @selector [data-selection-mode="single | multiple"] */
  selectionMode: SelectionMode;
  selectionBehavior: "toggle" | "replace";
  /** Whether the item has a submenu. @selector [data-has-submenu] */
  hasSubmenu: boolean;
  /** Whether the item's submenu is open. @selector [data-open] */
  isOpen: () => boolean;
}

export interface MenuItemProps<T = object>
  extends DOMRenderProps<"div", MenuItemRenderProps>, Omit<GlobalDOMAttributes<HTMLElement>, "style" | "onClick" | "onFocus" | "onBlur"> {
  /** The unique id of the item. */
  id?: Key;
  /** The object value that this item represents. When using dynamic collections, this is set automatically. */
  value?: T;
  /** A string representation of the item's contents, used for features like typeahead. */
  textValue?: string;
  /** An accessibility label for this item. */
  "aria-label"?: string;
  /** Whether the item is disabled. */
  isDisabled?: boolean;
  /** Handler that is called when the item is selected. */
  onAction?: () => void;
  /** Whether the menu should close when the menu item is selected. */
  shouldCloseOnSelect?: boolean;
  /** A URL to link to (renders an `<a>`). */
  href?: string;
  hrefLang?: string;
  target?: string;
  rel?: string;
  download?: boolean | string;
  ping?: string;
  referrerPolicy?: string;
  /** Options for the configured client side router. */
  routerOptions?: Record<string, unknown>;
  onPressStart?: (e: PressEvent) => void;
  onPressEnd?: (e: PressEvent) => void;
  onPressChange?: (isPressed: boolean) => void;
  onPressUp?: (e: PressEvent) => void;
  onPress?: (e: PressEvent) => void;
  onHoverStart?: (e: HoverEvent) => void;
  onHoverEnd?: (e: HoverEvent) => void;
  onHoverChange?: (isHovering: boolean) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  /** The CSS class for the element. A function may be provided to compute the class based on component state. @default 'rv-MenuItem' */
  class?: ClassNameOrFunction<MenuItemRenderProps>;
  style?: StyleOrFunction<MenuItemRenderProps>;
  children?: Content | ((values: MenuItemRenderProps & { defaultChildren: Content | undefined }) => Content);
  ref?: RefValue<HTMLElement>;
}

// The menu's delegated handler runs the item behaviour; the item's own DOM handlers stay on the item element
// (they run first, while the event bubbles to the menu — RAC mergeProps(DOMProps, menuItemProps)).
const ITEM_OWNED = ["style"] as const;

/** A MenuItem represents an individual action in a Menu (RAC `MenuItem`). */
export const MenuItem = /*#__PURE__*/ createLeafComponent(ItemNode, function MenuItem<
  T,
>(inProps: MenuItemProps<T>, forwardedRef: unknown, item: { key: Key; textValue?: string; value?: unknown }) {
  const [props, ref] = contextProps(inProps, forwardedRef as RefValue<HTMLElement> | undefined, MenuItemContext) as [
    MenuItemProps<T>,
    RefValue<HTMLElement> | undefined,
  ];
  const state = useContext(MenuStateContext);
  if (!state) throw new Error("MenuItem must be rendered inside a Menu.");
  const sectionKey = useContext(MenuSectionKeyContext);
  const scope = useContext(SubmenuScopeContext);
  const key = item.key;
  // Live `isDisabled` (LIVE-SWEEP round 2): an accessor read in the bindings; the DOM collection (handlers,
  // keyboard navigation) reads the item's `aria-disabled`, so a live item is not registered in `disabledKeys`.
  const ownDisabled: boolean | (() => unknown) = isLive(props, "isDisabled")
    ? (liveAt(liveView(props, ["isDisabled"]), "isDisabled") as () => unknown)
    : !!props.isDisabled;
  const liveDisabled = typeof ownDisabled === "function" ? ownDisabled : undefined;
  const isDisabled = liveDisabled ? false : (ownDisabled as boolean);
  const collectionScope = useContext(MenuCollectionScopeContext);
  const virtualFocus = collectionScope?.virtualFocus;
  // Live collection size (RAC `collection.size`): visible items count themselves.
  const count = () => {
    state.itemCount.set(untrack(state.itemCount) + 1);
    onCleanup(() => state.disposing || state.itemCount.set(untrack(state.itemCount) - 1));
  };

  // A SubmenuTrigger's trigger item: bind the key, register the submenu (hover delay).
  const sub = scope?.sub;
  if (sub) {
    bindSubmenuItem(scope!, state, key);
    registerSubmenu(state, key, sub, scope!.delay);
  }
  const wantsStates = isFn(props.class) || isFn(props.style) || isFn(props.children);
  const states: MenuItemStateSignals | undefined = wantsStates ? { hovered: signal(false), pressed: signal(false), focusVisible: signal(false) } : undefined;
  registerMenuItem(state, key, {
    isDisabled,
    onAction: sub ? undefined : props.onAction,
    shouldCloseOnSelect: props.shouldCloseOnSelect,
    routerOptions: props.routerOptions,
    onPressStart: props.onPressStart,
    onPressEnd: props.onPressEnd,
    onPressUp: props.onPressUp,
    onPress: props.onPress,
    onPressChange: props.onPressChange,
    onHoverStart: props.onHoverStart,
    onHoverEnd: props.onHoverEnd,
    onHoverChange: props.onHoverChange,
    onFocus: props.onFocus,
    onBlur: props.onBlur,
    onFocusChange: props.onFocusChange,
    ...(states ? { states } : {}),
  });
  const selection = selectionOf(state, sectionKey ?? undefined);
  const selectionMode = selection.selectionMode;
  const id = getItemId(state, key);
  const disabled: boolean | (() => boolean) = liveDisabled ? liveItemDisabled(state, key, liveDisabled) : itemDisabled(state, key, isDisabled);
  const hasSubmenu = !!sub;
  const isOpen = sub ? () => sub.isOpen() : () => false;
  const isSelected = () => selectionMode !== "none" && !hasSubmenu && !!itemSelected(selection as never, key, isDisabled || !!liveDisabled?.());
  const isFocused = () => itemFocused(state, key);
  const values: MenuItemRenderProps = {
    isHovered: () => !!states?.hovered(),
    isPressed: () => !!states?.pressed(),
    isSelected,
    isFocused,
    isFocusVisible: () => !!states?.focusVisible(),
    isDisabled: () => read(disabled),
    selectionMode,
    selectionBehavior: "toggle",
    hasSubmenu,
    isOpen,
  };
  // useMenuItem slot ids: label / description / keyboard shortcut (RA useSlotId).
  const label = createSlotId(id + "-label"),
    description = createSlotId(id + "-description"),
    kbd = createSlotId(id + "-kbd");
  const rp = untrack(() =>
    renderProps<MenuItemRenderProps>(
      {
        class: props.class,
        style: props.style,
        children: props.children as never,
        defaultClassName: "rv-MenuItem",
        values,
      },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  // Children first (they mark the slot ids rendered), then the element.
  const body = () => (
    <Provider
      values={[
        [TextContext, { slots: { [DEFAULT_SLOT]: { id: label }, label: { id: label }, description: { id: description } } }],
        [KeyboardContext, { id: kbd }],
        [SubmenuScopeContext, null],
      ]}
    >
      {() => rp.children()}
    </Provider>
  );
  // Rivet (server): the children render in a binding after the item's attributes: probe which slotted parts render
  // (label / description Text, Keyboard; same providers as `body`), so `aria-labelledby` / `aria-describedby` name only
  // those (no dangling IDREF).
  if (typeof document === "undefined")
    probeSlots(
      [
        [TextContext, { slots: { [DEFAULT_SLOT]: { id: label }, label: { id: label }, description: { id: description } } }],
        [KeyboardContext, { id: kbd }],
        [SubmenuScopeContext, null],
      ],
      () => rp.children(),
    );
  const role = hasSubmenu ? "menuitem" : selectionMode === "single" ? "menuitemradio" : selectionMode === "multiple" ? "menuitemcheckbox" : "menuitem";
  const dom = globalDOMProps(props, ITEM_OWNED);
  const ariaLabel = props["aria-label"],
    href = props.href,
    // Link attributes as locals: the item render closure must not capture `props` (PROPS-CAPTURE).
    hrefLang = props.hrefLang,
    target = props.target,
    rel = props.rel,
    download = props.download === true ? "" : props.download || undefined,
    linkExtra = { ping: props.ping, referrerpolicy: props.referrerPolicy },
    controls = sub ? submenuId(state, key) : undefined;
  const describedBy = () => [slotIdRef(description, false), slotIdRef(kbd, false)].filter(Boolean).join(" ") || undefined;
  const tabIndex = () => {
    const t = itemTabIndex(state, key, isDisabled || !!liveDisabled?.());
    // If a submenu is expanded, set the tabIndex to -1 so that shift tabbing goes out of the menu.
    if (virtualFocus?.()) return undefined;
    return t != null && isOpen() && !state.options.shouldUseVirtualFocus ? -1 : t;
  };
  // The item element: the submenu popover's trigger ref (+ the user's / context ref).
  const element = scope ? scope.itemRef : createRef<HTMLElement>();
  const r = mergeRefValues(element as RefValue<HTMLElement>, ref) as never;
  const attrs = {
    id,
    role,
    "data-key": String(key),
    "data-key-type": typeof key === "number" ? "number" : undefined,
    "data-text": props.textValue,
    "aria-label": ariaLabel,
    "aria-disabled": typeof disabled === "function" ? ariaDisabledOf(disabled) : disabled ? "true" : undefined,
    "data-disabled": typeof disabled === "function" ? dataDisabledOf(disabled) : dataBool(disabled),
    "aria-haspopup": hasSubmenu ? "menu" : undefined,
    "data-has-submenu": dataBool(hasSubmenu),
  };
  if (state.virtual)
    // useMenuItem (virtualized): the item's position comes from the built collection (only a window is rendered).
    // (Object-literal arrows: resumable closures.)
    Object.assign(attrs, {
      "aria-posinset": () => menuItemPosition(state, key, 0),
      "aria-setsize": () => menuItemPosition(state, key, 1),
    });
  const renderItem = () => {
    count();
    const content = body();
    if (props.render) {
      const common = {
        ...dom,
        ...attrs,
        ref: r,
        class: () => rp.class(),
        style: () => rp.style(),
        "aria-labelledby": () => slotIdRef(label, false),
        "aria-describedby": () => describedBy(),
        "aria-checked": selectionMode !== "none" && !hasSubmenu ? () => String(isSelected()) : undefined,
        "aria-expanded": hasSubmenu ? () => String(isOpen()) : undefined,
        "aria-controls": () => (hasSubmenu && isOpen() ? controls : undefined),
        "data-focused": () => dataBool(isFocused()),
        "data-selected": () => dataBool(isSelected()),
        "data-selection-mode": selectionMode === "none" ? undefined : selectionMode,
        "data-open": () => dataBool(isOpen()),
        children: () => content,
      };
      return props.render(
        (href
          ? {
              ...common,
              href,
              hreflang: hrefLang,
              target,
              rel,
              download,
              ...(linkExtra as object),
              tabindex: () => (virtualFocus?.() ? undefined : (tabIndex() ?? -1)),
            }
          : { ...common, tabindex: () => tabIndex() }) as never,
        values,
      );
    }
    if (href)
      return (
        <a
          {...dom}
          {...attrs}
          ref={r}
          href={href}
          hreflang={hrefLang}
          target={target}
          rel={rel}
          download={download}
          {...(linkExtra as object)}
          class={rp.class()}
          style={rp.style()}
          aria-labelledby={slotIdRef(label, false)}
          aria-describedby={describedBy()}
          aria-checked={selectionMode !== "none" && !hasSubmenu ? String(isSelected()) : undefined}
          aria-expanded={hasSubmenu ? String(isOpen()) : undefined}
          aria-controls={hasSubmenu && isOpen() ? controls : undefined}
          tabIndex={virtualFocus?.() ? undefined : (tabIndex() ?? -1)}
          data-focused={dataBool(isFocused())}
          data-selected={dataBool(isSelected())}
          data-selection-mode={selectionMode === "none" ? undefined : selectionMode}
          data-open={dataBool(isOpen())}
        >
          {content}
        </a>
      );
    return (
      <div
        {...dom}
        {...attrs}
        ref={r}
        class={rp.class()}
        style={rp.style()}
        aria-labelledby={slotIdRef(label, false)}
        aria-describedby={describedBy()}
        aria-checked={selectionMode !== "none" && !hasSubmenu ? String(isSelected()) : undefined}
        aria-expanded={hasSubmenu ? String(isOpen()) : undefined}
        aria-controls={hasSubmenu && isOpen() ? controls : undefined}
        tabIndex={tabIndex()}
        data-focused={dataBool(isFocused())}
        data-selected={dataBool(isSelected())}
        data-selection-mode={selectionMode === "none" ? undefined : selectionMode}
        data-open={dataBool(isOpen())}
      >
        {content}
      </div>
    );
  };
  // Live-mode filtering (SelectableCollectionContext `filter`): the item hides itself.
  const filter = collectionScope?.filter;
  if (filter) {
    const itemText = item.textValue ?? props.textValue ?? "",
      itemValue = item.value;
    const visible = () => filter(itemText, { key, type: "item", textValue: itemText, value: itemValue } as unknown as Node<unknown>);
    return <Show when={visible}>{renderItem}</Show>;
  }
  return renderItem();
}) as <T = object>(props: MenuItemProps<T>) => unknown;

// =================================================================================================
// MenuLoadMoreItem
// =================================================================================================

export interface MenuLoadMoreItemProps extends Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Handler that is called when more items should be loaded, e.g. while scrolling near the bottom. */
  onLoadMore?: () => void;
  /** The amount of offset from the bottom of your scrollable region that should trigger load more (multiplier of its height). @default 1 */
  scrollOffset?: number;
  /** Whether or not the loading spinner should be rendered. */
  isLoading?: boolean | (() => boolean);
  /** The load more spinner to render when loading additional items. */
  children?: Content;
  /** @default 'rv-MenuLoadingIndicator' */
  class?: string;
  style?: Record<string, string | number | undefined>;
}

/** A sentinel that loads more items when scrolled into view, plus a loading row (RAC `MenuLoadMoreItem`). */
export const MenuLoadMoreItem = /*#__PURE__*/ createLeafComponent(LoaderNode, function MenuLoadingIndicator(props: MenuLoadMoreItemProps, ref: unknown) {
  const state = useContext(MenuStateContext);
  const sentinel = createRef<HTMLDivElement>();
  const { isLoading, onLoadMore, scrollOffset, children } = props;
  loadMoreSentinel({ collection: () => state?.itemCount(), onLoadMore, scrollOffset } as never, sentinel);
  const dom = globalDOMProps(props, ["style"] as const);
  const cls = props.class ?? "rv-MenuLoadingIndicator",
    style = props.style;
  return (
    <>
      <div style={{ position: "relative", width: "0", height: "0" }} inert>
        <div data-testid="loadMoreSentinel" ref={sentinel} style={{ position: "absolute", height: "1px", width: "1px" }} />
      </div>
      {read(isLoading) && children ? (
        <div {...dom} class={cls} style={style} role="menuitem" tabIndex={-1} ref={ref as never}>
          {children}
        </div>
      ) : null}
    </>
  );
}) as (props: MenuLoadMoreItemProps) => unknown;
