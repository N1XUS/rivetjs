// Ported from @react-aria/table (useTableColumnResize.ts), Apache-2.0, © Adobe.
//
// Rivet: `useTableColumnResize` → `tableColumnResizeProps(props, state)`; the bags carry the press
// (`../interactions/press.tsx`), move (`../interactions/move.tsx`) and keyboard machines' handlers —
// closures, so this module is `.tsx` (resume-compiled: R2 symbols). `state` is an ACCESSOR of the
// react-stately `TableColumnResizeState` view (`../state/table-column-resize.ts`
// `tableColumnResizeState(data, tableState)`): handlers read it at event time. Value attributes of
// `inputProps` (`min`, `max`, `value`, `aria-valuetext`, `aria-describedby`) are accessors (spreads
// resolve them inside bindings).
// - react-aria's effect starting a resize when `resizingColumn` becomes this column (a Column
//   `startResize` render prop, a menu "Resize" item) → the input's `onFocus`: the component
//   focuses the input after `startResize` (`focusColumnResizer`), and the input's focus handler runs the
//   resize start (`lastSize`, `onResizeStart`).
// - Refs (`isResizingRef`, `lastSize`, `wasFocusedOnResizeStart`, `columnResizeWidthRef`) → one plain
//   per-instance object (JSON; widths kept as `[key, size][]` until a callback gets a `Map`).
import { signal, untrack } from "@rivetjs/reactivity";
import { formatMessage } from "../_adapters/intl.ts";
import { focusSafely } from "../focus/index.ts";
import { getInteractionModality } from "../interactions/focus-visible.tsx";
import { keyboardProps as keyboardPropsOf } from "../interactions/keyboard.tsx";
import { moveProps as movePropsOf } from "../interactions/move.tsx";
import { pressProps as pressPropsOf } from "../interactions/press.tsx";
import { visuallyHidden } from "../a11y/index.ts";
import { getActiveElement, getEventTarget } from "../utils/dom.ts";
import { direction as elementDirection } from "../bidi/index.ts";
import type { GridNode } from "../collections/grid.ts";
import type { Key } from "../collections/types.ts";
import type { ColumnSize, TableColumnResizeState } from "../state/table-column-resize.ts";
import { getColumnHeaderId, type TableStateLike } from "./behaviour.ts";
import { strings } from "./intl.ts";

export interface AriaTableColumnResizeProps<T> {
  /** An object representing the column header. */
  column: GridNode<T>;
  /** Aria label for the hidden input. Gets read when resizing. */
  "aria-label": string;
  /** Ref to the trigger (column header) if resizing was started from a column header menu. */
  triggerRef?: { readonly current: Element | null } | (() => Element | null | undefined) | undefined;
  /** If resizing is disabled. */
  isDisabled?: boolean | undefined;
  /** Called when resizing starts. */
  onResizeStart?: ((widths: Map<Key, ColumnSize>) => void) | undefined;
  /** Called for every resize event that results in new column sizes. */
  onResize?: ((widths: Map<Key, ColumnSize>) => void) | undefined;
  /** Called when resizing ends. */
  onResizeEnd?: ((widths: Map<Key, ColumnSize>) => void) | undefined;
  /** Rivet: id of the hidden input (react-aria `useId`). */
  id: string;
  /** Rivet: id of the hidden "press Enter to resize" description element (react-aria `useDescription`). */
  descriptionId?: string | undefined;
  /** Rivet: locale of the strings. */
  locale?: string | undefined;
}

export interface TableColumnResizeAria {
  /** Props for the visually hidden input element. */
  inputProps: Record<string, unknown>;
  /** Props for the resizer element. */
  resizerProps: Record<string, unknown>;
  /** Whether this column is currently being resized. */
  isResizing: () => boolean;
  /** Whether a mouse drag-resize is active (the cursor overlay renders only then). */
  isMouseResizing: () => boolean;
}

/** Per-instance mutable bookkeeping (react-aria refs). */
interface ResizeMemo {
  isResizing: boolean;
  lastSize: [Key, ColumnSize][] | null;
  wasFocusedOnResizeStart: boolean;
  columnResizeWidth: number;
}

const toMap = (entries: [Key, ColumnSize][] | null): Map<Key, ColumnSize> => new Map(entries ?? []);
const triggerOf = (t: AriaTableColumnResizeProps<unknown>["triggerRef"]): Element | null => (typeof t === "function" ? t() : t?.current) ?? null;

/**
 * Provides the behavior and accessibility implementation for a table column resizer element
 * (react-aria `useTableColumnResize` → `tableColumnResizeProps`). Call once in the component body;
 * spread `resizerProps` on the resizer and `inputProps` on its visually hidden `<input>`.
 */
