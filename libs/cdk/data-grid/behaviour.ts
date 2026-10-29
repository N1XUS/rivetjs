// Rivet-authored (not a port): event handlers of `@rivetjs/cdk/data-grid`. Feature set inspired by commercial UI kits' public
// DataGrid docs; independent implementation. Keyboard / selection semantics follow React Aria's table (useGrid /
// useTableColumnHeader / useSelectableCollection / useSelectableItem, Apache-2.0, © Adobe) over flat data rows:
// - rows are focusable (row focus), ArrowLeft / ArrowRight move into cells and back to the row (wrapping like RA's
//   GridKeyboardDelegate), focusable children of a cell (buttons, inputs, the resizer) are walked before leaving it;
// - ArrowUp from the first row's cell → column header; Home / End (cell: first / last cell, row or Ctrl: first / last row);
//   PageUp / PageDown by a viewport of rows; typeahead on the row-header column;
// - selection: Space toggles, Shift+Arrow / Shift+click extend from the anchor (multiple), Ctrl/Cmd+A selects all,
//   Escape clears (unless `disallowEmptySelection`); "replace" behaviour moves the selection with the focus (no Ctrl);
// - Enter: header → sort, row → `onRowAction` (else selects in "replace" mode); treegrid ArrowRight / ArrowLeft expand /
//   collapse (collapsed child row: ArrowLeft → parent).
// Handlers are DELEGATED on the `<table>` (one listener per event type, no per-row closures): rows / cells are found with
// `closest()`; the context `ctx` is plain data (signals + controlled states + arrows) built by `./index.tsx`.
// Closures created here (window listeners during a drag / resize) are browser-only and never serialized.
import { batch, untrack, type Signal } from "@rivetjs/reactivity";
import { controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { announce } from "../announcer/live-announcer.ts";
import {
  clampColumnWidth,
  isKeySelected,
  nextSortDescriptor,
  rangeSelection,
  reorderItems,
  replaceSelection,
  scrollTopFor,
  selectAllState,
  toggleExpandedKey,
  toggleKeySelection,
  virtualWindow,
  type DataGridColumnBase,
  type DataGridRow,
  type DropPosition,
  type Key,
  type Selection,
  type SelectionMode,
  type SortDescriptor,
  type VirtualWindow,
} from "./state.ts";

export type SelectionBehavior = "toggle" | "replace";

/** Column ids of the utility columns the grid prepends. */
export const SELECT_COLUMN = "__rv_select";
export const DRAG_COLUMN = "__rv_drag";

export interface DragState {
  keys: Key[];
  target: Key | null;
  position: DropPosition;
  keyboard: boolean;
  /** Drop indicator offset in px from the top of the scroll content (`null`: hidden). */
  indicator: number | null;
}

/** Arguments of `onReorder` (keys moved, drop target, the reordered top-level data). */
export interface DataGridReorderEvent<T> {
  keys: Set<Key>;
  target: { key: Key; dropPosition: DropPosition };
  /** `data` with the moved items placed at the target (top level; nested rows reorder among their siblings). */
  items: T[];
}

/** What the handlers read and write (built by the component; plain data). */
export interface DataGridContext<T> {
  rows: () => DataGridRow<T>[];
  /** Rendered columns (utility + data) in order. */
  columns: () => DataGridColumnBase<T>[];
  data: () => readonly T[];
  getRowId: (item: T, index: number) => Key;
  getChildren: (item: T) => readonly T[] | null | undefined;
  selection: ControlledState<Selection>;
  mode: () => SelectionMode;
  behavior: () => SelectionBehavior;
  disabled: () => ReadonlySet<Key>;
  disallowEmpty: () => boolean;
  sort: ControlledState<SortDescriptor | null>;
  expanded: ControlledState<Set<Key>>;
  widths: Signal<Map<string, number> | null>;
  resizing: Signal<string | null>;
  /** Last focused row key / column id (column `null`: the row itself). */
  focus: Signal<{ key: Key | null; col: string | null }>;
  anchor: Signal<Key | null>;
  win: Signal<VirtualWindow>;
  drag: Signal<DragState | null>;
  virtual: () => boolean;
  rowHeight: () => number;
  headerHeight: () => number;
  overscan: () => number;
  hasAction: () => boolean;
  onRowAction: (key: Key) => void;
  canReorder: () => boolean;
  onReorder: (event: DataGridReorderEvent<T>) => void;
  onColumnResize: (widths: Map<string, number>) => void;
  onColumnResizeEnd: (widths: Map<string, number>) => void;
  rtl: () => boolean;
  /** Localized strings. */
  strings: { dragStart: string; dragDrop: string; dragCancel: string };
}

// ---------------------------------------------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------------------------------------------

const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";
const INTERACTIVE = "a[href], button, input, textarea, select, label, [contenteditable=''], [contenteditable='true'], [data-grid-ignore]";
const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]";

