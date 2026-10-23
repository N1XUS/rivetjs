// Tabs, TabList, Tab, TabPanels, TabPanel + TabsContext / TabListStateContext (react-aria-components Tabs).
// Ported from react-spectrum (Apache-2.0, © Adobe): packages/react-aria-components/src/Tabs.tsx.
//
// Rivet:
// - Live collection mode (`../collections/components.tsx`): tabs render in place inside the TabList (`data-key`);
//   the tablist's delegated handlers (`./behaviour.ts`) read the collection back from its DOM per event, so
//   resumed pages need no item model and run no library code until the first interaction.
// - Default selection (useTabListState's "a tab is always selected"): when no tab is selected at creation,
//   `Tabs` runs one build pass over its children (`buildCollectionFrom`: the Tab parts register, TabPanels /
//   TabPanel render nothing) and selects the first enabled tab, without calling `onSelectionChange`. A given
//   `defaultSelectedKey` / `selectedKey` is kept as is (no build pass, no check that it names a tab).
// - Render props are accessors (`class={({ isSelected }) => (isSelected() ? "on" : "")}`); hover / focus /
//   focus-visible states are written on the element by the handlers (`../utils/data-attrs.tsx`); pressed
//   follows each tab's usePress (`../interactions/press.tsx`).
// - `className` → `class` (default `rv-Tabs`, `rv-TabList`, `rv-Tab`, `rv-TabPanels`, `rv-TabPanel`).
// - Ids derive from the Tabs `id` (else a generated one): tablist `<id>-tablist`, tab `<id>-tab-<key>`, panel
//   `<id>-tabpanel-<key>` (RA: from the tablist's generated id).
// - TabsContext is not re-provided inside Tabs (its value holds the JSX children: not serializable); TabList reads
//   `orientation` / `keyboardActivation` from the state.
// - TabPanel content of unselected tabs is created when the tab is selected: on a resumed page it must be a
//   render-function child (`<TabPanel id="a">{() => …}</TabPanel>`), or use `shouldForceMount`.
// - Enter / exit animations and the TabPanels size variables (`--tab-panel-width` / `--tab-panel-height`) run for
//   parts created in the browser; panels the server rendered (resumed pages) switch without them.
// - `items` preset: `<Tabs items={…} tab={…} panel={…} aria-label="…" />` without children renders a TabList of
//   Tabs and (with `panel`) TabPanels of force-mounted panels (inactive ones `hidden` + `inert`: every panel is
//   server-rendered, so find-in-page / SEO see them and switching needs no render).
// `render` (RAC DOMRenderProps) on every part: given, the attributes object goes to `render(attrs, renderProps)`
// instead of the default element (Tab: `<a>` with `href`, else `<div>`).
import { createContext, provide, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { CollectionNode } from "../collections/base.ts";
import {
  Collection,
  CollectionRendererContext,
  DefaultCollectionRenderer,
  buildCollectionFrom,
  collectionItemId,
  createLeafComponent,
  isHidden,
  type CollectionProps,
} from "../collections/components.tsx";
import type { Node } from "../collections/types.ts";
import {
  createTabListState,
  isTabsDisabled,
  tabsOrientation,
  type KeyboardActivation,
  type TabKey,
  type TabListState,
  type TabListStateOptions,
} from "../state/tabs.ts";
import { hasLive, liveAssign, liveAt, liveOptions, liveView } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import type { Key, Orientation } from "../_adapters/collection.ts";
import { routerHref, useRouter, type LinkDOMProps } from "../link/router.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import {
  dataBool,
  focusStateBlur,
  focusStateFocus,
  hoverStateEnter,
  hoverStateLeave,
  mergeFocusableContext,
  readAttrs,
  setDataAttr,
  type InteractionStateOptions,
} from "../utils/data-attrs.tsx";
import { FocusableContext } from "../focus/focusable.tsx";
import { createEnterAnimation, createExitAnimation } from "../utils/animation.tsx";
import { focusRingBlur, focusRingFocus } from "../focus/focus-ring.tsx";
import { pressProps, type PressEvents } from "../interactions/press.tsx";
import { mergeProps, mergeRefs } from "../interactions/merge-props.tsx";
import type { HoverEvents } from "../interactions/hover.tsx";
import type { FocusEvents } from "../utils/types.ts";
import { isFn, ringOf } from "../grid-list/row.ts";
import { SharedElementTransition } from "../shared-element-transition/transition.tsx";
import { SelectionIndicatorContext } from "../selection-indicator/context.ts";
import {
  Provider,
  contextProps,
  mergeRefValues,
  renderProps as resolveRenderProps,
  renderPropsOf,
  type ClassNameOrFunction,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleObject,
  type StyleRenderProps,
} from "../slots/index.tsx";
import {
  isTabDisabled,
  isTabSelected,
  syncPanelTabIndex,
  tabClick,
  tabId,
  tabListFocusIn,
  tabListFocusOut,
  tabListKeyDown,
  tabListPointerDown,
  tabPanelId,
  tabPress,
  tabPressStart,
  tabPressUp,
  tabSelected,
  tabsKeys,
  tabTabIndex,
} from "./behaviour.ts";

export type { KeyboardActivation, TabListState } from "../state/tabs.ts";
export type { Key, Orientation } from "../_adapters/collection.ts";

const isBrowser = typeof document !== "undefined";

