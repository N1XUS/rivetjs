// Rivet addition (KANBAN-SELECT 2026-10-29): card selection of a `.CardList` with `selectionMode` (`kanban.tsx`), loaded
// on the list's first event so boards without selection never load the GridList behaviour. The handlers are the
// `@rivetjs/cdk/grid-list/behaviour` port (RAC GridList: row press / focus per card, grid navigation, typeahead, Escape,
// Mod+A) delegated on the list element, over the rendered cards as the collection (`listStateView(state, shared, list)`:
// no items, so `listCollection` reads the cards' `data-key` / `data-collection`).
// A `.ts` module (plain DOM code at event time; not server-rewritten).
import type { ListState } from "@rivetjs/cdk/collections/list-state";
import type { Key } from "@rivetjs/cdk/collections/types";
import {
  gridListBlur,
  gridListFocus,
  gridListItemClick,
  gridListItemFocus,
  gridListItemKeyDown,
  gridListItemKeyUp,
  gridListItemPointerCancel,
  gridListItemPointerDown,
  gridListItemPointerUp,
  gridListKeyDown,
  gridListKeyDownCapture,
  gridListMouseDown,
  listStateView,
} from "@rivetjs/cdk/grid-list/behaviour";
import type { AriaGridListItemOptions, AriaGridListOptions, GridListShared, GridListStateLike } from "@rivetjs/cdk/grid-list/behaviour";

/** What a selectable `.CardList` passes its handlers (plain data + the serializable list state). */
export interface KanbanSelectableList {
  state: ListState;
  shared: GridListShared;
  escapeKeyBehavior?: "clearSelection" | "none" | undefined;
  onAction?: ((key: Key) => void) | undefined;
}

export type KanbanListEvent = "keydown" | "keyup" | "focusin" | "focusout" | "mousedown" | "pointerdown" | "pointerup" | "pointercancel" | "click";

const CARD = '[data-slot="kanban-card"]';
// Pointer press origin per list: a press that moved past 4px (a drag) never selects.
const pressAt = new WeakMap<Element, { x: number; y: number }>();
const moved = (list: Element, e: MouseEvent) => {
  const at = pressAt.get(list);
  return !!at && Math.abs(e.clientX - at.x) + Math.abs(e.clientY - at.y) > 4;
};

function cardOf(list: HTMLElement, id: string, target: EventTarget | null): HTMLElement | null {
  const card = (target as Element | null)?.closest?.<HTMLElement>(CARD) ?? null;
  return card && card.getAttribute("data-collection") === id && list.contains(card) ? card : null;
}

function rowOf(v: GridListStateLike<unknown>, card: HTMLElement | null): AriaGridListItemOptions | null {
  const key = card?.getAttribute("data-key");
  const node = key == null ? null : v.collection.getItem(key);
  return node && card ? { node, ref: card } : null;
}

/** One event on the list element `list` (the event's `currentTarget`; it may be a proxy after the first load). */
export function kanbanListEvent(type: KanbanListEvent, e: Event, list: HTMLElement, board: KanbanSelectableList): void {
  const { state, shared } = board;
  const options: AriaGridListOptions = { id: state.id, ref: list, escapeKeyBehavior: board.escapeKeyBehavior, onAction: board.onAction };
  const v = listStateView(state, shared, list) as GridListStateLike<unknown>;
  const row = rowOf(v, cardOf(list, state.id, e.target));
  const ev = e as never;
  switch (type) {
    case "keydown":
      if (gridListKeyDownCapture(ev, options, v)) return;
      if (row) gridListItemKeyDown(ev, row, v);
      if (!e.cancelBubble) gridListKeyDown(ev, options, v);
      return;
    case "keyup":
      if (row) gridListItemKeyUp(ev, row, v);
      return;
    case "focusin":
      if (row) gridListItemFocus(ev, row, v);
      gridListFocus(ev, options, v);
      return;
    case "focusout":
      gridListBlur(ev, options, v);
      return;
    case "mousedown":
      gridListMouseDown(ev, options, v);
      return;
    case "pointerdown":
      pressAt.set(list, { x: (e as PointerEvent).clientX, y: (e as PointerEvent).clientY });
      if (row) gridListItemPointerDown(ev, row, v);
      return;
    case "pointerup":
      if (row) (moved(list, e as PointerEvent) ? gridListItemPointerCancel : gridListItemPointerUp)(ev, row, v);
      return;
    case "pointercancel":
      if (row) gridListItemPointerCancel(ev, row, v);
      return;
    case "click":
      if (row && !moved(list, e as MouseEvent)) gridListItemClick(ev, row, v);
      return;
  }
}
