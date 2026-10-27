// Ported from @react-aria/gridlist (useGridList.ts, useGridListItem.ts, useGridListSection.ts,
// useGridListSelectionCheckbox.ts, utils.ts), Apache-2.0, © Adobe.
//
// Rivet:
// - react-aria returns props bags with closures; here every hook is split into an attribute
//   function (reads state: bind its values as accessors) and handler bodies `(props, state, event)`
//   wired as explicit `onKeyDown` / `onFocusIn` / … attributes so they resume. Naming (wave-2
//   convention): `useGridList` → `gridListProps`, `useGridListItem` → `gridListItemProps`,
//   `useGridListSection` → `gridListSectionProps`, `useGridListSelectionCheckbox` →
//   `gridListSelectionCheckboxProps`; handlers `gridList<Event>` / `gridListItem<Event>(event, props, state)`.
// - `state` is a react-stately-shaped VIEW (`GridListStateLike`: collection + SelectionManager +
//   disabledKeys, plus expandedKeys / toggleKey for trees) rebuilt per event from serializable state
//   with `listStateView(listState)` / `treeStateView(treeState)`. Never capture a view in a resumable
//   closure: capture the serializable state and rebuild.
// - react-aria shares `id` / `onAction` / `linkBehavior` / … between useGridList and its items
//   through a WeakMap keyed by the state object (`listMap`). Views are rebuilt per event, so the
//   shared data rides on the view (`state.list`, produced by `gridListShared(props)`); `listMap` is
//   kept as the fallback for long-lived state objects.
// - React's post-render focus effects run synchronously at the end of the selectable-collection
//   handlers (`../selection/selectable-collection.ts` `syncFocus`); focusMode "child" moves focus from
//   the row to its first tabbable child in the row's focus handler (react-aria: same, after a frame).
// - useHighlightSelectionDescription / useGridSelectionAnnouncement / useGridSelectionCheckbox come
//   from the @react-aria/grid port (`../grid/behaviour.ts`): the grid's `aria-describedby` points at
//   `descriptionId` (render the hidden description element: `gridListHighlightDescription`), and the
//   selection announcement runs at the end of every handler that may change the selection.
import { untrack } from "@rivetjs/reactivity";
import type { Collection, DisabledBehavior, Direction, FocusStrategy, Key, KeyboardDelegate, LayoutDelegate, Node, Selection } from "../collections/types.ts";
import type { MultipleSelectionManager } from "../selection/manager.ts";
import { listCollection, listSelectionManager, resetFocusedKey, type ListState } from "../collections/list-state.ts";
import { toggleTreeKey, treeCollection, treeSelectionManager, type TreeState } from "../collections/tree-state.ts";
import {
  selectableListBlur,
  selectableListFocus,
  selectableListKeyDown,
  selectableListKeyDownCapture,
  selectableListMouseDown,
  selectableListOptions,
  type AriaSelectableListOptions,
} from "../selection/selectable-list.ts";
import { collectionTabIndex, selectableCollectionAutoFocus, selectableCollectionKeys } from "../selection/selectable-collection.ts";
import {
  selectableItemAttrs,
  selectableItemClick,
  selectableItemDoubleClick,
  selectableItemDragStart,
  selectableItemFocus,
  selectableItemKeyDown,
  selectableItemKeyUp,
  selectableItemPointerCancel,
  selectableItemPointerDown,
  selectableItemPointerUp,
  selectableItemStates,
  type SelectableItemOptions,
  type SelectableItemStates,
} from "../selection/selectable-item.ts";
import { refElement, type RefLike } from "../selection/utils.ts";
import { focusSafely, getFocusableTreeWalker } from "../focus/index.ts";
import { getItemElement } from "../_adapters/dom-collection.ts";
import { isFocusVisible } from "../interactions/focus-visible.tsx";
import {
  getActiveElement,
  getEventTarget,
  getOwnerDocument,
  getScrollParent,
  isFocusWithin,
  nodeContains,
  scrollIntoViewport,
  cssEscape,
} from "../utils/dom.ts";
import { syntheticLinkAttrs, type LinkDOMProps, type Router } from "../utils/links.tsx";
import { direction as elementDirection } from "../bidi/index.ts";
import { resumedId } from "../utils/id.ts";
import {
  gridSelectionAnnouncement,
  gridSelectionCheckboxChange,
  gridSelectionCheckboxProps,
  highlightSelectionDescription,
  highlightSelectionDescriptionProps,
  type AriaGridSelectionCheckboxProps,
  type GridSelectionCheckboxProps,
} from "../grid/behaviour.ts";
import type { SelectionManager } from "../selection/manager.ts";

// --- shared state (utils.ts) ---------------------------------------------------------------------

/** Data shared between useGridList, useGridListItem and useGridListSelectionCheckbox (react-aria `listMap` value). */
export interface GridListShared {
  id: string;
  onAction?: ((key: Key) => void) | undefined;
  linkBehavior?: "action" | "selection" | "override" | undefined;
  keyboardNavigationBehavior: "arrow" | "tab";
  shouldSelectOnPressUp?: boolean | undefined;
}

/**
 * A react-stately ListState / TreeState as the gridlist hooks read it. Build one per event with
 * `listStateView` / `treeStateView` (Rivet: collection + SelectionManager are class instances).
 */