// --- Tabs ----------------------------------------------------------------------------------------

export interface TabsRenderProps {
  /**
   * The orientation of the tabs.
   *
   * @selector [data-orientation="horizontal | vertical"]
   */
  orientation: () => Orientation;
}

/** A tab of the `items` preset (RAC `Tab` props as data). */
export interface TabItem extends LinkDOMProps {
  /** The unique id of the tab (also its panel's). */
  readonly id: Key;
  /** Tab text (default content, typeahead / accessible text). */
  readonly label?: string;
  readonly textValue?: string;
  readonly isDisabled?: boolean;
  readonly "aria-label"?: string;
}

export interface TabsProps
  extends RenderProps<TabsRenderProps>, DOMRenderProps<"div", TabsRenderProps>, SlotProps, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The currently selected key: a two-way signal, or a plain value (controlled). */
  selectedKey?: Key | null | Signal<Key | null> | Signal<Key>;
  /** The initial selected key (uncontrolled). */
  defaultSelectedKey?: Key;
  /** Handler that is called when the selection changes. */
  onSelectionChange?: (key: Key) => void;
  /** The item keys that are disabled. These items cannot be selected, focused, or otherwise interacted with. */
  disabledKeys?: Iterable<Key>;
  /** Whether the TabList is disabled. Shows that a selection exists, but is not available in that circumstance. */
  isDisabled?: boolean;
  /**
   * The orientation of the tabs.
   *
   * @default "horizontal"
   */
  orientation?: Orientation;
  /**
   * Whether tabs are activated automatically on focus or manually.
   *
   * @default "automatic"
   */
  keyboardActivation?: KeyboardActivation;
  /** The element's unique identifier (also the base of the tab / panel ids). */
  id?: string;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-Tabs'
   */
  class?: ClassNameOrFunction<TabsRenderProps>;
  ref?: RefValue<HTMLDivElement>;
  /** `items` preset: the tabs (renders a TabList and, with `panel`, TabPanels; ignored when `children` are given). */
  items?: readonly TabItem[];
  /** `items` preset: tab content (default `label ?? textValue`). */
  tab?: (item: TabItem) => unknown;
  /** `items` preset: panel content (omit for URL-driven link tabs whose route renders the content). */
  panel?: (item: TabItem) => unknown;
  /** `items` preset: the TabList's accessible name. */
  "aria-label"?: string;
  /** `items` preset: the TabList's labelling element ids. */
  "aria-labelledby"?: string;
}

/** RAC `TabsContext`: props for a Tabs inside a component, optionally per slot. */
export const TabsContext = createContext<ContextValue<Partial<TabsProps>, HTMLDivElement>>(null);
/** RAC `TabListStateContext`: the state of the enclosing Tabs (null outside one, and inside its panels). */
export const TabListStateContext = createContext<TabListState | null>(null);

/** Rivet (build pass): the node class of a Tab, told apart from other parts registering in the same pass. */
class TabItemNode extends CollectionNode<unknown> {
  static override readonly type = "item";
}

const TABS_OWNED = ["style", "onFocusIn", "onFocusOut"] as const;

/** Tabs organize content into multiple sections and allow users to navigate between them (RAC `Tabs`). */
export function Tabs(inProps: TabsProps) {
  // Live props (P5): `isDisabled` / `selectedKey` (controlled) become accessors at the boundary, class / style /
  // children stay live (live view); the rest of the body is read once (untracked).
  return untrack(() => tabsRoot(inProps));
}

/** `data-orientation` / `aria-orientation` for a render bag: the value, a returned arrow when `orientation` is live. */
function orientationAttr(state: TabListState): Orientation | (() => Orientation) {
  return state.live?.orientation ? liveOrientation(state) : state.orientation;
}
function liveOrientation(state: TabListState): () => Orientation {
  return () => tabsOrientation(state);
}
/** `data-rk` for a render bag (the navigation keys follow a live `orientation`). */
function tabsKeysAttr(state: TabListState): string | (() => string) {
  return state.live?.orientation ? liveTabsKeys(state) : tabsKeys(state);
}
function liveTabsKeys(state: TabListState): () => string {
  return () => tabsKeys(state);
}

/** `data-disabled` of a live tablist `isDisabled` (a returned arrow: resumable). */
function tabsDisabledAttr(state: TabListState): () => "true" | undefined {
  return () => dataBool(isTabsDisabled(state));
}

