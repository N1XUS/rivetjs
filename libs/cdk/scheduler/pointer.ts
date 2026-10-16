// Ported from @malva-ui/scheduler (src/lib/drag/scheduler-pointer.ts: `TOUCH_GESTURE_DELAY`, `elementAt`,
// `attachPointerDrag`), MIT, © 2026 Malva UI.
// Rivet:
// - `startPointerDrag(event, element, handlers, options)`: the same tracker started from a press that was already
//   dispatched (the lazily loaded drag chunk receives the pointerdown that loaded it); `attachPointerDrag` = a
//   pointerdown listener calling it. `released` (optional) tells a press released while the chunk loaded: the
//   gesture then ends at once as a click (`onEnd(point, false)`).
// - No NgZone: callers run plain functions.
// - `swallowNextClick(doc, press, scope)` replaces malva's per-view `_ignoreClicksUntil` / `suppressNextClick`
//   timestamps (same 300 ms window; scoped to the scheduler; skipped after touch; dropped on the next pointerdown).
/** Screen position of a pointer. */
export interface SchedulerPointerPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Milliseconds a touch must rest before a scheduler pointer gesture arms (range selection, chip resize and the chip
 * drag-move's `dragStartDelay`): every touch gesture has the same "press, then drag" feel and a swipe scrolls.
 */
export const TOUCH_GESTURE_DELAY = 200;

/**
 * The element under a pointer position, falling back to `fallback`. A touch pointer is implicitly captured by the
 * element its `pointerdown` landed on, so a gesture that hit-tests cells must not read `event.target` on moves;
 * `elementFromPoint` returns `null` outside the viewport, so the caller's own target is the fallback.
 */
export function elementAt(doc: Document, at: SchedulerPointerPosition, fallback: EventTarget | null): EventTarget | null {
  if (typeof doc.elementFromPoint !== "function") return fallback;
  return doc.elementFromPoint(at.x, at.y) ?? fallback;
}

/** Milliseconds a gesture's trailing click is swallowed for (malva `suppressNextClick` window). */
export const CLICK_SWALLOW_WINDOW = 300;

/**
 * Swallows the click the release of a gesture produces (malva `suppressNextClick`): once, within
 * `CLICK_SWALLOW_WINDOW` ms, only when the click lands inside one of `scope` (the scheduler root, the dragged chip),
 * and never after a touch gesture (a prevented `touchmove` leaves no trailing click, so the user's next tap would be
 * eaten). The next `pointerdown` drops it: a click after a new press belongs to that press.
 */
export function swallowNextClick(doc: Document, press: Event, scope: readonly (Element | null | undefined)[]): void {
  if (press.type.startsWith("touch") || (press as PointerEvent).pointerType === "touch") return;
  const swallow = (event: Event) => {
    const target = event.target as Node | null;
    if (!target || !scope.some((element) => element?.contains(target))) return;
    event.stopPropagation();
    event.preventDefault();
    done();
  };
  const done = () => {
    clearTimeout(timer);
    doc.removeEventListener("click", swallow, true);
    doc.removeEventListener("pointerdown", done, true);
  };
  doc.addEventListener("click", swallow, true);
  doc.addEventListener("pointerdown", done, true);
  const timer = setTimeout(done, CLICK_SWALLOW_WINDOW);
}

/** Callbacks of `attachPointerDrag` / `startPointerDrag`. */
export interface SchedulerPointerDragHandlers {
  /** Fires once, when the pointer first crosses the threshold. `point` is where the pointer went down. */
  onStart?(point: SchedulerPointerPosition, event: Event): void;
  /** Fires on every pointermove after the threshold. */
  onMove(point: SchedulerPointerPosition, event: Event): void;
  /** Fires on pointerup. `moved` is `false` for a plain click that never crossed the threshold. */
  onEnd(point: SchedulerPointerPosition, moved: boolean, event: Event | null): void;
  /** Fires on Escape or pointercancel; `onEnd` is not called afterwards. */
  onCancel?(): void;
}

/** Options of `attachPointerDrag` / `startPointerDrag`. */
export interface SchedulerPointerDragOptions {
  /** Distance in px before a press becomes a drag. Default `5`. */
  readonly threshold?: number;
  /**
   * Capture the pointer on the element so the compatibility mouse events and the trailing `click` retarget to it.
   * Default `true`; range selections pass `false` (their cells own the click handlers a press still has to reach).
   */
  readonly capture?: boolean;
  /** Return `true` for targets that must not start a drag (chips, buttons). */
  ignore?(target: Element): boolean;
  /**
   * Milliseconds a TOUCH pointer must stay still before the gesture arms. Default `0`. A touch that moves before
   * the timer fires abandons the gesture silently (the browser pans); once armed, the pointer is captured and
   * `touchmove` is prevented. Mouse and pen keep the movement threshold.
   */
  readonly touchDelay?: number;
  /** The press was released before the gesture started (lazy chunk): ends at once as a click. */
  readonly released?: () => boolean;
}

/**
 * Press-drag-release tracker on Pointer Events, started from an already dispatched `pointerdown`. Handles button
 * filtering, threshold, capture, touch delay, foreign pointers, Escape / pointercancel and cleanup. Returns the
 * teardown (also run when the gesture ends).
 */
export function startPointerDrag(
  down: Event,
  element: HTMLElement,
  handlers: SchedulerPointerDragHandlers,
  options: SchedulerPointerDragOptions = {},
): () => void {
  const threshold = options.threshold ?? 5;
  const capture = options.capture ?? true;
  const touchDelay = options.touchDelay ?? 0;
  const doc = element.ownerDocument;
  let origin: SchedulerPointerPosition | null = null;
  let pointerId: number | null = null;
  let started = false;
  let pending = false;
  let delayedTouch = false;
  let delayTimer: ReturnType<typeof setTimeout> | null = null;

  const onTouchMove = (event: Event): void => {
    if (event.cancelable) event.preventDefault();
  };
  const point = (event: Event): SchedulerPointerPosition => {
    const { clientX, clientY } = event as PointerEvent;
    return { x: clientX, y: clientY };
  };
  const stop = (): void => {
    if (delayTimer !== null) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    pending = false;
    delayedTouch = false;
    element.removeEventListener("touchmove", onTouchMove);
    if (pointerId !== null && capture && typeof element.releasePointerCapture === "function" && element.hasPointerCapture?.(pointerId))
      element.releasePointerCapture(pointerId);
    origin = null;
    pointerId = null;
    started = false;
    doc.removeEventListener("pointermove", onMove);
    doc.removeEventListener("pointerup", onUp);
    doc.removeEventListener("pointercancel", onCancel);
    doc.removeEventListener("keydown", onKeydown);
  };
  // A second pointer must not steer a gesture it did not start (events without a pointerId are never filtered).
  const foreign = (event: Event): boolean => {
    const id = (event as PointerEvent).pointerId;
    return pointerId !== null && typeof id === "number" && id !== pointerId;
  };
  const onMove = (event: Event): void => {
    if (!origin || foreign(event)) return;
    const at = point(event);
    const travelled = Math.hypot(at.x - origin.x, at.y - origin.y);
    if (pending) {
      if (travelled >= threshold) onCancel();
      return;
    }
    if (!started) {
      if (travelled < threshold) return;
      started = true;
      handlers.onStart?.(origin, event);
    }
    handlers.onMove(at, event);
  };
  const onUp = (event: Event): void => {
    if (!origin || foreign(event)) return;
    const moved = started;
    const at = point(event);
    stop();
    handlers.onEnd(at, moved, event);
  };
  const onCancel = (event?: Event): void => {
    if (!origin || (event && foreign(event))) return;
    stop();
    handlers.onCancel?.();
  };
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") onCancel();
  };
  const arm = (): void => {
    pending = false;
    delayTimer = null;
    if (capture && pointerId !== null && typeof element.setPointerCapture === "function") {
      try {
        element.setPointerCapture(pointerId);
      } catch {
        // A pointer already released / an element detached meanwhile: the document listeners still see the events.
      }
    }
    if (delayedTouch) element.addEventListener("touchmove", onTouchMove, { passive: false });
  };

  const pe = down as PointerEvent;
  if (pe.button !== undefined && pe.button !== 0) return stop;
  const target = down.target as Element | null;
  if (target && options.ignore?.(target)) return stop;
  origin = point(down);
  if (options.released?.()) {
    const at = origin;
    stop();
    handlers.onEnd(at, false, null);
    return stop;
  }
  pointerId = typeof pe.pointerId === "number" ? pe.pointerId : null;
  if (touchDelay > 0 && pe.pointerType === "touch") {
    pending = true;
    delayedTouch = true;
    delayTimer = setTimeout(arm, touchDelay);
  } else arm();
  doc.addEventListener("pointermove", onMove);
  doc.addEventListener("pointerup", onUp);
  doc.addEventListener("pointercancel", onCancel);
  doc.addEventListener("keydown", onKeydown);
  return stop;
}