export interface GridListStateLike<T = unknown> {
  readonly collection: Collection<Node<T>>;
  readonly selectionManager: MultipleSelectionManager;
  readonly disabledKeys: Set<Key>;
  /** TreeState only: the expanded keys. */
  readonly expandedKeys?: Set<Key> | undefined;
  /** TreeState only: toggles the expanded state of a key. */
  readonly toggleKey?: ((key: Key) => void) | undefined;
  /** Rivet: the data `useGridList` shares with its items (react-aria `listMap.get(state)`). */
  readonly list?: GridListShared | undefined;
}

/** react-aria `listMap`: shared gridlist data per (long-lived) state object. */
export const listMap: WeakMap<object, GridListShared> = new WeakMap();

function sharedOf(state: GridListStateLike<any>): GridListShared {
  const shared = state.list ?? listMap.get(state);
  if (!shared) throw new Error("Unknown list");
  return shared;
}

/** The row id of `key` (`<list id>-<normalized key>`). */
export function getRowId(state: GridListStateLike<any>, key: Key): string {
  const { id } = state.list ?? listMap.get(state) ?? ({} as Partial<GridListShared>);
  if (!id) throw new Error("Unknown list");
  return `${id}-${normalizeKey(key)}`;
}

/** Strips whitespace from string keys (ids must not contain spaces). */
export function normalizeKey(key: Key): string {
  if (typeof key === "string") return key.replace(/\s*/g, "");
  return "" + key;
}

/**
 * A gridlist view over a serializable `@rivetjs/cdk/collections/list-state` state (reads state).
 * `root`: the grid element of a live collection (default: the element with id `state.id`).
 */
export function listStateView<T>(state: ListState<T>, list?: GridListShared, root?: Element | null): GridListStateLike<T> {
  const collection = listCollection(state, root);
  return { collection, selectionManager: listSelectionManager(state, collection), disabledKeys: state.disabledKeys, list };
}

/** A gridlist view over a serializable `@rivetjs/cdk/collections/tree-state` state (reads state). */
export function treeStateView<T>(state: TreeState<T>, list?: GridListShared): GridListStateLike<T> {
  const collection = treeCollection(state);
  return {
    collection,
    selectionManager: treeSelectionManager(state, collection),
    disabledKeys: state.disabledKeys,
    expandedKeys: state.expandedKeys(),
    toggleKey: (key) => toggleTreeKey(state, key),
    list,
  };
}

// --- useGridList ---------------------------------------------------------------------------------

export interface AriaGridListOptions {
  /** The element's unique identifier (row ids derive from it). */
  id?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-details"?: string | undefined;
  /** Whether to auto focus the gridlist or an option. */
  autoFocus?: boolean | FocusStrategy | undefined;
  /** Handler that is called when a user performs an action on an item. */
  onAction?: ((key: Key) => void) | undefined;
  /** Whether `disabledKeys` applies to all interactions, or only selection. Default "all". */
  disabledBehavior?: DisabledBehavior | undefined;
  /** Whether selection should occur on press up instead of press down. */
  shouldSelectOnPressUp?: boolean | undefined;
  /** Whether keyboard navigation to focusable elements within items is via arrow keys or Tab. Default "arrow". */
  keyboardNavigationBehavior?: "arrow" | "tab" | undefined;
  /** Whether pressing Escape clears the selection. Default "clearSelection". */
  escapeKeyBehavior?: "clearSelection" | "none" | undefined;
  /** Whether the list uses virtual scrolling. */
  isVirtualized?: boolean | undefined;
  /** Whether typeahead navigation is disabled. */
  disallowTypeAhead?: boolean | undefined;
  /** An optional keyboard delegate implementation for type to select. */
  keyboardDelegate?: KeyboardDelegate | undefined;
  /** A delegate object that provides layout information for items (default: the DOM). */
  layoutDelegate?: LayoutDelegate | undefined;
  /** Whether focus should wrap around when the end/start is reached. */
  shouldFocusWrap?: boolean | undefined;
  /** The behavior of links in the collection. Default "action". */
  linkBehavior?: "action" | "selection" | "override" | undefined;
  /** @private Which item to focus when tabbing into the collection. */
  UNSTABLE_focusOnEntry?: "first" | "last" | undefined;
  /** Rivet: the list element (handlers default to `event.currentTarget`). */
  ref?: RefLike;
  /** Rivet: reading direction (default: computed from the element). */
  direction?: Direction | undefined;
  /** Rivet: typeahead collator locale (default: document language). */
  locale?: string | undefined;
  /** Rivet: list orientation for the keyboard delegate (RAC GridList `orientation`). */
  orientation?: "vertical" | "horizontal" | undefined;
  /** Rivet: id of the hidden highlight-selection description element (react-aria `useDescription`). */
  descriptionId?: string | undefined;
  /** Rivet: text of announced rows (react-aria `useGridSelectionAnnouncement` `getRowText`). */
  getRowText?: ((key: Key) => string) | undefined;
}

export interface GridListAria {
  /** Props for the grid element. */
  gridProps: Record<string, unknown>;
}

/** The data `useGridList` shares with its items. Call once per list (component body); pass to the views. */
export function gridListShared(props: AriaGridListOptions): GridListShared {
  return {
    id: props.id || resumedId(),
    onAction: props.onAction,
    linkBehavior: props.linkBehavior ?? "action",
    keyboardNavigationBehavior: props.keyboardNavigationBehavior ?? "arrow",
    shouldSelectOnPressUp: props.shouldSelectOnPressUp,
  };
}

