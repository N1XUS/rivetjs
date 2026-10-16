// Ported from @react-aria/grid (useGridSelectionCheckbox.ts, useHighlightSelectionDescription.ts,
// useGridSelectionAnnouncement.ts), Apache-2.0, © Adobe.
//
// Rivet (naming convention of the cdk hook ports):
// - `useX(props, state)` → `xProps(props, state)` returning react-aria's bag; values are computed
//   from the `GridState` view passed in (`../state/grid.ts` `gridState(data, collection)`), so call
//   them inside a binding / accessor for reactivity. Handlers react-aria creates inside the hook are
//   free functions `x<Event>(event, props, state)`, called from inline arrows (resumable).
// - Localized strings: `props.locale` (default: `en-US`); components pass `useLocale().locale`, resumed
//   handlers `localeOf(element)` (`../_adapters/intl.ts`).
// - `useGridSelectionAnnouncement` is an update effect in React; here `gridSelectionAnnouncement(props,
//   state, previousSelection)` runs at the end of a handler that may change the selection (capture
//   `state.selectionManager.rawSelection` before the handler body). Same messages, same frame delay
//   when the collection is not focused.
// - `useHighlightSelectionDescription` → `highlightSelectionDescription(props)` (the message, or
//   undefined) + `highlightSelectionDescriptionProps(props)` (`{ "aria-describedby" }`, needs the
//   description element: `../utils` `useDescription(element, message)` from a client handler).
//   Server: never a touch device (no description), like react-aria during SSR.
import { untrack } from "@rivetjs/reactivity";
import { announce } from "../announcer/live-announcer.ts";
import { formatMessage } from "../_adapters/intl.ts";
import { getInteractionModality } from "../interactions/focus-visible.tsx";
import { isFocusVisible } from "../interactions/focus-visible.tsx";
import type { Collection, Direction, Key, KeyboardDelegate, LayoutDelegate, Node, Selection } from "../collections/types.ts";
import type { GridNode, IGridCollection } from "../collections/grid.ts";
import type { MultipleSelectionManager, SelectionManager } from "../selection/manager.ts";
import type { GridState } from "../state/grid.ts";
import {
  collectionTabIndex,
  selectableCollectionBlur,
  selectableCollectionFocus,
  selectableCollectionKeyDown,
  selectableCollectionKeyDownCapture,
  selectableCollectionMouseDown,
  selectableCollectionScroll,
  type AriaSelectableCollectionOptions,
} from "../selection/selectable-collection.ts";
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
import { searchCollator } from "../selection/list-keyboard-delegate.ts";
import { refElement, type RefLike } from "../selection/utils.ts";
import { focusSafely, getFocusableTreeWalker } from "../focus/index.ts";
import { getActiveElement, getEventTarget, getOwnerDocument, getScrollParent, isFocusWithin, nodeContains, scrollIntoViewport } from "../utils/dom.ts";
import { direction as elementDirection } from "../bidi/index.ts";
import { createId } from "../utils/id.ts";
import { isOpeningLink } from "../utils/links.tsx";
import { GridKeyboardDelegate } from "./keyboard-delegate.ts";
import { strings } from "./intl.ts";

/** Localized-string option shared by the grid hooks. */
export interface GridLocaleProps {
  /** Locale of the strings (default "en-US"). */
  locale?: string | undefined;
}

// --- useGridSelectionCheckbox --------------------------------------------------------------------

export interface AriaGridSelectionCheckboxProps extends GridLocaleProps {
  /** A unique key for the checkbox. */
  key: Key;
  /** Id of the checkbox (react-aria generates one per hook call). */
  id?: string | undefined;
}

/** react-aria `AriaCheckboxProps` subset the selection checkbox sets (`onChange`: `gridSelectionCheckboxChange`). */
export interface GridSelectionCheckboxProps {
  id: string;
  "aria-label": string;
  isSelected: boolean;
  isDisabled: boolean;
}

/** The grid state slice the selection checkbox reads. */
export interface GridSelectionState {
  selectionManager: SelectionManager | MultipleSelectionManager;
}

/**
 * Props for the row selection checkbox of a grid (react-aria `useGridSelectionCheckbox`
 * `checkboxProps`, without `onChange` → `gridSelectionCheckboxChange`).
 */
export function gridSelectionCheckboxProps(props: AriaGridSelectionCheckboxProps, state: GridSelectionState): GridSelectionCheckboxProps {
  const { key } = props;
  const isDisabled = !state.selectionManager.canSelectItem(key);
  const isSelected = state.selectionManager.isSelected(key);
  return {
    id: props.id ?? createId(),
    "aria-label": formatMessage(strings, props.locale, "select"),
    isSelected,
    isDisabled,
  };
}

/** The selection checkbox's `onChange`: always toggles selection, regardless of selectionBehavior. */
export function gridSelectionCheckboxChange(_isSelected: boolean, props: { key: Key }, state: GridSelectionState): void {
  state.selectionManager.toggleSelection(props.key);
}

// --- useHighlightSelectionDescription ------------------------------------------------------------

export interface HighlightSelectionDescriptionProps extends GridLocaleProps {
  selectionManager: MultipleSelectionManager;
  hasItemActions?: boolean | undefined;
}

/** Whether a long press enters selection mode (touch device, pointer / virtual / unknown modality). */
function shouldLongPress(): boolean {
  const modality = getInteractionModality();
  // null is the default if the user hasn't interacted with the table at all yet or the rest of the page
  return (modality === "pointer" || modality === "virtual" || modality == null) && typeof window !== "undefined" && "ontouchstart" in window;
}