function tabsRoot(inProps: TabsProps) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, TabsContext) as [TabsProps, RefValue<HTMLDivElement> | undefined];
  const live = hasLive(ctxProps);
  // Live by default (LIVE-SWEEP): `orientation` / `keyboardActivation` / `disabledKeys` live in the state.
  const props = live ? liveOptions(ctxProps, ["isDisabled", "orientation", "keyboardActivation", "disabledKeys"] as never, ["selectedKey"]) : ctxProps;
  // Not the state (created below: the tabs builder may call a children function first).
  const orientationProp = props.orientation as MaybeAccessor<Orientation | undefined>;
  const values: TabsRenderProps = { orientation: () => read(orientationProp) ?? "horizontal" };
  const { items, tab, panel, selectedKey, defaultSelectedKey } = props;
  const preset = props.children === undefined && items != null;
  const ariaLabel = props["aria-label"],
    ariaLabelledby = props["aria-labelledby"];
  // RAC: `children` may be a function of `{ orientation }`.
  const ownChildren = props.children;
  const initial = typeof selectedKey === "function" ? untrack(selectedKey as Signal<Key | null>) : selectedKey !== undefined ? selectedKey : defaultSelectedKey;
  const needsDefault = initial == null && (typeof (selectedKey as { set?: unknown } | null | undefined)?.set === "function" || selectedKey === undefined);
  const tabs: (() => readonly TabKey[]) | undefined = !needsDefault
    ? undefined
    : preset
      ? () => items!.map((item) => ({ id: item.id, isDisabled: item.isDisabled }))
      : () => {
          const keys: TabKey[] = [];
          const content =
            typeof ownChildren === "function" && !isSlot(ownChildren)
              ? () => (ownChildren as (v: unknown) => unknown)({ ...values, defaultChildren: null })
              : ownChildren;
          // Outside any enclosing Tabs' state: the TabList registers its tabs (RAC CollectionBuilder).
          const built = buildCollectionFrom(() => provide(TabListStateContext, null, () => renderSlot(content as never)));
          for (const node of built) if (node instanceof TabItemNode) keys.push({ id: node.key, isDisabled: !!node.props?.isDisabled });
          return keys;
        };
  const state = createTabListState({
    id: props.id,
    selectedKey,
    defaultSelectedKey,
    onSelectionChange: props.onSelectionChange,
    disabledKeys: props.disabledKeys as TabListStateOptions["disabledKeys"],
    isDisabled: props.isDisabled as TabListStateOptions["isDisabled"],
    orientation: props.orientation as TabListStateOptions["orientation"],
    keyboardActivation: props.keyboardActivation as TabListStateOptions["keyboardActivation"],
    tabs,
  });
  // The `items` preset: TabList of Tabs + TabPanels of force-mounted panels (inline arrows: resumable renderers).
  const presetContent = () => (
    <>
      <TabList aria-label={ariaLabel} aria-labelledby={ariaLabelledby} items={items}>
        {(item: TabItem) => (
          <Tab
            id={item.id}
            textValue={item.textValue ?? item.label}
            isDisabled={item.isDisabled}
            aria-label={item["aria-label"]}
            href={item.href}
            hrefLang={item.hrefLang}
            target={item.target}
            rel={item.rel}
            download={item.download}
            ping={item.ping}
            referrerPolicy={item.referrerPolicy}
            routerOptions={item.routerOptions}
          >
            {(tab ? tab(item) : (item.label ?? item.textValue)) as never}
          </Tab>
        )}
      </TabList>
      {panel ? (
        <TabPanels items={items}>
          {(item: TabItem) => (
            <TabPanel id={item.id} shouldForceMount hidden={(() => !isTabSelected(state, item.id) || undefined) as never}>
              {(() => panel(item)) as never}
            </TabPanel>
          )}
        </TabPanels>
      ) : null}
    </>
  );
  const rp = resolveRenderProps(
    {
      class: props.class,
      style: props.style,
      children: preset ? presetContent : props.children,
      values,
      defaultClassName: "rv-Tabs",
    },
    live ? ((preset ? [...liveRenderProps(props).slice(0, 2), { children: presetContent }] : liveRenderProps(props)) as never) : undefined,
  );
  // RAC useFocusRing({ within: true }) on the root: `data-focused` / `data-focus-visible` written by the handlers.
  const { onFocusIn, onFocusOut } = props as { onFocusIn?: (e: FocusEvent) => void; onFocusOut?: (e: FocusEvent) => void };
  // `data-disabled` through the spread: an accessor for a live `isDisabled`.
  const dom = liveAssign(globalDOMProps(props, TABS_OWNED), { "data-disabled": state.disabled ? tabsDisabledAttr(state) : dataBool(state.isDisabled) });
  const slot = props.slot || undefined;
  const focusIn = (e: FocusEvent) => {
    const el = e.currentTarget as HTMLElement;
    setDataAttr(el, "data-focused", true);
    focusRingFocus(ringOf(el, true, "data-focus-visible"), e);
    onFocusIn?.(e);
  };
  const focusOut = (e: FocusEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (!el.contains(e.relatedTarget as globalThis.Node | null)) setDataAttr(el, "data-focused", false);
    focusRingBlur(ringOf(el, true, "data-focus-visible"), e);
    onFocusOut?.(e);
  };
  if (props.render)
    return props.render(
      {
        ...dom,
        ref: ref as never,
        id: props.id,
        slot,
        class: () => rp.class(),
        style: () => rp.style(),
        "data-orientation": orientationAttr(state),
        onFocusIn: focusIn,
        onFocusOut: focusOut,
        children: () => <Provider values={[[TabListStateContext, state]]}>{rp.children()}</Provider>,
      } as never,
      values,
    );
  return (
    <div
      {...dom}
      ref={ref as never}
      id={props.id}
      slot={slot}
      class={rp.class()}
      style={rp.style()}
      data-orientation={tabsOrientation(state)}
      onFocusIn={focusIn}
      onFocusOut={focusOut}
    >
      <Provider values={[[TabListStateContext, state]]}>{rp.children()}</Provider>
    </div>
  );
}

// --- TabList -------------------------------------------------------------------------------------

export interface TabListRenderProps {
  /**
   * The orientation of the tab list.
   *
   * @selector [data-orientation="horizontal | vertical"]
   */
  orientation: () => Orientation;
  /** State of the tab list. */
  state: TabListState;
}

