// Rivet-authored (not a port): the data pipeline and pure state helpers of `@rivetjs/cdk/data-grid`.
// Feature set scoped from public docs of commercial UI kits (prop / column names); independent implementation.
// Plain data in, plain data out: no signals, no closures kept, no DOM — the component (`./index.tsx`) wraps these in
// computeds, so a resumed page rebuilds every derived value from the serialized inputs.
//
// Pipeline (`dataGridRows`): filter → sort (per tree level, stable) → flatten expanded tree rows → paginate.
// Selection helpers follow react-stately's `Selection` model ("all" | Set of keys) and SelectionManager rules
// (disabled keys are never selected; toggling a key out of "all" materializes the selectable keys).
import type { Key, Selection, SelectionMode, SortDescriptor, SortDirection } from "../collections/types.ts";

export type { Key, Selection, SelectionMode, SortDescriptor, SortDirection };

/** A column width: pixels, a percentage of the grid width or a fraction of the remaining space. */
export type DataGridColumnSize = number | `${number}%` | `${number}fr`;

/** The data-only part of a column definition (what the pipeline and the layout read). */
export interface DataGridColumnBase<T> {
  /** Unique column id (also the `SortDescriptor.column` value). */
  id: string;
  /** Property of the row item shown in the column (and compared when sorting) unless `cell` / `sortFn` are given. */
  accessorKey?: (keyof T & string) | undefined;
  /** Whether the column labels its row (`<td role="rowheader">`, as React Aria). Default: the first data column. */
  isRowHeader?: boolean | undefined;
  /** Whether the column can be sorted by pressing its header. */
  allowsSorting?: boolean | undefined;
  /** Comparator used to sort by this column (ascending order); default compares `item[accessorKey]`. */
  sortFn?: ((a: T, b: T) => number) | undefined;
  /** Whether the column can be resized (needs `allowsColumnResize` on the grid). Default `true` when the grid allows resizing. */
  allowsResizing?: boolean | undefined;
  /** Width: px number, `"20%"` or `"2fr"`. Columns without a width share the remaining space (`1fr`). */
  width?: DataGridColumnSize | undefined;
  /** Minimum width in px (resizing never goes below it). Default 40. */
  minWidth?: number | undefined;
  /** Maximum width in px. */
  maxWidth?: number | undefined;
  /** Horizontal alignment of the header and the cells. Default `"start"`. */
  align?: "start" | "center" | "end" | undefined;
  /** Keep the column visible while scrolling horizontally (sticky); needs a numeric `width`. */
  pinned?: "start" | "end" | undefined;
}

/** One rendered body row: a flattened, possibly nested item. */
export interface DataGridRow<T> {
  key: Key;
  item: T;
  /** Nesting depth, 0 for top-level rows. */
  depth: number;
  /** Key of the parent row (`null` at the top level). */
  parentKey: Key | null;
  /** Whether `getChildren` returned at least one child. */
  hasChildren: boolean;
  /** 1-based position among its siblings and the sibling count (`aria-posinset` / `aria-setsize`). */
  posInSet: number;
  setSize: number;
  /** 0-based index in the flattened rows (before pagination). */
  index: number;
}

export interface DataGridPipelineInput<T> {
  data: readonly T[];
  columns: readonly DataGridColumnBase<T>[];
  getRowId: (item: T, index: number) => Key;
  /** Client-side sort (omit or `null`: keep the data order). */
  sort?: SortDescriptor | null | undefined;
  /** Row predicate; with a tree, a row stays when it or a descendant matches. */
  filter?: ((item: T) => boolean) | null | undefined;
  getChildren?: ((item: T) => readonly T[] | null | undefined) | undefined;
  /** Expanded row keys (`"all"`: every row with children). */
  expandedKeys?: Iterable<Key> | "all" | undefined;
  /** Rows per page (after flattening); omit to show every row. */
  pageSize?: number | undefined;
  /** 1-based page. */
  page?: number | undefined;
  /** Locale of the default string comparison. */
  locale?: string | undefined;
}

export interface DataGridPipelineResult<T> {
  /** The rows to render (current page). */
  rows: DataGridRow<T>[];
  /** Flattened row count before pagination. */
  total: number;
  /** Page count (1 when not paginated). */
  pageCount: number;
}