/** The interaction description of a grid selectable collection, or undefined. */
export function highlightSelectionDescription(props: HighlightSelectionDescriptionProps): string | undefined {
  const selectionMode = props.selectionManager.selectionMode;
  const selectionBehavior = props.selectionManager.selectionBehavior;
  let message: string | undefined;
  if (shouldLongPress()) message = formatMessage(strings, props.locale, "longPressToSelect");
  return selectionBehavior === "replace" && selectionMode !== "none" && props.hasItemActions ? message : undefined;
}

/**
 * Computes the description props for a grid selectable collection (react-aria
 * `useHighlightSelectionDescription`): `aria-describedby` = `descriptionId` when there is a
 * description. Render the description element yourself (`<div id={descriptionId} hidden>`), or
 * attach the shared one in the browser with `../utils` `useDescription(element, message)`.
 */
export function highlightSelectionDescriptionProps(props: HighlightSelectionDescriptionProps & { descriptionId?: string }): { "aria-describedby"?: string } {
  const description = highlightSelectionDescription(props);
  return { "aria-describedby": description ? props.descriptionId : undefined };
}

// --- useGridSelectionAnnouncement ----------------------------------------------------------------

export interface GridSelectionAnnouncementProps extends GridLocaleProps {
  /**
   * A function that returns the text that should be announced by assistive technology when a row is
   * added or removed from selection.
   * @default (key) => state.collection.getItem(key)?.textValue
   */
  getRowText?: ((key: Key) => string) | undefined;
}

export interface GridSelectionAnnouncementState<T> {
  /** A collection of items in the grid. */
  collection: Collection<Node<T>>;
  /** A selection manager to read and update multiple selection state. */
  selectionManager: SelectionManager;
}

/**
 * Many screen readers do not announce when items in a grid are selected / deselected: announce the
 * change from `lastSelection` to the current selection through the live announcer. Call at the end
 * of a handler that may change the selection (react-aria runs it as an update effect on selection /
 * focus change; when the collection is not focused it waits a frame, e.g. for mouse down focus).
 */
export function gridSelectionAnnouncement<T>(props: GridSelectionAnnouncementProps, state: GridSelectionAnnouncementState<T>, lastSelection: Selection): void {
  const selection = untrack(() => state.selectionManager.rawSelection);
  if (selection === lastSelection || equalSelection(selection, lastSelection)) return;
  if (untrack(() => state.selectionManager.isFocused)) announceSelectionChange(props, state, selection, lastSelection);
  else if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => announceSelectionChange(props, state, selection, lastSelection));
}

function equalSelection(a: Selection, b: Selection): boolean {
  if (a === "all" || b === "all") return a === b;
  if (a.size !== b.size) return false;
  for (const key of a) if (!b.has(key)) return false;
  return true;
}

function announceSelectionChange<T>(
  props: GridSelectionAnnouncementProps,
  state: GridSelectionAnnouncementState<T>,
  selection: Selection,
  last: Selection,
): void {
  untrack(() => {
    const manager = state.selectionManager;
    const getRowText = props.getRowText ?? ((key: Key) => state.collection.getTextValue?.(key) ?? state.collection.getItem(key)?.textValue ?? "");
    const format = (key: string, args?: Record<string, unknown>) => formatMessage(strings, props.locale, key, args);
    if (!manager.isFocused) return;

    const addedKeys = diffSelection(selection, last);
    const removedKeys = diffSelection(last, selection);

    // If adding or removing a single row from the selection, announce the name of that item.
    const isReplace = manager.selectionBehavior === "replace";
    const messages: string[] = [];

    if (manager.selectedKeys.size === 1 && isReplace) {
      const firstKey = manager.selectedKeys.keys().next().value;
      if (firstKey != null && state.collection.getItem(firstKey)) {
        const currentSelectionText = getRowText(firstKey);
        if (currentSelectionText) messages.push(format("selectedItem", { item: currentSelectionText }));
      }
    } else if (addedKeys.size === 1 && removedKeys.size === 0) {
      const firstKey = addedKeys.keys().next().value;
      if (firstKey != null) {
        const addedText = getRowText(firstKey);
        if (addedText) messages.push(format("selectedItem", { item: addedText }));
      }
    } else if (removedKeys.size === 1 && addedKeys.size === 0) {
      const firstKey = removedKeys.keys().next().value;
      if (firstKey != null && state.collection.getItem(firstKey)) {
        const removedText = getRowText(firstKey);
        if (removedText) messages.push(format("deselectedItem", { item: removedText }));
      }
    }

    // Announce how many items are selected, except when selecting the first item.
    if (manager.selectionMode === "multiple") {
      if (messages.length === 0 || selection === "all" || selection.size > 1 || last === "all" || last?.size > 1) {
        messages.push(selection === "all" ? format("selectedAll") : format("selectedCount", { count: selection.size }));
      }
    }

    if (messages.length > 0) announce(messages.join(" "));
  });
}

function diffSelection(a: Selection, b: Selection): Set<Key> {
  const res = new Set<Key>();
  if (a === "all" || b === "all") return res;
  for (const key of a.keys()) if (!b.has(key)) res.add(key);
  return res;
}

// --- utils.ts (gridMap) --------------------------------------------------------------------------

/**
 * The data `useGrid` shares with `useGridRow` / `useGridCell` (react-aria `gridMap` value, minus the
 * keyboard delegate: Rivet builds the delegate per event — `gridKeyboardDelegate`).
 */