/** malva `attachPointerDrag`: tracks every press on `element` (one gesture at a time). Returns the detach. */
export function attachPointerDrag(element: HTMLElement, handlers: SchedulerPointerDragHandlers, options: SchedulerPointerDragOptions = {}): () => void {
  let running: (() => void) | null = null;
  let active = false;
  const wrapped: SchedulerPointerDragHandlers = {
    onStart: handlers.onStart && ((p, e) => handlers.onStart!(p, e)),
    onMove: (p, e) => handlers.onMove(p, e),
    onEnd: (p, moved, e) => {
      active = false;
      handlers.onEnd(p, moved, e);
    },
    onCancel: () => {
      active = false;
      handlers.onCancel?.();
    },
  };
  const onDown = (event: Event): void => {
    // A press while a gesture runs belongs to another pointer: never re-anchor the running one.
    if (active) return;
    const pe = event as PointerEvent;
    if (pe.button !== undefined && pe.button !== 0) return;
    const target = event.target as Element | null;
    if (target && options.ignore?.(target)) return;
    active = true;
    running = startPointerDrag(event, element, wrapped, options);
  };
  element.addEventListener("pointerdown", onDown);
  return () => {
    running?.();
    active = false;
    element.removeEventListener("pointerdown", onDown);
  };
}
