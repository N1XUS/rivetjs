// Rivet-authored (not a port): `@rivetjs/cdk/data-grid`, a headless, data-driven grid. Feature set inspired by commercial UI kits'
//  public DataGrid docs (prop and column names); independent implementation (no third-party source, styles or demos).
// Semantics follow React Aria's table (ARIA grid / treegrid, row + cell focus, selection, sorting, resizing; see
// `./behaviour.ts`); the RAC `@rivetjs/cdk/table` stays the faithful composable port — this module is the
// data-first, virtualization-first sibling (no collection build pass: rows are plain data through `./state.ts`).
// Rivet:
// - one native `<table role="grid|treegrid">` for both modes; `virtualized` renders the rows of the visible window
//   (fixed `rowHeight`) between two spacer rows, `aria-rowcount` / `aria-rowindex` describe the full set;
// - fine-grained: the pipeline (filter → sort → tree → page) is one computed; rows are keyed (`For` by row key), so
//   sorting moves rows, selecting updates two attributes per row, scrolling creates / drops only rows entering /
//   leaving the window — nothing re-renders;
// - every event handler is delegated on the `<table>` (no per-row closures; resume state stays small), pinned-column
//   offsets are CSS variables on the table (one binding), the drop indicator is one element;
// - behaviour-critical styles are inline (sticky header / pinned cells, `table-layout: fixed`, row heights, spacer
//   rows, resizer `touch-action`); looks are class names (`rv-DataGrid*` defaults, `*Class` props);
// - resumable: the server renders the first window (virtualized) or every row; nothing runs before an interaction
//   (`preload="visible"` on the root fetches the handler chunks when the grid shows up).
import { computed, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { For, Show, ref as elementRef } from "@rivetjs/runtime/dom";
import { splitProps } from "@rivetjs/runtime/props";
import type { DOMValue } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { controllable } from "../interactions/controllable.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { loadMoreSentinel } from "../utils/load-more-sentinel.tsx";
import { useLocale } from "../i18n/index.ts";
import {
  DRAG_COLUMN,
  SELECT_COLUMN,
  gridClick,
  gridDoubleClick,
  gridFocusIn,
  gridFocusOut,
  gridKeyDown,
  gridPointerDown,
  gridScroll,
  type DataGridContext,
  type DataGridReorderEvent,
  type DragState,
  type SelectionBehavior,
} from "./behaviour.ts";
import {
  columnCssWidths,
  dataGridRows,
  isKeySelected,
  pinnedOffsets,
  selectAllState,
  tableWidthPx,
  type DataGridColumnBase,
  type DataGridRow,
  type Key,
  type Selection,
  type SelectionMode,
  type SortDescriptor,
  type SortDirection,
  type VirtualWindow,
} from "./state.ts";

export * from "./state.ts";
export { DRAG_COLUMN, SELECT_COLUMN } from "./behaviour.ts";
export type { DataGridReorderEvent, DragState, SelectionBehavior } from "./behaviour.ts";

type MaybeAccessor<T> = T | (() => T);
const read = <T,>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);
const cx = (...parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join(" ") || undefined;

/** What a function `header` gets (accessor, read it in bindings). */
export interface DataGridHeaderInfo {
  sortDirection: () => SortDirection | undefined;
}

/** A column of the grid (`DataGridColumn` field names). */
export interface DataGridColumn<T> extends DataGridColumnBase<T> {
  /** Header content: text, or a function of the sort state (render JSX through a function: JSX props are eager). */
  header?: string | ((info: DataGridHeaderInfo) => Content) | undefined;
  /** Cell content (default: `String(item[accessorKey])`). Called once per rendered cell; read signals inside for live content. */
  cell?: ((item: T, column: DataGridColumn<T>) => Content) | undefined;
  /** Extra class of the header cell. */
  headerClass?: string | undefined;
  /** Extra class of every body cell of the column. */
  cellClass?: string | undefined;
}

/** Localized strings (English defaults). */
export interface DataGridStrings {
  select: string;
  selectAll: string;
  drag: string;
  expand: string;
  collapse: string;
  resize: (column: string) => string;
  dragStart: string;
  dragDrop: string;
  dragCancel: string;
}

export const defaultDataGridStrings: DataGridStrings = {
  select: "Select",
  selectAll: "Select All",
  drag: "Drag",
  expand: "Expand",
  collapse: "Collapse",
  resize: (column) => defaultResizeLabel(column),
  dragStart: "Started dragging. Press the arrow keys to move, Enter to drop, Escape to cancel.",
  dragDrop: "Dropped.",
  dragCancel: "Dropping canceled.",
};

export interface DataGridCheckboxState {
  isSelected: () => boolean;
  isIndeterminate: () => boolean;
}

export interface DataGridProps<T> extends GlobalDOMAttributes<HTMLDivElement> {
  /** Rows (top level). A Signal / accessor updates the grid in place. */
  data: MaybeAccessor<readonly T[]>;
  /** Column definitions in display order. */
  columns: MaybeAccessor<readonly DataGridColumn<T>[]>;
  /** Unique row key (default `item.id`, then `item.key`, then the index). */
  getRowId?: ((item: T, index: number) => Key) | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  id?: string | undefined;
  /** Root class (default `rv-DataGrid`). React-style `className`. */
  class?: string | undefined;
  style?: Record<string, string | number | undefined> | undefined;
  /** `<table>` class. React-style `contentClassName`. */
  contentClass?: string | undefined;
  /** Scroll container class. React-style `scrollContainerClassName`. */
  scrollContainerClass?: string | undefined;
  headerClass?: string | undefined;
  columnClass?: string | undefined;
  bodyClass?: string | undefined;
  rowClass?: string | undefined;
  cellClass?: string | undefined;
  /** Footer class. React-style `footerClassName`. */
  footerClass?: string | undefined;
  checkboxClass?: string | undefined;
  resizerClass?: string | undefined;
  expandButtonClass?: string | undefined;
  dragHandleClass?: string | undefined;
  emptyClass?: string | undefined;
  loadMoreClass?: string | undefined;
  dropIndicatorClass?: string | undefined;
  /** Vertical alignment of cell content (`data-vertical-align` on the root; styled by CSS). Default `"middle"`. */
  verticalAlign?: "top" | "middle" | "bottom" | undefined;

  selectionMode?: SelectionMode | undefined;
  /** Selected keys: value, two-way Signal or accessor. */
  selectedKeys?: Selection | Signal<Selection> | (() => Selection) | undefined;
  defaultSelectedKeys?: Selection | undefined;
  onSelectionChange?: ((keys: Selection) => void) | undefined;
  selectionBehavior?: SelectionBehavior | undefined;
  /** Prepend a checkbox column (multiple: select-all header). */
  showSelectionCheckboxes?: boolean | undefined;
  disabledKeys?: MaybeAccessor<Iterable<Key> | undefined>;
  disallowEmptySelection?: boolean | undefined;

  /** Controlled sort: the grid does not sort (server-side) unless `sortMode="client"`. Value, Signal or accessor. */
  sortDescriptor?: SortDescriptor | null | Signal<SortDescriptor | null> | (() => SortDescriptor | null) | undefined;
  defaultSortDescriptor?: SortDescriptor | undefined;
  onSortChange?: ((descriptor: SortDescriptor) => void) | undefined;
  /** Rivet: who sorts. Default `"client"` when uncontrolled, `"manual"` (data arrives sorted) when `sortDescriptor` is given. */
  sortMode?: "client" | "manual" | undefined;

  allowsColumnResize?: boolean | undefined;
  onColumnResize?: ((widths: Map<string, number>) => void) | undefined;
  onColumnResizeEnd?: ((widths: Map<string, number>) => void) | undefined;

  /** Enables row reordering (drag handle column): called with the moved keys, the target and the reordered data. */
  onReorder?: ((event: DataGridReorderEvent<T>) => void) | undefined;
  onRowAction?: ((key: Key) => void) | undefined;

  renderEmptyState?: (() => Content) | undefined;
  /** Content under the table (outside the horizontal scroll). */
  footer?: Content | undefined;
  onLoadMore?: (() => void) | undefined;
  isLoadingMore?: MaybeAccessor<boolean | undefined>;
  loadMoreContent?: Content | undefined;

  virtualized?: boolean | undefined;
  /** Body row height in px (virtualized: fixed). Default 42. */
  rowHeight?: number | undefined;
  /** Header row height in px. Default 36. */
  headingHeight?: number | undefined;
  /** Rivet: scroll container height (virtualized default 480). */
  height?: number | string | undefined;
  /** Rivet: rows rendered beyond each edge of the viewport (virtualized). Default 8. */
  overscan?: number | undefined;

  getChildren?: ((item: T) => readonly T[] | null | undefined) | undefined;
  /** Column holding the expand toggle + indentation (default: the row-header column). */
  treeColumn?: string | undefined;
  expandedKeys?: Iterable<Key> | Signal<Set<Key>> | (() => Set<Key>) | undefined;
  defaultExpandedKeys?: Iterable<Key> | undefined;
  onExpandedChange?: ((keys: Set<Key>) => void) | undefined;
  /** Indentation per level in px. Default 20. */
  treeIndent?: number | undefined;

  /** Rivet: client-side filter (read signals inside: the grid re-filters when they change). */
  filter?: ((item: T) => boolean) | null | undefined;
  /** Rivet: client-side pagination (after filter / sort / tree). */
  pageSize?: MaybeAccessor<number | undefined>;
  page?: MaybeAccessor<number | undefined>;

  /** Content of the selection checkboxes (headless: none). */
  renderCheckbox?: ((state: DataGridCheckboxState) => Content) | undefined;
  /** Content after a sortable header (headless: none). */
  renderSortIndicator?: ((direction: () => SortDirection | undefined) => Content) | undefined;
  /** Content of the expand toggle (headless: none). */
  renderExpandIcon?: ((isExpanded: () => boolean) => Content) | undefined;
  /** Content of the drag handle (headless: none). */
  renderDragHandle?: (() => Content) | undefined;
  strings?: Partial<DataGridStrings> | undefined;
}

const OWNED = ["style", "onScroll"] as const;
const LIVE_KEYS = ["data", "columns", "disabledKeys", "pageSize", "page", "isLoadingMore", "filter", "treeColumn"] as const;

const defaultResizeLabel = (column: string) => `Resize ${column}`;

/** Row computed equality: a row whose key just left the window keeps its last value until `For` disposes it. */
const keepRow = (previous: unknown, next: unknown) => previous === next || (next as DataGridRow<unknown>).index < 0;
/** Placeholder for a row whose key left the window before `For` disposed it (a resumed row's computed may run without
 * `keepRow`): bindings read harmless values, cell content renders nothing. */
const goneRow = (key: Key): DataGridRow<never> => ({
  key,
  item: undefined as never,
  depth: 0,
  parentKey: null,
  hasChildren: false,
  posInSet: 1,
  setSize: 1,
  index: -1,
});

const defaultRowId = (item: unknown, index: number): Key => {
  const o = item as { id?: Key; key?: Key } | null;
  return o?.id ?? o?.key ?? index;
};

const fieldText = (item: unknown, field: string): string => {
  const v = (item as Record<string, unknown> | null)?.[field];
  return v == null ? "" : String(v);
};

const UTILITY_SELECT = { id: SELECT_COLUMN, width: 44, minWidth: 44, maxWidth: 44 } satisfies DataGridColumnBase<unknown>;
const UTILITY_DRAG = { id: DRAG_COLUMN, width: 36, minWidth: 36, maxWidth: 36 } satisfies DataGridColumnBase<unknown>;

interface CellMeta<T> {
  col: DataGridColumn<T>;
  id: string;
  pinned: "start" | "end" | undefined;
  edge: "start" | "end" | undefined;
  style: Record<string, string> | undefined;
  cls: string | undefined;
  tree: boolean;
}

/** Headless data grid (see the module header). */
export function DataGrid<T>(props: DataGridProps<T>): DOMValue {
  const locale = useLocale().locale;
  const dom = globalDOMProps(props, OWNED);
  // Plain strings only (captured by bindings / handlers); `resize` is called through `resizeLabel`.
  const custom = props.strings ?? {};
  const strings = {
    select: custom.select ?? defaultDataGridStrings.select,
    selectAll: custom.selectAll ?? defaultDataGridStrings.selectAll,
    drag: custom.drag ?? defaultDataGridStrings.drag,
    expand: custom.expand ?? defaultDataGridStrings.expand,
    collapse: custom.collapse ?? defaultDataGridStrings.collapse,
    dragStart: custom.dragStart ?? defaultDataGridStrings.dragStart,
    dragDrop: custom.dragDrop ?? defaultDataGridStrings.dragDrop,
    dragCancel: custom.dragCancel ?? defaultDataGridStrings.dragCancel,
  };
  // PROPS-CAPTURE: closures capture locals (a captured `props` would serialize every prop, JSX content included);
  // live inputs go through `live` (splitProps: getters forward to the caller's props).
  const [live] = splitProps(props as unknown as Record<string, unknown>, LIVE_KEYS) as unknown as [Pick<DataGridProps<T>, (typeof LIVE_KEYS)[number]>];
  const customResize = props.strings?.resize;
  const rowIdProp = props.getRowId;
  const childrenProp = props.getChildren;
  const onRowAction = props.onRowAction;
  const onReorder = props.onReorder;
  const onColumnResize = props.onColumnResize;
  const onColumnResizeEnd = props.onColumnResizeEnd;
  const onLoadMore = props.onLoadMore;
  const disallowEmpty = !!props.disallowEmptySelection;
  const resizeLabel = (column: string) => (customResize ?? defaultResizeLabel)(column);
  const virtual = !!props.virtualized;
  const rowHeight = props.rowHeight ?? 42;
  const headerHeight = props.headingHeight ?? 36;
  const overscan = props.overscan ?? 8;
  const height = props.height ?? (virtual ? 480 : undefined);
  const showCheckboxes = !!props.showSelectionCheckboxes;
  const reorderable = !!props.onReorder;
  const resizable = !!props.allowsColumnResize;
  const isTree = !!props.getChildren;
  const treeIndent = props.treeIndent ?? 20;
  const selectionMode: SelectionMode = props.selectionMode ?? "none";
  const selectionBehavior: SelectionBehavior = props.selectionBehavior ?? "toggle";
  // Module-level defaults are referenced inside the closures (imports), never held in a captured local.
  const getRowId = (item: T, index: number): Key => (rowIdProp ?? defaultRowId)(item, index);
  const getChildren = (item: T): readonly T[] | null | undefined => childrenProp?.(item);
  const clientSort = props.sortMode ? props.sortMode === "client" : props.sortDescriptor === undefined;
  const renderCheckbox = props.renderCheckbox;
  const renderSortIndicator = props.renderSortIndicator;
  const renderExpandIcon = props.renderExpandIcon;
  const renderDragHandle = props.renderDragHandle;
  const renderEmptyState = props.renderEmptyState;
  const footer = props.footer;
  const loadMoreContent = props.loadMoreContent;
  const hasLoadMore = !!props.onLoadMore;

  const classes = {
    root: props.class ?? "rv-DataGrid",
    scroll: props.scrollContainerClass ?? "rv-DataGrid-scroll",
    table: props.contentClass ?? "rv-DataGrid-table",
    header: props.headerClass ?? "rv-DataGrid-header",
    column: props.columnClass ?? "rv-DataGrid-column",
    body: props.bodyClass ?? "rv-DataGrid-body",
    row: props.rowClass ?? "rv-DataGrid-row",
    cell: props.cellClass ?? "rv-DataGrid-cell",
    footer: props.footerClass ?? "rv-DataGrid-footer",
    checkbox: props.checkboxClass ?? "rv-DataGrid-checkbox",
    resizer: props.resizerClass ?? "rv-DataGrid-resizer",
    expand: props.expandButtonClass ?? "rv-DataGrid-expand",
    drag: props.dragHandleClass ?? "rv-DataGrid-drag",
    empty: props.emptyClass ?? "rv-DataGrid-empty",
    loadMore: props.loadMoreClass ?? "rv-DataGrid-loadMore",
    drop: props.dropIndicatorClass ?? "rv-DataGrid-dropIndicator",
  };

  // State.
  const selection = controllable<Selection>(props.selectedKeys as never, props.defaultSelectedKeys ?? new Set<Key>(), props.onSelectionChange);
  const sort = controllable<SortDescriptor | null>(
    props.sortDescriptor as never,
    props.defaultSortDescriptor ?? null,
    props.onSortChange as ((d: SortDescriptor | null) => void) | undefined,
  );
  const expanded = controllable<Set<Key>>(
    (props.expandedKeys instanceof Set || typeof props.expandedKeys === "function" || props.expandedKeys === undefined
      ? props.expandedKeys
      : new Set(props.expandedKeys)) as never,
    new Set(props.defaultExpandedKeys ?? []),
    props.onExpandedChange,
  );
  const widths = signal<Map<string, number> | null>(null);
  const resizing = signal<string | null>(null);
  const focus = signal<{ key: Key | null; col: string | null }>({ key: null, col: null });
  const anchor = signal<Key | null>(null);
  const drag = signal<DragState | null>(null);
  const initialRows = Math.ceil((typeof height === "number" ? height : 480) / rowHeight);
  const win = signal<VirtualWindow>({ start: 0, end: initialRows + overscan });

  const disabled = computed(() => new Set(read(live.disabledKeys) ?? []));
  const dataColumns = computed(() => read(live.columns));
  const columns = computed((): DataGridColumn<T>[] => {
    const data = dataColumns();
    const anyPinnedStart = data.some((c) => c.pinned === "start");
    const lead: DataGridColumn<T>[] = [];
    if (reorderable) lead.push({ ...UTILITY_DRAG, pinned: anyPinnedStart ? "start" : undefined });
    if (showCheckboxes && selectionMode !== "none") lead.push({ ...UTILITY_SELECT, pinned: anyPinnedStart ? "start" : undefined });
    const header = data.some((c) => c.isRowHeader) ? null : data[0]?.id;
    return [...lead, ...data.map((c) => (c.id === header ? { ...c, isRowHeader: true } : c))];
  });
  const treeColumn = computed(() => live.treeColumn ?? columns().find((c) => c.isRowHeader)?.id);
  const pipeline = computed(() =>
    dataGridRows<T>({
      data: read(live.data),
      columns: dataColumns(),
      getRowId,
      sort: clientSort ? sort.value() : null,
      filter: live.filter,
      getChildren: isTree ? getChildren : undefined,
      expandedKeys: isTree ? expanded.value() : undefined,
      pageSize: read(live.pageSize),
      page: read(live.page),
      locale,
    }),
  );
  const rows = computed(() => pipeline().rows);
  const windowRows = computed((): DataGridRow<T>[] => {
    const all = rows();
    if (!virtual) return all;
    const { start, end } = win();
    return all.slice(Math.min(start, all.length), Math.min(end, all.length));
  });
  const windowKeys = computed(() => windowRows().map((r) => r.key));
  const rowByKey = computed(() => {
    const map = new Map<Key, DataGridRow<T>>();
    for (const r of windowRows()) map.set(r.key, r);
    return map;
  });
  const topSpace = computed(() => (virtual ? Math.min(win().start, rows().length) * rowHeight : 0));
  const bottomSpace = computed(() => (virtual ? Math.max(0, rows().length - win().end) * rowHeight : 0));
  const pins = computed(() => pinnedOffsets(columns(), widths()));
  const colWidths = computed(() => columnCssWidths(columns(), widths()));
  const tableStyle = computed(() => {
    const w = tableWidthPx(columns(), widths());
    const style: Record<string, string> = { tableLayout: "fixed", borderCollapse: "separate", borderSpacing: "0", width: w == null ? "100%" : `${w}px` };
    if (w == null) {
      let min = 0;
      for (const c of columns()) min += typeof c.width === "number" ? c.width : (c.minWidth ?? 80);
      style.minWidth = `${min}px`;
    }
    columns().forEach((c, i) => {
      const pin = pins().get(c.id);
      if (pin) style[`--rv-dg-pin-${i}`] = `${pin.offset}px`;
    });
    return style;
  });
  const selectAll = computed(() =>
    selectAllState(
      selection.value(),
      rows().map((r) => r.key),
      disabled(),
    ),
  );
  const isSelected = (key: Key) => isKeySelected(selection.value(), key, disabled());
  const sortDirection = (id: string): SortDirection | undefined => {
    const s = sort.value();
    return s && s.column === id ? s.direction : undefined;
  };
  const isExpanded = (key: Key) => expanded.value().has(key);
  const loading = () => !!read(live.isLoadingMore);

  const ctx: DataGridContext<T> = {
    rows: () => rows(),
    columns: () => columns(),
    data: () => read(live.data),
    getRowId: (item, index) => getRowId(item, index),
    getChildren: (item) => getChildren(item),
    selection,
    mode: () => selectionMode,
    behavior: () => selectionBehavior,
    disabled: () => disabled(),
    disallowEmpty: () => disallowEmpty,
    sort,
    expanded,
    widths,
    resizing,
    focus,
    anchor,
    win,
    drag,
    virtual: () => virtual,
    rowHeight: () => rowHeight,
    headerHeight: () => headerHeight,
    overscan: () => overscan,
    hasAction: () => !!onRowAction,
    onRowAction: (key) => onRowAction?.(key),
    canReorder: () => reorderable,
    onReorder: (event) => onReorder?.(event),
    onColumnResize: (map) => onColumnResize?.(map),
    onColumnResizeEnd: (map) => onColumnResizeEnd?.(map),
    rtl: () => typeof document !== "undefined" && getComputedStyle(document.documentElement).direction === "rtl",
    strings: { dragStart: strings.dragStart, dragDrop: strings.dragDrop, dragCancel: strings.dragCancel },
  };

  const sentinel = elementRef<HTMLTableRowElement>();
  if (hasLoadMore) loadMoreSentinel({ collection: (() => rows()) as never, onLoadMore: () => onLoadMore?.() }, () => sentinel());

  // Static per-column style: alignment + sticky inset from the table's CSS variables.
  const cellStyle = (c: DataGridColumnBase<T>, index: number, header: boolean): Record<string, string> | undefined => {
    const style: Record<string, string> = {};
    if (c.align && c.align !== "start") style.textAlign = c.align === "end" ? "end" : "center";
    if (header) Object.assign(style, { position: "sticky", top: "0", zIndex: c.pinned ? "3" : "2" });
    if (c.pinned) {
      style.position = "sticky";
      if (!header) style.zIndex = "1";
      style[c.pinned === "start" ? "insetInlineStart" : "insetInlineEnd"] = `var(--rv-dg-pin-${index}, 0px)`;
    }
    return Object.keys(style).length ? style : undefined;
  };
  const headerText = (c: DataGridColumn<T>) => (typeof c.header === "string" ? c.header : c.id);

  // Per-column static cell data, computed once per column set: every body cell writes these as plain attributes
  // (locals compile to one `setAttr` each, no binding effect), so a 1k-row mount / sort creates no per-cell effect
  // beyond the content itself. The pinned edge depends on column order only (offsets live in the table's CSS vars).
  const cellMeta = computed((): CellMeta<T>[] => {
    const cols = columns();
    let startEdge = -1;
    let endEdge = -1;
    cols.forEach((c, i) => {
      if (c.pinned === "start") startEdge = i;
      else if (c.pinned === "end" && endEdge < 0) endEdge = i;
    });
    const tree = isTree ? treeColumn() : undefined;
    return cols.map((c, i) => ({
      col: c,
      id: c.id,
      pinned: c.pinned,
      edge: i === startEdge || i === endEdge ? c.pinned : undefined,
      style: cellStyle(c, i, false),
      cls: cx(classes.cell, c.cellClass),
      tree: tree !== undefined && c.id === tree,
    }));
  });
  const pinEdge = (c: DataGridColumnBase<T>) => cellMeta().find((m) => m.id === c.id)?.edge;

  const selectAllCheckbox = { isSelected: () => selectAll() === "all", isIndeterminate: () => selectAll() === "some" };
  const headerCell = (c: DataGridColumn<T>, index: number) => {
    if (c.id === SELECT_COLUMN) {
      return (
        <th
          role="columnheader"
          class={cx(classes.column, c.headerClass)}
          data-column={c.id}
          aria-colindex={index + 1}
          tabIndex={-1}
          style={cellStyle(c, index, true)}
          data-pinned={c.pinned}
          data-pinned-edge={pinEdge(c)}
        >
          {selectionMode === "multiple" ? (
            <span
              role="checkbox"
              class={classes.checkbox}
              data-rv-select-all=""
              tabIndex={-1}
              aria-label={strings.selectAll}
              aria-checked={selectAll() === "all" ? "true" : selectAll() === "some" ? "mixed" : "false"}
              data-selected={selectAll() === "all" ? "true" : undefined}
              data-indeterminate={selectAll() === "some" ? "true" : undefined}
            >
              {renderCheckbox?.(selectAllCheckbox)}
            </span>
          ) : (
            <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
              {strings.select}
            </span>
          )}
        </th>
      );
    }
    if (c.id === DRAG_COLUMN) {
      return (
        <th
          role="columnheader"
          class={cx(classes.column, c.headerClass)}
          data-column={c.id}
          aria-colindex={index + 1}
          tabIndex={-1}
          style={cellStyle(c, index, true)}
          data-pinned={c.pinned}
          data-pinned-edge={pinEdge(c)}
        >
          <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
            {strings.drag}
          </span>
        </th>
      );
    }
    const sortable = !!c.allowsSorting;
    const canResize = resizable && c.allowsResizing !== false;
    // Render-prop accessors are local consts over plain locals (compiler-registered: resumable when a cdk binding or a
    // caller's binding captures them).
    const columnId = c.id;
    const direction = () => sortDirection(columnId);
    const headerInfo = { sortDirection: direction };
    return (
      <th
        role="columnheader"
        class={cx(classes.column, c.headerClass)}
        data-column={c.id}
        aria-colindex={index + 1}
        tabIndex={-1}
        style={cellStyle(c, index, true)}
        data-pinned={c.pinned}
        data-pinned-edge={pinEdge(c)}
        aria-sort={sortable ? (sortDirection(c.id) ?? "none") : undefined}
        data-allows-sorting={sortable ? "true" : undefined}
        data-sort-direction={sortDirection(c.id)}
        data-resizing={resizing() === c.id ? "true" : undefined}
      >
        {typeof c.header === "function" ? c.header(headerInfo) : (c.header ?? c.id)}
        {sortable && renderSortIndicator ? renderSortIndicator(direction) : null}
        {canResize ? (
          <div
            role="separator"
            aria-orientation="vertical"
            class={classes.resizer}
            data-rv-resizer={c.id}
            tabIndex={-1}
            aria-label={resizeLabel(headerText(c))}
            aria-valuenow={widths()?.get(c.id)}
            aria-valuemin={c.minWidth ?? 40}
            aria-valuemax={c.maxWidth}
            data-resizing={resizing() === c.id ? "true" : undefined}
            style={{ touchAction: "none", cursor: "col-resize" }}
          />
        ) : null}
      </th>
    );
  };

  // Cell element: four literal shapes so that unstyled cells skip the style binding entirely. Row headers are
  // `<td role="rowheader">` as React Aria's Cell (always a `td`): no UA `th` centring / bold, `td` table looks apply.
  const cellShell = (m: CellMeta<T>, header: boolean, kids: Content) => {
    const id = m.id;
    const pinned = m.pinned;
    const edge = m.edge;
    const cls = m.cls;
    const style = m.style;
    const tree = m.tree ? "" : undefined;
    if (header)
      return style ? (
        <td role="rowheader" tabIndex={-1} class={cls} data-column={id} style={style} data-pinned={pinned} data-pinned-edge={edge} data-tree-column={tree}>
          {kids}
        </td>
      ) : (
        <td role="rowheader" tabIndex={-1} class={cls} data-column={id} data-pinned={pinned} data-pinned-edge={edge} data-tree-column={tree}>
          {kids}
        </td>
      );
    return style ? (
      <td role="gridcell" tabIndex={-1} class={cls} data-column={id} style={style} data-pinned={pinned} data-pinned-edge={edge} data-tree-column={tree}>
        {kids}
      </td>
    ) : (
      <td role="gridcell" tabIndex={-1} class={cls} data-column={id} data-pinned={pinned} data-pinned-edge={edge} data-tree-column={tree}>
        {kids}
      </td>
    );
  };

  const bodyCell = (m: CellMeta<T>, row: () => DataGridRow<T>, item: () => T, key: Key) => {
    const c = m.col;
    const rowSelected = () => isSelected(key);
    const rowExpanded = () => isExpanded(key);
    const rowCheckbox = { isSelected: rowSelected, isIndeterminate: () => false };
    if (c.id === SELECT_COLUMN)
      return cellShell(
        m,
        false,
        <span
          role="checkbox"
          class={classes.checkbox}
          data-rv-select=""
          tabIndex={-1}
          aria-label={strings.select}
          aria-checked={isSelected(key) ? "true" : "false"}
          aria-disabled={disabled().has(key) ? "true" : undefined}
          data-selected={isSelected(key) ? "true" : undefined}
        >
          {renderCheckbox?.(rowCheckbox)}
        </span>,
      );
    if (c.id === DRAG_COLUMN)
      return cellShell(
        m,
        false,
        <button type="button" class={classes.drag} data-rv-drag-handle="" tabIndex={-1} aria-label={strings.drag} style={{ touchAction: "none" }}>
          {renderDragHandle?.()}
        </button>,
      );
    const content = c.cell ? <>{item() === undefined ? null : c.cell(item(), c)}</> : <>{fieldText(item(), c.accessorKey ?? c.id)}</>;
    if (!m.tree) return cellShell(m, !!c.isRowHeader, content);
    const tree = (
      <>
        <span aria-hidden="true" data-rv-indent="" style={{ display: "inline-block", width: `${row().depth * treeIndent}px` }} />
        <Show when={() => row().hasChildren} fallback={<span aria-hidden="true" class={classes.expand} data-placeholder="" />}>
          <button
            type="button"
            class={classes.expand}
            data-rv-expand=""
            tabIndex={-1}
            aria-label={isExpanded(key) ? strings.collapse : strings.expand}
            aria-expanded={isExpanded(key) ? "true" : "false"}
            data-expanded={isExpanded(key) ? "true" : undefined}
          >
            {renderExpandIcon?.(rowExpanded)}
          </button>
        </Show>
      </>
    );
    return cellShell(m, !!c.isRowHeader, [tree, content]);
  };

  const colCount = () => columns().length;
  // Eager, statically inserted content (JSX props are nodes: never captured by a resumable site).
  const footerElement = footer != null ? <div class={classes.footer}>{footer}</div> : null;
  const loadMoreElement = hasLoadMore ? (
    <div data-rv-load-more-content="" hidden={!loading()}>
      {loadMoreContent}
    </div>
  ) : null;

  return (
    <div
      {...dom}
      class={classes.root}
      style={props.style}
      data-virtualized={virtual ? "true" : undefined}
      data-vertical-align={props.verticalAlign ?? "middle"}
      data-selection-mode={selectionMode}
      preload="visible"
    >
      <div
        class={classes.scroll}
        style={{
          overflow: "auto",
          position: "relative",
          height: virtual ? (typeof height === "number" ? `${height}px` : height) : undefined,
          maxHeight: !virtual && height != null ? (typeof height === "number" ? `${height}px` : height) : undefined,
          scrollPaddingBlockStart: `${headerHeight}px`,
          "--rv-dg-header-height": `${headerHeight}px`,
        }}
        onScroll={(e) => gridScroll(e, ctx)}
      >
        <table
          role={isTree ? "treegrid" : "grid"}
          class={classes.table}
          id={props.id}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={props["aria-describedby"]}
          aria-multiselectable={selectionMode === "multiple" ? "true" : undefined}
          aria-rowcount={pipeline().total + 1}
          aria-colcount={colCount()}
          tabIndex={0}
          style={tableStyle()}
          onKeyDown={(e) => gridKeyDown(e, ctx)}
          onClick={(e) => gridClick(e, ctx)}
          onDblClick={(e) => gridDoubleClick(e, ctx)}
          onPointerDown={(e) => gridPointerDown(e, ctx)}
          onFocusIn={(e) => gridFocusIn(e, ctx)}
          onFocusOut={(e) => gridFocusOut(e)}
        >
          <colgroup>
            {columns().map((c, i) => (
              <col data-column={c.id} style={{ width: colWidths()[i] }} />
            ))}
          </colgroup>
          <thead class={classes.header}>
            <tr role="row" aria-rowindex={1} style={{ height: `${headerHeight}px` }}>
              {columns().map((c, i) => headerCell(c, i))}
            </tr>
          </thead>
          <tbody class={classes.body}>
            <Show when={() => topSpace() > 0}>
              <tr aria-hidden="true" data-rv-spacer="">
                <td colSpan={colCount()} style={{ height: `${topSpace()}px`, padding: "0", border: "0" }} />
              </tr>
            </Show>
            <For each={windowKeys} by={(k) => k}>
              {(keyOf) => {
                // Rows are keyed by their (primitive) key: a resumed page adopts every server row on the first change
                // (item identity = the key), and a sort only moves rows. `row` keeps its last value while the row leaves.
                const key = untrack(keyOf);
                const row = computed((): DataGridRow<T> => rowByKey().get(key) ?? goneRow(key), { equals: keepRow });
                const item = computed(() => row().item);
                return (
                  <tr
                    role="row"
                    class={classes.row}
                    data-key={String(key)}
                    data-key-type={typeof key === "number" ? "number" : undefined}
                    tabIndex={-1}
                    aria-rowindex={row().index + 2}
                    aria-selected={selectionMode !== "none" ? (isSelected(key) ? "true" : "false") : undefined}
                    data-selected={selectionMode !== "none" && isSelected(key) ? "true" : undefined}
                    aria-disabled={disabled().has(key) ? "true" : undefined}
                    data-disabled={disabled().has(key) ? "true" : undefined}
                    aria-level={isTree ? row().depth + 1 : undefined}
                    aria-posinset={isTree ? row().posInSet : undefined}
                    aria-setsize={isTree ? row().setSize : undefined}
                    aria-expanded={isTree && row().hasChildren ? (isExpanded(key) ? "true" : "false") : undefined}
                    data-level={isTree ? row().depth + 1 : undefined}
                    style={
                      virtual
                        ? { height: `${rowHeight}px`, ["--table-row-level" as string]: isTree ? String(row().depth + 1) : undefined }
                        : isTree
                          ? { "--table-row-level": String(row().depth + 1) }
                          : undefined
                    }
                  >
                    {cellMeta().map((m) => bodyCell(m, row, item, key))}
                  </tr>
                );
              }}
            </For>
            <Show when={() => bottomSpace() > 0}>
              <tr aria-hidden="true" data-rv-spacer="">
                <td colSpan={colCount()} style={{ height: `${bottomSpace()}px`, padding: "0", border: "0" }} />
              </tr>
            </Show>
            <Show when={() => rows().length === 0 && !loading()}>
              <tr role="row" class={classes.empty} data-empty="">
                <td role="gridcell" colSpan={colCount()}>
                  {renderEmptyState?.()}
                </td>
              </tr>
            </Show>
            {hasLoadMore ? (
              <tr role="row" ref={sentinel} class={classes.loadMore} data-load-more="" data-loading={loading() ? "true" : undefined}>
                <td role="rowheader" colSpan={colCount()}>
                  {loadMoreElement}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {reorderable ? (
          <div
            aria-hidden="true"
            class={classes.drop}
            data-rv-drop-indicator=""
            style={{
              position: "absolute",
              insetInline: "0",
              height: "0",
              pointerEvents: "none",
              top: `${drag()?.indicator ?? 0}px`,
              display: drag()?.indicator != null && drag()?.target != null ? "block" : "none",
            }}
          />
        ) : null}
      </div>
      {footerElement}
    </div>
  );
}