export interface GridShared {
  actions: {
    onRowAction?: ((key: Key) => void) | undefined;
    onCellAction?: ((key: Key) => void) | undefined;
  };
  shouldSelectOnPressUp?: boolean | undefined;
  keyboardNavigationBehavior?: "arrow" | "tab" | undefined;
}

/**
 * A react-stately `GridState` view as the grid hooks read it; `grid` carries the `gridShared(props)`
 * data (react-aria `gridMap.get(state)`: views are rebuilt per event, so the data rides on the view).
 */
export type GridStateLike<T = unknown, C extends IGridCollection<T> = IGridCollection<T>> = GridState<T, C> & { grid?: GridShared | undefined };

/** react-aria `gridMap`: shared grid data per (long-lived) state object (fallback of `state.grid`). */
export const gridMap: WeakMap<object, GridShared> = new WeakMap();

function gridSharedOf(state: GridStateLike<any, any>): GridShared {
  return state.grid ?? gridMap.get(state) ?? { actions: {} };
}

/** The data `gridProps` shares with rows and cells (put it on the state view as `grid`). */
export function gridShared(props: Pick<GridProps, "onRowAction" | "onCellAction" | "shouldSelectOnPressUp" | "keyboardNavigationBehavior">): GridShared {
  return {
    actions: { onRowAction: props.onRowAction, onCellAction: props.onCellAction },
    shouldSelectOnPressUp: props.shouldSelectOnPressUp,
    keyboardNavigationBehavior: props.keyboardNavigationBehavior ?? "arrow",
  };
}

// --- useGrid -------------------------------------------------------------------------------------

export interface GridProps extends GridLocaleProps {
  /** The element's unique identifier (react-aria generates one with `useId`). */
  id?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-details"?: string | undefined;
  /** Whether the grid uses virtual scrolling. */
  isVirtualized?: boolean | undefined;
  /** Whether typeahead navigation is disabled. */
  disallowTypeAhead?: boolean | undefined;
  /** An optional keyboard delegate implementation for type to select, to override the default. */
  keyboardDelegate?: KeyboardDelegate | undefined;
  /** Whether initial grid focus should be placed on the grid row or grid cell. Default "row". */
  focusMode?: "row" | "cell" | undefined;
  /** Text announced when a row is added to / removed from the selection. */
  getRowText?: ((key: Key) => string) | undefined;
  /** The scrollable body (automatic scrolling on item focus for non-virtualized grids). */
  scrollRef?: RefLike;
  /** Handler that is called when a user performs an action on the row. */
  onRowAction?: ((key: Key) => void) | undefined;
  /** Handler that is called when a user performs an action on the cell. */
  onCellAction?: ((key: Key) => void) | undefined;
  /** Whether pressing the escape key should clear selection in the grid or not. Default "clearSelection". */
  escapeKeyBehavior?: "clearSelection" | "none" | undefined;
  /** Whether selection should occur on press up instead of press down. */
  shouldSelectOnPressUp?: boolean | undefined;
  /** Whether keyboard navigation to focusable elements within grid cells is via arrow keys or the tab key. Default "arrow". */
  keyboardNavigationBehavior?: "arrow" | "tab" | undefined;
  /** Rivet: the grid element (handlers default to `event.currentTarget`). */
  ref?: RefLike;
  /** Rivet: reading direction (default: computed from the grid element). */
  direction?: Direction | undefined;
  /** Rivet: layout delegate of the default keyboard delegate (virtualizers). */
  layoutDelegate?: LayoutDelegate | undefined;
  /** Rivet: id of the highlight-selection description element (react-aria `useDescription`). */
  descriptionId?: string | undefined;
}

export interface GridAria {
  /** Props for the grid element. */
  gridProps: Record<string, unknown>;
}

type Ev<E extends Event> = E & { currentTarget: EventTarget | null };

const gridElementOf = (props: { ref?: RefLike }, e?: Event): HTMLElement | null => refElement(props.ref) ?? ((e?.currentTarget as HTMLElement | null) || null);

/**
 * The keyboard delegate `useGrid` builds (react-aria memoizes it; Rivet builds it per event):
 * `props.keyboardDelegate`, else a `GridKeyboardDelegate` over the grid element's DOM layout.
 */
export function gridKeyboardDelegate<T>(props: GridProps, state: GridStateLike<T, any>, element: HTMLElement | null): KeyboardDelegate {
  if (props.keyboardDelegate) return props.keyboardDelegate;
  return new GridKeyboardDelegate<T, IGridCollection<T>>({
    collection: state.collection,
    disabledKeys: state.disabledKeys,
    disabledBehavior: state.selectionManager.disabledBehavior,
    ref: element,
    direction: props.direction ?? (element ? elementDirection(element) : "ltr"),
    collator: searchCollator(props.locale),
    focusMode: props.focusMode,
    layoutDelegate: props.layoutDelegate,
  });
}

function collectionOptions(props: GridProps, state: GridStateLike<any, any>, e: Event): AriaSelectableCollectionOptions {
  const element = gridElementOf(props, e);
  return {
    ref: element,
    selectionManager: state.selectionManager,
    keyboardDelegate: gridKeyboardDelegate(props, state, element),
    isVirtualized: props.isVirtualized,
    scrollRef: props.scrollRef,
    disallowTypeAhead: props.disallowTypeAhead,
    escapeKeyBehavior: props.escapeKeyBehavior ?? "clearSelection",
    direction: props.direction,
  };
}