export interface TabListProps<T = object>
  extends
    StyleRenderProps<TabListRenderProps>,
    Omit<CollectionProps<T>, "disabledKeys" | "children">,
    DOMRenderProps<"div", TabListRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Static `Tab` children, or a renderer for `items` returning one `Tab` per item. */
  children?: Content | ((item: T) => unknown);
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-TabList'
   */
  class?: ClassNameOrFunction<TabListRenderProps>;
  ref?: RefValue<HTMLDivElement>;
}

const LIST_OWNED = ["style", "onPointerDown"] as const;

/**
 * A TabList is used within Tabs to group tabs that a user can switch between. The ids of the items within the
 * <TabList> must match up with a corresponding item inside the <TabPanels> (RAC `TabList`).
 */
export function TabList<T extends object>(props: TabListProps<T>) {
  // Live props (P5): class / style stay live; the rest of the body is read once (untracked).
  return untrack(() => tabList(props));
}

function tabList<T extends object>(props: TabListProps<T>) {
  const state = useContext(TabListStateContext);
  const { items, children, idScope } = props;
  // RAC: outside Tabs (its build pass) a TabList is a plain Collection.
  if (!state)
    return (
      <Collection items={items} idScope={idScope}>
        {children as never}
      </Collection>
    );
  const router = useRouter();
  const renderer = useContext(CollectionRendererContext);
  // Resumable: the lazy collection slot captures `customRenderer` (undefined for the default renderer).
  const customRenderer = renderer === DefaultCollectionRenderer ? undefined : renderer;
  const orientation = orientationAttr(state);
  const values: TabListRenderProps = { orientation: () => tabsOrientation(state), state };
  // Not `renderPropsOf`: the children (collection content) must stay out of the resumable `rp`.
  const rp = resolveRenderProps(
    { class: props.class, style: props.style, values, defaultClassName: "rv-TabList" },
    hasLive(props) ? (liveRenderProps(props, ["class", "style"]) as never) : undefined,
  );
  const id = state.id + "-tablist";
  // react-aria useLabels: with both a label and labelledby, the element labels itself too.
  const ariaLabel = props["aria-label"],
    ownLabelledBy = props["aria-labelledby"];
  const labelledBy = ariaLabel && ownLabelledBy ? [...new Set([id, ...ownLabelledBy.split(/\s+/)])].join(" ") : ownLabelledBy;
  const describedBy = props["aria-describedby"],
    details = props["aria-details"];
  const userPointerDown = (props as { onPointerDown?: (e: PointerEvent) => void }).onPointerDown;
  const dom = globalDOMProps(props, LIST_OWNED);
  const content = () => (
    <Collection items={items} idScope={idScope}>
      {children as never}
    </Collection>
  );
  const handlers = {
    onKeyDown: (event: KeyboardEvent) => tabListKeyDown(state, event as never, router),
    onPointerDown: (event: PointerEvent) => {
      tabListPointerDown(event as never);
      userPointerDown?.(event);
    },
    onFocusIn: (event: FocusEvent) => tabListFocusIn(state, event as never, router),
    onFocusOut: (event: FocusEvent) => tabListFocusOut(state, event as never),
  };
  if (props.render)
    return props.render(
      {
        ...dom,
        ref: props.ref as never,
        id,
        role: "tablist",
        class: () => rp.class(),
        style: () => rp.style(),
        "aria-label": ariaLabel,
        "aria-labelledby": labelledBy,
        "aria-describedby": describedBy,
        "aria-details": details,
        "aria-orientation": orientation,
        "data-orientation": orientation,
        "data-collection": state.id,
        "data-rk": tabsKeysAttr(state),
        ...handlers,
        children: () => (
          <SharedElementTransition>
            {(customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection: null, content, idScope }) as never}
          </SharedElementTransition>
        ),
      } as never,
      values,
    );
  return (
    <div
      {...dom}
      ref={props.ref as never}
      id={id}
      role="tablist"
      class={rp.class()}
      style={rp.style()}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-details={details}
      aria-orientation={tabsOrientation(state)}
      data-orientation={tabsOrientation(state)}
      data-collection={state.id}
      data-rk={tabsKeys(state)}
      onKeyDown={handlers.onKeyDown}
      onPointerDown={handlers.onPointerDown}
      onFocusIn={handlers.onFocusIn}
      onFocusOut={handlers.onFocusOut}
    >
      {/* RAC TabList: the tabs share one SharedElementTransition scope (an animated SelectionIndicator moves between them). */}
      <SharedElementTransition>
        {(customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection: null, content, idScope }) as never}
      </SharedElementTransition>
    </div>
  );
}

// --- Tab -----------------------------------------------------------------------------------------

