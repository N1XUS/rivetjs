// Ported from react-aria-components (src/Table.tsx: Table, TableHeader, Column, ColumnResizer,
// TableBody, TableFooter, Row, Cell, TableLoadMoreItem, ResizableTableContainer, TableContext,
// TableStateContext, TableColumnResizeStateContext, TableOptionsContext / useTableOptions,
// RowFocusContext), Apache-2.0, © Adobe.
//
// A table displays data in rows and columns: keyboard navigation, row selection (checkboxes via
// `<Checkbox slot="selection">`), sorting, column resizing, expandable rows (treegrid), links, actions.
// Rivet:
// - The collection is built from the content (`collectionOf`, B5 build mode) into `./collection.ts`
//   `TableCollection` (RAC's internal class), flattened by the expanded keys and filtered by the
//   SelectableCollectionContext `filter` in a computed; `CollectionRendererContext.CollectionRoot`
//   renders the header / body / footer sections keyed by node key (resumed rows are adopted).
// - State: `../state/table.ts` `createTableState` (signals + plain data); the react-stately `TableState`
//   view (collection + SelectionManager instances) is rebuilt per event / binding. Handlers are inline
//   arrows calling `./behaviour.ts` / `../grid/behaviour.ts` free functions with KEYS, never nodes.
// - `TableStateContext` / `TableColumnResizeStateContext` provide ACCESSORS of the state views
//   (`useContext(TableStateContext)!()`), not the views (deviation: views hold class instances).
// - `tableOptions()` = RAC `useTableOptions()` (cdk naming: no `use*`).
// - Render props are accessors (`class={({ isSelected }) => (isSelected() ? "on" : "")}`); `data-*`
//   state values `"true"`; `class` = RAC `className` (defaults `rv-Table`, `rv-TableHeader`, `rv-Column`,
//   `rv-ColumnResizer`, `rv-TableBody`, `rv-TableFooter`, `rv-Row`, `rv-Cell`, `rv-TableLoadingIndicator`,
//   `rv-ResizableTableContainer`).
// - react-aria `useDescription` elements (sort, sortable column, long-press, resizer descriptions) are
//   rendered by the Table as hidden siblings after the `<table>` (server HTML carries them; a `<div>`
//   inside `<table>` would be foster-parented by the HTML parser).
// - Selection checkbox / expand button ids derive from the table id + row key (byte-stable server HTML).
// Deviations:
// - Inside a `<CollectionVirtualizer layout={TableLayout}>` (RAC useElementType) every part renders a `div` with its role
//   (the JSX of each part is duplicated per element type: one compiled template per tag, the native path untouched);
//   the grid element is the scroll container (it forwards `scroll` to the renderer) and the focused key is persisted.
// - Drag and drop (`dragAndDropHooks`, drop indicators, `slot="drag"` button) not wired yet (DnD lane).
// - No `FocusScope` wrapper (nothing here reads its context); the SharedElementTransition scope is a `SharedElementContext` provider entry.
// - Header placeholder cells (nested columns, react-stately level) render nothing — RAC renders
//   `node.render` of a placeholder (no render: throws); RAC `Column` is a leaf, so RAC tables never
//   have them.
import { computed, createContext, provide, runWithOwner, signal, untrack, useContext } from "@rivetjs/reactivity";
import { For, Portal, Show, clientEffect, ref as elementRef } from "@rivetjs/runtime/dom";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import {
  Collection,
  CollectionRendererContext,
  DefaultCollectionRenderer,
  collectionOf,
  createBranchComponent,
  createLeafComponent,
  renderNodeAt,
  type CollectionProps,
} from "../collections/components.tsx";
import { LoaderNode } from "../collections/base.ts";
import type { GridNode } from "../collections/grid.ts";
import type { DisabledBehavior, Key, Node, Selection, SelectionBehavior, SelectionMode, SortDescriptor, SortDirection } from "../collections/types.ts";
import type { Signal } from "@rivetjs/reactivity";
import { createTableState, tableState, type TableState, type TableStateData } from "../state/table.ts";
import { resetGridFocusedKey } from "../state/grid.ts";
import { createTableColumnResizeState, tableColumnResizeState, type ColumnSize, type TableColumnResizeState } from "../state/table-column-resize.ts";
import type { ColumnStaticSize } from "../collections/table.ts";
import {
  gridBlur,
  gridCellClick,
  gridCellFocus,
  gridCellKeyDown,
  gridCellKeyDownCapture,
  gridCellKeyUp,
  gridCellPointerDown,
  gridCellPointerUp,
  gridFocus,
  gridKeyDown,
  gridKeyDownCapture,
  gridMouseDown,
  gridRowClick,
  gridRowDoubleClick,
  gridRowDragStart,
  gridRowFocus,
  gridRowKeyDown,
  gridRowKeyUp,
  gridRowPointerCancel,
  gridRowPointerDown,
  gridRowPointerUp,
  gridShared,
  highlightSelectionDescription,
  type GridCellProps,
} from "../grid/behaviour.ts";
import {
  getRowLabelledBy,
  normalizeKey,
  tableCellProps,
  tableColumnHeaderPress,
  tableColumnHeaderPressable,
  tableColumnHeaderProps,
  tableGridProps,
  tableHeaderRowProps,
  tableProps,
  tableRowExpandPress,
  tableRowKeyDown,
  tableRowProps,
  tableSelectAllCheckboxChange,
  tableSelectAllCheckboxProps,
  tableSelectionCheckboxChange,
  tableSelectionCheckboxProps,
  tableSortDescription,
  type AriaTableColumnHeaderProps,
  type AriaTableProps,
  type TableRowProps as AriaTableRowProps,
  type TableStateLike,
} from "./behaviour.ts";
import { focusColumnResizer, tableColumnResizeProps } from "./column-resize.tsx";
import { TableBodyNode, TableCellNode, TableCollection, TableColumnNode, TableFooterNode, TableHeaderNode, TableRowNode } from "./collection.ts";
import { strings as tableStrings } from "./intl.ts";
import { strings as racStrings } from "./rac-intl.ts";
import { formatMessage } from "../_adapters/intl.ts";
import {
  pressClick,
  pressDragStart,
  pressKeyDown,
  pressMouseDown,
  pressPointerDown,
  pressPointerEnter,
  pressPointerLeave,
  pressPointerUp,
  type PressOptions,
} from "../button/press.ts";
import { ButtonContext } from "../button/index.tsx";
import { CheckboxContext, CheckboxFieldContext } from "../checkbox/index.tsx";
import { SelectionIndicatorContext } from "../selection-indicator/context.ts";
import { SharedElementContext, type SharedElementScope } from "../shared-element-transition/transition.tsx";
import { FieldInputContext, SelectableCollectionContext, type SelectableCollectionContextValue } from "../autocomplete/contexts.ts";
import {
  DEFAULT_SLOT,
  Provider,
  contextProps,
  mergeRefValues,
  renderProps,
  resumableContext,
  type ContextValue,
  type LiveRenderProps,
  type RefValue,
  type RenderProps,
  type RenderPropsHookRetVal,
  type SlotProps,
  type StyleRenderProps,
} from "../slots/index.tsx";
import {
  dataBool,
  focusStateBlur,
  focusStateFocus,
  focusStateIn,
  hoverStateEnter,
  hoverStateLeave,
  hoverStateOver,
  type InteractionStateOptions,
} from "../utils/data-attrs.tsx";
import { focusRingBlur, focusRingFocus, useFocusRing } from "../focus/focus-ring.tsx";
import { isFocusVisible } from "../interactions/focus-visible.tsx";
import { focusSafely, getFocusableTreeWalker } from "../focus/index.ts";
import { getItemElement } from "../collections/dom.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { isScrollable } from "../utils/dom.ts";
import { useId } from "../utils/id.ts";
import { useLocale } from "../i18n/index.ts";
import { loadMoreSentinel, type LoadMoreSentinelProps } from "../utils/load-more-sentinel.tsx";
import { useRouter, type LinkDOMProps } from "../utils/links.tsx";
import type { HoverEvents } from "../utils/types.ts";
import type { PressEvents } from "../interactions/press.tsx";
import { hasLive, liveKeys } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";

export { TableCollection } from "./collection.ts";
export type { TableState } from "../state/table.ts";
export type { TableColumnResizeState, ColumnSize } from "../state/table-column-resize.ts";
export type { ColumnStaticSize } from "../collections/table.ts";

type MaybeAccessor<T> = T | (() => T);
const read = <T,>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);
type Px = Record<string, string | number | undefined>;

// ---------------------------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------------------------

/** RAC `TableContext`: props for the Tables inside a component, optionally per `slot`. */
export const TableContext = resumableContext(createContext<ContextValue<TableProps, HTMLTableElement>>(null, { id: "rv-table" }));
/** RAC `TableStateContext` (Rivet: an accessor of the state view of the enclosing Table). */
export const TableStateContext = resumableContext(createContext<(() => TableState<any>) | null>(null, { id: "rv-table-state" }));
/** RAC `TableColumnResizeStateContext` (Rivet: an accessor; null outside a ResizableTableContainer). */
export const TableColumnResizeStateContext = resumableContext(
  createContext<(() => TableColumnResizeState<unknown>) | null>(null, { id: "rv-table-column-resize-state" }),
);

export interface TableOptionsContextValue {
  /** The type of selection that is allowed in the table. */
  selectionMode: SelectionMode;
  /** The selection behavior for the table. If selectionMode is `"none"`, this will be `null`. */
  selectionBehavior: SelectionBehavior | null;
  /** Whether the table allows empty selection. */
  disallowEmptySelection: boolean;
  /** Whether the table allows rows to be dragged. */
  allowsDragging: boolean;
}

const TableOptionsContext = resumableContext(createContext<TableOptionsContextValue | null>(null, { id: "rv-table-options" }));

/** Returns options from the parent `<Table>` component (RAC `useTableOptions`). */
export function tableOptions(): TableOptionsContextValue {
  return useContext(TableOptionsContext)!;
}

export interface RowFocusContextValue {
  /** Whether a descendant of the row has keyboard focus (accessor). */
  isFocusVisibleWithinRow: () => boolean;
}

/** RAC `RowFocusContext` (Rivet: `isFocusVisibleWithinRow` is an accessor). */
export const RowFocusContext = resumableContext(createContext<RowFocusContextValue>({ isFocusVisibleWithinRow: () => false }, { id: "rv-row-focus" }));

/** What the Table shares with its parts (plain data + accessors). */
interface TableInternal {
  data: TableStateData;
  /** The rendered (expanded + filtered) collection. */
  collection: () => TableCollection<unknown>;
  gridId: string;
  locale: string;
  direction: "ltr" | "rtl";
  isVirtualized: boolean;
  /** Hidden description element ids (react-aria `useDescription`). */
  sortableDescriptionId: string;
  resizerDescriptionId: string;
}
const TableInternalContext = resumableContext(createContext<TableInternal | null>(null, { id: "rv-table-internal" }));

interface ResizableTableContainerContextValue {
  /** The measured width of the scrollable element (react-aria `tableWidth`). */
  tableWidth: Signal<number>;
  /** Ref the Table merges into its own (RAC `tableRef`). */
  tableRef: RefValue<HTMLElement>;
  onResizeStart?: ((widths: Map<Key, ColumnSize>) => void) | undefined;
  onResize?: ((widths: Map<Key, ColumnSize>) => void) | undefined;
  onResizeEnd?: ((widths: Map<Key, ColumnSize>) => void) | undefined;
}
const ResizableTableContainerContext = resumableContext(
  createContext<ResizableTableContainerContextValue | null>(null, { id: "rv-resizable-table-container" }),
);

interface ColumnResizerContextValue {
  columnKey: Key;
  /** The column header element. */
  triggerRef: () => Element | null | undefined;
}
const ColumnResizerContext = resumableContext(createContext<ColumnResizerContextValue | null>(null, { id: "rv-column-resizer" }));