const escapeKey = (key: Key) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(String(key)) : String(key).replace(/"/g, '\\"'));
const tableOf = (el: Element) => el.closest("table") as HTMLTableElement | null;
const scrollerOf = (table: Element) => table.parentElement as HTMLElement;
export const rowElement = (table: Element, key: Key) => table.querySelector<HTMLElement>(`tbody > tr[data-key="${escapeKey(key)}"]`);
const cellIn = (row: Element, col: string) => row.querySelector<HTMLElement>(`:scope > [data-column="${escapeKey(col)}"]`);
const headerCell = (table: Element, col: string) => table.querySelector<HTMLElement>(`thead [data-column="${escapeKey(col)}"]`);

/** The row key of a `<tr data-key>` (numeric keys round-trip through `data-key-type`). */
export function keyOf(row: Element): Key {
  const raw = row.getAttribute("data-key")!;
  return row.getAttribute("data-key-type") === "number" ? Number(raw) : raw;
}

const rowIndex = <T>(ctx: DataGridContext<T>, key: Key | null): number => (key == null ? -1 : ctx.rows().findIndex((r) => r.key === key));
const isDisabledKey = <T>(ctx: DataGridContext<T>, key: Key) => ctx.disabled().has(key);
const colIds = <T>(ctx: DataGridContext<T>) => ctx.columns().map((c) => c.id);

function focusables(cell: Element): HTMLElement[] {
  return [...cell.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.tabIndex >= -1 && !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
  );
}

function focusElement(el: HTMLElement | null, scroll: boolean) {
  if (!el) return;
  el.focus({ preventScroll: true });
  if (scroll && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** Keep the virtual window around row `index` and scroll it into view. */
function revealRow<T>(ctx: DataGridContext<T>, table: HTMLTableElement, index: number) {
  if (!ctx.virtual()) return;
  const scroller = scrollerOf(table);
  const top = scrollTopFor(index, ctx.rowHeight(), ctx.headerHeight(), scroller.scrollTop, scroller.clientHeight);
  if (top !== scroller.scrollTop) scroller.scrollTop = top;
  updateWindow(ctx, scroller);
}

/** Recompute the virtual window from the scroller (scroll handler, keyboard reveal). */
export function updateWindow<T>(ctx: DataGridContext<T>, scroller: HTMLElement) {
  if (!ctx.virtual()) return;
  const next = virtualWindow(scroller.scrollTop - 0, scroller.clientHeight - ctx.headerHeight(), ctx.rowHeight(), untrack(ctx.rows).length, ctx.overscan());
  const prev = untrack(ctx.win);
  if (prev.start !== next.start || prev.end !== next.end) ctx.win.set(next);
}

/** Focus row `key` (column `col`: a cell, `null`: the row) once its element exists (after the current flush). */
function focusRow<T>(ctx: DataGridContext<T>, table: HTMLTableElement, key: Key, col: string | null, tries = 2) {
  ctx.focus.set({ key, col });
  const apply = () => {
    const row = rowElement(table, key);
    if (!row) {
      if (tries-- > 0) requestAnimationFrame(apply);
      return;
    }
    focusElement(col ? (cellIn(row, col) ?? row) : row, !ctx.virtual());
  };
  const row = rowElement(table, key);
  if (row) focusElement(col ? (cellIn(row, col) ?? row) : row, !ctx.virtual());
  else queueMicrotask(apply);
}

// ---------------------------------------------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------------------------------------------

function setSelection<T>(ctx: DataGridContext<T>, next: Selection) {
  setControlledValue(ctx.selection, next);
}

/** Toggle `key` (Space, checkbox, toggle-mode press). */
export function toggleRow<T>(ctx: DataGridContext<T>, key: Key) {
  const mode = ctx.mode();
  if (mode === "none" || isDisabledKey(ctx, key)) return;
  const current = controlledValue(ctx.selection);
  if (ctx.disallowEmpty() && isKeySelected(current, key) && (current === "all" ? false : current.size === 1)) return;
  setSelection(
    ctx,
    toggleKeySelection(current, key, mode, () => ctx.rows().map((r) => r.key), ctx.disabled()),
  );
  ctx.anchor.set(key);
}

/** Select-all checkbox / Ctrl+A: "all" ↔ empty (react-stately `toggleSelectAll`). */
export function toggleAll<T>(ctx: DataGridContext<T>) {
  if (ctx.mode() !== "multiple") return;
  const state = selectAllState(
    controlledValue(ctx.selection),
    ctx.rows().map((r) => r.key),
    ctx.disabled(),
  );
  setSelection(ctx, state === "all" ? new Set() : "all");
}

function extendTo<T>(ctx: DataGridContext<T>, key: Key) {
  if (ctx.mode() !== "multiple") return toggleOrReplace(ctx, key, false);
  const anchor = untrack(ctx.anchor) ?? key;
  setSelection(
    ctx,
    rangeSelection(
      ctx.rows().map((r) => r.key),
      anchor,
      key,
      ctx.disabled(),
    ),
  );
}

function toggleOrReplace<T>(ctx: DataGridContext<T>, key: Key, toggle: boolean) {
  if (toggle || ctx.behavior() === "toggle") return toggleRow(ctx, key);
  if (ctx.mode() === "none" || isDisabledKey(ctx, key)) return;
  setSelection(ctx, replaceSelection(ctx.mode(), key, ctx.disabled()));
  ctx.anchor.set(key);
}

// ---------------------------------------------------------------------------------------------------------------
// Sorting / expanding
// ---------------------------------------------------------------------------------------------------------------

export function sortBy<T>(ctx: DataGridContext<T>, column: string) {
  const def = ctx.columns().find((c) => c.id === column);
  if (!def?.allowsSorting) return;
  setControlledValue(ctx.sort, nextSortDescriptor(controlledValue(ctx.sort), column));
}

export function toggleExpanded<T>(ctx: DataGridContext<T>, key: Key) {
  setControlledValue(ctx.expanded, toggleExpandedKey(controlledValue(ctx.expanded), key));
}

const isExpandedKey = <T>(ctx: DataGridContext<T>, key: Key) => controlledValue(ctx.expanded).has(key);

// ---------------------------------------------------------------------------------------------------------------
// Click / double click
// ---------------------------------------------------------------------------------------------------------------

/** Delegated `click` on the `<table>`. */
export function gridClick<T>(event: MouseEvent, ctx: DataGridContext<T>) {
  const target = event.target as Element;
  const table = event.currentTarget as HTMLTableElement;
  if (target.closest("[data-rv-resizer]") || untrack(ctx.resizing)) return;
  if (target.closest("[data-rv-select-all]")) return toggleAll(ctx);
  const header = target.closest("thead [data-column]");
  if (header) return sortBy(ctx, header.getAttribute("data-column")!);
  const row = target.closest("tbody > tr[data-key]");
  if (!row || tableOf(row) !== table) return;
  const key = keyOf(row);
  if (target.closest("[data-rv-expand]")) return toggleExpanded(ctx, key);
  if (target.closest("[data-rv-drag-handle]")) return;
  if (target.closest("[data-rv-select]")) return toggleRow(ctx, key);
  // Clicks on interactive content inside a cell (editable cells, links, buttons) belong to that content.
  const interactive = target.closest(INTERACTIVE);
  if (interactive && row.contains(interactive)) return;
  if (isDisabledKey(ctx, key)) return;
  const mod = event.metaKey || event.ctrlKey;
  const mode = ctx.mode();
  if (event.shiftKey && mode === "multiple" && untrack(ctx.anchor) != null) return extendTo(ctx, key);
  if (ctx.hasAction() && (mode === "none" || (ctx.behavior() === "toggle" && selectionEmpty(ctx)))) {
    return ctx.onRowAction(key);
  }
  if (mode === "none") return;
  toggleOrReplace(ctx, key, mod);
}

const selectionEmpty = <T>(ctx: DataGridContext<T>) => {
  const s = controlledValue(ctx.selection);
  return s !== "all" && s.size === 0;
};

/** Delegated `dblclick`: "replace" selection behaviour runs the row action on double click (RA). */
export function gridDoubleClick<T>(event: MouseEvent, ctx: DataGridContext<T>) {
  const row = (event.target as Element).closest("tbody > tr[data-key]");
  if (!row || !ctx.hasAction() || ctx.behavior() !== "replace" || ctx.mode() === "none") return;
  const interactive = (event.target as Element).closest(INTERACTIVE);
  if (interactive && row.contains(interactive)) return;
  const key = keyOf(row);
  if (!isDisabledKey(ctx, key)) ctx.onRowAction(key);
}

// ---------------------------------------------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------------------------------------------

/** Delegated `focusin`: track the focused row / cell; the table leaves the tab order while focus is inside. */
export function gridFocusIn<T>(event: FocusEvent, ctx: DataGridContext<T>) {
  const table = event.currentTarget as HTMLTableElement;
  const target = event.target as HTMLElement;
  if (target === table) {
    // Tab into the grid: forward focus to the last focused row (or the first row / header).
    const { key, col } = untrack(ctx.focus);
    const rows = untrack(ctx.rows);
    const index = rowIndex(ctx, key);
    if (index >= 0) return (revealRow(ctx, table, index), focusRow(ctx, table, key!, col));
    if (rows.length) return focusRow(ctx, table, rows[Math.min(untrack(ctx.win).start, rows.length - 1)]!.key, null);
    const first = table.querySelector<HTMLElement>("thead [data-column]");
    return focusElement(first, false);
  }
  table.tabIndex = -1;
  const row = target.closest("tbody > tr[data-key]");
  if (row) {
    const cell = target.closest("[data-column]");
    ctx.focus.set({ key: keyOf(row), col: cell && cell !== row && row.contains(cell) ? cell.getAttribute("data-column") : null });
  }
}

/** Delegated `focusout`: focus leaving the grid puts the table back in the tab order. */
export function gridFocusOut(event: FocusEvent) {
  const table = event.currentTarget as HTMLTableElement;
  const next = event.relatedTarget as Node | null;
  if (!next || !table.contains(next)) table.tabIndex = 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------------------------------------------

const typeahead = new WeakMap<object, { text: string; timer: ReturnType<typeof setTimeout> | undefined }>();

/** Delegated `keydown` on the `<table>`. */
export function gridKeyDown<T>(event: KeyboardEvent, ctx: DataGridContext<T>) {
  const table = event.currentTarget as HTMLTableElement;
  const target = event.target as HTMLElement;
  if (event.defaultPrevented || event.isComposing) return;

  // Keyboard drag and drop.
  const drag = untrack(ctx.drag);
  if (drag?.keyboard) return dragKey(event, ctx, table, drag);

  // Column resizer.
  const resizer = target.closest<HTMLElement>("[data-rv-resizer]");
  if (resizer) return resizerKey(event, ctx, table, resizer);

  // Drag handle: Enter / Space start a keyboard drag.
  if ((event.key === "Enter" || event.key === " ") && target.closest("[data-rv-drag-handle]") && ctx.canReorder()) {
    const row = target.closest("tbody > tr[data-key]");
    if (row) {
      event.preventDefault();
      return startKeyboardDrag(ctx, table, keyOf(row));
    }
  }

  // Editable content inside a cell keeps its keys; Escape returns to the cell.
  if (target.matches(EDITABLE) && target !== table) {
    if (event.key === "Escape") {
      const cell = target.closest<HTMLElement>("[data-column]");
      if (cell) (event.preventDefault(), event.stopPropagation(), cell.focus());
    }
    return;
  }

  const header = target.closest<HTMLElement>("thead [data-column]");
  if (header) return headerKey(event, ctx, table, header, target);

  const row = target.closest<HTMLElement>("tbody > tr[data-key]");
  if (!row) return;
  const key = keyOf(row);
  const cell = target === row ? null : target.closest<HTMLElement>("[data-column]");
  const col = cell?.getAttribute("data-column") ?? null;
  const rows = ctx.rows();
  const index = rowIndex(ctx, key);
  const cols = colIds(ctx);
  const ltr = !ctx.rtl();
  const forward = ltr ? "ArrowRight" : "ArrowLeft",
    backward = ltr ? "ArrowLeft" : "ArrowRight";
  const mod = event.ctrlKey || event.metaKey;
  const multiple = ctx.mode() === "multiple";

  const go = (nextIndex: number, nextCol: string | null) => {
    const r = rows[Math.max(0, Math.min(rows.length - 1, nextIndex))];
    if (!r) return;
    event.preventDefault();
    revealRow(ctx, table, rows.indexOf(r));
    focusRow(ctx, table, r.key, nextCol);
    if (
      event.shiftKey &&
      multiple &&
      (event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "PageDown" ||
        event.key === "PageUp" ||
        event.key === "Home" ||
        event.key === "End")
    ) {
      if (untrack(ctx.anchor) == null) ctx.anchor.set(key);
      extendTo(ctx, r.key);
    } else if (!mod && ctx.behavior() === "replace" && ctx.mode() !== "none" && !isDisabledKey(ctx, r.key) && r.key !== key) {
      setSelection(ctx, replaceSelection(ctx.mode(), r.key, ctx.disabled()));
      ctx.anchor.set(r.key);
    }
  };

  // Walk focusable children inside the focused cell before leaving it (RA useGridCell).
  if (cell && (event.key === forward || event.key === backward) && !mod) {
    const kids = focusables(cell);
    const at = kids.indexOf(target);
    const step = event.key === forward ? 1 : -1;
    if (target === cell && step === 1 && kids.length) return (event.preventDefault(), kids[0]!.focus());
    if (at >= 0) {
      const next = kids[at + step];
      event.preventDefault();
      return next ? next.focus() : step === 1 ? moveCell(1) : cell.focus();
    }
  }

  function moveCell(step: number) {
    const i = col == null ? -1 : cols.indexOf(col);
    const next = i + step;
    event.preventDefault();
    if (col == null) return focusRow(ctx, table, key, step > 0 ? cols[0]! : cols[cols.length - 1]!);
    if (next < 0 || next >= cols.length) return focusRow(ctx, table, key, null);
    focusRow(ctx, table, key, cols[next]!);
  }

  const page = Math.max(1, Math.floor((scrollerOf(table).clientHeight - ctx.headerHeight()) / ctx.rowHeight()) - 1);
  switch (event.key) {
    case "ArrowDown":
      return go(index + 1, col);
    case "ArrowUp":
      if (index === 0 && col) {
        event.preventDefault();
        return focusElement(headerCell(table, col), false);
      }
      return go(index - 1, col);
    case "PageDown":
      return go(index + page, col);
    case "PageUp":
      return go(index - page, col);
    case "Home":
      if (col && !mod) return (event.preventDefault(), focusRow(ctx, table, key, cols[0]!));
      return go(0, col);
    case "End":
      if (col && !mod) return (event.preventDefault(), focusRow(ctx, table, key, cols[cols.length - 1]!));
      return go(rows.length - 1, col);
  }
  if (event.key === forward || event.key === backward) {
    const r = rows[index];
    if (col == null && r) {
      // Treegrid: expand / collapse / parent before moving into cells.
      if (event.key === forward && r.hasChildren && !isExpandedKey(ctx, key)) return (event.preventDefault(), toggleExpanded(ctx, key));
      if (event.key === backward && r.hasChildren && isExpandedKey(ctx, key)) return (event.preventDefault(), toggleExpanded(ctx, key));
      if (event.key === backward && r.parentKey != null) return go(rowIndex(ctx, r.parentKey), null);
    }
    return moveCell(event.key === forward ? 1 : -1);
  }
  if (event.key === " " && !mod) {
    if (target !== row && target !== cell) return; // a focused button / checkbox child handles its own Space
    if (ctx.mode() === "none") return;
    event.preventDefault();
    if (event.shiftKey && multiple) return extendTo(ctx, key);
    return toggleRow(ctx, key);
  }
  if (event.key === "Enter") {
    if (target !== row && target !== cell) return;
    event.preventDefault();
    if (ctx.hasAction() && !isDisabledKey(ctx, key)) return ctx.onRowAction(key);
    if (ctx.mode() !== "none") return toggleOrReplace(ctx, key, false);
    return;
  }
  if (mod && (event.key === "a" || event.key === "A") && multiple) {
    event.preventDefault();
    return setSelection(ctx, "all");
  }
  if (event.key === "Escape" && multiple && !ctx.disallowEmpty() && !selectionEmpty(ctx)) {
    event.preventDefault();
    return setSelection(ctx, new Set());
  }
  if (event.key.length === 1 && !mod && !event.altKey && /\S/.test(event.key)) typeahead1(event, ctx, table, index);
}

function typeahead1<T>(event: KeyboardEvent, ctx: DataGridContext<T>, table: HTMLTableElement, index: number) {
  const state = typeahead.get(table) ?? { text: "", timer: undefined };
  typeahead.set(table, state);
  state.text += event.key.toLowerCase();
  clearTimeout(state.timer);
  state.timer = setTimeout(() => (state.text = ""), 1000);
  const header = ctx.columns().find((c) => c.isRowHeader) ?? ctx.columns().find((c) => c.accessorKey);
  const field = header?.accessorKey;
  if (!field) return;
  const rows = ctx.rows();
  const n = rows.length;
  for (let step = state.text.length === 1 ? 1 : 0; step < n + 1; step++) {
    const r = rows[(index + step) % n]!;
    if (
      String((r.item as Record<string, unknown>)[field] ?? "")
        .toLowerCase()
        .startsWith(state.text)
    ) {
      event.preventDefault();
      revealRow(ctx, table, (index + step) % n);
      return focusRow(ctx, table, r.key, null);
    }
  }
}

function headerKey<T>(event: KeyboardEvent, ctx: DataGridContext<T>, table: HTMLTableElement, header: HTMLElement, target: HTMLElement) {
  const col = header.getAttribute("data-column")!;
  const cols = colIds(ctx);
  const ltr = !ctx.rtl();
  const i = cols.indexOf(col);
  const forward = ltr ? "ArrowRight" : "ArrowLeft",
    backward = ltr ? "ArrowLeft" : "ArrowRight";
  if (event.key === forward || event.key === backward) {
    const kids = focusables(header);
    const at = kids.indexOf(target);
    const step = event.key === forward ? 1 : -1;
    event.preventDefault();
    if (target === header && step === 1 && kids.length) return kids[0]!.focus();
    if (at >= 0 && kids[at + step]) return kids[at + step]!.focus();
    if (at >= 0 && step === -1) return header.focus();
    const next = cols[i + step];
    if (next) focusElement(headerCell(table, next), false);
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    const rows = ctx.rows();
    const first = rows[ctx.virtual() ? Math.min(untrack(ctx.win).start, rows.length - 1) : 0];
    if (first) focusRow(ctx, table, first.key, col);
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    return focusElement(headerCell(table, event.key === "Home" ? cols[0]! : cols[cols.length - 1]!), false);
  }
  if ((event.key === "Enter" || event.key === " ") && target === header) {
    event.preventDefault();
    if (col === SELECT_COLUMN) return toggleAll(ctx);
    return sortBy(ctx, col);
  }
  if (event.key === " " && target.matches("[data-rv-select-all]")) {
    event.preventDefault();
    return toggleAll(ctx);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Column resizing
// ---------------------------------------------------------------------------------------------------------------

/** Current px widths of every rendered column (measured once when a resize starts). */
function measuredWidths<T>(ctx: DataGridContext<T>, table: HTMLTableElement): Map<string, number> {
  const current = untrack(ctx.widths);
  const out = new Map<string, number>();
  for (const id of colIds(ctx)) {
    const w = current?.get(id) ?? headerCell(table, id)?.getBoundingClientRect().width ?? 0;
    out.set(id, Math.round(w));
  }
  return out;
}

function resizeTo<T>(ctx: DataGridContext<T>, table: HTMLTableElement, col: string, width: number) {
  const def = ctx.columns().find((c) => c.id === col);
  if (!def) return;
  const widths = new Map(measuredWidths(ctx, table));
  const next = clampColumnWidth(def, width);
  if (widths.get(col) === next && untrack(ctx.widths)) return;
  widths.set(col, next);
  ctx.widths.set(widths);
  ctx.onColumnResize(widths);
}

/** Delegated `pointerdown`: column resizer drag, row drag handle. */
export function gridPointerDown<T>(event: PointerEvent, ctx: DataGridContext<T>) {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement;
  const table = event.currentTarget as HTMLTableElement;
  const resizer = target.closest<HTMLElement>("[data-rv-resizer]");
  if (resizer) return startPointerResize(event, ctx, table, resizer);
  const handle = target.closest<HTMLElement>("[data-rv-drag-handle]");
  if (handle && ctx.canReorder()) return startPointerDrag(event, ctx, table, handle);
}

function startPointerResize<T>(event: PointerEvent, ctx: DataGridContext<T>, table: HTMLTableElement, resizer: HTMLElement) {
  event.preventDefault();
  event.stopPropagation();
  const col = resizer.getAttribute("data-rv-resizer")!;
  const startX = event.clientX;
  const startWidths = measuredWidths(ctx, table);
  const start = startWidths.get(col) ?? 0;
  const sign = ctx.rtl() ? -1 : 1;
  batch(() => {
    ctx.widths.set(startWidths);
    ctx.resizing.set(col);
  });
  const doc = table.ownerDocument;
  const move = (e: PointerEvent) => resizeTo(ctx, table, col, start + sign * (e.clientX - startX));
  const up = () => {
    doc.removeEventListener("pointermove", move);
    doc.removeEventListener("pointerup", up);
    doc.removeEventListener("pointercancel", up);
    // The click that follows the pointerup must not sort the column.
    setTimeout(() => ctx.resizing.set(null));
    ctx.onColumnResizeEnd(untrack(ctx.widths) ?? startWidths);
  };
  doc.addEventListener("pointermove", move);
  doc.addEventListener("pointerup", up);
  doc.addEventListener("pointercancel", up);
}

function resizerKey<T>(event: KeyboardEvent, ctx: DataGridContext<T>, table: HTMLTableElement, resizer: HTMLElement) {
  const col = resizer.getAttribute("data-rv-resizer")!;
  const ltr = !ctx.rtl();
  const delta = event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0;
  if (delta) {
    event.preventDefault();
    event.stopPropagation();
    const widths = measuredWidths(ctx, table);
    resizeTo(ctx, table, col, (widths.get(col) ?? 0) + (ltr ? delta : -delta));
    ctx.onColumnResizeEnd(untrack(ctx.widths) ?? widths);
    return;
  }
  if (event.key === "Escape" || event.key === "Enter" || event.key === "Tab") {
    if (event.key !== "Tab") event.preventDefault();
    event.stopPropagation();
    resizer.closest<HTMLElement>("[data-column]")?.focus();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Row reordering (drag and drop)
// ---------------------------------------------------------------------------------------------------------------

function dragKeys<T>(ctx: DataGridContext<T>, key: Key): Key[] {
  const s = controlledValue(ctx.selection);
  if (isKeySelected(s, key, ctx.disabled()))
    return ctx
      .rows()
      .filter((r) => isKeySelected(s, r.key, ctx.disabled()))
      .map((r) => r.key);
  return [key];
}

/** Offset of the drop line for `key` / `position` inside the scroll container's content. */
function indicatorTop(table: HTMLTableElement, key: Key | null, position: DropPosition): number | null {
  if (key == null) return null;
  const row = rowElement(table, key);
  if (!row) return null;
  const scroller = scrollerOf(table);
  const rect = row.getBoundingClientRect();
  return Math.round((position === "after" ? rect.bottom : rect.top) - scroller.getBoundingClientRect().top + scroller.scrollTop);
}

function markDragging(table: HTMLTableElement, keys: Key[], on: boolean) {
  for (const key of keys) {
    const row = rowElement(table, key);
    if (row) on ? row.setAttribute("data-dragging", "true") : row.removeAttribute("data-dragging");
  }
}

function drop<T>(ctx: DataGridContext<T>, state: DragState) {
  ctx.drag.set(null);
  if (state.target == null) return;
  const keys = new Set(state.keys);
  if (keys.has(state.target)) return;
  const rows = ctx.rows();
  const targetRow = rows.find((r) => r.key === state.target);
  if (!targetRow) return;
  // Reorder among the target's siblings (top level: the data itself).
  let items: T[];
  const data = ctx.data();
  if (targetRow.parentKey == null) items = reorderItems(data, ctx.getRowId, keys, state.target, state.position);
  else items = data.slice();
  ctx.onReorder({ keys, target: { key: state.target, dropPosition: state.position }, items });
}

function startPointerDrag<T>(event: PointerEvent, ctx: DataGridContext<T>, table: HTMLTableElement, handle: HTMLElement) {
  const row = handle.closest("tbody > tr[data-key]");
  if (!row) return;
  event.preventDefault();
  const key = keyOf(row);
  const scroller = scrollerOf(table);
  const state: DragState = { keys: dragKeys(ctx, key), target: null, position: "after", keyboard: false, indicator: null };
  ctx.drag.set({ ...state });
  markDragging(table, state.keys, true);
  const doc = table.ownerDocument;
  let raf = 0,
    lastY = event.clientY,
    lastX = event.clientX;
  const locate = () => {
    const el = doc.elementFromPoint(lastX, lastY)?.closest("tbody > tr[data-key]");
    if (!el || !table.contains(el)) return;
    const rect = el.getBoundingClientRect();
    const position: DropPosition = lastY < rect.top + rect.height / 2 ? "before" : "after";
    const target = keyOf(el);
    if (target !== state.target || position !== state.position) {
      state.target = target;
      state.position = position;
      state.indicator = indicatorTop(table, target, position);
      ctx.drag.set({ ...state });
    }
  };
  const autoScroll = () => {
    const box = scroller.getBoundingClientRect();
    const edge = 32;
    const dy = lastY < box.top + edge + ctx.headerHeight() ? -12 : lastY > box.bottom - edge ? 12 : 0;
    if (dy) {
      scroller.scrollTop += dy;
      updateWindow(ctx, scroller);
      locate();
    }
    raf = dy ? requestAnimationFrame(autoScroll) : 0;
  };
  const move = (e: PointerEvent) => {
    lastY = e.clientY;
    lastX = e.clientX;
    locate();
    if (!raf) raf = requestAnimationFrame(autoScroll);
  };
  const end = (commit: boolean) => {
    doc.removeEventListener("pointermove", move);
    doc.removeEventListener("pointerup", up);
    doc.removeEventListener("pointercancel", cancel);
    if (raf) cancelAnimationFrame(raf);
    markDragging(table, state.keys, false);
    if (commit) drop(ctx, state);
    else ctx.drag.set(null);
  };
  const up = () => end(true);
  const cancel = () => end(false);
  doc.addEventListener("pointermove", move);
  doc.addEventListener("pointerup", up);
  doc.addEventListener("pointercancel", cancel);
}

/** Enter on a drag handle starts a keyboard drag (RA useDrag keyboard: Enter grab, arrows move, Enter drop, Escape cancel). */
export function startKeyboardDrag<T>(ctx: DataGridContext<T>, table: HTMLTableElement, key: Key) {
  const keys = dragKeys(ctx, key);
  ctx.drag.set({ keys, target: key, position: "after", keyboard: true, indicator: indicatorTop(table, key, "after") });
  markDragging(table, keys, true);
  announce(ctx.strings.dragStart, "assertive");
}

function dragKey<T>(event: KeyboardEvent, ctx: DataGridContext<T>, table: HTMLTableElement, drag: DragState) {
  const rows = ctx.rows();
  // Drop slots: before row 0, after every row → slot i = after rows[i-1].
  const slots = rows
    .map((r) => ({ key: r.key, position: "before" as DropPosition }))
    .concat(rows.length ? [{ key: rows[rows.length - 1]!.key, position: "after" }] : []);
  let i = slots.findIndex((s) => s.key === drag.target && s.position === drag.position);
  if (i < 0) i = Math.max(0, rows.findIndex((r) => r.key === drag.target) + (drag.position === "after" ? 1 : 0));
  const set = (n: number) => {
    const slot = slots[Math.max(0, Math.min(slots.length - 1, n))]!;
    revealRow(ctx, table, rowIndex(ctx, slot.key));
    ctx.drag.set({ ...drag, target: slot.key, position: slot.position, indicator: indicatorTop(table, slot.key, slot.position) });
  };
  switch (event.key) {
    case "ArrowDown":
    case "ArrowRight":
      event.preventDefault();
      return set(i + 1);
    case "ArrowUp":
    case "ArrowLeft":
      event.preventDefault();
      return set(i - 1);
    case "Enter":
    case " ":
      event.preventDefault();
      markDragging(table, drag.keys, false);
      drop(ctx, drag);
      announce(ctx.strings.dragDrop, "assertive");
      return;
    case "Escape":
    case "Tab":
      if (event.key === "Escape") event.preventDefault();
      markDragging(table, drag.keys, false);
      ctx.drag.set(null);
      announce(ctx.strings.dragCancel, "assertive");
      return;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Scroll
// ---------------------------------------------------------------------------------------------------------------

/** `scroll` on the scroll container: virtual window + pinned-column separators (`data-scrolled-start` / `-end`). */
export function gridScroll<T>(event: Event, ctx: DataGridContext<T>) {
  const scroller = event.currentTarget as HTMLElement;
  updateWindow(ctx, scroller);
  const root = scroller.parentElement!;
  const left = Math.abs(scroller.scrollLeft);
  const max = scroller.scrollWidth - scroller.clientWidth;
  toggleAttr(root, "data-scrolled-start", left > 0);
  toggleAttr(root, "data-scrolled-end", max > 0 && left < max - 1);
}

function toggleAttr(el: Element, name: string, on: boolean) {
  if (on) {
    if (!el.hasAttribute(name)) el.setAttribute(name, "true");
  } else if (el.hasAttribute(name)) el.removeAttribute(name);
}