const collators = new Map<string, Intl.Collator>();
/** Locale-aware, numeric-aware collator (cached per locale). */
export function collatorFor(locale = "en-US"): Intl.Collator {
  let c = collators.get(locale);
  if (!c) collators.set(locale, (c = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })));
  return c;
}

/** Default comparison: `null` / `undefined` last, numbers / bigints / dates / booleans by value, the rest as locale strings. */
export function compareValues(a: unknown, b: unknown, collator: Intl.Collator): number {
  if (a === b) return 0;
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "bigint" && typeof b === "bigint") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return collator.compare(String(a), String(b));
}

/** The ascending comparator of a column (its `sortFn`, else `accessorKey` values), or `null` when it cannot sort. */
export function columnComparator<T>(column: DataGridColumnBase<T> | undefined, locale?: string): ((a: T, b: T) => number) | null {
  if (!column) return null;
  if (column.sortFn) return column.sortFn;
  const key = column.accessorKey ?? (column.id as keyof T & string);
  const collator = collatorFor(locale);
  return (a, b) => compareValues((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], collator);
}

/** Stable sort of `items` by `column` in `direction` (returns a new array). */
export function sortItems<T>(items: readonly T[], compare: (a: T, b: T) => number, direction: SortDirection): T[] {
  const sign = direction === "descending" ? -1 : 1;
  const indexed = items.map((item, index) => ({ item, index }));
  indexed.sort((x, y) => sign * compare(x.item, y.item) || x.index - y.index);
  return indexed.map((x) => x.item);
}

/** Next sort descriptor when a column header is pressed (react-stately `useTableState.sort`: new column → ascending, same → flip). */
export function nextSortDescriptor(current: SortDescriptor | null | undefined, column: Key, direction?: SortDirection): SortDescriptor {
  if (direction) return { column, direction };
  return {
    column,
    direction: current && current.column === column && current.direction === "ascending" ? "descending" : "ascending",
  };
}

const expandedSet = (expanded: Iterable<Key> | "all" | undefined): Set<Key> | "all" =>
  expanded === "all" ? "all" : expanded instanceof Set ? expanded : new Set(expanded ?? []);

/** Run the pipeline: filter → sort → flatten (expanded) → paginate. */
export function dataGridRows<T>(input: DataGridPipelineInput<T>): DataGridPipelineResult<T> {
  const { data, columns, getRowId, sort, filter, getChildren, pageSize, page = 1, locale } = input;
  const expanded = expandedSet(input.expandedKeys);
  const compare = sort
    ? columnComparator(
        columns.find((c) => c.id === sort.column),
        locale,
      )
    : null;
  const direction = sort?.direction ?? "ascending";
  const out: DataGridRow<T>[] = [];

  // Tree filter: an item stays when it or one of its descendants matches.
  const keep = (item: T): boolean => {
    if (!filter || filter(item)) return true;
    const children = getChildren?.(item);
    return !!children && children.some(keep);
  };

  const visit = (items: readonly T[], depth: number, parentKey: Key | null) => {
    let level = filter ? items.filter(keep) : items;
    if (compare) level = sortItems(level, compare, direction);
    const setSize = level.length;
    for (let i = 0; i < setSize; i++) {
      const item = level[i]!;
      const key = getRowId(item, i);
      const children = getChildren?.(item);
      const hasChildren = !!children && children.length > 0;
      out.push({ key, item, depth, parentKey, hasChildren, posInSet: i + 1, setSize, index: out.length });
      if (hasChildren && (expanded === "all" || expanded.has(key))) visit(children!, depth + 1, key);
    }
  };
  visit(data, 0, null);

  const total = out.length;
  if (!pageSize || pageSize <= 0) return { rows: out, total, pageCount: 1 };
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { rows: out.slice((current - 1) * pageSize, current * pageSize), total, pageCount };
}

/** Keys of every row that has children (for "expand all"). */
export function expandableKeys<T>(
  data: readonly T[],
  getRowId: (item: T, index: number) => Key,
  getChildren: (item: T) => readonly T[] | null | undefined,
): Set<Key> {
  const keys = new Set<Key>();
  const visit = (items: readonly T[]) =>
    items.forEach((item, i) => {
      const children = getChildren(item);
      if (children && children.length) {
        keys.add(getRowId(item, i));
        visit(children);
      }
    });
  visit(data);
  return keys;
}