export interface TabRenderProps {
  /**
   * Whether the tab is currently hovered with a mouse.
   *
   * @selector [data-hovered]
   */
  isHovered: () => boolean;
  /**
   * Whether the tab is currently in a pressed state.
   *
   * @selector [data-pressed]
   */
  isPressed: () => boolean;
  /**
   * Whether the tab is currently selected.
   *
   * @selector [data-selected]
   */
  isSelected: () => boolean;
  /**
   * Whether the tab is currently focused.
   *
   * @selector [data-focused]
   */
  isFocused: () => boolean;
  /**
   * Whether the tab is currently keyboard focused.
   *
   * @selector [data-focus-visible]
   */
  isFocusVisible: () => boolean;
  /**
   * Whether the tab is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
}

export interface TabProps
  extends
    RenderProps<TabRenderProps>,
    DOMRenderProps<"div", TabRenderProps>,
    LinkDOMProps,
    HoverEvents,
    FocusEvents<HTMLElement>,
    PressEvents,
    Omit<GlobalDOMAttributes<HTMLElement>, "onClick" | "style"> {
  /** The unique id of the tab. */
  id?: Key;
  /** Whether the tab is disabled. */
  isDisabled?: boolean;
  /** A string representation of the tab's contents (typeahead / accessible text) for non-text children. */
  textValue?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-Tab'
   */
  class?: ClassNameOrFunction<TabRenderProps>;
  ref?: RefValue<HTMLElement>;
}

const TAB_OWNED = ["onPointerDown", "onPointerUp", "onPointerEnter", "onPointerLeave", "onMouseDown", "onDragStart", "onClick", "style"] as const;

/** A Tab provides a title for an individual item within a TabList (RAC `Tab`). */
export const Tab = /*#__PURE__*/ createLeafComponent(TabItemNode, function Tab(inProps: TabProps, inRef: unknown, item: Node<unknown>) {
  // Live props (P5): `isDisabled` / class / style / children stay live; the rest of the body is read once (untracked).
  return untrack(() => tabItem(inProps, inRef, item));
});

/** A live tab's disabled state (a returned arrow: resumable). */
function tabDisabled(state: TabListState, key: Key, itemDisabled: boolean | (() => boolean | undefined)): () => boolean {
  return () => isTabDisabled(state, key, itemDisabled);
}

/** `aria-disabled` / `data-disabled` of a live tab (returned arrows: resumable). */
function tabDisabledAttrs(isDisabled: () => boolean): { "aria-disabled": () => "true" | undefined; "data-disabled": () => "true" | undefined } {
  return { "aria-disabled": () => (isDisabled() ? "true" : undefined), "data-disabled": () => dataBool(isDisabled()) };
}

