// Ported from react-aria-components (src/Tree.tsx: Tree, TreeItem, TreeItemContent, TreeLoadMoreItem,
// TreeContext, TreeStateContext, TreeItemContentContext), Apache-2.0, © Adobe.
//
// A tree: nested, expandable rows with keyboard navigation and selection (a single column treegrid).
// Rivet:
// - The collection is built from the content (`buildCollectionFrom` in a local computed, B5 build mode) into a `TreeCollection`
//   (`./collection.ts`), flattened by the expanded keys (`withExpandedKeys`) in a computed, and
//   rendered by `CollectionRendererContext.CollectionRoot` keyed by row key: expanding / collapsing
//   adds / removes rows in place, resumed rows are adopted.
// - State: `@rivetjs/cdk/collections/tree-state` `createTreeState` (signals + plain data, resumable),
//   provided as `TreeStateContext`; the gridlist view (collection + SelectionManager) is rebuilt per
//   event / binding (`treeStateView`). Handlers are inline arrows calling `tree/behaviour` +
//   `grid-list/behaviour` free functions with the row KEY (never a node / collection instance).
// - Render props are accessors (`class={({ isExpanded }) => (isExpanded() ? "open" : "")}`);
//   `data-hovered` / `data-focused` / `data-focus-visible` written by the handlers, `data-*` values `"true"`.
// - `expandedKeys` / `selectedKeys`: a plain value (controlled) or a Signal (two-way).
// - `class` = RAC `className` (defaults `rv-Tree`, `rv-TreeItem`, `rv-TreeLoader`).
// `render` (RAC DOMRenderProps) on Tree / TreeItem / TreeSection (`<div>`) and TreeHeader (via GridListHeader): given, the attributes object goes to `render(attrs, renderProps)`;
//   the aria prop objects become one accessor per key (object-literal accessors over `gridAttr` / `row`: only literal arrows resume), the row content is the `children` accessor.
// Deviations:
// - Drag and drop (`dragAndDropHooks`, drop indicators, drag button slot) not wired yet (DnD lane).
// - `TreeItem` row `data-pressed` follows the row's pointer / key handlers (a press released outside
//   the row clears on the next row event).
// - No `FocusScope` wrapper (RAC uses it only for its focus manager; nothing here reads it).
// - The selection checkbox id derives from the row id (`<row id>-checkbox`; react-aria `useId()`), like
//   the chevron's (`tree/behaviour.tsx`): byte-stable server HTML.
import { computed, createContext, signal, untrack, useContext } from "@rivetjs/reactivity";
import { For, Provider as ContextProvider, Show, clientEffect, ref as elementRef } from "@rivetjs/runtime/dom";
import {
  Collection,
  CollectionRendererContext,
  DefaultCollectionRenderer,
  buildCollectionFrom,
  createBranchComponent,
  createLeafComponent,
  renderNodeAt,
  type CollectionProps,
  type SectionProps,
} from "../collections/components.tsx";
import { createTreeState, resetTreeFocusedKey, type TreeState } from "../collections/tree-state.ts";
import type { Collection as ICollection, DisabledBehavior, Key, Node, Selection, SelectionBehavior, SelectionMode } from "../collections/types.ts";
import type { Signal } from "@rivetjs/reactivity";
import {
  gridListBlur,
  gridListFocus,
  gridListHighlightDescription,
  gridListItemClick,
  gridListItemDoubleClick,
  gridListItemDragStart,
  gridListItemFocus,
  gridListItemKeyDown,
  gridListItemKeyDownCapture,
  gridListItemKeyUp,
  gridListItemPointerCancel,
  gridListItemPointerDown,
  gridListItemPointerUp,
  gridListKeyDown,
  gridListKeyDownCapture,
  gridListMouseDown,
  gridListSelectionCheckboxChange,
  gridListSelectionCheckboxProps,
  gridListSectionProps,
  gridListShared,
  treeStateView,
  type GridListShared,
} from "../grid-list/behaviour.ts";
import { ButtonContext } from "../button/index.tsx";
import { CheckboxContext, CheckboxFieldContext } from "../checkbox/index.tsx";
import { SelectionIndicatorContext } from "../selection-indicator/context.ts";
import { SharedElementContext, type SharedElementScope } from "../shared-element-transition/transition.tsx";
import {
  DEFAULT_SLOT,
  Provider,
  contextProps,
  createSlotId,
  slotIdRef,
  type SlotId,
  mergeRefValues,
  renderProps,
  resumableContext,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleRenderProps,
} from "../slots/index.tsx";
import { dataBool, focusStateBlur, focusStateFocus, hoverStateEnter, hoverStateLeave, type InteractionStateOptions } from "../utils/data-attrs.tsx";
import { useFocusRing } from "../focus/focus-ring.tsx";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { getScrollParent, nodeContains, scrollIntoView } from "../utils/dom.ts";
import { getFocusableTreeWalker } from "../focus/index.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import { loadMoreSentinel, type LoadMoreSentinelProps } from "../utils/load-more-sentinel.tsx";
import type { HoverEvents } from "../utils/types.ts";
import { useRouter, type LinkDOMProps } from "../utils/links.tsx";
import { GridListHeader, GridListHeaderContext, GridListHeaderInnerContext, type GridListHeaderProps } from "../grid-list/index.tsx";
import { TreeCollection } from "./collection.ts";
import { InternalNavigationTreeContext, NavigationTreeItemLinkContext, NavigationTreeItemStateContext, hasSelectedDescendant } from "./navigation-context.tsx";
import { treeItemExpandPress, treeItemProps, treeProps, type AriaTreeItemOptions, type AriaTreeOptions } from "./behaviour.tsx";
import { hasLive, liveKeys } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";

export { TreeCollection } from "./collection.ts";
export type { TreeState } from "../collections/tree-state.ts";