/** `expanded` with `key` toggled (a new Set). */
export function toggleExpandedKey(expanded: Iterable<Key> | "all", key: Key, allExpandable?: () => Iterable<Key>): Set<Key> {
  const next = new Set(expanded === "all" ? (allExpandable?.() ?? []) : expanded);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

// ---------------------------------------------------------------------------------------------------------------
// Selection (react-stately Selection semantics)
// ---------------------------------------------------------------------------------------------------------------

/** Whether `key` is selected (`"all"` selects every key except disabled ones). */
export function isKeySelected(selection: Selection, key: Key, disabled?: ReadonlySet<Key>): boolean {
  if (disabled?.has(key)) return false;
  return selection === "all" || selection.has(key);
}

/** The selection with `key` toggled. `"all"` turns into the selectable `keys` minus `key`. */
export function toggleKeySelection(selection: Selection, key: Key, mode: SelectionMode, keys: () => Iterable<Key>, disabled?: ReadonlySet<Key>): Selection {
  if (mode === "none" || disabled?.has(key)) return selection;
  if (mode === "single") return isKeySelected(selection, key, disabled) ? new Set() : new Set([key]);
  const next = new Set(selection === "all" ? [...keys()].filter((k) => !disabled?.has(k)) : selection);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Replace the selection with `key` (selectionBehavior "replace" press). */
export function replaceSelection(mode: SelectionMode, key: Key, disabled?: ReadonlySet<Key>): Selection {
  if (mode === "none" || disabled?.has(key)) return new Set();
  return new Set([key]);
}

/** Select the range from `anchor` to `key` in `order` (shift-click / shift-arrow), added to `base` when given. */
export function rangeSelection(order: readonly Key[], anchor: Key, key: Key, disabled?: ReadonlySet<Key>, base?: Set<Key>): Set<Key> {
  const from = order.indexOf(anchor),
    to = order.indexOf(key);
  const next = new Set(base ?? []);
  if (from < 0 || to < 0) {
    if (!disabled?.has(key)) next.add(key);
    return next;
  }
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  for (let i = lo; i <= hi; i++) if (!disabled?.has(order[i]!)) next.add(order[i]!);
  return next;
}

/** Select-all checkbox state over the selectable `keys`: `"all"`, `"some"` or `"none"`. */
export function selectAllState(selection: Selection, keys: readonly Key[], disabled?: ReadonlySet<Key>): "all" | "some" | "none" {
  if (selection === "all") return keys.some((k) => !disabled?.has(k)) ? "all" : "none";
  if (selection.size === 0) return "none";
  let selectable = 0,
    selected = 0;
  for (const k of keys) {
    if (disabled?.has(k)) continue;
    selectable++;
    if (selection.has(k)) selected++;
  }
  if (selectable === 0 || selected === 0) return "none";
  return selected === selectable ? "all" : "some";
}

/** Number of selected keys (`"all"`: `total` minus disabled). */
export function selectionSize(selection: Selection, total: number, disabled?: ReadonlySet<Key>): number {
  return selection === "all" ? total - (disabled?.size ?? 0) : selection.size;
}

// ---------------------------------------------------------------------------------------------------------------
// Column layout
// ---------------------------------------------------------------------------------------------------------------

/**
 * CSS widths for `<col>` elements: px for numbers and measured / resized columns, `%` as given, fractions of the
 * remaining space (`calc((100% - <static px>) * f / Σf)`) for `fr` and width-less columns.
 */
export function columnCssWidths<T>(columns: readonly DataGridColumnBase<T>[], resized?: ReadonlyMap<string, number> | null, extra = 0): string[] {
  let staticPx = extra,
    staticPct = 0,
    fr = 0;
  const parsed = columns.map((c) => {
    const w = resized?.get(c.id) ?? c.width;
    if (typeof w === "number") return ((staticPx += w), { px: w });
    if (typeof w === "string" && w.endsWith("%")) return ((staticPct += parseFloat(w)), { pct: parseFloat(w) });
    const f = typeof w === "string" && w.endsWith("fr") ? parseFloat(w) || 1 : 1;
    fr += f;
    return { fr: f };
  });
  return parsed.map((p) => {
    if ("px" in p) return `${p.px}px`;
    if ("pct" in p) return `${p.pct}%`;
    const rest = `(100% - ${staticPx}px${staticPct ? ` - ${staticPct}%` : ""})`;
    return p.fr === fr ? `calc${rest}` : `calc(${rest} * ${p.fr / fr})`;
  });
}

/** Total table width in px when every column has a px width (after a resize), else `null` (100%). */
export function tableWidthPx<T>(columns: readonly DataGridColumnBase<T>[], resized?: ReadonlyMap<string, number> | null, extra = 0): number | null {
  let sum = extra;
  for (const c of columns) {
    const w = resized?.get(c.id) ?? c.width;
    if (typeof w !== "number") return null;
    sum += w;
  }
  return sum;
}

export interface PinnedOffset {
  side: "start" | "end";
  /** Sticky inset in px (`inset-inline-start` / `-end`). */
  offset: number;
  /** The innermost pinned column of its side (draws the separator shadow). */
  edge: boolean;
}

/**
 * Sticky offsets of pinned columns (`columns` in render order, incl. leading utility columns given as
 * `{ id, width, pinned }`). A pinned column needs a px width; columns after it pinned to the same side add up.
 */
export function pinnedOffsets<T>(columns: readonly DataGridColumnBase<T>[], resized?: ReadonlyMap<string, number> | null): Map<string, PinnedOffset> {
  const out = new Map<string, PinnedOffset>();
  const widthOf = (c: DataGridColumnBase<T>) => {
    const w = resized?.get(c.id) ?? c.width;
    return typeof w === "number" ? w : 0;
  };
  let start = 0,
    lastStart: string | null = null;
  for (const c of columns) {
    if (c.pinned !== "start") continue;
    out.set(c.id, { side: "start", offset: start, edge: false });
    start += widthOf(c);
    lastStart = c.id;
  }
  let end = 0,
    lastEnd: string | null = null;
  for (let i = columns.length - 1; i >= 0; i--) {
    const c = columns[i]!;
    if (c.pinned !== "end") continue;
    out.set(c.id, { side: "end", offset: end, edge: false });
    end += widthOf(c);
    lastEnd = c.id;
  }
  if (lastStart) out.get(lastStart)!.edge = true;
  if (lastEnd) out.get(lastEnd)!.edge = true;
  return out;
}

/** Clamp a resized width to the column's min / max (min default 40). */
export function clampColumnWidth<T>(column: DataGridColumnBase<T>, width: number): number {
  const min = column.minWidth ?? 40,
    max = column.maxWidth ?? Infinity;
  return Math.round(Math.min(max, Math.max(min, width)));
}

// ---------------------------------------------------------------------------------------------------------------
// Virtual window
// ---------------------------------------------------------------------------------------------------------------

export interface VirtualWindow {
  start: number;
  end: number;
}

/** Rows `[start, end)` intersecting the viewport (+ `overscan` rows each side) for fixed `rowHeight`. */
export function virtualWindow(scrollTop: number, viewportHeight: number, rowHeight: number, count: number, overscan: number): VirtualWindow {
  if (count === 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const visible = Math.ceil(Math.max(viewportHeight, rowHeight) / rowHeight) + 1;
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visible + overscan);
  return { start: Math.min(start, end), end };
}

/** `scrollTop` that brings row `index` fully into a viewport of `viewportHeight` (unchanged when already visible). */
export function scrollTopFor(index: number, rowHeight: number, headerHeight: number, scrollTop: number, viewportHeight: number): number {
  const top = index * rowHeight,
    bottom = top + rowHeight;
  const visibleTop = scrollTop,
    visibleBottom = scrollTop + viewportHeight - headerHeight;
  if (top < visibleTop) return top;
  if (bottom > visibleBottom) return bottom - (viewportHeight - headerHeight);
  return scrollTop;
}

// ---------------------------------------------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------------------------------------------

export type DropPosition = "before" | "after";

/** Move the items with `keys` before / after `target` (order of the moved items kept). Returns a new array. */
export function reorderItems<T>(
  items: readonly T[],
  getRowId: (item: T, index: number) => Key,
  keys: ReadonlySet<Key>,
  target: Key,
  position: DropPosition,
): T[] {
  if (keys.has(target)) return items.slice();
  const moving: T[] = [],
    rest: T[] = [];
  items.forEach((item, i) => (keys.has(getRowId(item, i)) ? moving : rest).push(item));
  const at = rest.findIndex((item, i) => getRowId(item, i) === target);
  if (at < 0) return items.slice();
  const index = position === "before" ? at : at + 1;
  return [...rest.slice(0, index), ...moving, ...rest.slice(index)];
}