function tabItem(inProps: TabProps, inRef: unknown, item: Node<unknown>) {
  const state = useContext(TabListStateContext);
  if (!state) throw new Error("Tab must be rendered inside a TabList within Tabs.");
  const key = item.key;
  const router = useRouter();
  const live = hasLive(inProps);
  const itemIsDisabled = live ? liveAt(liveView(inProps, ["isDisabled"]), "isDisabled") : !!inProps.isDisabled;
  // RA useTab → useSelectableItem → useFocusable: FocusableContext (TooltipTrigger) props / handlers / ref reach the tab
  // (read once: the disabled state at creation).
  const [props, focusableRef, focusAttrs] = mergeFocusableContext(inProps, useContext(FocusableContext), isTabDisabled(state, key, itemIsDisabled));
  const forwardedRef = mergeRefValues(inRef as RefValue<HTMLElement> | undefined, focusableRef as RefValue<HTMLElement> | undefined);
  // Resumable closures read locals only (a `props.x` read captures the whole props object).
  const { onHoverStart, onHoverEnd, onHoverChange, onFocus, onBlur, onFocusChange, onPressStart, onPressEnd, onPressChange, onPress, onPressUp, onClick } =
    props;
  const href = props.href;
  const isDisabled: boolean | (() => boolean) =
    typeof itemIsDisabled === "function" || state.disabled || state.live?.disabledKeys
      ? tabDisabled(state, key, itemIsDisabled as never)
      : isTabDisabled(state, key, itemIsDisabled);
  const isSelected = () => isTabSelected(state, key);
  const wantsStates = isFn(props.class) || isFn(props.style) || isFn(props.children);
  const hovered = wantsStates ? signal(false) : undefined;
  const focused = wantsStates ? signal(false) : undefined;
  const focusVisible = wantsStates ? signal(false) : undefined;
  // useTab → useSelectableItem's usePress (selection) + the tab's own press events.
  const { pressProps: press, isPressed } = pressProps({
    isDisabled,
    onPressStart: (e) => {
      tabPressStart(state, e, router);
      onPressStart?.(e);
    },
    onPressUp: (e) => {
      tabPressUp(state, e, router);
      onPressUp?.(e);
    },
    onPress: (e) => {
      tabPress(state, e, router);
      onPress?.(e);
    },
    onPressEnd,
    onPressChange,
    onClick,
  });
  const interaction: InteractionStateOptions = {
    isDisabled,
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    onFocus: onFocus as never,
    onBlur: onBlur as never,
    onFocusChange,
    states: wantsStates ? { isHovered: hovered, isFocused: focused, isFocusVisible: focusVisible } : undefined,
  };
  const { onPointerDown, onPointerUp, onPointerEnter, onPointerLeave, onMouseDown, onDragStart, onKeyDown, onKeyUp } = props as Record<string, any>;
  const own = mergeProps(press, {
    onClick: (e: MouseEvent) => tabClick(state, e as never, router),
    onPointerEnter: (e: PointerEvent) => hoverStateEnter(interaction, e),
    onPointerLeave: (e: PointerEvent) => hoverStateLeave(interaction, e),
    onFocus: (e: FocusEvent) => focusStateFocus(interaction, e),
    onBlur: (e: FocusEvent) => focusStateBlur(interaction, e),
  }) as Record<string, (e: never) => void>;
  const handlers = mergeProps(own, { onPointerDown, onPointerUp, onPointerEnter, onPointerLeave, onMouseDown, onDragStart, onKeyDown, onKeyUp }) as Record<
    string,
    (e: never) => void
  >;
  const values: TabRenderProps = {
    isHovered: () => !!hovered?.(),
    isPressed,
    isSelected,
    isFocused: () => !!focused?.(),
    isFocusVisible: () => !!focusVisible?.(),
    isDisabled: () => read(isDisabled),
  };
  const rp = resolveRenderProps(
    { class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-Tab" },
    live ? (liveRenderProps(props) as never) : undefined,
  );
  const dom = globalDOMProps(props, TAB_OWNED);
  const textValue = item.textValue || undefined;
  const selection = { isSelected };
  // RAC Tab: `SelectionIndicatorContext` around the tab content. A function called in the tab's children: the content's
  // signal reads (a SelectionIndicator's) belong to that child site, so a resumed page re-creates the content only.
  const content = () => <Provider values={[[SelectionIndicatorContext, selection]]}>{rp.children()}</Provider>;
  const link: Record<string, unknown> =
    href != null
      ? {
          href: routerHref(router, href),
          hreflang: props.hrefLang,
          target: props.target,
          rel: props.rel,
          download: props.download === true ? "" : props.download || undefined,
          ping: props.ping,
          referrerpolicy: props.referrerPolicy,
        }
      : {};
  const attrs = {
    id: tabId(state, key),
    role: "tab",
    "data-collection": state.id,
    "data-key": String(key),
    "data-key-type": typeof key === "number" ? "number" : undefined,
    "data-text": textValue,
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": props["aria-describedby"],
    "aria-details": props["aria-details"],
    ...(typeof isDisabled === "function"
      ? tabDisabledAttrs(isDisabled)
      : { "aria-disabled": isDisabled ? "true" : undefined, "data-disabled": dataBool(isDisabled) }),
  };
  if (props.render)
    return props.render(
      {
        ...dom,
        ...focusAttrs,
        ...attrs,
        ...handlers,
        ref: forwardedRef as never,
        class: () => rp.class(),
        style: () => rp.style(),
        ...link,
        "aria-selected": () => tabSelected(state, key),
        "aria-controls": () => (isSelected() ? tabPanelId(state, key) : undefined),
        tabindex: () => tabTabIndex(state, key, read(isDisabled)),
        "data-selected": () => dataBool(isSelected()),
        "data-pressed": () => dataBool(isPressed()),
        children: content,
      } as never,
      values,
    );
  return href != null ? (
    <a
      {...dom}
      {...readAttrs(focusAttrs)}
      {...attrs}
      ref={forwardedRef as never}
      class={rp.class()}
      style={rp.style()}
      {...link}
      aria-selected={tabSelected(state, key)}
      aria-controls={isSelected() ? tabPanelId(state, key) : undefined}
      tabIndex={tabTabIndex(state, key, read(isDisabled))}
      data-selected={dataBool(isSelected())}
      data-pressed={dataBool(isPressed())}
      {...handlers}
    >
      {content()}
    </a>
  ) : (
    <div
      {...dom}
      {...readAttrs(focusAttrs)}
      {...attrs}
      ref={forwardedRef as never}
      class={rp.class()}
      style={rp.style()}
      aria-selected={tabSelected(state, key)}
      aria-controls={isSelected() ? tabPanelId(state, key) : undefined}
      tabIndex={tabTabIndex(state, key, read(isDisabled))}
      data-selected={dataBool(isSelected())}
      data-pressed={dataBool(isPressed())}
      {...handlers}
    >
      {content()}
    </div>
  );
}

// --- TabPanels -----------------------------------------------------------------------------------

export interface TabPanelsProps<T = object>
  extends Omit<CollectionProps<T>, "disabledKeys" | "children">, DOMRenderProps<"div", undefined>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Static `TabPanel` children, or a renderer for `items` returning one `TabPanel` per item. */
  children?: Content | ((item: T) => unknown);
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  id?: string;
  /**
   * The CSS class for the element.
   *
   * @default 'rv-TabPanels'
   */
  class?: string;
  style?: StyleObject;
  ref?: RefValue<HTMLDivElement>;
}

/** Groups multiple `<TabPanel>` elements, and provides CSS variables for animated transitions (RAC `TabPanels`). */
export function TabPanels<T extends object>(props: TabPanelsProps<T>) {
  if (isHidden()) return null;
  // Live props (P5): the body is read once (untracked). The panel collection stays tracked: on the server the
  // TabPanel `Show` reads are the enclosing site's resume dependencies (untracked → no region, the panel never switched).
  const { items, children, idScope } = untrack(() => ({ items: props.items, children: props.children, idScope: props.idScope }));
  const content = (
    <Collection items={items} idScope={idScope}>
      {children as never}
    </Collection>
  );
  return untrack(() => tabPanels(props, content));
}