function selectableOptions(props: AriaGridListOptions, state: GridListStateLike<any>): AriaSelectableListOptions {
  return {
    selectionManager: state.selectionManager,
    collection: state.collection as Collection<Node<unknown>>,
    disabledKeys: state.disabledKeys,
    ref: props.ref,
    keyboardDelegate: props.keyboardDelegate,
    layoutDelegate: props.layoutDelegate,
    isVirtualized: props.isVirtualized,
    selectOnFocus: state.selectionManager.selectionBehavior === "replace",
    shouldFocusWrap: props.shouldFocusWrap,
    linkBehavior: props.linkBehavior ?? "action",
    disallowTypeAhead: props.disallowTypeAhead,
    autoFocus: props.autoFocus,
    escapeKeyBehavior: props.escapeKeyBehavior ?? "clearSelection",
    UNSTABLE_focusOnEntry: props.UNSTABLE_focusOnEntry,
    direction: props.direction,
    locale: props.locale,
    orientation: props.orientation,
  };
}

/**
 * Attributes of the grid element: role, id, aria-multiselectable, labelling, tabIndex (roving; an
 * empty grid is tabbable unless it holds a tabbable child), virtualized row / col counts. Reads
 * state: bind values as accessors. `hasTabbableChild` = react-aria `useHasTabbableChild` (empty state).
 */
function gridListAttrs(props: AriaGridListOptions, state: GridListStateLike<any>, hasTabbableChild = false): Record<string, unknown> {
  const shared = sharedOf(state);
  const manager = state.selectionManager;
  const attrs: Record<string, unknown> = {
    role: "grid",
    id: shared.id,
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": props["aria-describedby"],
    "aria-details": props["aria-details"],
    "aria-multiselectable": manager.selectionMode === "multiple" ? "true" : undefined,
    // Rivet: the navigation keys, held by the resume loader while a cold chunk loads (a cold arrow never scrolls).
    "data-rk": selectableCollectionKeys,
    // If the collection is empty, make sure the grid is tabbable unless there is a child tabbable element.
    tabIndex: state.collection.size === 0 ? (hasTabbableChild ? -1 : 0) : collectionTabIndex(manager),
  };
  const description = highlightSelectionDescriptionProps({
    selectionManager: manager,
    hasItemActions: !!shared.onAction,
    locale: props.locale,
    descriptionId: props.descriptionId,
  })["aria-describedby"];
  if (description) attrs["aria-describedby"] = [props["aria-describedby"], description].filter(Boolean).join(" ");
  if (props.isVirtualized) {
    attrs["aria-rowcount"] = state.collection.size;
    attrs["aria-colcount"] = 1;
  }
  return attrs;
}

type Ev<E extends Event> = E & { currentTarget: EventTarget | null };

/** Runs a handler body, then announces the selection change (react-aria `useGridSelectionAnnouncement` effect). */
function announced<R>(
  state: GridListStateLike<any>,
  props: { locale?: string | undefined; getRowText?: ((key: Key) => string) | undefined },
  body: () => R,
): R {
  const manager = state.selectionManager as SelectionManager;
  const last = untrack(() => manager.rawSelection);
  const result = body();
  gridSelectionAnnouncement({ locale: props.locale, getRowText: props.getRowText }, { collection: state.collection, selectionManager: manager }, last);
  return result;
}

/**
 * Text of the hidden highlight-selection description element (react-aria
 * `useHighlightSelectionDescription`; render `<div id={descriptionId} hidden>{text}</div>` when set).
 */
export function gridListHighlightDescription(props: AriaGridListOptions, state: GridListStateLike<any>): string | undefined {
  return highlightSelectionDescription({ selectionManager: state.selectionManager, hasItemActions: !!sharedOf(state).onAction, locale: props.locale });
}

/** keydown (capture) on the grid element. */
export const gridListKeyDownCapture = (e: Ev<KeyboardEvent>, props: AriaGridListOptions, state: GridListStateLike<any>): boolean =>
  state.collection.size === 0 ? false : selectableListKeyDownCapture(selectableOptions(props, state), e);
/** keydown on the grid element (row navigation, typeahead, select all, Escape, Tab out). */
export const gridListKeyDown = (e: Ev<KeyboardEvent>, props: AriaGridListOptions, state: GridListStateLike<any>): boolean =>
  state.collection.size === 0 ? false : announced(state, props, () => selectableListKeyDown(selectableOptions(props, state), e));
/** focusin on the grid element. */
export const gridListFocus = (e: Ev<FocusEvent>, props: AriaGridListOptions, state: GridListStateLike<any>): void => {
  if (state.collection.size !== 0) selectableListFocus(selectableOptions(props, state), e);
};
/** focusout on the grid element. */
export const gridListBlur = (e: Ev<FocusEvent>, props: AriaGridListOptions, state: GridListStateLike<any>): void => {
  if (state.collection.size !== 0) selectableListBlur(selectableOptions(props, state), e);
};
/** mousedown on the grid element. */
export const gridListMouseDown = (e: Ev<MouseEvent>, props: AriaGridListOptions, state: GridListStateLike<any>): void => {
  if (state.collection.size !== 0) selectableListMouseDown(selectableOptions(props, state), e);
};