export function tableColumnResizeProps<T>(props: AriaTableColumnResizeProps<T>, state: () => TableColumnResizeState<T>): TableColumnResizeAria {
  // Locals only: closures never capture `props` (the column node is a class instance, not serializable).
  const { isDisabled, onResizeStart, onResize, onResizeEnd, "aria-label": ariaLabel, id, locale, triggerRef, descriptionId } = props;
  const key = props.column.key;
  const memo: ResizeMemo = { isResizing: false, lastSize: null, wasFocusedOnResizeStart: false, columnResizeWidth: 0 };
  // Whether a mouse drag-resize is active. Set on the first move (not on press) so a cursor overlay
  // only mounts during an actual drag.
  const mouseResizing = signal(false);
  const editModeEnabled = () => untrack(() => state().tableState.isKeyboardNavigationDisabled);

  const startResize = (input: Element | null) => {
    const s = untrack(state);
    if (!memo.isResizing) {
      // react-aria's effect on the resizing column: whether the resizer had focus when resizing started.
      memo.wasFocusedOnResizeStart = !!input && getActiveElement(input.ownerDocument) === input;
      memo.lastSize = [...s.updateResizedColumns(key, s.getColumnWidth(key))];
      s.startResize(key);
      s.tableState.setKeyboardNavigationDisabled(true);
      onResizeStart?.(toMap(memo.lastSize));
    }
    memo.isResizing = true;
  };

  const resize = (newWidth: number) => {
    const sizes = untrack(state).updateResizedColumns(key, newWidth);
    onResize?.(sizes);
    memo.lastSize = [...sizes];
  };

  const endResize = (input?: Element | null) => {
    const s = untrack(state);
    if (memo.isResizing) {
      if (memo.lastSize == null) memo.lastSize = [...s.updateResizedColumns(key, s.getColumnWidth(key))];
      s.endResize();
      s.tableState.setKeyboardNavigationDisabled(false);
      onResizeEnd?.(toMap(memo.lastSize));
      memo.isResizing = false;
      const trigger = triggerOf(triggerRef as never) as HTMLElement | null;
      // switch focus back to the column header unless the resizer was already focused when resizing started.
      if (trigger && !memo.wasFocusedOnResizeStart) focusSafely(trigger);
    }
    memo.lastSize = null;
    void input;
  };

  const endResizeEvent = (): false | void => {
    if (editModeEnabled()) {
      endResize();
      return;
    }
    return false;
  };

  // Declared before the handler bags: resumable closures capture their free locals when the bag is built.
  const focusInput = (input: HTMLInputElement | null | undefined) => {
    if (input) focusSafely(input);
  };
  const inputOf = (resizer: Element | null | undefined): HTMLInputElement | null => resizer?.querySelector("input") ?? null;

  const kb = keyboardPropsOf({
    shortcuts: {
      Escape: () => endResizeEvent(),
      Enter: (e) => {
        if (editModeEnabled()) endResize();
        else startResize(inputOf(e.currentTarget as Element));
      },
      " ": () => endResizeEvent(),
      Tab: () => endResizeEvent(),
    },
  });

  const mv = movePropsOf({
    onMoveStart(e) {
      memo.columnResizeWidth = untrack(state).getColumnWidth(key);
      if (e.pointerType === "mouse") mouseResizing.set(true);
      const doc = globalThis.document as Document | undefined;
      startResize(doc ? getActiveElement(doc) : null);
    },
    onMove(e) {
      let { deltaX } = e;
      const { deltaY, pointerType } = e;
      const doc = globalThis.document as Document | undefined;
      const active = doc ? getActiveElement(doc) : null;
      if (elementDirection(active ?? undefined) === "rtl") deltaX *= -1;
      if (pointerType === "keyboard") {
        if (deltaY !== 0 && deltaX === 0) deltaX = deltaY * -1;
        deltaX *= 10;
      }
      // if moving up/down only, no need to resize
      if (deltaX !== 0) {
        memo.columnResizeWidth += deltaX;
        resize(memo.columnResizeWidth);
      }
    },
    onMoveEnd(e) {
      const { pointerType } = e;
      memo.columnResizeWidth = 0;
      mouseResizing.set(false);
      if (pointerType === "mouse" || (pointerType === "touch" && memo.wasFocusedOnResizeStart)) endResize();
    },
  });

  const pr = pressPropsOf({
    preventFocusOnPress: true,
    onPressStart: (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.pointerType === "keyboard") return;
      if (e.pointerType === "virtual" && untrack(state).resizingColumn != null) {
        endResize();
        return;
      }
      // Sometimes onPress won't trigger for quick taps on mobile so we want to focus the input so blurring away
      // can cancel resize mode for us.
      focusInput(inputOf(e.target));
      // If resizer is always visible, mobile screenreader user can access the visually hidden resizer directly and thus we don't need
      // to handle a virtual click to start the resizer.
      if (e.pointerType !== "virtual") startResize(inputOf(e.target));
    },
    onPress: (e) => {
      if (((e.pointerType === "touch" && memo.wasFocusedOnResizeStart) || e.pointerType === "mouse") && untrack(state).resizingColumn != null) endResize();
    },
  });

  const min = () => Math.floor(state().getColumnMinWidth(key));
  const max = () => {
    const m = Math.floor(state().getColumnMaxWidth(key));
    return m === Infinity ? Number.MAX_SAFE_INTEGER : m;
  };
  const value = () => Math.floor(state().getColumnWidth(key));
  const description = () => {
    let modality: string | null = getInteractionModality();
    if (modality === "virtual" && "ontouchstart" in globalThis) modality = "touch";
    return triggerOf(triggerRef as never) == null && (modality === "keyboard" || modality === "virtual") && state().resizingColumn !== key
      ? formatMessage(strings, locale, "resizerDescription")
      : undefined;
  };

  type Handlers = Record<string, ((e: Event) => void) | undefined>;
  const keys = kb.keyboardProps as Handlers;
  const move = mv.moveProps as Handlers;
  const press = pr.pressProps as Handlers;
  // RESUMABLE CLOSURES: one object literal of inline arrows (react-aria mergeProps(keyboardProps,
  // moveProps, pressProps) chain order), no post-hoc merge.
  return {
    resizerProps: {
      "data-rv-pressable": "",
      style: { touchAction: "none" },
      onKeyDown: (e: KeyboardEvent) => {
        keys.onKeyDown?.(e);
        if (editModeEnabled()) move.onKeyDown?.(e);
        press.onKeyDown?.(e);
      },
      onKeyUp: (e: KeyboardEvent) => keys.onKeyUp?.(e),
      onPointerDown: (e: PointerEvent) => {
        move.onPointerDown?.(e);
        press.onPointerDown?.(e);
      },
      onMouseDown: (e: MouseEvent) => press.onMouseDown?.(e),
      onPointerUp: (e: PointerEvent) => press.onPointerUp?.(e),
      onPointerEnter: (e: PointerEvent) => press.onPointerEnter?.(e),
      onPointerLeave: (e: PointerEvent) => press.onPointerLeave?.(e),
      onClick: (e: MouseEvent) => press.onClick?.(e),
      onDragStart: (e: DragEvent) => press.onDragStart?.(e),
    },
    inputProps: {
      style: visuallyHidden,
      id,
      onBlur: () => endResize(),
      onFocus: () => {
        // react-aria's effect: this column became the resizing column from outside (a Column
        // `startResize`): start the resize once the input has focus.
        if (untrack(state).resizingColumn === key && !memo.isResizing) {
          startResize(null);
          memo.wasFocusedOnResizeStart = false;
        }
      },
      onChange: (e: Event) => {
        const currentWidth = untrack(state).getColumnWidth(key);
        let nextValue = parseFloat((getEventTarget(e) as HTMLInputElement).value);
        if (nextValue > currentWidth) nextValue = currentWidth + 10;
        else nextValue = currentWidth - 10;
        resize(nextValue);
      },
      disabled: isDisabled,
      "aria-label": ariaLabel,
      "aria-orientation": "horizontal",
      "aria-labelledby": () => `${id} ${getColumnHeaderId(state().tableState as TableStateLike<T>, key)}`,
      "aria-valuetext": () => formatMessage(strings, locale, "columnSize", { value: value() }),
      type: "range",
      min,
      max,
      value,
      "aria-describedby": () => (description() ? descriptionId : undefined),
    },
    isResizing: () => state().resizingColumn === key,
    isMouseResizing: () => mouseResizing(),
  };
}

/**
 * Focus the column's resizer input after `startResize` (react-aria: a timeout, plus a second one for
 * VoiceOver on iOS). `column` is the column header element.
 */
export function focusColumnResizer(column: Element | null): void {
  const input = column?.querySelector<HTMLInputElement>(".rv-ColumnResizer input, [data-rv-column-resizer] input");
  if (!input) return;
  setTimeout(() => focusSafely(input), 0);
  setTimeout(() => getActiveElement(input.ownerDocument) !== input && focusSafely(input), 400);
}
