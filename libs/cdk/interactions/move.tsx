// moveProps: drag-style movement with mouse, pen, touch (pointer events, page coordinates) and arrow
// keys; movestart only after the first non-zero delta; text selection disabled while moving.
// Ported from @react-aria/interactions useMove (react-spectrum), Apache-2.0, © Adobe.
//
// Rivet: resumable handlers; per-move state is a JSON object. No mouse/touch fallback (test-only in
// the original).
import { disableTextSelection, getEventTarget, getOwnerWindow, restoreTextSelection, type PointerType } from "./utils.ts";

interface BaseMoveEvent {
  pointerType: PointerType;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}
export interface MoveStartEvent extends BaseMoveEvent {
  type: "movestart";
}
export interface MoveMoveEvent extends BaseMoveEvent {
  type: "move";
  /** Movement in X since the last event. */
  deltaX: number;
  /** Movement in Y since the last event. */
  deltaY: number;
}
export interface MoveEndEvent extends BaseMoveEvent {
  type: "moveend";
}
export type MoveEvent = MoveStartEvent | MoveMoveEvent | MoveEndEvent;

export interface MoveEvents {
  onMoveStart?: (e: MoveStartEvent) => void;
  onMove?: (e: MoveMoveEvent) => void;
  onMoveEnd?: (e: MoveEndEvent) => void;
}

export interface MoveResult {
  moveProps: Record<string, unknown>;
}

interface EventBase {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

interface Move {
  props: MoveEvents;
  state: { didMove: boolean; lastPosition: { pageX: number; pageY: number } | null; id: number | null };
}

const modifiers = (e: EventBase) => ({ shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey });

function move(m: Move, e: EventBase, pointerType: PointerType, deltaX: number, deltaY: number): void {
  if (deltaX === 0 && deltaY === 0) return;
  if (!m.state.didMove) {
    m.state.didMove = true;
    m.props.onMoveStart?.({ type: "movestart", pointerType, ...modifiers(e) });
  }
  m.props.onMove?.({ type: "move", pointerType, deltaX, deltaY, ...modifiers(e) });
}

function end(m: Move, e: EventBase, pointerType: PointerType): void {
  restoreTextSelection();
  if (m.state.didMove) m.props.onMoveEnd?.({ type: "moveend", pointerType, ...modifiers(e) });
}

function start(m: Move): void {
  disableTextSelection();
  m.state.didMove = false;
}

/** @internal pointerdown handler of moveProps. */
export function movePointerDown(m: Move, e: PointerEvent): void {
  const { state } = m;
  if (e.button !== 0 || state.id != null) return;
  start(m);
  e.stopPropagation();
  e.preventDefault();
  state.lastPosition = { pageX: e.pageX, pageY: e.pageY };
  state.id = e.pointerId;
  const win = getOwnerWindow(getEventTarget(e));
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== state.id) return;
    // movementX/Y is 0 on macOS Safari and DPR-scaled on Chrome Android: use page coordinates.
    move(
      m,
      event,
      (event.pointerType || "mouse") as PointerType,
      event.pageX - (state.lastPosition?.pageX ?? 0),
      event.pageY - (state.lastPosition?.pageY ?? 0),
    );
    state.lastPosition = { pageX: event.pageX, pageY: event.pageY };
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== state.id) return;
    end(m, event, (event.pointerType || "mouse") as PointerType);
    state.id = null;
    win.removeEventListener("pointermove", onPointerMove, false);
    win.removeEventListener("pointerup", onPointerUp, false);
    win.removeEventListener("pointercancel", onPointerUp, false);
  };
  win.addEventListener("pointermove", onPointerMove, false);
  win.addEventListener("pointerup", onPointerUp, false);
  win.addEventListener("pointercancel", onPointerUp, false);
}

/** @internal keydown handler of moveProps. */
export function moveKeyDown(m: Move, e: KeyboardEvent): void {
  let delta: [number, number] | null = null;
  switch (e.key) {
    case "Left":
    case "ArrowLeft":
      delta = [-1, 0];
      break;
    case "Right":
    case "ArrowRight":
      delta = [1, 0];
      break;
    case "Up":
    case "ArrowUp":
      delta = [0, -1];
      break;
    case "Down":
    case "ArrowDown":
      delta = [0, 1];
      break;
  }
  if (!delta) return;
  e.preventDefault();
  e.stopPropagation();
  start(m);
  move(m, e, "keyboard", delta[0], delta[1]);
  end(m, e, "keyboard");
}

/** Move interactions (drag with mouse / touch / pen, arrow keys). Spread `moveProps` on the target. */
export function moveProps(props: MoveEvents = {}): MoveResult {
  const m: Move = { props, state: { didMove: false, lastPosition: null, id: null } };
  return {
    moveProps: {
      onPointerDown: (e: PointerEvent) => movePointerDown(m, e),
      onKeyDown: (e: KeyboardEvent) => moveKeyDown(m, e),
    },
  };
}