type MaybeAccessor<T> = T | (() => T);
const read = <T,>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);
/** The flattened collection a Tree passed to its state (`TreeState.collection`). */
const flatOf = (state: TreeState<any>): ICollection<Node<unknown>> => {
  const c = state.collection;
  return (typeof c === "function" ? c() : c) as ICollection<Node<unknown>>;
};
/** Plain data (primitive, array, plain object): a value a For row item can carry through resume by identity. */
const isPlainData = (value: unknown): boolean => {
  if (value === null || typeof value !== "object") return typeof value !== "function" && typeof value !== "symbol";
  const proto = Object.getPrototypeOf(value);
  return Array.isArray(value) || proto === Object.prototype || proto === null;
};
/** Stand-in node of a row whose key just left the collection (its bindings run once more before disposal). */
const removedNode = (key: Key): Node<unknown> =>
  ({
    type: "item",
    key,
    value: null,
    level: 0,
    index: 0,
    parentKey: null,
    hasChildNodes: false,
    childNodes: [],
    props: {},
    textValue: "",
    rendered: null,
  }) as unknown as Node<unknown>;
/** A two-way Signal (callable with `.set`), as `collections/tree-state.ts`. */
const isSignal = (value: unknown): value is Signal<Set<Key>> => typeof value === "function" && typeof (value as Signal<unknown>).set === "function";
const isDev = (): boolean => typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

// ---------------------------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------------------------

/** Render props of `Tree` (accessors; `@selector` = the matching attribute). */
export interface TreeRenderProps {
  /** Whether the tree has no items and should display its empty state. @selector [data-empty] */
  isEmpty: () => boolean;
  /** Whether the tree is currently focused. @selector [data-focused] */
  isFocused: () => boolean;
  /** Whether the tree is currently keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** The type of selection that is allowed in the collection. @selector [data-selection-mode="single | multiple"] */
  selectionMode: () => SelectionMode;
  /** Whether the tree allows dragging. @selector [data-allows-dragging] */
  allowsDragging: () => boolean;
  /** Whether the tree is currently the active drop target. @selector [data-drop-target] */
  isDropTarget: () => boolean;
  /** State of the tree. */
  state: TreeState<unknown>;
}

export interface TreeEmptyStateRenderProps extends Omit<TreeRenderProps, "isEmpty"> {}

export interface TreeProps<T>
  extends
    Omit<AriaTreeOptions, "ref" | "keyboardDelegate" | "layoutDelegate" | "isVirtualized" | "descriptionId" | "getRowText" | "disabledBehavior">,
    CollectionProps<T>,
    StyleRenderProps<TreeRenderProps>,
    DOMRenderProps<"div", TreeRenderProps>,
    SlotProps,
    GlobalDOMAttributes<HTMLDivElement> {
  /** The type of selection that is allowed in the collection. Default "none". */
  selectionMode?: SelectionMode | undefined;
  /** How multiple selection should behave in the tree. Default "toggle". */
  selectionBehavior?: SelectionBehavior | undefined;
  /** The currently selected keys: a plain value (controlled) or a Signal (two-way). */
  selectedKeys?: Signal<Selection> | "all" | Iterable<Key> | undefined;
  /** The initial selected keys (uncontrolled). */
  defaultSelectedKeys?: "all" | Iterable<Key> | undefined;
  /** Handler that is called when the selection changes. */
  onSelectionChange?: ((keys: Selection) => void) | undefined;
  /** Whether the collection allows empty selection. */
  disallowEmptySelection?: boolean | undefined;
  /** The item keys that are disabled. */
  disabledKeys?: Iterable<Key> | undefined;
  /** Whether `disabledKeys` applies to all interactions, or only selection. Default "all". */
  disabledBehavior?: DisabledBehavior | undefined;
  /** The currently expanded keys: a plain value (controlled) or a Signal (two-way). */
  expandedKeys?: Signal<Set<Key>> | Iterable<Key> | undefined;
  /** The initial expanded keys (uncontrolled). */
  defaultExpandedKeys?: Iterable<Key> | undefined;
  /** Handler that is called when items are expanded or collapsed. */
  onExpandedChange?: ((keys: Set<Key>) => void) | undefined;
  /** Provides content to display when there are no items in the tree. */
  renderEmptyState?: ((props: TreeEmptyStateRenderProps) => unknown) | undefined;
  ref?: RefValue<HTMLDivElement> | undefined;
}

/** RAC `TreeContext`: props for the Trees inside a component, optionally per `slot`. */
export const TreeContext = resumableContext(createContext<ContextValue<TreeProps<any>, HTMLDivElement>>(null, { id: "rv-tree" }));
/** RAC `TreeStateContext`: the state of the enclosing Tree. */
export const TreeStateContext = resumableContext(createContext<TreeState<any> | null>(null, { id: "rv-tree-state" }));

/** Data the Tree shares with its rows (react-aria `listMap` value + grid options). */
interface TreeInternal {
  shared: GridListShared;
}
const TreeInternalContext = resumableContext(createContext<TreeInternal | null>(null, { id: "rv-tree-internal" }));

/** Global DOM events Tree handles itself; the user's run from its own handler. */
const TREE_OWNED = ["onMouseDown", "style"] as const;

/**
 * A tree provides users with a way to navigate nested hierarchical information, with support for
 * keyboard navigation and selection.
 */