function tabPanels<T extends object>(props: TabPanelsProps<T>, content: unknown) {
  const state = useContext(TabListStateContext)!;
  // RAC: animate `--tab-panel-width` / `--tab-panel-height` when the element's CSS transitions its size (browser-created only).
  let ref: RefValue<HTMLDivElement> | undefined = props.ref;
  if (isBrowser && state) {
    const element = createRef<HTMLDivElement>();
    ref = props.ref ? (mergeRefs(props.ref as never, element as never) as RefValue<HTMLDivElement>) : element;
    let selected = untrack(state.selectedKey);
    let hasTransition: boolean | null = null;
    let prevSize: DOMRect | null = null;
    clientEffect(() => {
      const key = state.selectedKey();
      const el = element();
      if (!el) return;
      untrack(() => {
        hasTransition ??= /width|height|block-size|inline-size|all/.test(window.getComputedStyle(el).transition);
        if (hasTransition && selected != null && selected !== key) {
          // Measure auto size.
          el.style.setProperty("--tab-panel-width", "auto");
          el.style.setProperty("--tab-panel-height", "auto");
          const { width, height } = el.getBoundingClientRect();
          if (prevSize && (prevSize.width !== width || prevSize.height !== height)) {
            // Revert to previous size.
            el.style.setProperty("--tab-panel-width", prevSize.width + "px");
            el.style.setProperty("--tab-panel-height", prevSize.height + "px");
            // Force style re-calculation to trigger animations.
            void window.getComputedStyle(el).height;
            // Animate to current pixel size.
            el.style.setProperty("--tab-panel-width", width + "px");
            el.style.setProperty("--tab-panel-height", height + "px");
            // When animations complete, revert back to auto size.
            Promise.all(el.getAnimations().map((a) => a.finished))
              .then(() => {
                el.style.setProperty("--tab-panel-width", "auto");
                el.style.setProperty("--tab-panel-height", "auto");
              })
              .catch(() => {});
          }
        }
        // Deviation: the previous size is the one measured after the last change (RA measures it during the render).
        if (hasTransition) prevSize = el.getBoundingClientRect();
        selected = key;
      });
    });
  }
  const dom = globalDOMProps(props, ["style"]);
  const className = props.class || "rv-TabPanels";
  const attrs = {
    ...dom,
    ref: ref as never,
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": props["aria-describedby"],
    "aria-details": props["aria-details"],
    class: className,
    style: props.style as never,
  };
  if (props.render) return props.render({ ...attrs, children: () => content } as never, undefined);
  return <div {...attrs}>{content as never}</div>;
}

// --- TabPanel ------------------------------------------------------------------------------------

export interface TabPanelRenderProps {
  /**
   * Whether the tab panel is currently focused.
   *
   * @selector [data-focused]
   */
  isFocused: () => boolean;
  /**
   * Whether the tab panel is currently keyboard focused.
   *
   * @selector [data-focus-visible]
   */
  isFocusVisible: () => boolean;
  /**
   * Whether the tab panel is currently non-interactive. This occurs when the `shouldForceMount` prop is true, and the
   * corresponding tab is not selected.
   *
   * @selector [data-inert]
   */
  isInert: () => boolean;
  /**
   * Whether the tab panel is currently entering. Use this to apply animations.
   *
   * @selector [data-entering]
   */
  isEntering: () => boolean;
  /**
   * Whether the tab panel is currently exiting. Use this to apply animations.
   *
   * @selector [data-exiting]
   */
  isExiting: () => boolean;
  /** State of the tab list. */
  state: TabListState;
}

export interface TabPanelProps
  extends RenderProps<TabPanelRenderProps>, DOMRenderProps<"div", TabPanelRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The unique id of the tab panel (the id of its Tab). */
  id?: Key;
  /**
   * Whether to mount the tab panel in the DOM even when it is not currently selected. Inactive tab panels are inert and
   * cannot be interacted with. They must be styled appropriately so this is clear to the user visually.
   *
   * @default false
   */
  shouldForceMount?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-TabPanel'
   */
  class?: ClassNameOrFunction<TabPanelRenderProps>;
  ref?: RefValue<HTMLDivElement>;
}

interface PanelShared {
  props: TabPanelProps;
  key: Key;
  state: TabListState;
  isSelected: () => boolean;
  isExiting: () => boolean;
  element: (() => HTMLDivElement | null | undefined) | undefined;
  /** Whether the panel was selected when the TabPanel was created (no enter animation then). */
  initial: { selected: boolean };
}

/** A TabPanel provides the content for a tab (RAC `TabPanel`). */
export function TabPanel(inProps: TabPanelProps) {
  if (isHidden()) return null;
  // Live props (P5): class / style / children stay live; the rest of the body is read once (untracked). The `Show`
  // stays tracked: on the server its `when` read is the branch's resume dependency.
  const shared = untrack(() => panelShared(inProps));
  if (shared.props.shouldForceMount) return <TabPanelInner shared={shared} />;
  return <Show when={() => shared.isSelected() || shared.isExiting()}>{() => <TabPanelInner shared={shared} />}</Show>;
}

function panelShared(inProps: TabPanelProps): PanelShared {
  // RAC useCachedChildren: a TabPanel rendered for an `items` row gets the row's id.
  const rowId = collectionItemId();
  const props = rowId != null && inProps.id == null ? liveAssign(inProps, { id: rowId }) : inProps;
  const state = useContext(TabListStateContext);
  if (!state) throw new Error("TabPanel must be rendered inside Tabs.");
  const key = props.id as Key;
  const isSelected = () => isTabSelected(state, key);
  const element = isBrowser ? createRef<HTMLDivElement>() : undefined;
  // Object-literal arrows (resumable symbols): a conditional bare arrow captured by the panel is not serializable.
  const idle = { isExiting: () => false };
  const isExiting = element ? createExitAnimation(element, isSelected) : idle.isExiting;
  return { props, key, state, isSelected, isExiting, element, initial: { selected: untrack(isSelected) } };
}