/** Runs a handler body, then announces the selection change (`useGridSelectionAnnouncement` effect). */
export function withSelectionAnnouncement<R>(props: GridSelectionAnnouncementProps, state: GridSelectionAnnouncementState<any>, body: () => R): R {
  const last = untrack(() => state.selectionManager.rawSelection);
  const result = body();
  gridSelectionAnnouncement(props, state, last);
  return result;
}

/**
 * Attributes of the grid element (react-aria `useGrid` → `gridProps`): role, id, labelling,
 * aria-multiselectable, roving tabIndex (an empty grid is tabbable unless it holds a tabbable child:
 * `hasTabbableChild` = react-aria `useHasTabbableChild`), the highlight-selection description,
 * virtualized row / col counts. Reads state: bind as accessors. Wire the `grid<Event>(event, props,
 * state)` handlers on the same element (`gridKeyDownCapture` as a capture handler).
 */
export function gridProps<T>(props: GridProps, state: GridStateLike<T, any>, hasTabbableChild = false): GridAria {
  if (!props["aria-label"] && !props["aria-labelledby"] && typeof console !== "undefined") {
    console.warn("An aria-label or aria-labelledby prop is required for accessibility.");
  }
  const manager = state.selectionManager;
  const shared = gridSharedOf(state);
  const attrs: Record<string, unknown> = {
    id: props.id,
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": props["aria-describedby"],
    "aria-details": props["aria-details"],
    role: "grid",
    "aria-multiselectable": manager.selectionMode === "multiple" ? "true" : undefined,
  };
  // useSelectableCollection's tabIndex (not with keyboard navigation disabled).
  if (!state.isKeyboardNavigationDisabled) attrs.tabIndex = collectionTabIndex(manager);
  // If collection is empty, make sure the grid is tabbable unless there is a child tabbable element.
  if (state.collection.size === 0) attrs.tabIndex = hasTabbableChild ? -1 : 0;
  const description = highlightSelectionDescriptionProps({
    selectionManager: manager,
    hasItemActions: !!(shared.actions.onRowAction || shared.actions.onCellAction),
    locale: props.locale,
    descriptionId: props.descriptionId,
  })["aria-describedby"];
  if (description) attrs["aria-describedby"] = [props["aria-describedby"], description].filter(Boolean).join(" ");
  if (props.isVirtualized) {
    attrs["aria-rowcount"] = state.collection.size;
    attrs["aria-colcount"] = state.collection.columnCount;
  }
  return { gridProps: attrs };
}

/** keydown (capture phase) on the grid element: typeahead. */
export function gridKeyDownCapture(e: Ev<KeyboardEvent>, props: GridProps, state: GridStateLike<any, any>): boolean {
  if (state.isKeyboardNavigationDisabled) return false;
  return selectableCollectionKeyDownCapture(collectionOptions(props, state, e), e);
}

/** keydown on the grid element: arrow / Home / End / Page navigation, select all, Escape, Tab. */
export function gridKeyDown(e: Ev<KeyboardEvent>, props: GridProps, state: GridStateLike<any, any>): boolean {
  if (state.isKeyboardNavigationDisabled) return false;
  return withSelectionAnnouncement(props, state, () => selectableCollectionKeyDown(collectionOptions(props, state, e), e));
}

/** focus (wire as `onFocusIn`) on the grid element. With keyboard navigation disabled only the focused state is tracked. */
export function gridFocus(e: Ev<FocusEvent>, props: GridProps, state: GridStateLike<any, any>): void {
  if (!state.isKeyboardNavigationDisabled)
    return void withSelectionAnnouncement(props, state, () => selectableCollectionFocus(collectionOptions(props, state, e), e));
  const manager = state.selectionManager;
  const current = gridElementOf(props, e);
  if (manager.isFocused) {
    // If a focus event bubbled through a portal, reset focus state.
    if (!nodeContains(current, getEventTarget(e))) manager.setFocused(false);
    return;
  }
  // Focus events can bubble through portals. Ignore these events.
  if (!nodeContains(current, getEventTarget(e))) return;
  manager.setFocused(true);
}

/** blur (wire as `onFocusOut`) on the grid element. */
export function gridBlur(e: Ev<FocusEvent>, props: GridProps, state: GridStateLike<any, any>): void {
  selectableCollectionBlur(collectionOptions(props, state, e), e);
}

/** mousedown on the grid element. */
export function gridMouseDown(e: Ev<MouseEvent>, props: GridProps, state: GridStateLike<any, any>): void {
  if (!state.isKeyboardNavigationDisabled) selectableCollectionMouseDown(collectionOptions(props, state, e), e);
}

/** scroll on the grid's scrollable body. */
export function gridScroll(e: Ev<Event>, props: GridProps, state: GridStateLike<any, any>): void {
  if (!state.isKeyboardNavigationDisabled) selectableCollectionScroll(collectionOptions(props, state, e), e);
}

// --- useGridRowGroup -----------------------------------------------------------------------------

export interface GridRowGroupAria {
  /** Props for the row group element. */
  rowGroupProps: Record<string, unknown>;
}

/** Provides the accessibility implementation for a row group in a grid (react-aria `useGridRowGroup`). */
export function gridRowGroupProps(): GridRowGroupAria {
  return { rowGroupProps: { role: "rowgroup" } };
}

// --- press propagation ---------------------------------------------------------------------------