export function Tree<T>(inProps: TreeProps<T>) {
  const [props, userRef] = contextProps(inProps, inProps.ref, TreeContext) as [TreeProps<T>, RefValue<HTMLDivElement> | undefined];
  const items = props.items;
  const children = props.children;
  const idScope = props.idScope;
  // `computed(buildCollectionFrom(…))` (= B5 `collectionOf`) written out here so the compiler records it as a
  // resumable computed (`_rComputed`): the accessor `collectionOf` returns is a plain computed and does not
  // serialize when a resumable closure captures it.
  const base = computed(() =>
    buildCollectionFrom(
      () => Collection<T>({ items, children, idScope }),
      () => new TreeCollection<T>(),
    ),
  );
  // Props read into locals first: a resumable closure / call reading `props.x` captures the whole props object.
  const selectionMode = props.selectionMode ?? "none";
  const selectionBehavior = props.selectionBehavior;
  // Live props: a controlled `selectedKeys={keys()}` stays live (accessor; never written).
  const selectedKeys = liveKeys(props, "selectedKeys");
  const defaultSelectedKeys = props.defaultSelectedKeys;
  const onSelectionChange = props.onSelectionChange;
  const disallowEmptySelection = props.disallowEmptySelection;
  const disabledKeys = props.disabledKeys;
  const disabledBehavior = props.disabledBehavior ?? "all";
  // Live props: a controlled `expandedKeys={keys()}` stays live (accessor; never written).
  const expandedProp = liveKeys(props, "expandedKeys");
  const defaultExpandedKeys = props.defaultExpandedKeys;
  const onExpandedChange = props.onExpandedChange;
  // react-stately useTreeState's expanded keys (as `createTreeState`): created here because the
  // flattened collection reads them and the state holds the collection.
  const expandedControlled = expandedProp !== undefined && !isSignal(expandedProp);
  const expanded: Signal<Set<Key>> =
    typeof expandedProp === "function"
      ? (expandedProp as Signal<Set<Key>>)
      : signal(new Set<Key>(expandedControlled ? (expandedProp as Iterable<Key>) : (defaultExpandedKeys ?? [])));
  // The flattened (expanded-aware) collection: rebuilt when the content or the expanded keys change.
  const flat = computed(() => base().withExpandedKeys(new Set(), expanded()));
  const state: TreeState<T> = {
    ...createTreeState<T>({
      selectionMode,
      selectionBehavior,
      selectedKeys,
      defaultSelectedKeys,
      onSelectionChange,
      disallowEmptySelection,
      disabledKeys,
      disabledBehavior,
      expandedKeys: expanded,
      onExpandedChange,
      collection: flat as () => ICollection<Node<T>>,
    }),
    // A plain `expandedKeys` value is controlled: changes are reported, never written.
    expandedKeysControlled: expandedControlled,
  };
  const renderer = useContext(CollectionRendererContext);
  // The default renderer's methods are module functions (not resumable captures): capture only a custom one.
  const customRenderer = renderer === DefaultCollectionRenderer ? null : renderer;
  const shared = gridListShared(props as AriaTreeOptions);
  const descriptionId = shared.id + "-description";
  const gridOpts: AriaTreeOptions = {
    id: shared.id,
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": props["aria-describedby"],
    "aria-details": props["aria-details"],
    autoFocus: props.autoFocus,
    onAction: props.onAction,
    disabledBehavior: props.disabledBehavior ?? "all",
    shouldSelectOnPressUp: props.shouldSelectOnPressUp,
    keyboardNavigationBehavior: props.keyboardNavigationBehavior,
    escapeKeyBehavior: props.escapeKeyBehavior,
    disallowTypeAhead: props.disallowTypeAhead,
    linkBehavior: props.linkBehavior,
    isVirtualized: renderer.isVirtualized,
    UNSTABLE_focusOnEntry: props.UNSTABLE_focusOnEntry,
    direction: props.direction,
    locale: props.locale,
    descriptionId,
  };
  const view = () => treeStateView(state, shared);
  const sharedElements: SharedElementScope = {};
  const el = elementRef<HTMLDivElement>();
  const rootRef = mergeRefValues<HTMLDivElement>(el as RefValue<HTMLDivElement>, userRef);
  // react-aria useHasTabbableChild (empty state with a tabbable child: the grid leaves the tab order).
  const hasTabbableChild = signal(false);
  clientEffect(() => {
    const root = el();
    if (!root || flat().size !== 0) return;
    const update = () => hasTabbableChild.set(!!getFocusableTreeWalker(root, { tabbable: true }).nextNode());
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["tabIndex", "disabled"] });
    return () => observer.disconnect();
  });
  const focused = signal(false);
  const focusVisible = signal(false);
  const rootInteraction: InteractionStateOptions = { states: { isFocused: focused, isFocusVisible: focusVisible } };
  const values: TreeRenderProps = {
    isEmpty: () => flat().size === 0,
    isFocused: () => focused(),
    isFocusVisible: () => focusVisible(),
    selectionMode: computed(() => view().selectionManager.selectionMode),
    allowsDragging: () => false,
    isDropTarget: () => false,
    state: state as TreeState<unknown>,
  };
  const rp = untrack(() =>
    renderProps(
      { class: props.class, style: props.style, values, defaultClassName: "rv-Tree" },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  const renderEmptyState = props.renderEmptyState;
  const emptyValues: TreeEmptyStateRenderProps = {
    isFocused: values.isFocused,
    isFocusVisible: values.isFocusVisible,
    selectionMode: values.selectionMode,
    allowsDragging: values.allowsDragging,
    isDropTarget: values.isDropTarget,
    state: values.state,
  };
  const onMouseDown = props.onMouseDown;
  const slot = props.slot || undefined;
  const dom = globalDOMProps(props, TREE_OWNED);
  const description = () => gridListHighlightDescription(gridOpts, view());
  // useTreeState: reset the focused key when its item leaves the collection.
  clientEffect(() => resetTreeFocusedKey(state, flat()));
  if (props.render) {
    // Accessors are object-literal arrows over `gridAttr` (a local const): only those resume (a `liveProps` loop made them closures).
    // `tabindex` lowercase: see CalendarCell.
    const gridAttr = (name: string) => treeProps(gridOpts, view(), hasTabbableChild()).gridProps[name] as never;
    const attrs = {
      ...dom,
      id: () => gridAttr("id"),
      role: "treegrid",
      "aria-label": () => gridAttr("aria-label"),
      "aria-labelledby": () => gridAttr("aria-labelledby"),
      "aria-describedby": () => gridAttr("aria-describedby"),
      "aria-details": () => gridAttr("aria-details"),
      "aria-multiselectable": () => gridAttr("aria-multiselectable"),
      "aria-rowcount": () => gridAttr("aria-rowcount"),
      "aria-colcount": () => gridAttr("aria-colcount"),
      tabindex: () => gridAttr("tabIndex"),
      ref: rootRef,
      class: () => rp.class(),
      style: () => rp.style(),
      slot,
      "data-empty": () => dataBool(flat().size === 0),
      "data-selection-mode": () => (values.selectionMode() === "none" ? undefined : values.selectionMode()),
      onKeyDownCapture: (e: KeyboardEvent) => gridListKeyDownCapture(e as never, gridOpts, view()),
      onKeyDown: (e: KeyboardEvent) => gridListKeyDown(e as never, gridOpts, view()),
      onFocusIn: (e: FocusEvent) => gridListFocus(e as never, gridOpts, view()),
      onFocusOut: (e: FocusEvent) => gridListBlur(e as never, gridOpts, view()),
      onFocus: (e: FocusEvent) => focusStateFocus(rootInteraction, e as never),
      onBlur: (e: FocusEvent) => focusStateBlur(rootInteraction, e as never),
      onMouseDown: (e: MouseEvent) => {
        gridListMouseDown(e as never, gridOpts, view());
        onMouseDown?.(e as never);
      },
      children: () => [
        <Provider
          values={[
            [TreeStateContext, state],
            [TreeInternalContext, { shared }],
            [SharedElementContext, sharedElements],
          ]}
        >
          {(customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection: flat as () => ICollection<Node<unknown>>, scrollRef: el }) as never}
        </Provider>,
        renderEmptyState ? (
          <Show when={() => flat().size === 0}>
            {() => (
              <div role="row" style={{ display: "contents" }} aria-level="1">
                <div role="gridcell" style={{ display: "contents" }}>
                  {renderEmptyState(emptyValues) as never}
                </div>
              </div>
            )}
          </Show>
        ) : null,
        <Show when={() => !!description()}>
          {() => (
            <div id={descriptionId} hidden>
              {description()}
            </div>
          )}
        </Show>,
      ],
    };
    return props.render(attrs as never, values);
  }
  return (
    <div
      {...dom}
      {...treeProps(gridOpts, view(), hasTabbableChild()).gridProps}
      ref={rootRef as never}
      class={rp.class()}
      style={rp.style()}
      slot={slot}
      data-empty={dataBool(flat().size === 0)}
      data-selection-mode={values.selectionMode() === "none" ? undefined : values.selectionMode()}
      onKeyDownCapture={(e) => gridListKeyDownCapture(e, gridOpts, view())}
      onKeyDown={(e) => gridListKeyDown(e, gridOpts, view())}
      onFocusIn={(e) => gridListFocus(e, gridOpts, view())}
      onFocusOut={(e) => gridListBlur(e, gridOpts, view())}
      onFocus={(e) => focusStateFocus(rootInteraction, e)}
      onBlur={(e) => focusStateBlur(rootInteraction, e)}
      onMouseDown={(e) => {
        gridListMouseDown(e, gridOpts, view());
        onMouseDown?.(e as never);
      }}
    >
      <Provider
        values={[
          [TreeStateContext, state],
          [TreeInternalContext, { shared }],
          // RAC: the rows share one SharedElementTransition scope (a SelectionIndicator animates between them).
          [SharedElementContext, sharedElements],
        ]}
      >
        {(customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection: flat as () => ICollection<Node<unknown>>, scrollRef: el }) as never}
      </Provider>
      {renderEmptyState ? (
        <Show when={() => flat().size === 0}>
          {() => (
            <div role="row" style={{ display: "contents" }} aria-level="1">
              <div role="gridcell" style={{ display: "contents" }}>
                {renderEmptyState(emptyValues) as never}
              </div>
            </div>
          )}
        </Show>
      ) : null}
      <Show when={() => !!description()}>
        {() => (
          <div id={descriptionId} hidden>
            {description()}
          </div>
        )}
      </Show>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// TreeItem
// ---------------------------------------------------------------------------------------------

/** Render props of `TreeItem` / `TreeItemContent` (accessors; `@selector` = the matching attribute). */
export interface TreeItemRenderProps {
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
  selectionMode: () => SelectionMode;
  selectionBehavior: () => SelectionBehavior;
  /** @selector [data-allows-dragging] */
  allowsDragging: () => boolean;
  /** @selector [data-dragging] */
  isDragging: () => boolean;
  /** @selector [data-drop-target] */
  isDropTarget: () => boolean;
  /** Whether the tree item is expanded. @selector [data-expanded] */
  isExpanded: () => boolean;
  /** Whether the tree item has child tree items. @selector [data-has-child-items] */
  hasChildItems: () => boolean;
  /** What level the tree item has within the tree. @selector [data-level="number"] */
  level: () => number;
  /** Whether the tree item's children have keyboard focus. @selector [data-focus-visible-within] */
  isFocusVisibleWithin: () => boolean;
  /** The state of the tree. */
  state: TreeState<unknown>;
  /** The unique id of the tree row. */
  id: Key;
}

export interface TreeItemContentRenderProps extends TreeItemRenderProps {}

/** RAC `TreeItemContentContext`: the render props of the enclosing TreeItem. */
export const TreeItemContentContext = resumableContext(createContext<TreeItemContentRenderProps | null>(null, { id: "rv-tree-item-content" }));

export interface TreeItemContentProps {
  /** The children of the component. A function may be provided to alter the children based on component state. */
  children: RenderProps<TreeItemContentRenderProps>["children"];
}

/** The content of a TreeItem (everything but its child rows); children may be a function of the item's render props. */
export const TreeItemContent = /* @__PURE__ */ createLeafComponent("content", function TreeItemContent(props: TreeItemContentProps) {
  const values = useContext(TreeItemContentContext)!;
  const rp = renderProps({ children: props.children, values });
  return (
    <ContextProvider token={CollectionRendererContext} value={DefaultCollectionRenderer}>
      {rp.children() as never}
    </ContextProvider>
  );
});

export interface TreeItemProps<T = object>
  extends
    StyleRenderProps<TreeItemRenderProps>,
    DOMRenderProps<"div", TreeItemRenderProps>,
    LinkDOMProps,
    HoverEvents,
    Pick<AriaTreeItemOptions, "hasChildItems" | "focusMode" | "allowsArrowNavigation">,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "onClick"> {
  /** The unique id of the tree row. */
  id?: Key | undefined;
  /** The object value that this tree item represents. When using dynamic collections, this is set automatically. */
  value?: T | undefined;
  /** A string representation of the tree item's contents, used for features like typeahead. */
  textValue: string;
  /** An accessibility label for this tree item. */
  "aria-label"?: string | undefined;
  /** The content of the tree item along with any nested children (TreeItemContent, TreeItems, Collection). */
  children: unknown;
  /** Whether the item is disabled. */
  isDisabled?: boolean | undefined;
  /** Handler that is called when a user performs an action on this tree item. */
  onAction?: (() => void) | undefined;
  ref?: RefValue<HTMLDivElement> | undefined;
}

/** Global DOM events TreeItem handles itself (the user's chain after its own); RAC drops `onClick`. */
const ITEM_OWNED = [
  "onPointerDown",
  "onPointerUp",
  "onPointerCancel",
  "onPointerEnter",
  "onPointerLeave",
  "onDblClick",
  "onDragStart",
  "onClick",
  "style",
] as const;

/** A TreeItem represents an individual item in a Tree. */
export const TreeItem = /* @__PURE__ */ createBranchComponent("item", function TreeItem<T>(props: TreeItemProps<T>, forwardedRef: unknown, item: Node<T>) {
  const state = useContext(TreeStateContext)!;
  const internal = useContext(TreeInternalContext)!;
  const shared = internal.shared;
  const key = item.key;
  const focusMode = props.focusMode;
  const allowsArrowNavigation = props.allowsArrowNavigation;
  const hasChildItemsProp = props.hasChildItems;
  const router = useRouter();
  const view = () => treeStateView(state, shared);
  const opts = (collection: ICollection<Node<unknown>>, row?: Element | null): AriaTreeItemOptions => ({
    // A removed row's bindings may re-run once before the row is disposed: read it as a detached leaf.
    node: collection.getItem(key) ?? removedNode(key),
    focusMode,
    allowsArrowNavigation,
    hasChildItems: hasChildItemsProp,
    shouldSelectOnPressUp: false,
    router,
    ref: (row as HTMLElement | null | undefined) ?? undefined,
  });
  const row = elementRef<HTMLDivElement>();
  const rowRef = mergeRefValues<HTMLDivElement>(row as RefValue<HTMLDivElement>, forwardedRef as RefValue<HTMLDivElement> | undefined);
  const aria = computed(() => {
    const v = view();
    return treeItemProps(opts(v.collection as ICollection<Node<unknown>>), v);
  });
  const isExpanded = () => aria().rowProps["aria-expanded"] === true;
  const hasChildItems = () => !!hasChildItemsProp || [...(flatOf(state).getChildren?.(key) ?? [])].length > 1;
  const level = () => (aria().rowProps["aria-level"] as number | undefined) || 1;
  const hovered = signal(false);
  const pressed = signal(false);
  const focusVisible = signal(false);
  const within = useFocusRing({ within: true });
  const { onHoverStart, onHoverChange, onHoverEnd } = props;
  const interaction: InteractionStateOptions = {
    // RAC: hover only when the row can be selected or has an action (WebKit sticky hover after drops).
    isDisabled: () => !aria().allowsSelection && !aria().hasAction,
    onHoverStart,
    onHoverChange,
    onHoverEnd,
    states: { isHovered: hovered, isFocusVisible: focusVisible },
  };
  // Row `isPressed` lives in the press memo of the row element: re-read it after the row's press handlers.
  const syncPressed = (target: EventTarget | null) => {
    const v = view();
    pressed.set(treeItemProps(opts(v.collection as ICollection<Node<unknown>>, target as Element | null), v).isPressed);
  };
  // NavigationTree (RAC NavigationTreeItem's `render` wrapper; see navigation-context.tsx): current route,
  // current-route ancestors and the link's focus-visible state.
  const nav = useContext(InternalNavigationTreeContext);
  const { href, hrefLang, target: linkTarget, rel, download, ping, referrerPolicy, routerOptions } = props;
  const hasLink = href != null && href.length > 0;
  const linkFocused = signal(false);
  const isCurrent = (): boolean => !!nav && hasLink && href === nav.selectedRoute();
  const isCurrentAncestor = (): boolean => !!nav && hasSelectedDescendant(key, flatOf(state), nav.selectedRoute());
  const navFocusVisible = nav ? (): boolean => focusVisible() || (within.isFocusVisible() && linkFocused()) : null;
  const values: TreeItemContentRenderProps & { isCurrent?: () => boolean; isCurrentAncestor?: () => boolean } = {
    isHovered: () => hovered(),
    isPressed: () => pressed(),
    // Memos: `view()` / `aria()` change on every expand / selection / focus update; a render-prop reader
    // (`selectionMode() !== "none" ? <Checkbox/> : null`) re-runs only when its value changes (RAC: React
    // keeps the element across those re-renders).
    isSelected: computed(() => aria().isSelected),
    isFocused: computed(() => aria().isFocused),
    isFocusVisible: navFocusVisible ?? (() => focusVisible()),
    isDisabled: computed(() => aria().isDisabled),
    selectionMode: computed(() => view().selectionManager.selectionMode),
    selectionBehavior: computed(() => view().selectionManager.selectionBehavior),
    allowsDragging: () => false,
    isDragging: () => false,
    isDropTarget: () => false,
    isExpanded,
    hasChildItems,
    level,
    isFocusVisibleWithin: () => within.isFocusVisible(),
    state: state as TreeState<unknown>,
    id: key,
    ...(nav ? { isCurrent, isCurrentAncestor } : {}),
  };
  if (nav) {
    // Keep the current route's row visible inside the tree's own scroll container (never the page).
    clientEffect(() => {
      const el = row();
      if (!isCurrent() || !el) return;
      const scrollParent = getScrollParent(el, true) as HTMLElement;
      const tree = el.closest('[role="treegrid"]');
      if (tree && nodeContains(tree, scrollParent)) scrollIntoView(scrollParent, el, { block: "center" });
    });
  }
  const rp = untrack(() =>
    renderProps(
      {
        class: props.class,
        style: props.style,
        values,
        defaultClassName: "rv-TreeItem",
        defaultStyle: { "--tree-item-level": level() },
      },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  if (isDev() && !item.textValue) {
    console.warn("A `textValue` prop is required for <TreeItem> elements in order to support accessibility features such as type to select.");
  }
  if (isDev()) {
    clientEffect(() => {
      const el = row();
      if (el && untrack(hasChildItems) && !el.querySelector('[slot="chevron"]')) {
        console.warn("Expandable tree items must contain a expand button so screen reader users can expand/collapse the item.");
      }
    });
  }
  const rowId = () => aria().rowProps.id as string;
  // useGridListSelectionCheckbox (Rivet: the checkbox id derives from the row id, see header).
  const checkboxId = untrack(rowId) + "-checkbox";
  const checkboxLabel = untrack(() => gridListSelectionCheckboxProps({ key, id: checkboxId }, view()).checkboxProps["aria-label"]);
  const checkboxProps = {
    id: checkboxId,
    "aria-label": checkboxLabel,
    "aria-labelledby": `${checkboxId} ${untrack(rowId)}`,
    isSelected: () => aria().isSelected,
    isDisabled: () => !view().selectionManager.canSelectItem(key),
    onChange: (isSelected: boolean) => gridListSelectionCheckboxChange(isSelected, { key }, view()),
  };
  const chevronId = () => aria().expandButtonProps.id;
  const arrowNav = shared.keyboardNavigationBehavior === "arrow" || !!allowsArrowNavigation;
  const { onPointerDown, onPointerUp, onPointerCancel, onPointerEnter, onPointerLeave, onDblClick } = props;
  const dom = globalDOMProps(props, ITEM_OWNED);
  const contentKeys = (): Key[] => {
    const keys: Key[] = [];
    for (const child of flatOf(state).getChildren?.(key) ?? []) if (child.type === "content") keys.push(child.key);
    return keys;
  };
  // Content rows are keyed by index; each row's item is the row's value when it is plain data (else null). A resumed
  // page adopts the server rows only while that value is the same object, and a client row re-renders when it
  // changes: `createTreeData.update` (a new value) re-renders the content (RAC re-renders TreeItemContent with the
  // new item even where the content node itself is unchanged).
  const contentRows = (): unknown[] => {
    const value = flatOf(state).getItem(key)?.value;
    const token = isPlainData(value) ? value : null;
    return contentKeys().map(() => token);
  };
  if (props.render) {
    const rowAttr = (name: string) => aria().rowProps[name] as never;
    const attrs = {
      ...dom,
      id: () => rowAttr("id"),
      role: "row",
      "aria-label": () => rowAttr("aria-label"),
      "aria-labelledby": () => rowAttr("aria-labelledby"),
      "aria-selected": () => (rowAttr("aria-selected") === undefined ? undefined : String(rowAttr("aria-selected"))),
      "aria-disabled": () => (rowAttr("aria-disabled") ? "true" : undefined),
      "aria-expanded": () => (rowAttr("aria-expanded") === undefined ? undefined : String(rowAttr("aria-expanded"))),
      "aria-level": () => rowAttr("aria-level"),
      "aria-posinset": () => rowAttr("aria-posinset"),
      "aria-setsize": () => rowAttr("aria-setsize"),
      "aria-rowindex": () => rowAttr("aria-rowindex"),
      tabindex: () => rowAttr("tabIndex"),
      "data-key": () => rowAttr("data-key"),
      "data-key-type": () => rowAttr("data-key-type"),
      "data-collection": () => rowAttr("data-collection"),
      "data-href": () => rowAttr("data-href"),
      "data-target": () => rowAttr("data-target"),
      "data-rel": () => rowAttr("data-rel"),
      "data-download": () => rowAttr("data-download"),
      "data-ping": () => rowAttr("data-ping"),
      "data-referrer-policy": () => rowAttr("data-referrer-policy"),
      ref: rowRef,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-expanded": () => dataBool(hasChildItems() && isExpanded()),
      "data-has-child-items": () => dataBool(hasChildItems()),
      "data-level": () => level(),
      "data-selected": () => dataBool(aria().isSelected),
      "data-disabled": () => dataBool(aria().isDisabled),
      "data-focused": () => dataBool(aria().isFocused),
      "data-pressed": () => dataBool(pressed()),
      "data-selection-mode": () => (values.selectionMode() === "none" ? undefined : values.selectionMode()),
      "data-current": nav ? () => dataBool(isCurrent()) : undefined,
      "data-current-ancestor": nav ? () => dataBool(isCurrentAncestor()) : undefined,
      "data-focus-visible": navFocusVisible ? () => dataBool(navFocusVisible()) : undefined,
      onKeyDownCapture: (e: KeyboardEvent) => {
        if (!arrowNav) return;
        const v = view();
        gridListItemKeyDownCapture(e as never, opts(v.collection as ICollection<Node<unknown>>), v);
      },
      onKeyDown: (e: KeyboardEvent) => {
        const v = view();
        gridListItemKeyDown(e as never, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
      },
      onKeyUp: (e: KeyboardEvent) => {
        const v = view();
        gridListItemKeyUp(e as never, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
      },
      onFocusIn: (e: FocusEvent) => {
        const v = view();
        gridListItemFocus(e as never, opts(v.collection as ICollection<Node<unknown>>), v);
        (within.focusProps.onFocusIn as (e: FocusEvent) => void)(e);
      },
      onFocusOut: (e: FocusEvent) => (within.focusProps.onFocusOut as (e: FocusEvent) => void)(e),
      onFocus: (e: FocusEvent) => focusStateFocus(interaction, e as never),
      onBlur: (e: FocusEvent) => focusStateBlur(interaction, e as never),
      onPointerEnter: (e: PointerEvent) => {
        hoverStateEnter(interaction, e as never);
        onPointerEnter?.(e as never);
      },
      onPointerLeave: (e: PointerEvent) => {
        hoverStateLeave(interaction, e as never);
        onPointerLeave?.(e as never);
      },
      onPointerDown: (e: PointerEvent) => {
        const v = view();
        gridListItemPointerDown(e as never, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
        onPointerDown?.(e as never);
      },
      onPointerUp: (e: PointerEvent) => {
        const v = view();
        gridListItemPointerUp(e as never, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
        onPointerUp?.(e as never);
      },
      onPointerCancel: (e: PointerEvent) => {
        const v = view();
        gridListItemPointerCancel(e as never, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
        onPointerCancel?.(e as never);
      },
      onClick: (e: MouseEvent) => {
        const v = view();
        gridListItemClick(e as never, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
      },
      onDblClick: (e: MouseEvent) => {
        const v = view();
        gridListItemDoubleClick(e as never, opts(v.collection as ICollection<Node<unknown>>), v);
        onDblClick?.(e as never);
      },
      onDragStart: (e: DragEvent) => {
        const v = view();
        gridListItemDragStart(e as never, opts(v.collection as ICollection<Node<unknown>>), v);
      },
      children: () => (
        <div {...aria().gridCellProps} style={{ display: "contents" }}>
          <Provider
            values={[
              [CheckboxContext, { slots: { [DEFAULT_SLOT]: {}, selection: checkboxProps } }],
              [CheckboxFieldContext, { slots: { [DEFAULT_SLOT]: {}, selection: checkboxProps } }],
              [
                ButtonContext,
                {
                  slots: {
                    [DEFAULT_SLOT]: {},
                    chevron: {
                      id: untrack(chevronId),
                      "aria-label": () => aria().expandButtonProps["aria-label"],
                      "aria-labelledby": `${untrack(chevronId)} ${untrack(rowId)}`,
                      excludeFromTabOrder: true,
                      preventFocusOnPress: true,
                      "data-rv-prevent-focus": "true",
                      onPress: () => {
                        const v = view();
                        const o = opts(v.collection as ICollection<Node<unknown>>);
                        treeItemExpandPress(undefined, o, v, treeItemProps(o, v).isDisabled);
                      },
                    },
                  },
                },
              ],
              [TreeItemContentContext, values],
              [SelectionIndicatorContext, { isSelected: () => aria().isSelected }],
              ...(nav
                ? ([
                    [
                      NavigationTreeItemLinkContext,
                      {
                        href,
                        hrefLang,
                        target: linkTarget,
                        rel,
                        download,
                        ping,
                        referrerPolicy,
                        routerOptions,
                        isCurrent,
                        isLinkFocused: linkFocused,
                      },
                    ],
                    [NavigationTreeItemStateContext, { isCurrentAncestor }],
                  ] as never[])
                : []),
            ]}
          >
            <For each={contentRows} by={(_: unknown, index: number) => index}>
              {(value: () => unknown, index: () => number) =>
                renderNodeAt(
                  () => flatOf(state),
                  () => untrack(contentKeys)[index()]!,
                  value,
                ) as never
              }
            </For>
          </Provider>
        </div>
      ),
    };
    return props.render(attrs as never, values);
  }
  return (
    <div
      {...dom}
      {...aria().rowProps}
      ref={rowRef as never}
      class={rp.class()}
      style={rp.style()}
      data-expanded={dataBool(hasChildItems() && isExpanded())}
      data-has-child-items={dataBool(hasChildItems())}
      data-level={level()}
      data-selected={dataBool(aria().isSelected)}
      data-disabled={dataBool(aria().isDisabled)}
      data-focused={dataBool(aria().isFocused)}
      data-pressed={dataBool(pressed())}
      data-selection-mode={values.selectionMode() === "none" ? undefined : values.selectionMode()}
      data-current={nav ? dataBool(isCurrent()) : undefined}
      data-current-ancestor={nav ? dataBool(isCurrentAncestor()) : undefined}
      data-focus-visible={navFocusVisible ? dataBool(navFocusVisible()) : undefined}
      onKeyDownCapture={
        arrowNav
          ? (e) => {
              const v = view();
              gridListItemKeyDownCapture(e, opts(v.collection as ICollection<Node<unknown>>), v);
            }
          : undefined
      }
      onKeyDown={(e) => {
        const v = view();
        gridListItemKeyDown(e, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
      }}
      onKeyUp={(e) => {
        const v = view();
        gridListItemKeyUp(e, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
      }}
      onFocusIn={(e) => {
        const v = view();
        gridListItemFocus(e, opts(v.collection as ICollection<Node<unknown>>), v);
        (within.focusProps.onFocusIn as (e: FocusEvent) => void)(e);
      }}
      onFocusOut={(e) => (within.focusProps.onFocusOut as (e: FocusEvent) => void)(e)}
      onFocus={(e) => focusStateFocus(interaction, e)}
      onBlur={(e) => focusStateBlur(interaction, e)}
      onPointerEnter={(e) => {
        hoverStateEnter(interaction, e);
        onPointerEnter?.(e as never);
      }}
      onPointerLeave={(e) => {
        hoverStateLeave(interaction, e);
        onPointerLeave?.(e as never);
      }}
      onPointerDown={(e) => {
        const v = view();
        gridListItemPointerDown(e, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
        onPointerDown?.(e as never);
      }}
      onPointerUp={(e) => {
        const v = view();
        gridListItemPointerUp(e, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
        onPointerUp?.(e as never);
      }}
      onPointerCancel={(e) => {
        const v = view();
        gridListItemPointerCancel(e, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
        onPointerCancel?.(e as never);
      }}
      onClick={(e) => {
        const v = view();
        gridListItemClick(e, opts(v.collection as ICollection<Node<unknown>>), v);
        syncPressed(e.currentTarget);
      }}
      onDblClick={(e) => {
        const v = view();
        gridListItemDoubleClick(e, opts(v.collection as ICollection<Node<unknown>>), v);
        onDblClick?.(e as never);
      }}
      onDragStart={(e) => {
        const v = view();
        gridListItemDragStart(e, opts(v.collection as ICollection<Node<unknown>>), v);
      }}
    >
      <div {...aria().gridCellProps} style={{ display: "contents" }}>
        <Provider
          values={[
            [CheckboxContext, { slots: { [DEFAULT_SLOT]: {}, selection: checkboxProps } }],
            [CheckboxFieldContext, { slots: { [DEFAULT_SLOT]: {}, selection: checkboxProps } }],
            [
              ButtonContext,
              {
                slots: {
                  [DEFAULT_SLOT]: {},
                  chevron: {
                    id: untrack(chevronId),
                    "aria-label": () => aria().expandButtonProps["aria-label"],
                    "aria-labelledby": `${untrack(chevronId)} ${untrack(rowId)}`,
                    excludeFromTabOrder: true,
                    preventFocusOnPress: true,
                    "data-rv-prevent-focus": "true",
                    onPress: () => {
                      const v = view();
                      const o = opts(v.collection as ICollection<Node<unknown>>);
                      treeItemExpandPress(undefined, o, v, treeItemProps(o, v).isDisabled);
                    },
                  },
                },
              },
            ],
            [TreeItemContentContext, values],
            [SelectionIndicatorContext, { isSelected: () => aria().isSelected }],
            ...(nav
              ? ([
                  [
                    NavigationTreeItemLinkContext,
                    {
                      href,
                      hrefLang,
                      target: linkTarget,
                      rel,
                      download,
                      ping,
                      referrerPolicy,
                      routerOptions,
                      isCurrent,
                      isLinkFocused: linkFocused,
                    },
                  ],
                  [NavigationTreeItemStateContext, { isCurrentAncestor }],
                ] as never[])
              : []),
          ]}
        >
          <For each={contentRows} by={(_: unknown, index: number) => index}>
            {(value: () => unknown, index: () => number) =>
              renderNodeAt(
                () => flatOf(state),
                () => untrack(contentKeys)[index()]!,
                value,
              ) as never
            }
          </For>
        </Provider>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------------------------
// TreeLoadMoreItem
// ---------------------------------------------------------------------------------------------

export interface TreeLoadMoreItemRenderProps {
  /** What level the tree item has within the tree. @selector [data-level] */
  level: () => number;
}

export interface TreeLoadMoreItemProps extends Omit<LoadMoreSentinelProps, "collection" | "direction">, RenderProps<TreeLoadMoreItemRenderProps> {
  /** Whether or not the loading spinner should be rendered (a value or an accessor). */
  isLoading?: MaybeAccessor<boolean | undefined>;
}

/** A sentinel row: calls `onLoadMore` when scrolled near, and renders its children while `isLoading`. */
export const TreeLoadMoreItem = /* @__PURE__ */ createLeafComponent(
  "loader",
  function TreeLoadingSentinel(props: TreeLoadMoreItemProps, ref: unknown, item: Node<unknown>) {
    const state = useContext(TreeStateContext)!;
    const internal = useContext(TreeInternalContext)!;
    const isVirtualized = useContext(CollectionRendererContext).isVirtualized;
    const key = item.key;
    const shared = internal.shared;
    const isLoading = props.isLoading;
    const sentinel = elementRef<HTMLDivElement>();
    // This collection updates whenever a row is expanded / collapsed (the flattened rows change):
    // onLoadMore may fire again; users handle repeated calls.
    loadMoreSentinel({ onLoadMore: props.onLoadMore, collection: () => flatOf(state), scrollOffset: props.scrollOffset }, sentinel);
    const level = () => {
      const v = treeStateView(state, shared);
      const node = v.collection.getItem(key);
      return node ? (treeItemProps({ node }, v).rowProps["aria-level"] as number | undefined) || 1 : 1;
    };
    const rp = untrack(() =>
      renderProps(
        { class: props.class, style: props.style, children: props.children, values: { level }, defaultClassName: "rv-TreeLoader" },
        hasLive(props) ? (liveRenderProps(props) as never) : undefined,
      ),
    );
    const hasChildren = props.children != null;
    const dom = globalDOMProps(props, ["style"]);
    return (
      <>
        {/* Always render the sentinel. For now onus is on the user for styling when using flex + gap. */}
        <div style={{ position: "relative", width: "0", height: "0" }} inert>
          <div data-testid="loadMoreSentinel" ref={sentinel} style={{ position: "absolute", height: "1px", width: "1px" }} />
        </div>
        <Show when={() => !!read(isLoading) && hasChildren}>
          {() => (
            // No aria-posinset / aria-setsize on the loader: it is not keyboard focusable.
            <div {...dom} ref={ref as never} role="row" aria-level={level()} class={rp.class()} style={rp.style()} data-level={level()}>
              <div role="gridcell" aria-colindex="1" style={isVirtualized ? { display: "contents" } : undefined}>
                {rp.children() as never}
              </div>
            </div>
          )}
        </Show>
      </>
    );
  },
);

// ---------------------------------------------------------------------------------------------
// TreeSection / TreeHeader
// ---------------------------------------------------------------------------------------------

const isServer = typeof document === "undefined";
/** react-aria `useSlotId` on the server: the id is always rendered; in the browser only while the header is. */
const slotRef = (slot: SlotId): string | undefined => (isServer ? slot.id : slotIdRef(slot));

export interface TreeSectionProps<T>
  extends SectionProps<T>, DOMRenderProps<"div", undefined>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | `data-${string}`> {
  ref?: RefValue<HTMLDivElement> | undefined;
}

/** A TreeSection represents a section within a Tree. */
export const TreeSection = /* @__PURE__ */ createBranchComponent("section", function TreeSection<
  T,
>(props: TreeSectionProps<T>, forwardedRef: unknown, item: Node<T>) {
  const state = useContext(TreeStateContext)!;
  const renderer = useContext(CollectionRendererContext);
  const customRenderer = renderer === DefaultCollectionRenderer ? null : renderer;
  // The section is read back from the collection by key: the (resumable) branch render must not capture the node.
  const sectionKey = item.key;
  const heading = createSlotId();
  const ariaLabel = props["aria-label"] ?? undefined;
  const aria = gridListSectionProps({ "aria-label": ariaLabel, headingId: heading.id });
  const labelledBy = () => (ariaLabel ? undefined : slotRef(heading));
  const dom = globalDOMProps(props, ["style", "id"]);
  const className = props.class ?? "rv-TreeSection";
  const style = props.style as Record<string, string | number | undefined> | undefined;
  if (props.render) {
    const attrs = {
      ...dom,
      ref: forwardedRef,
      role: aria.rowGroupProps.role as string,
      class: className,
      style,
      "aria-label": ariaLabel,
      "aria-labelledby": labelledBy,
      children: () => (
        <Provider
          values={[
            [GridListHeaderContext, { ...aria.rowProps }],
            [GridListHeaderInnerContext, { ...aria.rowHeaderProps, id: heading }],
          ]}
        >
          {
            (customRenderer ?? DefaultCollectionRenderer).CollectionBranch({
              collection: () => flatOf(state),
              parent: untrack(() => flatOf(state).getItem(sectionKey)) as Node<unknown>,
            }) as never
          }
        </Provider>
      ),
    };
    return props.render(attrs as never, undefined);
  }
  return (
    <div
      {...dom}
      ref={forwardedRef as never}
      role={aria.rowGroupProps.role as string}
      class={className}
      style={style}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy()}
    >
      <Provider
        values={[
          [GridListHeaderContext, { ...aria.rowProps }],
          [GridListHeaderInnerContext, { ...aria.rowHeaderProps, id: heading }],
        ]}
      >
        {
          (customRenderer ?? DefaultCollectionRenderer).CollectionBranch({
            collection: () => flatOf(state),
            parent: untrack(() => flatOf(state).getItem(sectionKey)) as Node<unknown>,
          }) as never
        }
      </Provider>
    </div>
  );
});

export interface TreeHeaderProps extends GridListHeaderProps {}

/** The header of a TreeSection (a GridListHeader with class `rv-TreeHeader`). */
export const TreeHeader = (props: TreeHeaderProps): unknown => {
  const { children, ...rest } = props;
  return (
    <GridListHeader class="rv-TreeHeader" {...rest}>
      {children as never}
    </GridListHeader>
  );
};