/**
 * react-aria's `autoFocus` mount effect (useSelectableCollection): call once the grid element
 * (`props.ref`) is connected, e.g. from a `clientEffect`; returns false while it still waits for items.
 */
export function gridListAutoFocus(props: AriaGridListOptions, state: GridListStateLike<any>): boolean {
  return selectableCollectionAutoFocus(selectableListOptions(selectableOptions(props, state))) && state.collection.size > 0;
}

/**
 * Provides the behavior and accessibility implementation for a list component with interactive
 * children (react-aria `useGridList` → `gridListProps`). Returns the grid element's attributes
 * (bind values as accessors); wire the `gridList<Event>(event, props, state)` handlers on the same
 * element. `state.list` (or `listMap`) must carry the `gridListShared(props)` data.
 */
export function gridListProps(props: AriaGridListOptions, state: GridListStateLike<any>, hasTabbableChild = false): GridListAria {
  return { gridProps: gridListAttrs(props, state, hasTabbableChild) };
}

// --- useGridListItem -----------------------------------------------------------------------------

export interface AriaGridListItemOptions {
  /** The node of the row. */
  node: Node<unknown>;
  /** Whether the list row is contained in a virtual scroller. */
  isVirtualized?: boolean | undefined;
  /** Whether selection should occur on press up instead of press down. */
  shouldSelectOnPressUp?: boolean | undefined;
  /** Whether this item has children, even if not loaded yet. */
  hasChildItems?: boolean | undefined;
  /** Whether the row or its first focusable child element should be focused when the row is focused. Default "row". */
  focusMode?: "child" | "row" | undefined;
  /** Whether the row supports arrow key navigation even when the collection uses Tab navigation. */
  allowsArrowNavigation?: boolean | undefined;
  /** Rivet: the row element (handlers default to `event.currentTarget`). */
  ref?: RefLike;
  /** Rivet: reading direction (default: computed from the row). */
  direction?: Direction | undefined;
  /** Rivet: id of the row's description element (react-aria `useSlotId`; set when a description slot renders). */
  descriptionId?: string | undefined;
  /** Rivet: router for synthetic link attributes (RouterContext value). */
  router?: Router | undefined;
  /** Rivet: locale of the selection announcement. */
  locale?: string | undefined;
  /** Rivet: text of announced rows (default: the node's textValue). */
  getRowText?: ((key: Key) => string) | undefined;
}

export interface GridListItemAria extends SelectableItemStates {
  /** Props for the list row element. */
  rowProps: Record<string, unknown>;
  /** Props for the grid cell element within the list row. */
  gridCellProps: Record<string, unknown>;
  /** Props for the list item description element, if any. */
  descriptionProps: Record<string, unknown>;
}

const EXPANSION_KEYS = { expand: { ltr: "ArrowRight", rtl: "ArrowLeft" }, collapse: { ltr: "ArrowLeft", rtl: "ArrowRight" } } as const;

const rowOf = (props: AriaGridListItemOptions, e?: Event): HTMLElement | null => refElement(props.ref) ?? ((e?.currentTarget as HTMLElement | null) || null);
const dirOf = (props: AriaGridListItemOptions, row: Element | null): Direction => props.direction ?? (row ? elementDirection(row) : "ltr");

function getDirectChildren<T>(parent: Node<T>, collection: Collection<Node<T>>): Node<T>[] {
  // A tree built from hooks may lack firstChildKey: start at the first child and walk siblings.
  const children = collection.getChildren?.(parent.key);
  const childArray = children ? Array.from(children) : [];
  let node: Node<T> | null = childArray.length > 0 ? childArray[0] : null;
  const siblings: Node<T>[] = [];
  while (node) {
    siblings.push(node);
    node = node.nextKey != null ? collection.getItem(node.nextKey) : null;
  }
  return siblings;
}

// Rivet: tree set sizes per committed collection (upstream recounts the siblings for every row: O(n²) per
// tree mount, O(n) per row re-run). Entry = [item count, first child is an item]; key TOP = top level.
// An uncommitted BaseCollection (`isFrozen === false`) may still change: not cached.
const TOP: unique symbol = Symbol();
type SetSizes = Map<Key | typeof TOP, [number, boolean]>;
const setSizes = new WeakMap<object, SetSizes>();
function setSizesOf(collection: Collection<Node<unknown>>): SetSizes | undefined {
  if ((collection as { isFrozen?: boolean }).isFrozen === false) return undefined;
  let sizes = setSizes.get(collection);
  if (sizes === undefined) setSizes.set(collection, (sizes = new Map()));
  return sizes;
}

interface ItemDerived {
  shared: GridListShared;
  hasChildRows: boolean | undefined;
  onAction: (() => void) | undefined;
  treeAttrs: Record<string, unknown>;
}