/**
 * react-aria's usePress stops propagation of the events of a press it handles, so a pressable cell
 * keeps its row from pressing too. The selectable-item port leaves propagation alone: stop it here
 * when the item takes press events (allows selection or has an action).
 */
function stopPress(options: SelectableItemOptions, e: Event): void {
  // usePress ignores the click a synthetic link dispatches (`openLink.isOpening`): let it reach the document.
  if (e.type === "click" && isOpeningLink()) return;
  const states = untrack(() => selectableItemStates(options));
  if (!states.isDisabled && (states.allowsSelection || states.hasAction)) e.stopPropagation();
}

const isPressKey = (e: KeyboardEvent) => e.key === " " || e.key === "Enter";

// --- useGridRow ----------------------------------------------------------------------------------

export interface GridRowProps<T> {
  /** An object representing the grid row. */
  node: GridNode<T>;
  /** Whether the grid row is contained in a virtual scroller. */
  isVirtualized?: boolean | undefined;
  /** Whether selection should occur on press up instead of press down. */
  shouldSelectOnPressUp?: boolean | undefined;
  /** @deprecated Handler that is called when a user performs an action on the row. Use onRowAction on the grid. */
  onAction?: (() => void) | undefined;
  /** Rivet: the row element (handlers default to `event.currentTarget`). */
  ref?: RefLike;
  /** Rivet: announcement options (`useGrid` `getRowText`, locale). */
  getRowText?: ((key: Key) => string) | undefined;
  locale?: string | undefined;
}

export interface GridRowAria extends SelectableItemStates {
  /** Props for the grid row element. */
  rowProps: Record<string, unknown>;
}

function rowItemOptions<T>(props: GridRowProps<T>, state: GridStateLike<T, any>, e?: Event): SelectableItemOptions {
  const { node, isVirtualized, shouldSelectOnPressUp, onAction } = props;
  const { actions, shouldSelectOnPressUp: gridShouldSelectOnPressUp } = gridSharedOf(state);
  const onRowAction = actions.onRowAction ? () => actions.onRowAction?.(node.key) : onAction;
  const nodeAction = node?.props?.onAction as (() => void) | undefined;
  return {
    selectionManager: state.selectionManager,
    key: node.key,
    ref: refElement(props.ref) ?? ((e?.currentTarget as HTMLElement | null) || null),
    isVirtualized,
    shouldSelectOnPressUp: gridShouldSelectOnPressUp || shouldSelectOnPressUp,
    onAction: onRowAction || nodeAction ? () => (nodeAction?.(), onRowAction?.()) : undefined,
    isDisabled: state.collection.size === 0,
  };
}

/**
 * Provides the behavior and accessibility implementation for a row in a grid (react-aria
 * `useGridRow` → `gridRowProps`): row attributes + item states. Reads state: bind as accessors. Wire
 * `gridRow<Event>(event, props, state)` on the row.
 */
export function gridRowProps<T>(props: GridRowProps<T>, state: GridStateLike<T, any>): GridRowAria {
  const options = rowItemOptions(props, state);
  const states = selectableItemStates(options);
  const isSelected = state.selectionManager.isSelected(props.node.key);
  const rowProps: Record<string, unknown> = {
    role: "row",
    "aria-selected": state.selectionManager.selectionMode !== "none" ? isSelected : undefined,
    "aria-disabled": states.isDisabled || undefined,
    ...selectableItemAttrs(options),
  };
  if (props.isVirtualized) rowProps["aria-rowindex"] = props.node.index + 1; // aria-rowindex is 1 based
  return { rowProps, ...states };
}

/**
 * Whether a keyboard press on the row applies: the row itself, or one of its (non-pressable) cells —
 * not an interactive child (a checkbox, a button) that handles the key itself.
 */
function isRowPressTarget(e: Event): boolean {
  const target = e.target as Element | null;
  if (!target || target === e.currentTarget) return true;
  const role = target.getAttribute("role");
  return (role === "gridcell" || role === "rowheader") && target.parentElement === e.currentTarget;
}

/** pointerdown on the row (press start). */
export function gridRowPointerDown<T>(e: Ev<PointerEvent>, props: GridRowProps<T>, state: GridStateLike<T, any>): void {
  const options = rowItemOptions(props, state, e);
  withSelectionAnnouncement(props, state, () => selectableItemPointerDown(options, e));
  stopPress(options, e);
}
/** pointerup on the row. */
export function gridRowPointerUp<T>(e: Ev<PointerEvent>, props: GridRowProps<T>, state: GridStateLike<T, any>): void {
  const options = rowItemOptions(props, state, e);
  withSelectionAnnouncement(props, state, () => selectableItemPointerUp(options, e));
  stopPress(options, e);
}
/** pointercancel on the row. */
export function gridRowPointerCancel<T>(e: Ev<PointerEvent>, props: GridRowProps<T>, state: GridStateLike<T, any>): void {
  selectableItemPointerCancel(rowItemOptions(props, state, e), e);
}
/** click on the row (the press). */
export function gridRowClick<T>(e: Ev<MouseEvent>, props: GridRowProps<T>, state: GridStateLike<T, any>): void {
  const options = rowItemOptions(props, state, e);
  withSelectionAnnouncement(props, state, () => selectableItemClick(options, e));
  stopPress(options, e);
}
/** dblclick on the row (secondary action with selectionBehavior "replace"). */
export function gridRowDoubleClick<T>(e: Ev<MouseEvent>, props: GridRowProps<T>, state: GridStateLike<T, any>): void {
  selectableItemDoubleClick(rowItemOptions(props, state, e), e);
}
/** keydown on the row: Space / Enter press. */
export function gridRowKeyDown<T>(e: Ev<KeyboardEvent>, props: GridRowProps<T>, state: GridStateLike<T, any>): void {
  if (!isPressKey(e) || !isRowPressTarget(e)) return;
  const options = rowItemOptions(props, state, e);
  withSelectionAnnouncement(props, state, () => selectableItemKeyDown(options, e));
  stopPress(options, e);
}
/** keyup on the row. */
export function gridRowKeyUp<T>(e: Ev<KeyboardEvent>, props: GridRowProps<T>, state: GridStateLike<T, any>): void {
  if (!isPressKey(e)) return;
  const options = rowItemOptions(props, state, e);
  withSelectionAnnouncement(props, state, () => selectableItemKeyUp(options, e));
}
/** focus (wire as `onFocusIn`) on the row: the row becomes the focused key. */
export function gridRowFocus<T>(e: Ev<FocusEvent>, props: GridRowProps<T>, state: GridStateLike<T, any>): void {
  selectableItemFocus(rowItemOptions(props, state, e), e);
}
/** dragstart on the row. */
export function gridRowDragStart<T>(e: Ev<DragEvent>, props: GridRowProps<T>, state: GridStateLike<T, any>): void {
  selectableItemDragStart(rowItemOptions(props, state, e), e);
}

