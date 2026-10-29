// Rivet (no upstream: shadcn's Sheet has no swipe): swipe-to-dismiss of the mobile Sidebar sheet on the house motion,
// `@rivetjs/cdk/motion` (embla-carousel 8.6.0 physics, MIT, © David Jerleke; user decision 2026-10-08: no hand-rolled
// easing). The drag follows the pointer (Motion1D `hold` + `drag`, embla's drag friction); on release the flick force
// (VelocityTracker, DragRelease snap boost) projects the throw: past half the sheet width → it animates off-screen
// and `close()` runs at once (the overlay exit slides it on from the dragged offset), otherwise it settles back open. Open / close
// from the trigger, Escape or the underlay stay the overlay's CSS transition (`data-entering` / `data-exiting`).
// - Axis lock: a move must go 6 px, more sideways than vertical, before the drag starts (vertical moves scroll the
//   content); the sheet sets `touch-action: pan-y` inline (behaviour-critical) so touch drags reach it.
// - Native drag-and-drop (links, images) is prevented while a pointer is down on the sheet (it would cancel the pointer).
// - A started drag cancels presses under the pointer (synthetic `pointercancel`, as a browser does for a pan) and
//   swallows the click that follows.
// - Units: distance towards the closed edge, 0 = open … sheet width = off-screen; rendered as an inline
//   `transform: translateX(…)` (the overlay CSS animates `translate`, the two compose); the underlay fades with it.
// - `prefers-reduced-motion: reduce` or the provider's `reduceMotion` → the release jumps (duration 0), as the motion
//   docs prescribe. Timing of open / close and of the dismiss fade = the stylesheet's (ui: the overlay tokens, as a Drawer).
import { DragRelease, Motion1D, VelocityTracker } from "../motion/index.ts";
import { cssTiming } from "../utils/css-timing.ts";

export interface SidebarSheetMotionOptions {
  /** The edge the sheet is attached to. */
  side: "left" | "right";
  /** Closes the mobile sheet (`setSidebarOpenMobile(state, false)`). */
  close: () => void;
  /** Rivet: the provider's `reduceMotion` (read on release; `prefers-reduced-motion` applies too). */
  reduceMotion?: () => boolean;
}

/** Pixels a pointer moves before a drag is decided (sideways → drag, vertical → scroll). */
export const SHEET_DRAG_THRESHOLD = 6;
const BASE_FRICTION = 0.68;

/**
 * Attaches swipe-to-dismiss motion to the open mobile sheet element; returns a cleanup. Called by `Sidebar` from a
 * client effect while the sheet is open.
 */