function deriveItem(props: AriaGridListItemOptions, state: GridListStateLike<any>): ItemDerived {
  const { node } = props;
  const shared = sharedOf(state);
  let onAction = shared.onAction;
  let hasChildRows = props.hasChildItems;
  const hasLink = state.selectionManager.isLink(node.key);
  let treeAttrs: Record<string, unknown> = {};
  let toggle: (() => void) | undefined;
  if (node != null && state.expandedKeys) {
    // TODO (upstream): node.hasChildNodes is always true because of the row's content node.
    const children = state.collection.getChildren?.(node.key);
    hasChildRows = hasChildRows || [...(children ?? [])].length > 1;
    if (onAction == null && !hasLink && state.selectionManager.selectionMode === "none" && hasChildRows) toggle = () => state.toggleKey?.(node.key);
    const isExpanded = hasChildRows ? state.expandedKeys.has(node.key) : undefined;
    let setSize = 1;
    let index = node.index;
    const sizes = setSizesOf(state.collection);
    if (node.level >= 0 && node.parentKey != null) {
      const parent = state.collection.getItem(node.parentKey);
      if (parent) {
        let entry = sizes?.get(parent.key);
        if (entry === undefined) {
          const siblings = getDirectChildren(parent, state.collection);
          entry = [siblings.filter((row) => row.type === "item").length, siblings[0]?.type === "item"];
          sizes?.set(parent.key, entry);
        }
        setSize = entry[0];
        if (index > 0 && !entry[1]) index -= 1; // the parent item's content node
      }
    } else {
      let entry = sizes?.get(TOP);
      if (entry === undefined) {
        entry = [[...state.collection].filter((row) => row.level === 0 && row.type === "item").length, true];
        sizes?.set(TOP, entry);
      }
      setSize = entry[0];
    }
    treeAttrs = { "aria-expanded": isExpanded, "aria-level": node.level + 1, "aria-posinset": index + 1, "aria-setsize": setSize };
  }
  const nodeAction = node.props?.onAction as (() => void) | undefined;
  const listAction = onAction ? () => onAction!(node.key) : toggle;
  const action = nodeAction || listAction ? () => (nodeAction?.(), listAction?.()) : undefined;
  return { shared, hasChildRows, onAction: action, treeAttrs };
}

function itemOptions(props: AriaGridListItemOptions, state: GridListStateLike<any>, d: ItemDerived, e?: Event): SelectableItemOptions {
  const row = rowOf(props, e);
  return {
    selectionManager: state.selectionManager,
    key: props.node.key,
    ref: row,
    isVirtualized: props.isVirtualized,
    shouldSelectOnPressUp: props.shouldSelectOnPressUp || d.shared.shouldSelectOnPressUp,
    onAction: d.onAction,
    focus: () => focusRow(props, row),
    linkBehavior: d.shared.linkBehavior,
    router: props.router,
    // RA collectionItemProps: the item's own onPress* / onClick / link props (the node's props).
    itemProps: props.node.props as SelectableItemOptions["itemProps"],
  };
}

// The key of the item at the time its row was last focused (a virtualizer reuses DOM nodes).
const keyWhenFocused = new WeakMap<Element, Key>();

/** Focus the row (focusMode "child": its first tabbable child) — react-aria's item `focus()`. */
export function focusRow(props: AriaGridListItemOptions, row: HTMLElement | null): void {
  if (row === null) return;
  if (props.focusMode === "child") {
    // Focus already on a focusable child within the row: don't shift it.
    if (isFocusWithin(row) && row !== getActiveElement(getOwnerDocument(row))) return;
    const walker = getFocusableTreeWalker(row, { tabbable: true });
    const focusable = walker.firstChild() as HTMLElement | null;
    if (focusable) {
      focusSafely(focusable);
      scrollIntoViewport(focusable, { containingElement: getScrollParent(focusable) });
      return;
    }
  }
  // Don't shift focus to the row if the active element is within the row already (a row button).
  const last = keyWhenFocused.get(row);
  if ((last != null && props.node.key !== last) || !isFocusWithin(row)) focusSafely(row);
}

/** Item state flags (react-aria `useGridListItem` states). Reads state: use in bindings. */
function gridListItemStates(props: AriaGridListItemOptions, state: GridListStateLike<any>): SelectableItemStates {
  return selectableItemStates(itemOptions(props, state, deriveItem(props, state)));
}

/**
 * Attributes of the row element: role row, id, aria-selected / -disabled / -label / -labelledby,
 * roving tabIndex, data-key, synthetic link `data-href…` when the row has an action, tree
 * aria-expanded / -level / -posinset / -setsize, virtualized aria-rowindex. Reads state.
 */
function gridListItemAttrs(props: AriaGridListItemOptions, state: GridListStateLike<any>): Record<string, unknown> {
  const { node } = props;
  const d = deriveItem(props, state);
  const manager = state.selectionManager;
  const options = itemOptions(props, state, d);
  const states = selectableItemStates(options);
  const rowId = getRowId(state, node.key);
  const label = (node as Node<unknown> & { "aria-label"?: string })["aria-label"] || node.textValue || undefined;
  const attrs: Record<string, unknown> = {
    ...selectableItemAttrs(options),
    ...(states.hasAction ? syntheticLinkAttrs((node.props ?? {}) as LinkDOMProps, props.router) : {}),
    role: "row",
    "aria-label": label,
    "aria-selected": manager.canSelectItem(node.key) ? manager.isSelected(node.key) : undefined,
    "aria-disabled": manager.isDisabled(node.key) || undefined,
    "aria-labelledby": props.descriptionId && label ? `${rowId} ${props.descriptionId}` : undefined,
    id: rowId,
  };
  if (props.focusMode === "child" && props.allowsArrowNavigation && d.shared.keyboardNavigationBehavior === "tab") attrs.tabIndex = -1;
  if (props.isVirtualized) attrs["aria-rowindex"] = gridListRowIndex(state.collection, node.key, node.index);
  return { ...attrs, ...d.treeAttrs };
}