// --- useGridCell ---------------------------------------------------------------------------------

export interface GridCellProps {
  /** An object representing the grid cell. */
  node: GridNode<unknown>;
  /** Whether the grid cell is contained in a virtual scroller. */
  isVirtualized?: boolean | undefined;
  /**
   * Whether the cell or its first focusable child element should be focused when the grid cell is
   * focused. Defaults to 'child' in arrow keyboard navigation mode and 'cell' in tab mode.
   */
  focusMode?: "child" | "cell" | undefined;
  /** Whether the cell supports arrow key navigation even when the collection uses tab navigation. */
  allowsArrowNavigation?: boolean | undefined;
  /** Whether selection should occur on press up instead of press down. */
  shouldSelectOnPressUp?: boolean | undefined;
  /** Indicates how many columns the data cell spans. */
  colSpan?: number | undefined;
  /** @deprecated Handler that is called when a user performs an action on the cell. Use onCellAction on the grid. */
  onAction?: (() => void) | undefined;
  /** Rivet: the cell element (handlers default to `event.currentTarget`). */
  ref?: RefLike;
  /** Rivet: reading direction (default: computed from the cell). */
  direction?: Direction | undefined;
  /** Rivet: the grid's keyboard delegate (default: `gridKeyboardDelegate` over the closest grid element). */
  keyboardDelegate?: KeyboardDelegate | undefined;
}

export interface GridCellAria {
  /** Props for the grid cell element. */
  gridCellProps: Record<string, unknown>;
  /** Whether the cell is currently in a pressed state. */
  isPressed: boolean;
}

// The key of the item at the time its cell was last focused (a virtualizer reuses DOM nodes), and the
// specific focusable child last focused within the cell (react-aria refs).
const cellKeyWhenFocused = new WeakMap<Element, Key>();
const cellLastFocusedChild = new WeakMap<Element, Element>();

const cellOf = (props: GridCellProps, e?: Event): HTMLElement | null => refElement(props.ref) ?? ((e?.currentTarget as HTMLElement | null) || null);
const cellFocusMode = (props: GridCellProps, state: GridStateLike<any, any>): "child" | "cell" =>
  props.focusMode ?? (gridSharedOf(state).keyboardNavigationBehavior === "tab" ? "cell" : "child");

function lastFocusable(walker: TreeWalker): HTMLElement | null {
  let next: HTMLElement | null = null;
  let last: HTMLElement | null = null;
  do {
    last = walker.lastChild() as HTMLElement | null;
    if (last) next = last;
  } while (last);
  return next;
}

/** Focus the cell, or (focusMode "child") its last focused / first / last focusable child — react-aria's cell `focus()`. */
export function focusGridCell(props: GridCellProps, state: GridStateLike<any, any>, cell: HTMLElement | null): void {
  if (!cell) return;
  const treeWalker = getFocusableTreeWalker(cell);
  const keyWhenFocused = cellKeyWhenFocused.get(cell);
  if (cellFocusMode(props, state) === "child") {
    const activeElement = getActiveElement(getOwnerDocument(cell));
    // If focus is already on a focusable child within the cell, early return so we don't shift focus
    if (isFocusWithin(cell) && cell !== activeElement) return;
    const ownerDocument = getOwnerDocument(cell);
    const shouldRestoreToLastFocused = !activeElement || activeElement === ownerDocument.body || activeElement === cell;
    if (shouldRestoreToLastFocused) {
      const lastChild = cellLastFocusedChild.get(cell);
      if (lastChild && keyWhenFocused === props.node.key && nodeContains(cell, lastChild)) {
        focusSafely(lastChild as HTMLElement);
        return;
      }
    }
    const focusable = state.selectionManager.childFocusStrategy === "last" ? lastFocusable(treeWalker) : (treeWalker.firstChild() as HTMLElement | null);
    if (focusable) {
      focusSafely(focusable);
      return;
    }
  }
  if ((keyWhenFocused != null && props.node.key !== keyWhenFocused) || !isFocusWithin(cell)) focusSafely(cell);
}