const columnOf = (c: TableCollection<unknown>, key: Key): GridNode<unknown> | undefined => (c.getItem(key) ?? undefined) as GridNode<unknown> | undefined;

// ---------------------------------------------------------------------------------------------
// ResizableTableContainer
// ---------------------------------------------------------------------------------------------

export interface ResizableTableContainerProps extends GlobalDOMAttributes<HTMLDivElement> {
  /** The CSS class of the element. Default "rv-ResizableTableContainer". */
  class?: string | undefined;
  style?: Px | undefined;
  /** The Table (and anything else) inside the container. */
  children?: unknown;
  /** Handler that is called when a user starts a column resize. */
  onResizeStart?: ((widths: Map<Key, ColumnSize>) => void) | undefined;
  /** Handler that is called when a user performs a column resize (controlled widths: the Column `width` props). */
  onResize?: ((widths: Map<Key, ColumnSize>) => void) | undefined;
  /** Handler that is called after a user performs a column resize (store the widths). */
  onResizeEnd?: ((widths: Map<Key, ColumnSize>) => void) | undefined;
  ref?: RefValue<HTMLDivElement> | undefined;
}

/** Wraps a Table to enable column resizing (ColumnResizer); measures the scrollable width. */
export function ResizableTableContainer(props: ResizableTableContainerProps) {
  const container = elementRef<HTMLDivElement>();
  const containerRef = mergeRefValues<HTMLDivElement>(container as RefValue<HTMLDivElement>, props.ref);
  const tableRef = elementRef<HTMLElement>();
  const tableWidth = signal(0);
  clientEffect(() => {
    // Walk up the DOM from the Table to the ResizableTableContainer and stop when we reach the first
    // scrollable element: what we measure to determine column widths (scrollbar widths).
    const root = container();
    let table = tableRef() as HTMLElement | null | undefined;
    while (table && table !== root && !isScrollable(table)) table = table.parentElement;
    const scroll = table ?? null;
    if (!scroll) return;
    tableWidth.set(scroll.clientWidth);
    const view = scroll.ownerDocument.defaultView;
    if (!view || typeof view.ResizeObserver === "undefined") return;
    const observer = new view.ResizeObserver(() => tableWidth.set(scroll.clientWidth));
    observer.observe(scroll, { box: "border-box" });
    return () => observer.disconnect();
  });
  // Locals only (PROPS-CAPTURE: a literal reading `props.x` captures the whole props object).
  const { onResizeStart, onResize, onResizeEnd } = props;
  const ctx: ResizableTableContainerContextValue = { tableWidth, tableRef: tableRef as RefValue<HTMLElement>, onResizeStart, onResize, onResizeEnd };
  const dom = globalDOMProps(props, ["style"]);
  const className = props.class || "rv-ResizableTableContainer";
  const style = props.style;
  const children = props.children;
  return (
    <div {...dom} ref={containerRef as never} class={className} style={style}>
      {provide(ResizableTableContainerContext, ctx, () => renderSlot(children)) as never}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------------------------

/** Render props of `Table` (accessors; `@selector` = the matching attribute). */
export interface TableRenderProps {
  /** Whether the table is currently focused. @selector [data-focused] */
  isFocused: () => boolean;
  /** Whether the table is currently keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Whether the table is currently the active drop target. @selector [data-drop-target] */
  isDropTarget: () => boolean;
  /** State of the table (accessor of the view). */
  state: () => TableState<unknown>;
}

export interface TableProps extends StyleRenderProps<TableRenderProps>, SlotProps, GlobalDOMAttributes<HTMLTableElement> {
  /** The elements that make up the table: TableHeader, TableBody, Columns, Rows. */
  children?: unknown;
  id?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-details"?: string | undefined;
  /** The type of selection that is allowed in the collection. Default "none". */
  selectionMode?: SelectionMode | undefined;
  /** How multiple selection should behave in the collection. Default "toggle". */
  selectionBehavior?: SelectionBehavior | undefined;
  /** The currently selected keys: a plain value (controlled) or a Signal (two-way). */
  selectedKeys?: Signal<Selection> | "all" | Iterable<Key> | undefined;
  /** The initial selected keys (uncontrolled). */
  defaultSelectedKeys?: "all" | Iterable<Key> | undefined;
  /** Handler that is called when the selection changes. */
  onSelectionChange?: ((keys: Selection) => void) | undefined;
  /** Whether the collection allows empty selection. */
  disallowEmptySelection?: boolean | undefined;
  /** The row keys that are disabled. */
  disabledKeys?: Iterable<Key> | undefined;
  /** Whether `disabledKeys` applies to all interactions, or only selection. Default "all". */
  disabledBehavior?: DisabledBehavior | undefined;
  /** The current sorted column and direction: a plain value (controlled) or a Signal (two-way). */
  sortDescriptor?: SortDescriptor | Signal<SortDescriptor | null> | null | undefined;
  /** Handler that is called when the sorted column or direction changes. */
  onSortChange?: ((descriptor: SortDescriptor) => any) | undefined;
  /** The currently expanded row keys: a plain value (controlled) or a Signal (two-way). */
  expandedKeys?: Signal<Set<Key>> | Iterable<Key> | undefined;
  /** The initial expanded row keys (uncontrolled). */
  defaultExpandedKeys?: Iterable<Key> | undefined;
  /** Handler that is called when rows are expanded or collapsed. */
  onExpandedChange?: ((keys: Set<Key>) => any) | undefined;
  /** The id of the column that displays hierarchical data (treegrid). */
  treeColumn?: Key | undefined;
  /** Handler that is called when a user performs an action on the row. */
  onRowAction?: ((key: Key) => void) | undefined;
  /** Handler that is called when a user performs an action on the cell. */
  onCellAction?: ((key: Key) => void) | undefined;
  /** Whether keyboard navigation to focusable elements within cells is via arrow keys or the tab key. Default "arrow". */
  keyboardNavigationBehavior?: "arrow" | "tab" | undefined;
  /** Whether pressing the escape key should clear selection. Default "clearSelection". */
  escapeKeyBehavior?: "clearSelection" | "none" | undefined;
  /** Whether selection should occur on press up instead of press down. */
  shouldSelectOnPressUp?: boolean | undefined;
  /** Whether typeahead navigation is disabled. */
  disallowTypeAhead?: boolean | undefined;
  ref?: RefValue<HTMLTableElement> | undefined;
}

/** Global DOM events / attributes Table handles itself; the user's run from its own handler. */
const TABLE_OWNED = ["onMouseDown", "onScroll", "style", "id"] as const;

/**
 * A table displays data in rows and columns and enables a user to navigate its contents via
 * directional navigation keys, and optionally supports row selection and sorting.
 */
export function Table(inProps: TableProps) {
  const [tableCtxProps, tableCtxRef] = contextProps(inProps, inProps.ref, TableContext) as [TableProps, RefValue<HTMLTableElement> | undefined];
  // RAC TableInner: the Autocomplete's SelectableCollectionContext merges under the table props.
  const [props, userRef] = contextProps(
    tableCtxProps as TableProps & SelectableCollectionContextValue<unknown>,
    tableCtxRef as never,
    SelectableCollectionContext as never,
  ) as [TableProps & SelectableCollectionContextValue<unknown>, RefValue<HTMLTableElement> | undefined];
  const container = useContext(ResizableTableContainerContext);
  const renderer = useContext(CollectionRendererContext);
  // Module component functions are not serializable: resolve the renderer at the call site (`(custom ?? Default).X(…)`).
  const customRenderer = renderer === DefaultCollectionRenderer ? undefined : renderer;
  const sharedElements: SharedElementScope = {};
  const isVirtualized = !!renderer.isVirtualized;
  const { locale, direction } = useLocale();

  // Separate selection options so collection components can read them via tableOptions().
  const selectionMode: SelectionMode = props.selectionMode ?? "none";
  const selectionBehavior: SelectionBehavior = props.selectionBehavior ?? "toggle";
  // Locals only (PROPS-CAPTURE: literals / closures reading `props.x` capture the whole props object).
  const {
    disallowEmptySelection,
    onRowAction,
    onCellAction,
    shouldSelectOnPressUp,
    keyboardNavigationBehavior,
    escapeKeyBehavior,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    "aria-describedby": ariaDescribedby,
    "aria-details": ariaDetails,
  } = props;
  const options: TableOptionsContextValue = {
    selectionMode,
    selectionBehavior: selectionMode === "none" ? null : selectionBehavior,
    disallowEmptySelection: !!disallowEmptySelection,
    allowsDragging: false,
  };
  const children = props.children;
  // Object-literal arrows (not call-argument arrows): the build computed captures them, so they must be
  // resumable closures.
  const build = {
    content: () => provide(TableOptionsContext, options, () => Collection({ children })),
    createCollection: () => new TableCollection<unknown>(),
  };
  const built = collectionOf(build.content, build.createCollection);
  const data = createTableState<unknown>({
    selectionMode,
    selectionBehavior,
    // Live props: a controlled `selectedKeys={keys()}` stays live (accessor; never written).
    selectedKeys: liveKeys(props, "selectedKeys"),
    defaultSelectedKeys: props.defaultSelectedKeys,
    onSelectionChange: props.onSelectionChange,
    disallowEmptySelection: props.disallowEmptySelection,
    disabledKeys: props.disabledKeys,
    disabledBehavior: props.disabledBehavior ?? "all",
    sortDescriptor: props.sortDescriptor,
    onSortChange: props.onSortChange,
    expandedKeys: liveKeys(props, "expandedKeys") as never,
    defaultExpandedKeys: props.defaultExpandedKeys,
    onExpandedChange: props.onExpandedChange,
    treeColumn: props.treeColumn,
  });
  const filter = props.filter;
  // RAC: collection.withExpandedKeys(expandedKeys), then UNSTABLE_useFilteredTableState(state, filter).
  const collection = computed(() => {
    const c = built().withExpandedKeys(data.expandedKeys.value());
    return filter ? c.filter(filter as never) : c;
  });
  const shared = gridShared({ onRowAction, onCellAction, shouldSelectOnPressUp, keyboardNavigationBehavior });
  const gridId = useId(props.id);
  const view = (): TableStateLike<unknown> => ({ ...tableState<unknown>(data, collection()), grid: shared, gridId });
  const sortDescriptionId = gridId + "-sort-description";
  const descriptionId = gridId + "-description";
  const internal: TableInternal = {
    data,
    collection,
    gridId,
    locale,
    direction,
    isVirtualized,
    sortableDescriptionId: gridId + "-sortable-description",
    resizerDescriptionId: gridId + "-resizer-description",
  };
  const aria: AriaTableProps = {
    id: gridId,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    "aria-describedby": ariaDescribedby,
    "aria-details": ariaDetails,
    isVirtualized,
    layoutDelegate: renderer.layoutDelegate,
    escapeKeyBehavior,
    keyboardNavigationBehavior,
    onRowAction,
    onCellAction,
    shouldSelectOnPressUp,
    locale,
    direction,
    descriptionId,
    sortDescriptionId,
  };
  const disallowTypeAhead = props.disallowTypeAhead as MaybeAccessor<boolean | undefined>;
  const shouldUseVirtualFocus = props.shouldUseVirtualFocus;
  const onFocusInFromContext = props.onFocusIn as ((e: FocusEvent) => void) | undefined;
  // The grid handler props for the event's table element (keyboard delegate over its DOM layout).
  const gridOf = (v: TableStateLike<unknown>, e: Event) =>
    tableGridProps({ ...aria, disallowTypeAhead: !!read(disallowTypeAhead) }, v, e.currentTarget as HTMLElement);

  const el = elementRef<HTMLTableElement>();
  const rootRef = mergeRefValues<HTMLTableElement>(mergeRefValues<HTMLTableElement>(el as RefValue<HTMLTableElement>, userRef), container?.tableRef as never);
  // react-aria useHasTabbableChild (empty table with a tabbable child: the table leaves the tab order).
  const hasTabbableChild = signal(false);
  clientEffect(() => {
    const root = el();
    if (!root || collection().size !== 0) return;
    const update = () => hasTabbableChild.set(!!getFocusableTreeWalker(root, { tabbable: true }).nextNode());
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["tabIndex", "disabled"] });
    return () => observer.disconnect();
  });
  // useGridState: reset the focused key when its row leaves the collection.
  // `blurred`: target of the last focusout to nowhere (Rivet: Chromium fires focusout when the focused row is
  // removed, jsdom / React's detached-node events do not — a blur whose target left the DOM keeps focus in the grid).
  const focusMemo: { last: TableCollection<unknown> | null; blurred: Element | null } = { last: null, blurred: null };
  clientEffect(() => {
    const c = collection();
    const selection = data.selectionState;
    const previous = untrack(selection.focusedKey);
    resetGridFocusedKey(data, focusMemo.last, c);
    focusMemo.last = c;
    // useSelectableItem's focus effect for the replacement key, after the rows re-rendered.
    const next = untrack(selection.focusedKey);
    if (next == null || next === previous) return;
    const wasFocused = untrack(selection.isFocused);
    queueMicrotask(() => {
      const lost = focusMemo.blurred;
      if (untrack(selection.focusedKey) !== next || !(wasFocused || (lost && !lost.isConnected))) return;
      const item = getItemElement(el(), next);
      if (item && item.ownerDocument.activeElement !== item) focusSafely(item);
    });
  });

  // Column resizing (ResizableTableContainer): the layout state over the measured width.
  const resizeData = container ? createTableColumnResizeState<unknown>({ tableWidth: container.tableWidth }) : null;
  const layout = resizeData ? () => tableColumnResizeState(resizeData, view()) as TableColumnResizeState<unknown> : null;

  const focused = signal(false);
  const focusVisible = signal(false);
  const rootInteraction: InteractionStateOptions = { states: { isFocused: focused, isFocusVisible: focusVisible } };
  const values: TableRenderProps = {
    isFocused: () => focused(),
    isFocusVisible: () => focusVisible(),
    isDropTarget: () => false,
    state: view,
  };
  const rp = untrack(() =>
    renderProps(
      { class: props.class, style: props.style, values, defaultClassName: "rv-Table" },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  const style = (): Px | undefined => {
    const s = rp.style() as Px | undefined;
    // due to https://bugzilla.mozilla.org/show_bug.cgi?id=1959353, we can't use "fit-content".
    return resizeData && !isVirtualized ? { ...s, tableLayout: "fixed", width: "min-content" } : s;
  };
  const onMouseDown = props.onMouseDown;
  const onScroll = props.onScroll;
  const slot = props.slot || undefined;
  const dom = globalDOMProps(props, TABLE_OWNED);
  const attrs = () => {
    const a = tableProps(aria, view(), hasTabbableChild()).gridProps;
    // Autocomplete virtual focus: the collection itself is never tabbable.
    return read(shouldUseVirtualFocus) ? { ...a, tabIndex: undefined } : a;
  };
  const sortDescription = () => tableSortDescription({ locale }, view());
  const longPressDescription = () => {
    const v = view();
    return highlightSelectionDescription({
      selectionManager: v.selectionManager,
      hasItemActions: !!(shared.actions.onRowAction || shared.actions.onCellAction),
      locale,
    });
  };
  if (isVirtualized) {
    // RAC useElementType: inside a Virtualizer the table is `div`s (absolutely positioned views; a `<table>` cannot
    // hold the view wrappers). The grid element is the scroll container; its focused row / cell stays rendered.
    const virtualScroll = customRenderer?.onScroll;
    const focusedKey = data.selectionState.focusedKey;
    return (
      <>
        <div
          {...dom}
          {...attrs()}
          ref={rootRef as never}
          class={rp.class()}
          style={style()}
          slot={slot}
          data-focused={dataBool(focused())}
          data-focus-visible={dataBool(focusVisible())}
          onKeyDownCapture={(e) => {
            const v = view();
            gridKeyDownCapture(e, gridOf(v, e), v);
          }}
          onKeyDown={(e) => {
            const v = view();
            gridKeyDown(e, gridOf(v, e), v);
          }}
          onFocusIn={(e) => {
            const v = view();
            gridFocus(e, gridOf(v, e), v);
            onFocusInFromContext?.(e);
          }}
          onFocusOut={(e) => {
            focusMemo.blurred = e.relatedTarget == null ? (e.target as Element) : null;
            const v = view();
            gridBlur(e, gridOf(v, e), v);
          }}
          onFocus={(e) => focusStateFocus(rootInteraction, e)}
          onBlur={(e) => focusStateBlur(rootInteraction, e)}
          onMouseDown={(e) => {
            const v = view();
            gridMouseDown(e, gridOf(v, e), v);
            onMouseDown?.(e as never);
          }}
          onScroll={(e) => {
            virtualScroll?.(e);
            onScroll?.(e as never);
          }}
        >
          <Provider
            values={[
              [TableStateContext, view],
              [TableColumnResizeStateContext, layout],
              [TableOptionsContext, options],
              [TableInternalContext, internal],
              [SelectableCollectionContext, null],
              [FieldInputContext, null],
              // RAC: the rows share one SharedElementTransition scope (a SelectionIndicator animates between them).
              [SharedElementContext, sharedElements],
            ]}
          >
            {(customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection: collection as never, scrollRef: el, focusedKey }) as never}
          </Provider>
        </div>
        <div id={sortDescriptionId} hidden>
          {sortDescription() ?? ""}
        </div>
        <div id={internal.sortableDescriptionId} hidden>
          {formatMessage(tableStrings, locale, "sortable")}
        </div>
        <div id={descriptionId} hidden>
          {longPressDescription() ?? ""}
        </div>
        {resizeData ? (
          <div id={internal.resizerDescriptionId} hidden>
            {formatMessage(tableStrings, locale, "resizerDescription")}
          </div>
        ) : null}
      </>
    );
  }
  return (
    <>
      <table
        {...dom}
        {...attrs()}
        ref={rootRef as never}
        class={rp.class()}
        style={style()}
        slot={slot}
        data-focused={dataBool(focused())}
        data-focus-visible={dataBool(focusVisible())}
        onKeyDownCapture={(e) => {
          const v = view();
          gridKeyDownCapture(e, gridOf(v, e), v);
        }}
        onKeyDown={(e) => {
          const v = view();
          gridKeyDown(e, gridOf(v, e), v);
        }}
        onFocusIn={(e) => {
          const v = view();
          gridFocus(e, gridOf(v, e), v);
          onFocusInFromContext?.(e);
        }}
        onFocusOut={(e) => {
          focusMemo.blurred = e.relatedTarget == null ? (e.target as Element) : null;
          const v = view();
          gridBlur(e, gridOf(v, e), v);
        }}
        onFocus={(e) => focusStateFocus(rootInteraction, e)}
        onBlur={(e) => focusStateBlur(rootInteraction, e)}
        onMouseDown={(e) => {
          const v = view();
          gridMouseDown(e, gridOf(v, e), v);
          onMouseDown?.(e as never);
        }}
        onScroll={(e) => onScroll?.(e as never)}
      >
        <Provider
          values={[
            [TableStateContext, view],
            [TableColumnResizeStateContext, layout],
            [TableOptionsContext, options],
            [TableInternalContext, internal],
            [SelectableCollectionContext, null],
            [FieldInputContext, null],
            // RAC: the rows share one SharedElementTransition scope (a SelectionIndicator animates between them).
            [SharedElementContext, sharedElements],
          ]}
        >
          {(customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection: collection as never, scrollRef: el }) as never}
        </Provider>
      </table>
      <div id={sortDescriptionId} hidden>
        {sortDescription() ?? ""}
      </div>
      <div id={internal.sortableDescriptionId} hidden>
        {formatMessage(tableStrings, locale, "sortable")}
      </div>
      <div id={descriptionId} hidden>
        {longPressDescription() ?? ""}
      </div>
      {resizeData ? (
        <div id={internal.resizerDescriptionId} hidden>
          {formatMessage(tableStrings, locale, "resizerDescription")}
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// TableHeader
// ---------------------------------------------------------------------------------------------

export interface TableHeaderRenderProps {
  /** Whether the table header is currently hovered with a mouse. @selector [data-hovered] */
  isHovered: () => boolean;
}

export interface TableHeaderProps<T> extends StyleRenderProps<TableHeaderRenderProps>, HoverEvents, GlobalDOMAttributes<HTMLTableSectionElement> {
  /** A list of table columns. */
  columns?: Iterable<T> | (() => Iterable<T>) | undefined;
  /** A list of `Column(s)` or a function. If the latter, a list of columns must be provided using the `columns` prop. */
  children?: unknown | ((item: T) => unknown);
  /** RAC parity; ignored (Rivet re-renders through signals). */
  dependencies?: readonly unknown[] | undefined;
  ref?: RefValue<HTMLTableSectionElement> | undefined;
}

const HOVER_OWNED = ["onPointerEnter", "onPointerLeave", "style"] as const;

/** A header within a `<Table>`, containing the table columns. */
export const TableHeader = /* @__PURE__ */ createBranchComponent(
  TableHeaderNode,
  function TableHeader<T>(props: TableHeaderProps<T>, ref: unknown) {
    const internal = useContext(TableInternalContext)!;
    const hovered = signal(false);
    const { onHoverStart, onHoverChange, onHoverEnd } = props;
    const interaction: InteractionStateOptions = {
      onHoverStart,
      onHoverChange,
      onHoverEnd,
      states: { isHovered: hovered },
    };
    const rp = untrack(() =>
      renderProps(
        { class: props.class, style: props.style, values: { isHovered: () => hovered() }, defaultClassName: "rv-TableHeader" },
        hasLive(props) ? (liveRenderProps(props) as never) : undefined,
      ),
    );
    const { onPointerEnter, onPointerLeave } = props;
    const dom = globalDOMProps(props, HOVER_OWNED);
    const rowKeys = (): Key[] => internal.collection().headerRows.map((row) => row.key);
    if (internal.isVirtualized) {
      // Virtualized (RAC useElementType): `div` row group inside the header view.
      return (
        <div
          {...dom}
          role="rowgroup"
          ref={ref as never}
          class={rp.class()}
          style={rp.style()}
          onPointerEnter={(e) => {
            hoverStateEnter(interaction, e);
            onPointerEnter?.(e as never);
          }}
          onPointerLeave={(e) => {
            hoverStateLeave(interaction, e);
            onPointerLeave?.(e as never);
          }}
        >
          {/* Not lazy (LAZY-T6): a header row holds the virtualizer's column views (a nested collection); a lazy
              header row materialised mid-layout lost them. Header rows are few: nothing to save. */}
          <For each={rowKeys} by={(k: Key) => k} lazy={false}>
            {(k: () => Key) => <TableHeaderRow rowKey={untrack(k)} />}
          </For>
        </div>
      );
    }
    return (
      <thead
        {...dom}
        role="rowgroup"
        ref={ref as never}
        class={rp.class()}
        style={rp.style()}
        onPointerEnter={(e) => {
          hoverStateEnter(interaction, e);
          onPointerEnter?.(e as never);
        }}
        onPointerLeave={(e) => {
          hoverStateLeave(interaction, e);
          onPointerLeave?.(e as never);
        }}
      >
        {/* Not lazy (LAZY-T6): header rows hold the column cells (a nested collection) and are few. */}
        <For each={rowKeys} by={(k: Key) => k} lazy={false}>
          {(k: () => Key) => <TableHeaderRow rowKey={untrack(k)} />}
        </For>
      </thead>
    );
  },
  (props) => Collection({ items: props.columns as CollectionProps<unknown>["items"], children: props.children }),
);

function TableHeaderRow(props: { rowKey: Key }) {
  const view = useContext(TableStateContext)! as () => TableStateLike<unknown>;
  const internal = useContext(TableInternalContext)!;
  const rowKey = props.rowKey;
  const isVirtualized = internal.isVirtualized;
  const locale = internal.locale;
  const attrs = () => {
    const v = view();
    const row = v.collection.headerRows.find((r) => r.key === rowKey);
    return row ? tableHeaderRowProps({ node: row, isVirtualized }, v).rowProps : { role: "row" };
  };
  // useTableSelectAllCheckbox
  const checkboxProps = {
    "aria-label": untrack(() => tableSelectAllCheckboxProps(view(), locale).checkboxProps["aria-label"]),
    isSelected: () => tableSelectAllCheckboxProps(view(), locale).checkboxProps.isSelected,
    isDisabled: () => tableSelectAllCheckboxProps(view(), locale).checkboxProps.isDisabled,
    isIndeterminate: () => tableSelectAllCheckboxProps(view(), locale).checkboxProps.isIndeterminate,
    onChange: () => tableSelectAllCheckboxChange(view()),
  };
  const cellKeys = (): Key[] => {
    const keys: Key[] = [];
    for (const n of internal.collection().getChildren(rowKey)) keys.push(n.key);
    return keys;
  };
  if (isVirtualized) {
    // Virtualized: `div` row; the virtualizer renders the column views.
    const branchRenderer = useContext(CollectionRendererContext);
    const customBranch = branchRenderer === DefaultCollectionRenderer ? undefined : branchRenderer;
    return (
      <div {...attrs()}>
        <Provider
          values={[
            [CheckboxContext, { slots: { selection: checkboxProps } }],
            [CheckboxFieldContext, { slots: { selection: checkboxProps } }],
          ]}
        >
          {/* The virtualizer renders the header row's column views (positioned by the layout). */}
          {
            (customBranch ?? DefaultCollectionRenderer).CollectionBranch({
              collection: internal.collection as never,
              parent: { key: rowKey } as never,
            }) as never
          }
        </Provider>
      </div>
    );
  }
  return (
    <tr {...attrs()}>
      <Provider
        values={[
          [CheckboxContext, { slots: { selection: checkboxProps } }],
          [CheckboxFieldContext, { slots: { selection: checkboxProps } }],
        ]}
      >
        {/* Columns are in the key map; header placeholders (nested columns) render nothing. */}
        <For each={cellKeys} by={(k: Key) => k}>
          {(k: () => Key) => renderNodeAt(internal.collection, k) as never}
        </For>
      </Provider>
    </tr>
  );
}

// ---------------------------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------------------------

export interface ColumnRenderProps {
  /** @selector [data-hovered] */
  isHovered: () => boolean;
  /** @selector [data-pressed] */
  isPressed: () => boolean;
  /** @selector [data-focused] */
  isFocused: () => boolean;
  /** @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Whether the column allows sorting. @selector [data-allows-sorting] */
  allowsSorting: () => boolean;
  /** The current sort direction. @selector [data-sort-direction="ascending | descending"] */
  sortDirection: () => SortDirection | undefined;
  /** Whether the column is currently being resized. @selector [data-resizing] */
  isResizing: () => boolean;
  /** Triggers sorting for this column in the given direction. */
  sort(direction: SortDirection): void;
  /** Starts column resizing if the table is contained in a `<ResizableTableContainer>` element. */
  startResize(): void;
}

export interface ColumnProps extends RenderProps<ColumnRenderProps>, GlobalDOMAttributes<HTMLTableCellElement> {
  /** The unique id of the column. */
  id?: Key | undefined;
  /** Whether the column allows sorting. */
  allowsSorting?: boolean | undefined;
  /** Whether a column is a row header and should be announced by assistive technology during row navigation. */
  isRowHeader?: boolean | undefined;
  /** A string representation of the column's contents, used for accessibility announcements. */
  textValue?: string | undefined;
  /** The width of the column (only inside a `<ResizableTableContainer>`). */
  width?: ColumnSize | null | undefined;
  /** The default width of the column (only inside a `<ResizableTableContainer>`). */
  defaultWidth?: ColumnSize | null | undefined;
  /** The minimum width of the column (only inside a `<ResizableTableContainer>`). */
  minWidth?: ColumnStaticSize | null | undefined;
  /** The maximum width of the column (only inside a `<ResizableTableContainer>`). */
  maxWidth?: ColumnStaticSize | null | undefined;
  /** Whether the column header or its first focusable child element should be focused when the column header is focused. */
  focusMode?: "child" | "cell" | undefined;
  /** Whether the column supports arrow key navigation even when the table uses tab keyboard navigation. */
  allowsArrowNavigation?: boolean | undefined;
  ref?: RefValue<HTMLTableCellElement> | undefined;
}

const COLUMN_OWNED = ["onPointerDown", "onPointerUp", "onPointerEnter", "onPointerLeave", "onMouseDown", "onClick", "onDragStart", "style", "id"] as const;

/** A column within a `<Table>`. */
export const Column = /* @__PURE__ */ createLeafComponent(TableColumnNode, function Column(props: ColumnProps, forwardedRef: unknown, column: Node<unknown>) {
  const view = useContext(TableStateContext)! as () => TableStateLike<unknown>;
  const internal = useContext(TableInternalContext)!;
  const layout = useContext(TableColumnResizeStateContext);
  const key = column.key;
  const isVirtualized = internal.isVirtualized;
  const locale = internal.locale;
  const descriptionId = internal.sortableDescriptionId;
  const { focusMode, allowsArrowNavigation } = props;
  const th = elementRef<HTMLTableCellElement>();
  const thRef = mergeRefValues<HTMLTableCellElement>(th as RefValue<HTMLTableCellElement>, forwardedRef as RefValue<HTMLTableCellElement> | undefined);
  const hopts = (v: TableStateLike<unknown>, el?: Element | null): AriaTableColumnHeaderProps<unknown> & GridCellProps => ({
    node: columnOf(v.collection as TableCollection<unknown>, key)!,
    isVirtualized,
    focusMode: focusMode ?? "child",
    allowsArrowNavigation,
    descriptionId,
    locale,
    ref: (el as HTMLElement | null | undefined) ?? undefined,
  });
  const attrs = () => {
    const v = view();
    return columnOf(v.collection as TableCollection<unknown>, key) ? tableColumnHeaderProps(hopts(v), v).columnHeaderProps : {};
  };
  const allowsSorting = () => !!columnOf(internal.collection(), key)?.props?.allowsSorting;
  const sortDirection = () => {
    const s = internal.data.sortDescriptor.value();
    return s?.column === key ? s.direction : undefined;
  };
  const isResizing = () => !!layout && layout().resizingColumn === key;
  const hovered = signal(false);
  const pressed = signal(false);
  const focused = signal(false);
  const focusVisible = signal(false);
  const interaction: InteractionStateOptions = {
    isDisabled: () => !allowsSorting(),
    states: { isHovered: hovered, isFocused: focused, isFocusVisible: focusVisible },
  };
  // usePress of useTableColumnHeader (options read per event).
  const press = (v: TableStateLike<unknown>): PressOptions => {
    const o = hopts(v);
    return {
      isDisabled: !tableColumnHeaderPressable(o, v),
      onPress: () => tableColumnHeaderPress(o, v, (k) => v.sort(k), view),
      onPressStart: () => pressed.set(true),
      onPressEnd: () => pressed.set(false),
    };
  };
  const values: ColumnRenderProps = {
    isHovered: () => hovered(),
    isPressed: () => pressed(),
    isFocused: () => focused(),
    isFocusVisible: () => focusVisible(),
    allowsSorting,
    sortDirection,
    isResizing,
    startResize: () => {
      if (!layout) throw new Error("Wrap your <Table> in a <ResizableTableContainer> to enable column resizing");
      layout().startResize(key);
      view().setKeyboardNavigationDisabled(true);
      focusColumnResizer(th() ?? null);
    },
    sort: (direction: SortDirection) => view().sort(key, direction),
  };
  const rp = untrack(() =>
    renderProps(
      { class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-Column" },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  const style = (): Px | undefined => {
    const s = rp.style() as Px | undefined;
    return layout ? { ...s, width: `${layout().getColumnWidth(key)}px` } : s;
  };
  const { onPointerDown, onPointerUp, onPointerEnter, onPointerLeave, onClick } = props;
  const dom = globalDOMProps(props, COLUMN_OWNED);
  if (isVirtualized) {
    // Virtualized (RAC useElementType): `div` column header inside its view.
    return (
      <div
        {...dom}
        {...attrs()}
        ref={thRef as never}
        class={rp.class()}
        style={style()}
        data-resizing={dataBool(isResizing())}
        data-allows-sorting={dataBool(allowsSorting())}
        data-sort-direction={sortDirection()}
        onKeyDownCapture={(e) => {
          const v = view();
          gridCellKeyDownCapture(e, hopts(v), v);
        }}
        onKeyDown={(e) => {
          const v = view();
          gridCellKeyDown(e, hopts(v), v);
          pressKeyDown(press(v), e);
        }}
        onKeyUp={(e) => {
          const v = view();
          gridCellKeyUp(e, hopts(v), v);
        }}
        onFocusIn={(e) => {
          const v = view();
          gridCellFocus(e, hopts(v), v);
        }}
        onFocus={(e) => {
          focusStateFocus(interaction, e);
        }}
        onBlur={(e) => {
          focusStateBlur(interaction, e);
        }}
        onPointerEnter={(e) => {
          hoverStateEnter(interaction, e);
          pressPointerEnter(press(view()), e);
          onPointerEnter?.(e as never);
        }}
        onPointerLeave={(e) => {
          hoverStateLeave(interaction, e);
          pressPointerLeave(press(view()), e);
          onPointerLeave?.(e as never);
        }}
        onPointerDown={(e) => {
          const v = view();
          gridCellPointerDown(e, hopts(v), v);
          pressPointerDown(press(v), e);
          onPointerDown?.(e as never);
        }}
        onPointerUp={(e) => {
          const v = view();
          gridCellPointerUp(e, hopts(v), v);
          pressPointerUp(press(v), e);
          onPointerUp?.(e as never);
        }}
        onMouseDown={(e) => pressMouseDown(press(view()), e)}
        onClick={(e) => {
          const v = view();
          gridCellClick(e, hopts(v), v);
          pressClick(press(v), e);
          onClick?.(e as never);
        }}
        onDragStart={(e) => pressDragStart(press(view()), e)}
      >
        {
          // A binding (not a Provider child slot): a render function that reads render-prop accessors
          // and returns text re-runs on change, as RAC re-renders.
          provide(ColumnResizerContext, { columnKey: key, triggerRef: th }, () =>
            provide(CollectionRendererContext, DefaultCollectionRenderer, () => rp.children()),
          ) as never
        }
      </div>
    );
  }
  return (
    <th
      {...dom}
      {...attrs()}
      ref={thRef as never}
      class={rp.class()}
      style={style()}
      data-resizing={dataBool(isResizing())}
      data-allows-sorting={dataBool(allowsSorting())}
      data-sort-direction={sortDirection()}
      onKeyDownCapture={(e) => {
        const v = view();
        gridCellKeyDownCapture(e, hopts(v), v);
      }}
      onKeyDown={(e) => {
        const v = view();
        gridCellKeyDown(e, hopts(v), v);
        pressKeyDown(press(v), e);
      }}
      onKeyUp={(e) => {
        const v = view();
        gridCellKeyUp(e, hopts(v), v);
      }}
      onFocusIn={(e) => {
        const v = view();
        gridCellFocus(e, hopts(v), v);
      }}
      onFocus={(e) => {
        focusStateFocus(interaction, e);
      }}
      onBlur={(e) => {
        focusStateBlur(interaction, e);
      }}
      onPointerEnter={(e) => {
        hoverStateEnter(interaction, e);
        pressPointerEnter(press(view()), e);
        onPointerEnter?.(e as never);
      }}
      onPointerLeave={(e) => {
        hoverStateLeave(interaction, e);
        pressPointerLeave(press(view()), e);
        onPointerLeave?.(e as never);
      }}
      onPointerDown={(e) => {
        const v = view();
        gridCellPointerDown(e, hopts(v), v);
        pressPointerDown(press(v), e);
        onPointerDown?.(e as never);
      }}
      onPointerUp={(e) => {
        const v = view();
        gridCellPointerUp(e, hopts(v), v);
        pressPointerUp(press(v), e);
        onPointerUp?.(e as never);
      }}
      onMouseDown={(e) => pressMouseDown(press(view()), e)}
      onClick={(e) => {
        const v = view();
        gridCellClick(e, hopts(v), v);
        pressClick(press(v), e);
        onClick?.(e as never);
      }}
      onDragStart={(e) => pressDragStart(press(view()), e)}
    >
      {
        // A binding (not a Provider child slot): a render function that reads render-prop accessors
        // and returns text re-runs on change, as RAC re-renders.
        provide(ColumnResizerContext, { columnKey: key, triggerRef: th }, () =>
          provide(CollectionRendererContext, DefaultCollectionRenderer, () => rp.children()),
        ) as never
      }
    </th>
  );
});

// ---------------------------------------------------------------------------------------------
// ColumnResizer
// ---------------------------------------------------------------------------------------------

export interface ColumnResizerRenderProps {
  /** @selector [data-hovered] */
  isHovered: () => boolean;
  /** @selector [data-focused] */
  isFocused: () => boolean;
  /** @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Whether the resizer is currently being resized. @selector [data-resizing] */
  isResizing: () => boolean;
  /** The direction that the column is currently resizable. @selector [data-resizable-direction="right | left | both"] */
  resizableDirection: () => "right" | "left" | "both";
}

export interface ColumnResizerProps extends HoverEvents, RenderProps<ColumnResizerRenderProps>, GlobalDOMAttributes<HTMLDivElement> {
  /** A custom accessibility label for the resizer. */
  "aria-label"?: string | undefined;
  ref?: RefValue<HTMLDivElement> | undefined;
}

const RESIZER_OWNED = ["onPointerDown", "onPointerUp", "onPointerEnter", "onPointerLeave", "onMouseDown", "onClick", "onDragStart", "style"] as const;

/** A draggable / keyboard-adjustable handle that resizes its Column (inside a ResizableTableContainer). */
export function ColumnResizer(props: ColumnResizerProps) {
  const layout = useContext(TableColumnResizeStateContext);
  if (!layout) throw new Error("Wrap your <Table> in a <ResizableTableContainer> to enable column resizing");
  const container = useContext(ResizableTableContainerContext)!;
  const { columnKey, triggerRef } = useContext(ColumnResizerContext)!;
  const internal = useContext(TableInternalContext)!;
  const locale = internal.locale;
  const direction = internal.direction;
  const column = untrack(() => columnOf(internal.collection(), columnKey))!;
  const ariaLabelProp = props["aria-label"];
  const id = `${internal.gridId}-${normalizeKey(columnKey)}-resizer`;
  const aria = tableColumnResizeProps(
    {
      column,
      "aria-label": ariaLabelProp || formatMessage(racStrings, locale, "tableResizer"),
      onResizeStart: container.onResizeStart,
      onResize: container.onResize,
      onResizeEnd: container.onResizeEnd,
      triggerRef,
      id,
      descriptionId: internal.resizerDescriptionId,
      locale,
    },
    layout,
  );
  const ring = useFocusRing();
  const hovered = signal(false);
  const { onHoverStart, onHoverChange, onHoverEnd } = props;
  const interaction: InteractionStateOptions = { onHoverStart, onHoverChange, onHoverEnd, states: { isHovered: hovered } };
  const resizableDirection = (): "right" | "left" | "both" => {
    const l = layout();
    const isEResizable = l.getColumnMinWidth(columnKey) >= l.getColumnWidth(columnKey);
    const isWResizable = l.getColumnMaxWidth(columnKey) <= l.getColumnWidth(columnKey);
    if (isEResizable) return direction === "rtl" ? "right" : "left";
    if (isWResizable) return direction === "rtl" ? "left" : "right";
    return "both";
  };
  const resizer = elementRef<HTMLDivElement>();
  const resizerRef = mergeRefValues<HTMLDivElement>(resizer as RefValue<HTMLDivElement>, props.ref);
  // The cursor of the resizer (computed style) for the full-screen cursor overlay.
  const cursor = signal("");
  clientEffect(() => {
    const node = resizer();
    resizableDirection();
    if (node) cursor.set(node.ownerDocument.defaultView?.getComputedStyle(node).cursor ?? "");
  });
  const values: ColumnResizerRenderProps = {
    isHovered: () => hovered(),
    isFocused: () => ring.isFocused(),
    isFocusVisible: () => ring.isFocusVisible(),
    isResizing: aria.isResizing,
    resizableDirection,
  };
  const rp = untrack(() =>
    renderProps(
      { class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-ColumnResizer" },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  const r = aria.resizerProps as Record<string, (e: never) => void>;
  const input = aria.inputProps as Record<string, unknown> & { onFocus: (e: FocusEvent) => void; onBlur: (e: FocusEvent) => void };
  const { onPointerDown, onPointerUp, onPointerEnter, onPointerLeave, onMouseDown, onClick } = props;
  const dom = globalDOMProps(props, RESIZER_OWNED);
  const { onFocus: inputFocus, onBlur: inputBlur, onChange: inputChange, style: inputStyle, ...inputAttrs } = input as Record<string, any>;
  // Cursor overlay is used to style the cursor against the entire screen.
  // Do not turn off pointer events or the cursor will no longer be styled.
  return (
    <div
      {...dom}
      ref={resizerRef as never}
      role="presentation"
      class={rp.class()}
      style={{ ...(rp.style() as Px | undefined), touchAction: "none" }}
      data-rv-column-resizer=""
      data-focused={dataBool(ring.isFocused())}
      data-focus-visible={dataBool(ring.isFocusVisible())}
      data-resizing={dataBool(aria.isResizing())}
      data-resizable-direction={resizableDirection()}
      onKeyDown={(e) => {
        r.onKeyDown!(e as never);
      }}
      onKeyUp={(e) => {
        r.onKeyUp!(e as never);
      }}
      onPointerDown={(e) => {
        r.onPointerDown!(e as never);
        onPointerDown?.(e as never);
      }}
      onPointerUp={(e) => {
        r.onPointerUp!(e as never);
        onPointerUp?.(e as never);
      }}
      onPointerEnter={(e) => {
        hoverStateEnter(interaction, e);
        r.onPointerEnter!(e as never);
        onPointerEnter?.(e as never);
      }}
      onPointerLeave={(e) => {
        hoverStateLeave(interaction, e);
        r.onPointerLeave!(e as never);
        onPointerLeave?.(e as never);
      }}
      onMouseDown={(e) => {
        r.onMouseDown!(e as never);
        onMouseDown?.(e as never);
      }}
      onClick={(e) => {
        r.onClick!(e as never);
        onClick?.(e as never);
      }}
      onDragStart={(e) => r.onDragStart!(e as never)}
    >
      {rp.children() as never}
      <input
        {...inputAttrs}
        style={inputStyle}
        onFocus={(e) => {
          inputFocus(e);
          // The ring's focus-in (binds its own blur while focused).
          (ring.focusProps.onFocusIn as (e: FocusEvent) => void)(e);
        }}
        onBlur={(e) => inputBlur(e)}
        onChange={(e) => inputChange(e)}
      />
      <Show when={() => aria.isResizing() && aria.isMouseResizing()}>
        {() => (
          <Portal>
            <div style={{ position: "fixed", top: "0", left: "0", bottom: "0", right: "0", cursor: cursor() }} data-testid="cursor-overlay" />
          </Portal>
        )}
      </Show>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// TableBody / TableFooter
// ---------------------------------------------------------------------------------------------

export interface TableBodyRenderProps {
  /** Whether the table body has no rows and should display its empty state. @selector [data-empty] */
  isEmpty: () => boolean;
  /** Whether the Table is currently the active drop target. @selector [data-drop-target] */
  isDropTarget: () => boolean;
}

export interface TableBodyProps<T> extends CollectionProps<T>, StyleRenderProps<TableBodyRenderProps>, GlobalDOMAttributes<HTMLTableSectionElement> {
  /** Provides content to display when there are no rows in the table. */
  renderEmptyState?: ((props: TableBodyRenderProps) => unknown) | undefined;
  ref?: RefValue<HTMLTableSectionElement> | undefined;
}

/** The body of a `<Table>`, containing the table rows. */
export const TableBody = /* @__PURE__ */ createBranchComponent(TableBodyNode, function TableBody<T>(props: TableBodyProps<T>, ref: unknown, node: Node<T>) {
  const internal = useContext(TableInternalContext)!;
  const branchRenderer = useContext(CollectionRendererContext);
  const customBranch = branchRenderer === DefaultCollectionRenderer ? undefined : branchRenderer;
  // The built renderer only reads the parent key: a plain object, not the node class instance (resumable capture).
  const branchParent = { key: node.key };
  const isEmpty = () => internal.collection().size === 0;
  const values: TableBodyRenderProps = { isEmpty, isDropTarget: () => false };
  const rp = untrack(() =>
    renderProps(
      { class: props.class, style: props.style, values, defaultClassName: "rv-TableBody" },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  const renderEmptyState = props.renderEmptyState;
  const numColumns = () => internal.collection().columnCount;
  const dom = globalDOMProps(props, ["style", "id"]);
  // TODO (upstream): TableBody doesn't support being the scrollable body of the table yet.
  if (internal.isVirtualized) {
    // Virtualized (RAC useElementType): `div` row group; the virtualizer renders the row views.
    return (
      <div {...dom} role="rowgroup" ref={ref as never} class={rp.class()} style={rp.style()} data-empty={dataBool(isEmpty())}>
        {(customBranch ?? DefaultCollectionRenderer).CollectionBranch({ collection: internal.collection as never, parent: branchParent as never }) as never}
        {renderEmptyState ? (
          <Show when={isEmpty}>
            {() => (
              <div role="row" style={{ height: "100%" }}>
                <div role="rowheader" aria-colspan={numColumns()} style={{ height: "100%" }}>
                  {renderEmptyState(values) as never}
                </div>
              </div>
            )}
          </Show>
        ) : null}
      </div>
    );
  }
  return (
    <tbody {...dom} role="rowgroup" ref={ref as never} class={rp.class()} style={rp.style()} data-empty={dataBool(isEmpty())}>
      {(customBranch ?? DefaultCollectionRenderer).CollectionBranch({ collection: internal.collection as never, parent: branchParent as never }) as never}
      {renderEmptyState ? (
        <Show when={isEmpty}>
          {() => (
            <tr role="row">
              <td role="rowheader" colSpan={numColumns()}>
                {renderEmptyState(values) as never}
              </td>
            </tr>
          )}
        </Show>
      ) : null}
    </tbody>
  );
});

export interface TableFooterProps<T> extends CollectionProps<T>, GlobalDOMAttributes<HTMLTableSectionElement> {
  /** The CSS class of the element. Default "rv-TableFooter". */
  class?: string | undefined;
  style?: Px | undefined;
  ref?: RefValue<HTMLTableSectionElement> | undefined;
}

/** The footer of a `<Table>`, containing table rows. */
export const TableFooter = /* @__PURE__ */ createBranchComponent(TableFooterNode, function TableFooter<
  T,
>(props: TableFooterProps<T>, ref: unknown, node: Node<T>) {
  const internal = useContext(TableInternalContext)!;
  const branchRenderer = useContext(CollectionRendererContext);
  const customBranch = branchRenderer === DefaultCollectionRenderer ? undefined : branchRenderer;
  // The built renderer only reads the parent key: a plain object, not the node class instance (resumable capture).
  const branchParent = { key: node.key };
  const dom = globalDOMProps(props, ["style", "id"]);
  const className = props.class || "rv-TableFooter";
  const style = props.style;
  if (internal.isVirtualized) {
    // Virtualized (RAC useElementType): `div` row group.
    return (
      <div {...dom} role="rowgroup" ref={ref as never} class={className} style={style}>
        {(customBranch ?? DefaultCollectionRenderer).CollectionBranch({ collection: internal.collection as never, parent: branchParent as never }) as never}
      </div>
    );
  }
  return (
    <tfoot {...dom} role="rowgroup" ref={ref as never} class={className} style={style}>
      {(customBranch ?? DefaultCollectionRenderer).CollectionBranch({ collection: internal.collection as never, parent: branchParent as never }) as never}
    </tfoot>
  );
});

// ---------------------------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------------------------

export interface RowRenderProps {
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
  /** Whether the row's children have keyboard focus. @selector [data-focus-visible-within] */
  isFocusVisibleWithin: () => boolean;
  /** The unique id of the row. */
  id: Key;
  /** Whether the row is expanded. @selector [data-expanded] */
  isExpanded: () => boolean;
  /** Whether the row has child rows. @selector [data-has-child-items] */
  hasChildItems: () => boolean;
  /** What level the row has within the table. @selector [data-level] */
  level: () => number;
  /** State of the table (accessor of the view). */
  state: () => TableState<unknown>;
}

export interface RowProps<T>
  extends StyleRenderProps<RowRenderProps>, LinkDOMProps, HoverEvents, PressEvents, Omit<GlobalDOMAttributes<HTMLTableRowElement>, "onClick"> {
  /** A list of columns used when dynamically rendering cells. */
  columns?: Iterable<T> | (() => Iterable<T>) | undefined;
  /** The cells within the row. Supports static items or a function for dynamic rendering. */
  children?: unknown | ((item: T) => unknown);
  /** The object value that this row represents. When using dynamic collections, this is set automatically. */
  value?: T | undefined;
  /** RAC parity; ignored (Rivet re-renders through signals). */
  dependencies?: readonly unknown[] | undefined;
  /** A string representation of the row's contents, used for features like typeahead. */
  textValue?: string | undefined;
  /** Whether the row is disabled. */
  isDisabled?: boolean | undefined;
  /** Whether `disabledKeys` applies to all interactions, or only selection. */
  disabledBehavior?: DisabledBehavior | undefined;
  /** Handler that is called when a user performs an action on the row. */
  onAction?: (() => void) | undefined;
  /** The unique id of the row. */
  id?: Key | undefined;
  /** Whether this row has children, even if not loaded yet. */
  hasChildItems?: boolean | undefined;
  ref?: RefValue<HTMLTableRowElement> | undefined;
}

/** Global DOM events Row handles itself (the user's chain after its own); RAC drops `onClick`. */
const ROW_OWNED = [
  "onPointerDown",
  "onPointerUp",
  "onPointerCancel",
  "onPointerEnter",
  "onPointerLeave",
  "onDblClick",
  "onDragStart",
  "onClick",
  "style",
  "id",
] as const;

/**
 * A row's resume state (CELL-DIET 2026-10-19): the one value its handlers and bindings capture; the row state computed,
 * render props, focus ring and interaction options derive from it per instance (`rowOf`), as for `CellData`.
 */
interface RowData {
  key: Key;
  view: () => TableStateLike<unknown>;
  isVirtualized: boolean;
  locale: string;
  router: ReturnType<typeof useRouter>;
  expandButtonId: string;
  hasChildItems: boolean | undefined;
  onHoverStart: RowProps<unknown>["onHoverStart"];
  onHoverChange: RowProps<unknown>["onHoverChange"];
  onHoverEnd: RowProps<unknown>["onHoverEnd"];
  hovered: Signal<boolean>;
  pressed: Signal<boolean>;
  focusVisible: Signal<boolean>;
  /** Focus-within ring signals (RA `useFocusRing({ within: true })`). */
  withinFocused: Signal<boolean>;
  withinVisible: Signal<boolean>;
  /** Static render props (unset when live: `live` holds the per-key views). */
  class: RowProps<unknown>["class"];
  style: RowProps<unknown>["style"];
  live: LiveRenderProps<RowRenderProps> | undefined;
}

interface RowState {
  aria: ReturnType<typeof tableRowProps>;
  hasChildItems: boolean;
  isExpanded: boolean;
  level: number;
  selectionMode: SelectionMode;
  selectionBehavior: SelectionBehavior;
}

interface RowDerived {
  st: () => RowState | null;
  values: RowRenderProps;
  rp: RenderPropsHookRetVal;
  interaction: InteractionStateOptions;
  ring: Parameters<typeof focusRingFocus>[0];
}

const rowDerived = /* @__PURE__ */ new WeakMap<RowData, RowDerived>();
// Row slot values shared by every row (one resume entry each): context consumers copy them, never write.
const NO_SLOT_PROPS = {};
const DRAG_SLOT_PROPS = { style: { pointerEvents: "none" } };
const ROW_BUTTONS = { slots: { [DEFAULT_SLOT]: NO_SLOT_PROPS, chevron: NO_SLOT_PROPS, drag: DRAG_SLOT_PROPS } };

function rowOptions(r: RowData, v: TableStateLike<unknown>, el?: Element | null): AriaTableRowProps<unknown> {
  return {
    node: v.collection.getItem(r.key) as GridNode<unknown>,
    isVirtualized: r.isVirtualized,
    shouldSelectOnPressUp: false,
    expandButtonId: r.expandButtonId,
    router: r.router,
    locale: r.locale,
    ref: (el as HTMLElement | null | undefined) ?? undefined,
  };
}

/** The derived parts of a row (built once per `RowData`; owner as `cellOf`). */
function rowOf(r: RowData): RowDerived {
  let d = rowDerived.get(r);
  if (!d) rowDerived.set(r, (d = untrack(() => runWithOwner(null, () => deriveRow(r)))));
  return d;
}

function initRow(r: RowData): RowDerived {
  const d = deriveRow(r);
  rowDerived.set(r, d);
  return d;
}

function deriveRow(r: RowData): RowDerived {
  const { view, key, locale } = r;
  const st = computed((): RowState | null => {
    const v = view();
    const n = v.collection.getItem(key) as GridNode<unknown> | null;
    if (!n) return null;
    const aria = tableRowProps(rowOptions(r, v), v, locale);
    const hasChildItems = !!r.hasChildItems || v.collection.getItem((n as { lastChildKey?: Key | null }).lastChildKey!)?.type !== "cell";
    return {
      aria,
      hasChildItems,
      isExpanded: hasChildItems && v.expandedKeys.has(key),
      level: n.level + 1,
      selectionMode: v.selectionManager.selectionMode,
      selectionBehavior: v.selectionManager.selectionBehavior,
    };
  });
  const interaction: InteractionStateOptions = {
    // because of https://bugs.webkit.org/show_bug.cgi?id=214609, hover only when selectable or with an action.
    isDisabled: () => !st()?.aria.allowsSelection && !st()?.aria.hasAction,
    onHoverStart: r.onHoverStart,
    onHoverChange: r.onHoverChange,
    onHoverEnd: r.onHoverEnd,
    states: { isHovered: r.hovered, isFocusVisible: r.focusVisible },
  };
  const values: RowRenderProps = {
    isHovered: () => r.hovered(),
    isPressed: () => r.pressed(),
    // Provided to the row's content (SelectionIndicatorContext, the selection checkbox): captures only `r`.
    isSelected: () => !!rowOf(r).st()?.aria.isSelected,
    isFocused: () => !!st()?.aria.isFocused,
    isFocusVisible: () => r.focusVisible(),
    isDisabled: () => !!st()?.aria.isDisabled,
    selectionMode: () => st()?.selectionMode ?? "none",
    selectionBehavior: () => st()?.selectionBehavior ?? "toggle",
    allowsDragging: () => false,
    isDragging: () => false,
    isDropTarget: () => false,
    isFocusVisibleWithin: () => r.withinVisible(),
    id: key,
    hasChildItems: () => !!st()?.hasChildItems,
    isExpanded: () => !!st()?.isExpanded,
    level: () => st()?.level ?? 1,
    state: view,
  };
  const rp = untrack(() =>
    renderProps(
      { class: r.class, style: r.style, values, defaultClassName: "rv-Row", defaultStyle: { "--table-row-level": untrack(values.level) } },
      r.live as never,
    ),
  );
  // useFocusRing({ within: true }) over the row's own signals (the binding of `data-focus-visible-within` reads them).
  const ring = {
    props: { within: true },
    focused: r.withinFocused,
    visible: r.withinVisible,
    state: { isFocused: false, isFocusVisible: isFocusVisible(), unsubscribe: null },
  };
  return { st, values, rp, interaction, ring };
}

/** Row `isPressed` lives in the press memo of the row element: re-read it after the row's press handlers. */
function rowSyncPressed(r: RowData, target: EventTarget | null): void {
  const v = r.view();
  if (v.collection.getItem(r.key)) r.pressed.set(tableRowProps(rowOptions(r, v, target as Element | null), v, r.locale).isPressed);
}

/** A row event through a grid row handler (+ the pressed re-read). */
function rowOn(r: RowData, e: Event, fn: (e: never, props: AriaTableRowProps<unknown>, state: TableStateLike<unknown>) => void, sync?: boolean): void {
  const v = r.view();
  fn(e as never, rowOptions(r, v), v);
  if (sync) rowSyncPressed(r, e.currentTarget);
}

/** The row's own attributes after the user's DOM props (one spread binding). */
function rowAttrs(r: RowData): Record<string, unknown> {
  const { st, values, rp } = rowOf(r);
  const selectionMode = values.selectionMode();
  return {
    ...(st()?.aria.rowProps ?? { role: "row" }),
    class: rp.class(),
    style: rp.style(),
    "data-disabled": dataBool(values.isDisabled()),
    "data-selected": dataBool(values.isSelected()),
    "data-focused": dataBool(values.isFocused()),
    "data-pressed": dataBool(r.pressed()),
    "data-selection-mode": selectionMode === "none" ? undefined : selectionMode,
    "data-expanded": dataBool(values.isExpanded()),
    "data-has-child-items": dataBool(values.hasChildItems()),
    "data-level": values.level(),
    "data-focus-visible-within": dataBool(values.isFocusVisibleWithin()),
  };
}

/** A row within a `<Table>`. */
export const Row = /* @__PURE__ */ createBranchComponent(
  TableRowNode,
  function Row<T>(props: RowProps<T>, forwardedRef: unknown, item: Node<T>) {
    const view = useContext(TableStateContext)! as () => TableStateLike<unknown>;
    const internal = useContext(TableInternalContext)!;
    const key = item.key;
    const locale = internal.locale;
    const rowBase = `${internal.gridId}-${normalizeKey(key)}`;
    const expandButtonId = rowBase + "-expand";
    const checkboxId = rowBase + "-checkbox";
    const isTreeGrid = internal.data.treeColumn != null;
    const live = hasLive(props);
    const r: RowData = {
      key,
      view,
      isVirtualized: internal.isVirtualized,
      locale,
      router: useRouter(),
      expandButtonId,
      hasChildItems: props.hasChildItems,
      onHoverStart: props.onHoverStart,
      onHoverChange: props.onHoverChange,
      onHoverEnd: props.onHoverEnd,
      hovered: signal(false),
      pressed: signal(false),
      focusVisible: signal(false),
      withinFocused: signal(false),
      withinVisible: signal(false),
      class: live ? undefined : props.class,
      style: live ? undefined : props.style,
      live: live ? (liveRenderProps(props, ["class", "style"]) as LiveRenderProps<RowRenderProps>) : undefined,
    };
    const { values } = initRow(r);
    // useTableSelectionCheckbox (Rivet: the id derives from the table id + row key, see header). One slots value for
    // CheckboxContext + CheckboxFieldContext; closures capture `r` (the row region's providers are in its resume state).
    const checkboxSlots = {
      slots: {
        [DEFAULT_SLOT]: NO_SLOT_PROPS,
        selection: {
          id: checkboxId,
          "aria-label": untrack(() => tableSelectionCheckboxProps({ key, id: checkboxId, locale }, view()).checkboxProps["aria-label"]),
          "aria-labelledby": untrack(() => `${checkboxId} ${getRowLabelledBy(view(), key)}`),
          isSelected: values.isSelected,
          isDisabled: () => !r.view().selectionManager.canSelectItem(r.key),
          onChange: (isSelected: boolean) => tableSelectionCheckboxChange(isSelected, { key: r.key }, r.view()),
        },
      },
    };
    const buttons = isTreeGrid
      ? {
          slots: {
            [DEFAULT_SLOT]: NO_SLOT_PROPS,
            chevron: {
              id: expandButtonId,
              "aria-label": () => rowOf(r).st()?.aria.expandButtonProps["aria-label"],
              "aria-labelledby": untrack(() => rowOf(r).st()?.aria.expandButtonProps["aria-labelledby"]),
              isDisabled: () => !!rowOf(r).st()?.aria.expandButtonProps.isDisabled,
              excludeFromTabOrder: true,
              preventFocusOnPress: true,
              "data-react-aria-prevent-focus": "true",
              onPress: () => {
                const v = r.view();
                tableRowExpandPress(rowOptions(r, v), v);
              },
            },
            drag: DRAG_SLOT_PROPS,
          },
        }
      : ROW_BUTTONS;
    const { onPointerDown, onPointerUp, onPointerCancel, onPointerEnter, onPointerLeave, onDblClick } = props;
    const dom = globalDOMProps(props, ROW_OWNED);
    const branchRenderer = useContext(CollectionRendererContext);
    const customBranch = branchRenderer === DefaultCollectionRenderer ? undefined : branchRenderer;
    if (r.isVirtualized) {
      // Virtualized (RAC useElementType): `div` row inside its view; the virtualizer renders the cell views.
      return (
        <div
          {...dom}
          {...rowAttrs(r)}
          ref={forwardedRef as never}
          onKeyDown={(e) => {
            const v = r.view();
            gridRowKeyDown(e, rowOptions(r, v), v);
            if (!e.cancelBubble) tableRowKeyDown(e, rowOptions(r, v), v);
            rowSyncPressed(r, e.currentTarget);
          }}
          onKeyUp={(e) => rowOn(r, e, gridRowKeyUp, true)}
          onFocusIn={(e) => {
            // The row's own focus (was a native `focus` listener per row; it ran before this focusin): its `blur` binds while focused.
            const d = rowOf(r);
            focusStateIn(d.interaction, e);
            rowOn(r, e, gridRowFocus);
            focusRingFocus(d.ring, e);
          }}
          onFocusOut={(e) => focusRingBlur(rowOf(r).ring, e)}
          onPointerOver={(e) => hoverStateOver(rowOf(r).interaction, e)}
          onPointerEnter={onPointerEnter ? (e) => onPointerEnter(e as never) : undefined}
          onPointerLeave={onPointerLeave ? (e) => onPointerLeave(e as never) : undefined}
          onPointerDown={(e) => {
            rowOn(r, e, gridRowPointerDown, true);
            onPointerDown?.(e as never);
          }}
          onPointerUp={(e) => {
            rowOn(r, e, gridRowPointerUp, true);
            onPointerUp?.(e as never);
          }}
          onPointerCancel={(e) => {
            rowOn(r, e, gridRowPointerCancel, true);
            onPointerCancel?.(e as never);
          }}
          onClick={(e) => rowOn(r, e, gridRowClick, true)}
          onDblClick={(e) => {
            rowOn(r, e, gridRowDoubleClick);
            onDblClick?.(e as never);
          }}
          onDragStart={(e) => rowOn(r, e, gridRowDragStart)}
        >
          <Provider
            values={[
              [CheckboxContext, checkboxSlots],
              [CheckboxFieldContext, checkboxSlots],
              [ButtonContext, buttons],
              [SelectionIndicatorContext, { isSelected: values.isSelected }],
              [RowFocusContext, { isFocusVisibleWithinRow: values.isFocusVisibleWithin }],
            ]}
          >
            {/* The built renderer only reads the parent key: the row data (`key`), not the node class instance (resumable capture). */}
            {(customBranch ?? DefaultCollectionRenderer).CollectionBranch({ collection: internal.collection as never, parent: r as never }) as never}
          </Provider>
        </div>
      );
    }
    return (
      <tr
        {...dom}
        {...rowAttrs(r)}
        ref={forwardedRef as never}
        onKeyDown={(e) => {
          const v = r.view();
          gridRowKeyDown(e, rowOptions(r, v), v);
          if (!e.cancelBubble) tableRowKeyDown(e, rowOptions(r, v), v);
          rowSyncPressed(r, e.currentTarget);
        }}
        onKeyUp={(e) => rowOn(r, e, gridRowKeyUp, true)}
        onFocusIn={(e) => {
          // The row's own focus (was a native `focus` listener per row; it ran before this focusin): its `blur` binds while focused.
          const d = rowOf(r);
          focusStateIn(d.interaction, e);
          rowOn(r, e, gridRowFocus);
          focusRingFocus(d.ring, e);
        }}
        onFocusOut={(e) => focusRingBlur(rowOf(r).ring, e)}
        onPointerOver={(e) => hoverStateOver(rowOf(r).interaction, e)}
        onPointerEnter={onPointerEnter ? (e) => onPointerEnter(e as never) : undefined}
        onPointerLeave={onPointerLeave ? (e) => onPointerLeave(e as never) : undefined}
        onPointerDown={(e) => {
          rowOn(r, e, gridRowPointerDown, true);
          onPointerDown?.(e as never);
        }}
        onPointerUp={(e) => {
          rowOn(r, e, gridRowPointerUp, true);
          onPointerUp?.(e as never);
        }}
        onPointerCancel={(e) => {
          rowOn(r, e, gridRowPointerCancel, true);
          onPointerCancel?.(e as never);
        }}
        onClick={(e) => rowOn(r, e, gridRowClick, true)}
        onDblClick={(e) => {
          rowOn(r, e, gridRowDoubleClick);
          onDblClick?.(e as never);
        }}
        onDragStart={(e) => rowOn(r, e, gridRowDragStart)}
      >
        <Provider
          values={[
            [CheckboxContext, checkboxSlots],
            [CheckboxFieldContext, checkboxSlots],
            [ButtonContext, buttons],
            [SelectionIndicatorContext, { isSelected: values.isSelected }],
            [RowFocusContext, { isFocusVisibleWithinRow: values.isFocusVisibleWithin }],
          ]}
        >
          {/* The built renderer only reads the parent key: the row data (`key`), not the node class instance (resumable capture). */}
          {(customBranch ?? DefaultCollectionRenderer).CollectionBranch({ collection: internal.collection as never, parent: r as never }) as never}
        </Provider>
      </tr>
    );
  },
  (props) => {
    const children = props.children;
    if (props.id == null && typeof children === "function" && !isSlot(children)) {
      throw new Error("No id detected for the Row element. The Row element requires a id to be provided to it when the cells are rendered dynamically.");
    }
    return Collection({ items: props.columns as CollectionProps<unknown>["items"], children, idScope: props.id });
  },
);

// ---------------------------------------------------------------------------------------------
// Cell
// ---------------------------------------------------------------------------------------------

export interface CellRenderProps {
  /** @selector [data-pressed] */
  isPressed: () => boolean;
  /** @selector [data-focused] */
  isFocused: () => boolean;
  /** @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** @selector [data-hovered] */
  isHovered: () => boolean;
  /** Whether the parent row is selected. @selector [data-selected] */
  isSelected: () => boolean;
  /** Whether the parent row is disabled. @selector [data-disabled] */
  isDisabled: () => boolean;
  /** Whether the parent row's children have keyboard focus. @selector [data-focus-visible-within-row] */
  isFocusVisibleWithinRow: () => boolean;
  /** The unique id of the cell. */
  id?: Key | undefined;
  /** The index of the column that this cell belongs to (respects column spans). @selector [data-column-index] */
  columnIndex: () => number | null | undefined;
  /** Whether the cell belongs to the hierarchical tree column. @selector [data-tree-column] */
  isTreeColumn: () => boolean;
  /** Whether the parent row is expanded. @selector [data-expanded] */
  isExpanded: () => boolean;
  /** Whether the parent row has child rows. @selector [data-has-child-items] */
  hasChildItems: () => boolean;
  /** What level the parent row has within the table. @selector [data-level] */
  level: () => number;
}

export interface CellProps extends RenderProps<CellRenderProps>, GlobalDOMAttributes<HTMLTableCellElement> {
  /** The unique id of the cell. */
  id?: Key | undefined;
  /** A string representation of the cell's contents, used for features like typeahead. */
  textValue?: string | undefined;
  /** Indicates how many columns the data cell spans. */
  colSpan?: number | undefined;
  /** Whether the cell or its first focusable child element should be focused when the grid cell is focused. */
  focusMode?: "child" | "cell" | undefined;
  /** Whether the cell supports arrow key navigation even when the table uses tab keyboard navigation. */
  allowsArrowNavigation?: boolean | undefined;
  ref?: RefValue<HTMLTableCellElement> | undefined;
}

const CELL_OWNED = ["onPointerDown", "onPointerUp", "onPointerEnter", "onPointerLeave", "onClick", "style", "id"] as const;

/**
 * A cell's resume state (CELL-DIET 2026-10-19): the one value its handlers and bindings capture. Everything else (the
 * cell state computed, render props, interaction options) derives from it per instance (`cellOf`), on the server, on a
 * client render and lazily on a resumed page — so a server-rendered cell encodes one object + its three signals, not
 * ~25 captured closures / objects (1000-row table: 145 → … table entries per row).
 */
interface CellData {
  key: Key;
  rowKey: Key;
  view: () => TableStateLike<unknown>;
  isVirtualized: boolean;
  focusMode: CellProps["focusMode"];
  allowsArrowNavigation: CellProps["allowsArrowNavigation"];
  /** The row's `isFocusVisibleWithinRow` (RowFocusContext). */
  within: () => boolean;
  hovered: Signal<boolean>;
  focused: Signal<boolean>;
  focusVisible: Signal<boolean>;
  /** Static render props (unset when live: `live` holds the per-key views). */
  class: CellProps["class"];
  style: CellProps["style"];
  children: CellProps["children"];
  live: LiveRenderProps<CellRenderProps> | undefined;
}

interface CellDerived {
  st: () => (ReturnType<typeof tableCellProps> & CellStateExtra) | null;
  values: CellRenderProps;
  rp: RenderPropsHookRetVal;
  interaction: InteractionStateOptions;
}
interface CellStateExtra {
  isSelected: boolean;
  isDisabled: boolean;
  hasChildItems: boolean;
  isExpanded: boolean;
  level: number;
  columnIndex: number | null | undefined;
  isTreeColumn: boolean;
}

const cellDerived = /* @__PURE__ */ new WeakMap<CellData, CellDerived>();

function cellNode(c: CellData, v: TableStateLike<unknown>): GridNode<unknown> | null {
  const n = v.collection.getItem(c.key) as (GridNode<unknown> & { column?: GridNode<unknown> }) | null;
  if (n) n.column = v.collection.columns[n.index];
  return n;
}

function cellOptions(c: CellData, n: GridNode<unknown>): GridCellProps {
  return {
    node: n,
    isVirtualized: c.isVirtualized,
    focusMode: c.focusMode,
    allowsArrowNavigation: c.allowsArrowNavigation,
    shouldSelectOnPressUp: false,
    ref: undefined,
  };
}

/**
 * The derived parts of a cell: built by the component (`initCell`, under its owner) or, on a resumed page, on first
 * use outside any owner (page lifetime, as the resume decoder creates captured computeds) — never under the binding /
 * handler that asked first (its re-run would dispose the memoized computed).
 */
function cellOf(c: CellData): CellDerived {
  let d = cellDerived.get(c);
  if (!d) cellDerived.set(c, (d = untrack(() => runWithOwner(null, () => deriveCell(c)))));
  return d;
}

function initCell(c: CellData): void {
  cellDerived.set(c, deriveCell(c));
}

function deriveCell(c: CellData): CellDerived {
  const { view, rowKey } = c;
  const st = computed(() => {
    const v = view();
    const n = cellNode(c, v);
    if (!n) return null;
    const row = v.collection.getItem(rowKey) as (GridNode<unknown> & { lastChildKey?: Key | null }) | null;
    const hasChildItems = !!row && (!!row.props?.hasChildItems || v.collection.getItem(row.lastChildKey!)?.type !== "cell");
    return {
      ...tableCellProps(cellOptions(c, n), v),
      isSelected: v.selectionManager.isSelected(rowKey),
      isDisabled: v.selectionManager.isDisabled(rowKey),
      hasChildItems,
      isExpanded: hasChildItems && v.expandedKeys.has(rowKey),
      level: (row?.level ?? 0) + 1,
      // colIndex is null, when there is no span, falling back to using the index
      columnIndex: n.colIndex || n.index,
      isTreeColumn: (n as { column?: GridNode<unknown> }).column?.key === v.treeColumn,
    };
  });
  const values: CellRenderProps = {
    isPressed: () => !!st()?.isPressed,
    isFocused: () => c.focused(),
    isFocusVisible: () => c.focusVisible(),
    isHovered: () => c.hovered(),
    isSelected: () => !!st()?.isSelected,
    isDisabled: () => !!st()?.isDisabled,
    isFocusVisibleWithinRow: c.within,
    id: c.key,
    columnIndex: () => st()?.columnIndex,
    isTreeColumn: () => !!st()?.isTreeColumn,
    isExpanded: () => !!st()?.isExpanded,
    hasChildItems: () => !!st()?.hasChildItems,
    level: () => st()?.level ?? 1,
  };
  const rp = untrack(() => renderProps({ class: c.class, style: c.style, children: c.children, values, defaultClassName: "rv-Cell" }, c.live as never));
  const interaction: InteractionStateOptions = { states: { isHovered: c.hovered, isFocused: c.focused, isFocusVisible: c.focusVisible } };
  return { st: st as CellDerived["st"], values, rp, interaction };
}

/** A cell event with the node for the event (skipped once the cell left the collection). */
function cellOn(c: CellData, e: Event, fn: (e: never, props: GridCellProps, state: TableStateLike<unknown>) => void): void {
  const v = c.view();
  const n = cellNode(c, v);
  if (n) fn(e as never, cellOptions(c, n), v);
}

/** The cell's own attributes after the user's DOM props (one spread binding). */
function cellAttrs(c: CellData): Record<string, unknown> {
  const { st, values, rp } = cellOf(c);
  return {
    ...(st()?.gridCellProps ?? { role: "gridcell" }),
    class: rp.class(),
    style: rp.style(),
    "data-focus-visible-within-row": dataBool(c.within()),
    "data-pressed": dataBool(values.isPressed()),
    "data-selected": dataBool(values.isSelected()),
    "data-column-index": values.columnIndex() ?? undefined,
    "data-expanded": dataBool(values.isExpanded()),
    "data-has-child-items": dataBool(values.hasChildItems()),
    "data-level": values.level(),
    "data-tree-column": dataBool(values.isTreeColumn()),
    "data-disabled": dataBool(values.isDisabled()),
  };
}

/** A cell within a table row. */
export const Cell = /* @__PURE__ */ createLeafComponent(TableCellNode, function Cell(props: CellProps, forwardedRef: unknown, cell: Node<unknown>) {
  const view = useContext(TableStateContext)! as () => TableStateLike<unknown>;
  const internal = useContext(TableInternalContext)!;
  const rowFocus = useContext(RowFocusContext);
  const live = hasLive(props);
  const c: CellData = {
    key: cell.key,
    rowKey: cell.parentKey!,
    view,
    isVirtualized: internal.isVirtualized,
    focusMode: props.focusMode,
    allowsArrowNavigation: props.allowsArrowNavigation,
    within: rowFocus.isFocusVisibleWithinRow,
    hovered: signal(false),
    focused: signal(false),
    focusVisible: signal(false),
    class: live ? undefined : props.class,
    style: live ? undefined : props.style,
    children: live ? undefined : props.children,
    live: live ? (liveRenderProps(props) as LiveRenderProps<CellRenderProps>) : undefined,
  };
  initCell(c);
  const { onPointerDown, onPointerUp, onPointerEnter, onPointerLeave, onClick } = props;
  const dom = globalDOMProps(props, CELL_OWNED);
  if (c.isVirtualized) {
    // Virtualized (RAC useElementType): `div` cell inside its view.
    return (
      <div
        {...dom}
        {...cellAttrs(c)}
        ref={forwardedRef as never}
        onKeyDownCapture={(e) => cellOn(c, e, gridCellKeyDownCapture)}
        onKeyDown={(e) => {
          cellOn(c, e, gridCellKeyDown);
        }}
        onKeyUp={(e) => {
          cellOn(c, e, gridCellKeyUp);
        }}
        onFocusIn={(e) => {
          // The cell's own focus (was a native `focus` listener per cell, before this focusin); its `blur` binds while focused.
          focusStateIn(cellOf(c).interaction, e);
          cellOn(c, e, gridCellFocus);
        }}
        onPointerOver={(e) => hoverStateOver(cellOf(c).interaction, e)}
        onPointerEnter={onPointerEnter ? (e) => onPointerEnter(e as never) : undefined}
        onPointerLeave={onPointerLeave ? (e) => onPointerLeave(e as never) : undefined}
        onPointerDown={(e) => {
          cellOn(c, e, gridCellPointerDown);
          onPointerDown?.(e as never);
        }}
        onPointerUp={(e) => {
          cellOn(c, e, gridCellPointerUp);
          onPointerUp?.(e as never);
        }}
        onClick={(e) => {
          cellOn(c, e, gridCellClick);
          onClick?.(e as never);
        }}
      >
        {provide(CollectionRendererContext, DefaultCollectionRenderer, () => cellOf(c).rp.children()) as never}
      </div>
    );
  }
  return (
    <td
      {...dom}
      {...cellAttrs(c)}
      ref={forwardedRef as never}
      onKeyDownCapture={(e) => cellOn(c, e, gridCellKeyDownCapture)}
      onKeyDown={(e) => {
        cellOn(c, e, gridCellKeyDown);
      }}
      onKeyUp={(e) => {
        cellOn(c, e, gridCellKeyUp);
      }}
      onFocusIn={(e) => {
        // The cell's own focus (was a native `focus` listener per cell, before this focusin); its `blur` binds while focused.
        focusStateIn(cellOf(c).interaction, e);
        cellOn(c, e, gridCellFocus);
      }}
      onPointerOver={(e) => hoverStateOver(cellOf(c).interaction, e)}
      onPointerEnter={onPointerEnter ? (e) => onPointerEnter(e as never) : undefined}
      onPointerLeave={onPointerLeave ? (e) => onPointerLeave(e as never) : undefined}
      onPointerDown={(e) => {
        cellOn(c, e, gridCellPointerDown);
        onPointerDown?.(e as never);
      }}
      onPointerUp={(e) => {
        cellOn(c, e, gridCellPointerUp);
        onPointerUp?.(e as never);
      }}
      onClick={(e) => {
        cellOn(c, e, gridCellClick);
        onClick?.(e as never);
      }}
    >
      {provide(CollectionRendererContext, DefaultCollectionRenderer, () => cellOf(c).rp.children()) as never}
    </td>
  );
});

// ---------------------------------------------------------------------------------------------
// TableLoadMoreItem
// ---------------------------------------------------------------------------------------------

export interface TableLoadMoreItemProps extends Omit<LoadMoreSentinelProps, "collection">, GlobalDOMAttributes<HTMLTableRowElement> {
  /** The CSS class of the element. Default "rv-TableLoadingIndicator". */
  class?: string | undefined;
  style?: Px | undefined;
  /** The load more spinner to render when loading additional items. */
  children?: unknown;
  /** Whether or not the loading spinner should be rendered (a value or an accessor). */
  isLoading?: MaybeAccessor<boolean | undefined>;
  ref?: RefValue<HTMLTableRowElement> | undefined;
}

/** A sentinel row: calls `onLoadMore` when scrolled near, and renders its children while `isLoading`. */
export const TableLoadMoreItem = /* @__PURE__ */ createLeafComponent(
  LoaderNode,
  function TableLoadingIndicator(props: TableLoadMoreItemProps, ref: unknown, item: Node<unknown>) {
    const internal = useContext(TableInternalContext)!;
    const isLoading = props.isLoading;
    const level = item.level + 1;
    const numColumns = () => internal.collection().columns.length;
    const sentinel = elementRef<HTMLDivElement>();
    const { onLoadMore, scrollOffset, style: userStyle } = props;
    loadMoreSentinel({ onLoadMore, collection: internal.collection, scrollOffset }, sentinel);
    const children = props.children;
    const className = props.class || "rv-TableLoadingIndicator";
    const style = { "--table-row-level": level, ...userStyle };
    const dom = globalDOMProps(props, ["style", "id"]);
    if (internal.isVirtualized) {
      // Virtualized (RAC useElementType): `div`s inside the loader view.
      return (
        <>
          <div style={{ height: "0" }} inert>
            <div style={{ padding: "0", border: "0" }}>
              <div data-testid="loadMoreSentinel" ref={sentinel} style={{ position: "relative", height: "1px", width: "1px" }} />
            </div>
          </div>
          <Show when={() => !!read(isLoading) && children != null}>
            {() => (
              <div {...dom} ref={ref as never} role="row" class={className} style={style} aria-level={level} data-level={level}>
                <div role="rowheader" aria-colspan={numColumns()}>
                  {children as never}
                </div>
              </div>
            )}
          </Show>
        </>
      );
    }
    return (
      <>
        {/* Always render the sentinel. For now onus is on the user for styling when using flex + gap. */}
        <tr style={{ height: "0" }} inert>
          <td style={{ padding: "0", border: "0" }}>
            <div data-testid="loadMoreSentinel" ref={sentinel} style={{ position: "relative", height: "1px", width: "1px" }} />
          </td>
        </tr>
        <Show when={() => !!read(isLoading) && children != null}>
          {() => (
            // For now don't include aria-rowindex on loader since they aren't keyboard focusable.
            <tr {...dom} ref={ref as never} role="row" class={className} style={style} aria-level={level} data-level={level}>
              <td role="rowheader" colSpan={numColumns()}>
                {children as never}
              </td>
            </tr>
          )}
        </Show>
      </>
    );
  },
);