const rowIndexes = new WeakMap<object, Map<Key, number> | null>();

/**
 * useGridListItem (virtualized) `aria-rowindex` of `key`: `node.index + 1`, or with sections its 1-based position
 * among the collection's non-section keys. Rivet: the section scan is cached per committed collection (a virtualized
 * GridList's rows each ask; upstream rescans per row).
 */
export function gridListRowIndex(collection: Collection<Node<unknown>>, key: Key, index = collection.getItem(key)?.index ?? 0): number {
  let keys = rowIndexes.get(collection);
  if (keys === undefined) {
    keys = null;
    for (const n of collection)
      if (n.type === "section") {
        keys = new Map();
        for (const k of collection.getKeys()) if (collection.getItem(k)?.type !== "section") keys.set(k, keys.size + 1);
        break;
      }
    if ((collection as { isFrozen?: boolean }).isFrozen !== false) rowIndexes.set(collection, keys);
  }
  return keys ? (keys.get(key) ?? 0) : index + 1;
}

/** Attributes of the grid cell inside the row. */
const gridListCellAttrs = (): Record<string, unknown> => ({ role: "gridcell", "aria-colindex": 1 });

function handleTreeExpansionKeys(
  e: KeyboardEvent,
  state: GridListStateLike<any>,
  node: Node<unknown>,
  hasChildRows: boolean | undefined,
  direction: Direction,
  activeElement: Element | null,
  row: Element | null,
  allowsArrowNavigation: boolean | undefined,
): boolean {
  if (!state.expandedKeys || (!allowsArrowNavigation && activeElement !== row)) return false;
  const manager = state.selectionManager;
  const focusedKey = untrack(() => manager.focusedKey);
  if (e.key === EXPANSION_KEYS.expand[direction] && focusedKey === node.key && hasChildRows && !state.expandedKeys.has(node.key)) {
    state.toggleKey?.(node.key);
    e.stopPropagation();
    return true;
  } else if (e.key === EXPANSION_KEYS.collapse[direction] && focusedKey === node.key) {
    // If the item is collapsible, collapse it; else move to the parent.
    if (hasChildRows && state.expandedKeys.has(node.key)) {
      state.toggleKey?.(node.key);
      e.stopPropagation();
      return true;
    } else if (!state.expandedKeys.has(node.key) && node.parentKey != null && state.collection.getItem(node.parentKey)?.type === "item") {
      manager.setFocusedKey(node.parentKey);
      // RA useSelectableItem focuses the row when focusedKey changes; here the grid handlers never see this
      // (propagation stopped), so move DOM focus to the parent row directly.
      const grid = row?.closest('[role="treegrid"],[role="grid"]');
      const collectionId = row?.getAttribute("data-collection");
      const parentRow = collectionId
        ? grid?.querySelector<HTMLElement>(`[data-collection="${cssEscape(collectionId)}"][data-key="${cssEscape(String(node.parentKey))}"]`)
        : getItemElement(grid, node.parentKey);
      if (parentRow) focusSafely(parentRow);
      e.stopPropagation();
      return true;
    }
  }
  return false;
}

function lastOf(walker: TreeWalker): HTMLElement | null {
  let next: HTMLElement | null = null;
  let last: HTMLElement | null;
  do {
    last = walker.lastChild() as HTMLElement | null;
    if (last) next = last;
  } while (last);
  return next;
}

/**
 * keydown (capture) on the row: Left / Right move between focusable children (arrow
 * keyboardNavigationBehavior, RTL aware) and back to the row; tree expand / collapse; Up / Down
 * from a child are re-dispatched from the row's parent so row navigation handles them. Wire it
 * when `keyboardNavigationBehavior === "arrow"` or `allowsArrowNavigation`.
 */
export function gridListItemKeyDownCapture(e: Ev<KeyboardEvent>, props: AriaGridListItemOptions, state: GridListStateLike<any>): void {
  const row = rowOf(props, e);
  const activeElement = row ? getActiveElement(getOwnerDocument(row)) : null;
  if (!nodeContains(e.currentTarget as Element, getEventTarget(e) as Element) || !row || !activeElement) return;
  const d = deriveItem(props, state);
  const direction = dirOf(props, row);
  const walker = getFocusableTreeWalker(row);
  walker.currentNode = activeElement;
  if (handleTreeExpansionKeys(e, state, props.node, d.hasChildRows, direction, activeElement, row, props.allowsArrowNavigation)) return;
  const arrow = d.shared.keyboardNavigationBehavior === "arrow";
  const moveWithin = (forwardInRtl: boolean, backToRowDir: Direction) => {
    const focusable = (forwardInRtl ? walker.nextNode() : walker.previousNode()) as HTMLElement | null;
    e.preventDefault();
    e.stopPropagation();
    if (focusable) {
      focusSafely(focusable);
      scrollIntoViewport(focusable, { containingElement: getScrollParent(row) });
    } else if (direction === backToRowDir) {
      // No next focusable child: return focus to the row.
      focusSafely(row);
      scrollIntoViewport(row, { containingElement: getScrollParent(row) });
    } else {
      walker.currentNode = row;
      const lastElement = lastOf(walker);
      if (lastElement) {
        focusSafely(lastElement);
        scrollIntoViewport(lastElement, { containingElement: getScrollParent(row) });
      }
    }
  };
  switch (e.key) {
    case "ArrowLeft":
      if (arrow) moveWithin(direction === "rtl", "rtl");
      break;
    case "ArrowRight":
      if (arrow) moveWithin(direction !== "rtl", "ltr");
      break;
    case "ArrowUp":
    case "ArrowDown":
      // Keep arrow keys from row children (menu buttons): re-dispatch from a higher parent so the
      // event still bubbles to the selectable collection.
      if (!e.altKey && nodeContains(row, getEventTarget(e) as Element)) {
        e.stopPropagation();
        e.preventDefault();
        row.parentElement?.dispatchEvent(new KeyboardEvent(e.type, e));
      }
      break;
  }
}