function cellItemOptions(props: GridCellProps, state: GridStateLike<any, any>, e?: Event): SelectableItemOptions {
  const { onCellAction } = gridSharedOf(state).actions;
  const cell = cellOf(props, e);
  return {
    selectionManager: state.selectionManager,
    key: props.node.key,
    ref: cell,
    isVirtualized: props.isVirtualized,
    focus: () => focusGridCell(props, state, cell),
    shouldSelectOnPressUp: props.shouldSelectOnPressUp,
    onAction: onCellAction ? () => onCellAction(props.node.key) : props.onAction,
    isDisabled: state.collection.size === 0,
  };
}

/**
 * Provides the behavior and accessibility implementation for a cell in a grid (react-aria
 * `useGridCell` → `gridCellProps`). Reads state: bind as accessors. Wire
 * `gridCell<Event>(event, props, state)` on the cell; `gridCellKeyDownCapture` (capture phase) when
 * `keyboardNavigationBehavior !== "tab"` or `allowsArrowNavigation`, `gridCellKeyDown` when it is
 * "tab".
 */
export function gridCellProps(props: GridCellProps, state: GridStateLike<any, any>): GridCellAria {
  const { node, isVirtualized } = props;
  const { keyboardNavigationBehavior } = gridSharedOf(state);
  const focusMode = cellFocusMode(props, state);
  const options = cellItemOptions(props, state);
  const states = selectableItemStates(options);
  const attrs: Record<string, unknown> = {
    ...selectableItemAttrs(options),
    role: "gridcell",
    "aria-colspan": node.colSpan ?? undefined,
    "aria-colindex": node.colIndex != null ? node.colIndex + 1 : undefined, // aria-colindex is 1-based
    colSpan: isVirtualized ? undefined : (node.colSpan ?? undefined),
    // make sure shift tabbing from a child of a cell doesnt move focus back to cell if focusMode="child" and in tab nav
    ...(focusMode === "child" && keyboardNavigationBehavior === "tab" ? { tabIndex: -1 } : {}),
  };
  if (isVirtualized) attrs["aria-colindex"] = (node.colIndex ?? node.index) + 1; // aria-colindex is 1-based
  return { gridCellProps: attrs, isPressed: states.isPressed };
}

/** Whether `gridCellKeyDownCapture` applies (react-aria wires it only then). */
export const gridCellHasKeyDownCapture = (props: GridCellProps, state: GridStateLike<any, any>): boolean =>
  gridSharedOf(state).keyboardNavigationBehavior !== "tab" || !!props.allowsArrowNavigation;

/**
 * keydown (capture phase) on the cell: Left / Right move between focusable children (RTL aware) and
 * on to the neighbouring cell; Up / Down from a child are re-dispatched from the cell's parent so the
 * grid navigates.
 */
export function gridCellKeyDownCapture(e: Ev<KeyboardEvent>, props: GridCellProps, state: GridStateLike<any, any>): void {
  if (!gridCellHasKeyDownCapture(props, state)) return;
  const cell = cellOf(props, e);
  const activeElement = cell ? getActiveElement(getOwnerDocument(cell)) : null;
  if (!nodeContains(e.currentTarget as Element, getEventTarget(e) as Element) || state.isKeyboardNavigationDisabled || !cell || !activeElement) return;
  const direction = props.direction ?? elementDirection(cell);
  const focusMode = cellFocusMode(props, state);
  const walker = getFocusableTreeWalker(cell);
  walker.currentNode = activeElement;
  const delegate = () => props.keyboardDelegate ?? gridKeyboardDelegate({ locale: undefined }, state, cell.closest<HTMLElement>("[role=grid],[role=treegrid]"));
  const focusAndScroll = (el: HTMLElement) => {
    focusSafely(el);
    scrollIntoViewport(el, { containingElement: getScrollParent(cell) });
  };
  switch (e.key) {
    case "ArrowLeft": {
      // Find the next focusable element within the cell.
      let focusable = (direction === "rtl" ? walker.nextNode() : walker.previousNode()) as HTMLElement | null;
      // Don't focus the cell itself if focusMode is "child"
      if (focusMode === "child" && focusable === cell) focusable = null;
      e.preventDefault();
      e.stopPropagation();
      if (focusable) focusAndScroll(focusable);
      else {
        // No next focusable child: move to the cell to the left of this one (useSelectableCollection).
        // If there is none (one column, grid not focusing rows), the next key is this one: focus the
        // cell or its first / last child, depending on the focus mode.
        const prev = delegate().getKeyLeftOf?.(props.node.key);
        if (prev !== props.node.key) {
          // Re-dispatch from a higher parent so the event still bubbles to useSelectableCollection.
          cell.parentElement?.dispatchEvent(new KeyboardEvent(e.type, e));
          break;
        }
        if (focusMode === "cell" && direction === "rtl") focusAndScroll(cell);
        else {
          walker.currentNode = cell;
          focusable = direction === "rtl" ? (walker.firstChild() as HTMLElement | null) : lastFocusable(walker);
          if (focusable) focusAndScroll(focusable);
        }
      }
      break;
    }
    case "ArrowRight": {
      let focusable = (direction === "rtl" ? walker.previousNode() : walker.nextNode()) as HTMLElement | null;
      if (focusMode === "child" && focusable === cell) focusable = null;
      e.preventDefault();
      e.stopPropagation();
      if (focusable) focusAndScroll(focusable);
      else {
        const next = delegate().getKeyRightOf?.(props.node.key);
        if (next !== props.node.key) {
          cell.parentElement?.dispatchEvent(new KeyboardEvent(e.type, e));
          break;
        }
        if (focusMode === "cell" && direction === "ltr") focusAndScroll(cell);
        else {
          walker.currentNode = cell;
          focusable = direction === "rtl" ? lastFocusable(walker) : (walker.firstChild() as HTMLElement | null);
          if (focusable) focusAndScroll(focusable);
        }
      }
      break;
    }
    case "ArrowUp":
    case "ArrowDown":
      // Keep arrow keys from cell children (menu buttons): re-dispatch from a higher parent so the
      // event still bubbles to useSelectableCollection.
      if (!e.altKey && nodeContains(cell, getEventTarget(e) as Element)) {
        e.stopPropagation();
        e.preventDefault();
        cell.parentElement?.dispatchEvent(new KeyboardEvent(e.type, e));
      }
      break;
  }
}

