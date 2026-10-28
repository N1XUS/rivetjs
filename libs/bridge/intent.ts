// @rivetjs/bridge/intent — the `intent` policy (spec §3.5), loaded on demand by the driver (`client.ts`) for intent
// islands only (resumed ones start fetching it next to the driver: `root.tsx`). Island-local listeners start the
// hydration; the cold pointerdown / click that started it (recorded by the driver) is replayed once on its target after
// hydration.
import type { Listen } from "./client.ts";

const DWELL = 60;

/**
 * @internal Island-local intent: pointerover dwell / focusin / touchstart on the root start it (`listen`: removed once it
 * starts). The driver records a pointerdown / click before hydration itself (`client.ts` `watch`).
 */
export function intent(root: Element, listen: Listen, start: () => void): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  listen(root, "pointerover", () => {
    clearTimeout(timer);
    timer = setTimeout(start, DWELL);
  });
  listen(root, "pointerout", () => clearTimeout(timer));
  listen(root, "focusin", start);
  listen(root, "touchstart", start);
}

/**
 * @internal Re-dispatch a cold event on its original target once the framework listens. The original already ran its
 * default action (link navigation, submit, checkbox toggle): the copy replays the handlers only — it is cancelled
 * before dispatch, and again at window capture (before any handler can stop its propagation).
 */
export function redispatch(event: Event): void {
  const target = event.target as Element | null;
  if (!target?.isConnected) return;
  const e = event as PointerEvent;
  const init: PointerEventInit = {
    bubbles: e.bubbles,
    cancelable: true,
    composed: e.composed,
    clientX: e.clientX,
    clientY: e.clientY,
    screenX: e.screenX,
    screenY: e.screenY,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
    button: e.button,
    buttons: e.buttons,
    detail: e.detail,
    pointerId: e.pointerId,
    pointerType: e.pointerType,
    isPrimary: e.isPrimary,
  };
  const copy =
    typeof PointerEvent !== "undefined" && event instanceof PointerEvent
      ? new PointerEvent(e.type, init)
      : event instanceof MouseEvent
        ? new MouseEvent(e.type, init)
        : new Event(e.type, init);
  copy.preventDefault();
  const guard = (seen: Event) => seen === copy && seen.preventDefault();
  // A checkbox / radio click toggles before its handlers run, also when cancelled (undone after dispatch): pre-flip it
  // so the handlers read the state the user's click produced, then restore that state.
  const box = e.type === "click" && target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio") ? target : null;
  const checked = box?.checked;
  if (box) box.checked = !checked;
  addEventListener(e.type, guard, true);
  try {
    target.dispatchEvent(copy);
  } finally {
    removeEventListener(e.type, guard, true);
    if (box) box.checked = checked!;
  }
}