/**
 * keydown on the row: Tab navigation between children ("tab" behavior), tree expansion keys, then
 * the selectable item's Space / Enter press unless propagation was stopped.
 */
export function gridListItemKeyDown(e: Ev<KeyboardEvent>, props: AriaGridListItemOptions, state: GridListStateLike<any>): void {
  const row = rowOf(props, e);
  const activeElement = row ? getActiveElement(getOwnerDocument(row)) : null;
  const d = deriveItem(props, state);
  let stopped = false;
  const stop = () => {
    stopped = true;
    e.stopPropagation();
  };
  if (nodeContains(e.currentTarget as Element, getEventTarget(e) as Element) && row && activeElement) {
    if (d.shared.keyboardNavigationBehavior === "tab") {
      // Events from the item's children never reach grid-level interactions (row navigation,
      // typeahead); Tab still propagates so the collection can tab out of the gridlist.
      if (getEventTarget(e) !== row && e.key !== "Tab") return void stop();
      const direction = dirOf(props, row);
      const before = e.cancelBubble;
      if (handleTreeExpansionKeys(e, state, props.node, d.hasChildRows, direction, activeElement, row, props.allowsArrowNavigation)) return;
      stopped = e.cancelBubble && !before;
    }
    if (e.key === "Tab" && d.shared.keyboardNavigationBehavior === "tab") {
      // Another focusable element in this item: let the browser handle Tab.
      const walker = getFocusableTreeWalker(row, { tabbable: true });
      walker.currentNode = activeElement;
      const next = e.shiftKey ? walker.previousNode() : walker.nextNode();
      if (next) stop();
    }
  }
  if (!stopped && !e.cancelBubble) announced(state, props, () => selectableItemKeyDown(itemOptions(props, state, d, e), e));
}

/** keyup on the row (keyboard press end). */
export const gridListItemKeyUp = (e: Ev<KeyboardEvent>, props: AriaGridListItemOptions, state: GridListStateLike<any>): void =>
  announced(state, props, () => selectableItemKeyUp(itemOptions(props, state, deriveItem(props, state), e), e));

/**
 * focusin on the row: a focused child makes the row the focused key (unless focus is visible:
 * keyboard users return to the previously focused row); focusMode "child" moves focus from the row
 * to its first tabbable child.
 */
export function gridListItemFocus(e: Ev<FocusEvent>, props: AriaGridListItemOptions, state: GridListStateLike<any>): void {
  const row = rowOf(props, e);
  if (!row) return;
  keyWhenFocused.set(row, props.node.key);
  if (getEventTarget(e) !== row) {
    if (!isFocusVisible()) state.selectionManager.setFocusedKey(props.node.key);
    return;
  }
  selectableItemFocus(itemOptions(props, state, deriveItem(props, state), e), e);
  // Focus came back to the row from a child in focusMode "child": don't trap it.
  if (props.focusMode === "child" && e.relatedTarget && nodeContains(row, e.relatedTarget as Element)) return;
  if (props.focusMode === "child")
    requestAnimationFrame(() => {
      if (getActiveElement(getOwnerDocument(row)) === row) focusRow(props, row);
    });
}

/** pointerdown on the row. */
export const gridListItemPointerDown = (e: Ev<PointerEvent>, props: AriaGridListItemOptions, state: GridListStateLike<any>): void =>
  announced(state, props, () => selectableItemPointerDown(itemOptions(props, state, deriveItem(props, state), e), e));
/** pointerup on the row. */
export const gridListItemPointerUp = (e: Ev<PointerEvent>, props: AriaGridListItemOptions, state: GridListStateLike<any>): void =>
  announced(state, props, () => selectableItemPointerUp(itemOptions(props, state, deriveItem(props, state), e), e));
/** pointercancel / pointerleave on the row. */
export const gridListItemPointerCancel = (e: Ev<PointerEvent>, props: AriaGridListItemOptions, state: GridListStateLike<any>): void =>
  selectableItemPointerCancel(itemOptions(props, state, deriveItem(props, state), e), e);
/** click on the row (the press). */
export const gridListItemClick = (e: Ev<MouseEvent>, props: AriaGridListItemOptions, state: GridListStateLike<any>): void =>
  announced(state, props, () => selectableItemClick(itemOptions(props, state, deriveItem(props, state), e), e));