/**
 * keydown on the cell: with "tab" keyboard navigation, events from children stay in the cell (Tab
 * moves between children while there are more); then the selectable item's Space / Enter press.
 */
export function gridCellKeyDown(e: Ev<KeyboardEvent>, props: GridCellProps, state: GridStateLike<any, any>): void {
  const cell = cellOf(props, e);
  const activeElement = cell ? getActiveElement(getOwnerDocument(cell)) : null;
  const { keyboardNavigationBehavior } = gridSharedOf(state);
  if (
    keyboardNavigationBehavior === "tab" &&
    nodeContains(e.currentTarget as Element, getEventTarget(e) as Element) &&
    !state.isKeyboardNavigationDisabled &&
    cell &&
    activeElement
  ) {
    if (getEventTarget(e) !== cell && e.key !== "Tab") {
      e.stopPropagation();
      return;
    }
    if (e.key === "Tab") {
      // Another focusable element in this item: let the browser handle Tab (not useSelectableCollection).
      const walker = getFocusableTreeWalker(cell, { tabbable: true });
      walker.currentNode = activeElement;
      const next = e.shiftKey ? walker.previousNode() : walker.nextNode();
      if (next) e.stopPropagation();
    }
  }
  if (!isPressKey(e) || e.target !== e.currentTarget || e.cancelBubble) return;
  const options = cellItemOptions(props, state, e);
  selectableItemKeyDown(options, e);
  stopPress(options, e);
}

/** keyup on the cell. */
export function gridCellKeyUp(e: Ev<KeyboardEvent>, props: GridCellProps, state: GridStateLike<any, any>): void {
  if (isPressKey(e)) selectableItemKeyUp(cellItemOptions(props, state, e), e);
}

/**
 * focus (wire as `onFocusIn`) on the cell: a focused child makes the cell the focused key (unless
 * focus is visible); the cell itself focused in focusMode "child" moves focus to a child after a frame.
 */
export function gridCellFocus(e: Ev<FocusEvent>, props: GridCellProps, state: GridStateLike<any, any>): void {
  const cell = cellOf(props, e);
  if (!cell) return;
  cellKeyWhenFocused.set(cell, props.node.key);
  const target = getEventTarget(e) as Element | null;
  if (target !== cell) {
    // useSelectableItem only handles the gridcell itself; a focused child also sets the focused key —
    // unless focus is visible (keyboard users return to the previously focused cell: one tab stop).
    if (target && nodeContains(cell, target)) cellLastFocusedChild.set(cell, target);
    if (!isFocusVisible()) state.selectionManager.setFocusedKey(props.node.key);
    return;
  }
  selectableItemFocus(cellItemOptions(props, state, e), e);
  const focusMode = cellFocusMode(props, state);
  // Focus back to the cell from a child in focusMode "child": don't trap it.
  if (focusMode === "child" && e.relatedTarget && nodeContains(cell, e.relatedTarget as Element)) return;
  // Wait a frame so that focus finishes propagating, then move focus to a focusable child.
  requestAnimationFrame(() => {
    if (focusMode === "child" && getActiveElement(getOwnerDocument(cell)) === cell) focusGridCell(props, state, cell);
  });
}

/**
 * pointerdown on the cell: the press; with `shouldSelectOnPressUp` on a non-pressable cell, the
 * tabIndex is removed for a frame so a draggable row's pointer down does not focus the cell.
 */
export function gridCellPointerDown(e: Ev<PointerEvent>, props: GridCellProps, state: GridStateLike<any, any>): void {
  const options = cellItemOptions(props, state, e);
  const states = untrack(() => selectableItemStates(options));
  if (states.allowsSelection || states.hasAction) {
    selectableItemPointerDown(options, e);
    stopPress(options, e);
    return;
  }
  const el = e.currentTarget as HTMLElement | null;
  const tabindex = el?.getAttribute("tabindex");
  if (props.shouldSelectOnPressUp && el && tabindex != null) {
    el.removeAttribute("tabindex");
    requestAnimationFrame(() => el.setAttribute("tabindex", tabindex));
  }
}
/** pointerup on the cell. */
export function gridCellPointerUp(e: Ev<PointerEvent>, props: GridCellProps, state: GridStateLike<any, any>): void {
  const options = cellItemOptions(props, state, e);
  selectableItemPointerUp(options, e);
  stopPress(options, e);
}
/** click on the cell (the press). */
export function gridCellClick(e: Ev<MouseEvent>, props: GridCellProps, state: GridStateLike<any, any>): void {
  const options = cellItemOptions(props, state, e);
  selectableItemClick(options, e);
  stopPress(options, e);
}