const PANEL_OWNED = ["style", "inert", "onFocus", "onBlur"] as const;

function TabPanelInner(input: { shared: PanelShared }) {
  return untrack(() => tabPanelInner(input));
}

function tabPanelInner(input: { shared: PanelShared }) {
  const { props, key, state, isSelected, isExiting, element, initial } = input.shared;
  const first = initial.selected;
  initial.selected = false;
  const idle = { isEntering: () => false };
  const isEntering = element && !first ? createEnterAnimation(element) : idle.isEntering;
  const wantsStates = isFn(props.class) || isFn(props.style) || isFn(props.children);
  const focused = wantsStates ? signal(false) : undefined;
  const focusVisible = wantsStates ? signal(false) : undefined;
  const ring: InteractionStateOptions = { states: wantsStates ? { isFocused: focused, isFocusVisible: focusVisible } : undefined };
  const values: TabPanelRenderProps = {
    isFocused: () => !!focused?.(),
    isFocusVisible: () => !!focusVisible?.(),
    isInert: () => !isSelected(),
    isEntering,
    isExiting,
    state,
  };
  const rp = renderPropsOf(props, { values, defaultClassName: "rv-TabPanel" });
  const ownInert = !!props.inert;
  const ariaLabel = props["aria-label"],
    ownLabelledBy = props["aria-labelledby"],
    describedBy = props["aria-describedby"],
    details = props["aria-details"];
  const panelId = tabPanelId(state, key);
  // react-aria useTabPanel: labelled by the selected tab (+ useLabels self-reference with an aria-label).
  const labelledBy = () => {
    const selected = state.selectedKey();
    const tab = selected == null ? undefined : tabId(state, selected);
    const ids = [ariaLabel && (ownLabelledBy || tab) ? panelId : undefined, ...(ownLabelledBy ? ownLabelledBy.split(/\s+/) : []), tab].filter(Boolean);
    return [...new Set(ids)].join(" ") || undefined;
  };
  // A synchronous callback merge (mergeRefValues assigns from an effect): the user ref is set on mount, like React.
  const ref = element ? (props.ref ? (mergeRefs(props.ref as never, element as never) as RefValue<HTMLDivElement>) : element) : props.ref;
  const dom = globalDOMProps(props, PANEL_OWNED);
  const { onFocus, onBlur } = props as { onFocus?: (e: FocusEvent) => void; onBlur?: (e: FocusEvent) => void };
  // useHasTabbableChild: a panel created in the browser drops its tab stop when it holds a tabbable element.
  if (element) clientEffect(() => (isSelected() ? void untrack(() => syncPanelTabIndex(state)) : undefined));
  const handlers = {
    onFocus: (e: FocusEvent) => {
      focusStateFocus(ring, e);
      onFocus?.(e);
    },
    onBlur: (e: FocusEvent) => {
      focusStateBlur(ring, e);
      onBlur?.(e);
    },
  };
  // A panel only carries the tabpanel role, ids and labels while its tab is selected (RAC: an inactive force-mounted
  // or exiting panel gets the DOM / render props only).
  const children = () => (
    <Provider
      values={[
        [TabsContext, null],
        [TabListStateContext, null],
        [CollectionRendererContext, DefaultCollectionRenderer],
      ]}
    >
      {rp.children()}
    </Provider>
  );
  if (props.render)
    return props.render(
      {
        ...dom,
        ...handlers,
        ref: ref as never,
        class: () => rp.class(),
        style: () => rp.style(),
        id: () => (isSelected() ? panelId : undefined),
        role: () => (isSelected() ? "tabpanel" : undefined),
        tabindex: () => (isSelected() ? 0 : undefined),
        "aria-label": () => (isSelected() ? ariaLabel : undefined),
        "aria-labelledby": () => (isSelected() ? labelledBy() : undefined),
        "aria-describedby": () => (isSelected() ? describedBy : undefined),
        "aria-details": () => (isSelected() ? details : undefined),
        inert: () => !isSelected() || ownInert || undefined,
        "data-inert": () => (isSelected() ? undefined : "true"),
        "data-entering": () => dataBool(isEntering()),
        "data-exiting": () => dataBool(isExiting()),
        children,
      } as never,
      values,
    );
  return (
    <div
      {...dom}
      ref={ref as never}
      class={rp.class()}
      style={rp.style()}
      id={isSelected() ? panelId : undefined}
      role={isSelected() ? "tabpanel" : undefined}
      tabIndex={isSelected() ? 0 : undefined}
      aria-label={isSelected() ? ariaLabel : undefined}
      aria-labelledby={isSelected() ? labelledBy() : undefined}
      aria-describedby={isSelected() ? describedBy : undefined}
      aria-details={isSelected() ? details : undefined}
      inert={!isSelected() || ownInert || undefined}
      data-inert={isSelected() ? undefined : "true"}
      data-entering={dataBool(isEntering())}
      data-exiting={dataBool(isExiting())}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
    >
      {children()}
    </div>
  );
}