/** dblclick on the row (secondary action with selectionBehavior "replace"). */
export const gridListItemDoubleClick = (e: Ev<MouseEvent>, props: AriaGridListItemOptions, state: GridListStateLike<any>): void =>
  announced(state, props, () => selectableItemDoubleClick(itemOptions(props, state, deriveItem(props, state), e), e));
/** dragstart on the row. */
export const gridListItemDragStart = (e: Ev<DragEvent>, props: AriaGridListItemOptions, state: GridListStateLike<any>): void =>
  selectableItemDragStart(itemOptions(props, state, deriveItem(props, state), e), e);

/**
 * Provides the behavior and accessibility implementation for a row in a grid list (react-aria
 * `useGridListItem` → `gridListItemProps`): row / grid cell / description attributes + item states
 * (reads state: bind as accessors). Wire `gridListItem<Event>(event, props, state)` on the row;
 * `gridListItemKeyDownCapture` only when `keyboardNavigationBehavior === "arrow"` or `allowsArrowNavigation`.
 */
export function gridListItemProps(props: AriaGridListItemOptions, state: GridListStateLike<any>): GridListItemAria {
  return {
    rowProps: gridListItemAttrs(props, state),
    gridCellProps: gridListCellAttrs(),
    descriptionProps: { id: props.descriptionId },
    ...gridListItemStates(props, state),
  };
}

// --- useGridListSection --------------------------------------------------------------------------

export interface AriaGridListSectionProps {
  /** An accessibility label for the section. Required if `heading` is not present. */
  "aria-label"?: string | undefined;
  /** Rivet: id of the section heading (react-aria `useSlotId`; omit when no header renders). */
  headingId?: string | undefined;
}

export interface GridListSectionAria {
  /** Props for the wrapper list item. */
  rowProps: Record<string, unknown>;
  /** Props for the heading element, if any. */
  rowHeaderProps: Record<string, unknown>;
  /** Props for the grid's row group element. */
  rowGroupProps: Record<string, unknown>;
}

/** Provides the behavior and accessibility implementation for a section in a grid list (react-aria `useGridListSection` → `gridListSectionProps`). */
export function gridListSectionProps(props: AriaGridListSectionProps, _state?: GridListStateLike<any>): GridListSectionAria {
  const { "aria-label": ariaLabel, headingId } = props;
  // useLabels: aria-labelledby = heading (+ own id when also aria-label'd — react-aria has no id here).
  const labelledBy = headingId ? (ariaLabel ? undefined : headingId) : undefined;
  return {
    rowProps: { role: "row" },
    rowHeaderProps: { id: headingId, role: "rowheader" },
    rowGroupProps: { role: "rowgroup", "aria-label": ariaLabel, "aria-labelledby": labelledBy },
  };
}

// --- useGridListSelectionCheckbox ----------------------------------------------------------------

export interface GridSelectionCheckboxAria {
  /** Props for the row selection checkbox element (RAC Checkbox props; `onChange` → `gridListSelectionCheckboxChange`). */
  checkboxProps: GridSelectionCheckboxProps & { "aria-labelledby": string };
}

/**
 * Provides the behavior and accessibility implementation for a selection checkbox in a grid list
 * (react-aria `useGridListSelectionCheckbox` → `gridListSelectionCheckboxProps`). Reads state.
 */
export function gridListSelectionCheckboxProps(props: AriaGridSelectionCheckboxProps, state: GridListStateLike<any>): GridSelectionCheckboxAria {
  const checkboxProps = gridSelectionCheckboxProps(props, state);
  return { checkboxProps: { ...checkboxProps, "aria-labelledby": `${checkboxProps.id} ${getRowId(state, props.key)}` } };
}

/** The selection checkbox `onChange`: toggles the row's selection (announced). */
export function gridListSelectionCheckboxChange(
  isSelected: boolean,
  props: AriaGridSelectionCheckboxProps & { getRowText?: (key: Key) => string },
  state: GridListStateLike<any>,
): void {
  announced(state, props, () => gridSelectionCheckboxChange(isSelected, props, state));
}

export type { AriaGridSelectionCheckboxProps };
export type { Selection };

/**
 * After the rendered items changed (live mode): react-stately `useFocusedKeyReset` (a removed focused
 * item hands the focused key to the next / previous enabled item of the previous collection) + the
 * react-aria focus effects that follow it (useSelectableItem focuses the new focused row;
 * useSelectableCollection focuses the collection when the focused key became null). `previous` is the
 * snapshot returned by the last call; call from a client effect after the DOM updated.
 */
export function gridListItemsChanged<T>(state: ListState<T>, root: HTMLElement, previous: Collection<Node<T>> | undefined): Collection<Node<T>> {
  const current = listCollection(state, root);
  if (!previous) return current;
  const manager = listSelectionManager(state, current);
  const before = untrack(() => manager.focusedKey);
  resetFocusedKey(state, previous, current);
  const after = untrack(() => manager.focusedKey);
  // Chromium fires focusout when the focused row is removed (React does not see it), which clears
  // `isFocused`: focus that fell back to the body still counts as being in the collection.
  const doc = root.ownerDocument;
  const active = doc.activeElement;
  const wasFocused = untrack(() => manager.isFocused) || active == null || active === doc.body;
  if (after !== before && wasFocused) {
    if (after != null) {
      const row = getItemElement(root, after);
      if (row && !isFocusWithin(row)) focusSafely(row);
    } else if (before != null) focusSafely(root);
  }
  return current;
}