export function sidebarSheetMotion(sheet: HTMLElement, options: SidebarSheetMotionOptions): () => void {
  const { side, close, reduceMotion } = options;
  const view = sheet.ownerDocument.defaultView!;
  // Closing direction in screen x: left sheet closes to the left.
  const sign = side === "left" ? -1 : 1;
  const backdrop = sheet.parentElement && sheet.parentElement !== sheet.ownerDocument.body ? sheet.parentElement : null;
  const tracker = VelocityTracker();
  const release = DragRelease(false, BASE_FRICTION);
  let width = 0;
  let dismissing = false;
  const render = (value: number): void => {
    sheet.style.transform = value ? `translateX(${sign * value}px)` : "";
    if (backdrop && width) backdrop.style.opacity = value ? String(Math.max(0, 1 - value / width)) : "";
  };
  const motion = Motion1D({ value: 0, friction: BASE_FRICTION, render, onSettle: () => reset() });
  const reset = (): void => {
    sheet.style.transform = "";
    sheet.style.transition = "";
    if (backdrop) ((backdrop.style.opacity = ""), (backdrop.style.transition = ""));
  };

  let pointer: { id: number; x: number; y: number; target: EventTarget | null; mouse: boolean } | null = null;
  let dragging = false;
  let cancelling = false;
  const point = (event: PointerEvent): number => sign * event.clientX;
  const clamp = (): void => {
    const target = motion.target.get();
    if (target < 0) motion.target.set(0);
    else if (target > width) motion.target.set(width);
  };

  const down = (event: PointerEvent): void => {
    if (pointer || dismissing || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.target, mouse: event.pointerType === "mouse" };
    dragging = false;
  };
  const move = (event: PointerEvent): void => {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (!dragging) {
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      if (Math.abs(dx) < SHEET_DRAG_THRESHOLD && Math.abs(dy) < SHEET_DRAG_THRESHOLD) return;
      if (Math.abs(dy) >= Math.abs(dx)) return void (pointer = null);
      dragging = true;
      width = sheet.getBoundingClientRect().width;
      sheet.style.transition = "none";
      if (backdrop) backdrop.style.transition = "none";
      try {
        sheet.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointers have no capture.
      }
      // Cancel presses under the pointer (a browser does the same when it starts a pan); our own window
      // `pointercancel` listener ignores this synthetic one (`cancelling`).
      cancelling = true;
      try {
        pointer.target?.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: event.pointerId, pointerType: event.pointerType }));
      } finally {
        cancelling = false;
      }
      view.addEventListener("click", swallow, { capture: true, once: true });
      tracker.pointerDown(sign * pointer.x, event.timeStamp);
      motion.hold(true);
    }
    event.preventDefault();
    motion.drag(tracker.pointerMove(point(event), event.timeStamp));
    clamp();
  };
  const up = (event: PointerEvent): void => {
    if (cancelling || !pointer || event.pointerId !== pointer.id) return;
    const mouse = pointer.mouse;
    pointer = null;
    if (!dragging) return;
    dragging = false;
    // Drop the click swallower if no click follows (pointerup outside the start element).
    view.setTimeout(() => view.removeEventListener("click", swallow, { capture: true }), 0);
    const rawForce = event.type === "pointercancel" ? 0 : tracker.pointerUp(event.timeStamp) * release.forceBoost(mouse);
    const current = motion.target.get();
    dismissing = current + rawForce > width / 2;
    motion.hold(false);
    if (dismissing) return dismiss(current);
    if (reduceMotion?.() || view.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return motion.to(0, true);
    const { duration, friction } = release.settle(rawForce, -current);
    motion.scrollBody.useDuration(duration).useFriction(friction);
    motion.target.set(0);
    motion.animation.start();
  };
  // Dismiss = close right away (ui Drawer's rule): the sheet keeps its inline offset and the overlay's exit
  // (`data-exiting` animation / transition on `translate`) slides it on from there; the underlay fades from its
  // dragged opacity (a script animation above the theme's CSS fade) with the exit timing the stylesheet gives it
  // (`cssTiming` after `close()` flipped `data-exiting`: no duration / curve in JS; none = reduced motion or no
  // stylesheet). Settling the spring first left the underlay blocking the page for ~1.5 s of an invisible tail.
  const dismiss = (current: number): void => {
    motion.stop();
    render(current);
    sheet.style.transition = "";
    close();
    if (!backdrop) return;
    const from = backdrop.style.opacity || "1";
    // After `close()`: the inline 0 starts the CSS fade under the exit rules (not the enter fade's duration).
    const fade = (): void => {
      backdrop.style.transition = "";
      backdrop.style.opacity = "0";
      const timing = reduceMotion?.() ? null : cssTiming(backdrop, "opacity");
      if (timing) backdrop.animate?.([{ opacity: from }, { opacity: 0 }], timing);
    };
    // `close()` commits `data-exiting` synchronously when nothing batches it; else read the exit rules a frame later.
    if (backdrop.hasAttribute("data-exiting")) fade();
    else view.requestAnimationFrame(fade);
  };
  // A mouse drag that starts on a link (menu buttons with `href`) or an image would become a native drag-and-drop: the
  // browser fires `pointercancel` and stops sending moves. No native drag inside the sheet while a pointer is down.
  const noNativeDrag = (event: DragEvent): void => {
    if (pointer) event.preventDefault();
  };
  const swallow = (event: Event): void => {
    event.stopPropagation();
    event.preventDefault();
  };

  const touchAction = sheet.style.touchAction;
  sheet.style.touchAction = "pan-y";
  sheet.addEventListener("pointerdown", down);
  sheet.addEventListener("dragstart", noNativeDrag);
  view.addEventListener("pointermove", move, { passive: false });
  view.addEventListener("pointerup", up);
  view.addEventListener("pointercancel", up);
  return () => {
    motion.stop();
    sheet.removeEventListener("pointerdown", down);
    sheet.removeEventListener("dragstart", noNativeDrag);
    view.removeEventListener("pointermove", move);
    view.removeEventListener("pointerup", up);
    view.removeEventListener("pointercancel", up);
    view.removeEventListener("click", swallow, { capture: true });
    sheet.style.touchAction = touchAction;
    // A swiped-away sheet keeps its offset while the overlay exit unmounts it (no jump back on screen).
    if (!dismissing) reset();
  };
}
