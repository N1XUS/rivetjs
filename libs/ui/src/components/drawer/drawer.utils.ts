// Ported from HeroUI v3.2.6 packages/react/src/components/drawer/drawer.utils.ts + the `useDrawerDrag` hook of drawer.tsx
// (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `useDrawerDrag` (React pointer handlers + refs) → `drawerDrag(dialog, options)`: plain DOM listeners attached by
//   `Drawer.Dialog` from a client effect while it is mounted and dismissable; returns a cleanup.
// - Same gesture rules as upstream: primary button only, drag only from the dialog itself (not a nested drawer), never from
//   interactive elements or `Drawer.Body`; activation after 8 px; only towards the dismiss edge; dismiss when dragged past
//   30 % of the dialog dimension or released faster than 0.5 px/ms; a dismissed drawer keeps its inline transform so the
//   exit animation (upstream CSS, `data-exiting`) continues from the dragged position.
// - Motion: the drag and the settle back after a short release run on `@rivetjs/cdk/motion` (embla-carousel 8.6.0 physics,
//   MIT, © David Jerleke; user decision 2026-10-08: the house motion, no CSS easing) instead of upstream's CSS
//   `transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1)`: `Motion1D` `hold` + `drag` while dragging (embla drag
//   friction), release force from `VelocityTracker` + `DragRelease` (snap boost) for the settle duration / friction.
//   `prefers-reduced-motion: reduce` → the settle jumps (the motion docs' rule).
import { DragRelease, Motion1D, VelocityTracker } from "@rivetjs/cdk/motion";

export type DrawerPlacement = "top" | "bottom" | "left" | "right";

export const isDrawerDragTargetOwnedBy = (target: HTMLElement, dialog: HTMLElement): boolean => target.closest('[data-slot="drawer-dialog"]') === dialog;

/* -------------------------------------------------------------------------------------------------
 * Drawer Drag
 * Tracks pointer events to enable drag-to-dismiss with CSS transforms.
 * Drag only initiates from handle/header/footer areas — body is excluded to avoid scroll conflicts.
 * -----------------------------------------------------------------------------------------------*/

export const DRAG_THRESHOLD = 8; // px before drag activates
export const DISMISS_FRACTION = 0.3; // dismiss if dragged > 30% of dimension
export const VELOCITY_THRESHOLD = 0.5; // px/ms — dismiss on fast flick
const BASE_FRICTION = 0.68;

export interface DrawerDragOptions {
  placement: DrawerPlacement | undefined;
  /** Closes the drawer (upstream `overlayState.close()`). */
  close: () => void;
}

/** Attaches drag-to-dismiss to a dismissable drawer dialog; returns a cleanup. */
export function drawerDrag(dialog: HTMLElement, options: DrawerDragOptions): () => void {
  const { placement, close } = options;
  const view = dialog.ownerDocument.defaultView!;
  const isVertical = placement === "top" || placement === "bottom";
  const axis = isVertical ? "Y" : "X";
  const tracker = VelocityTracker();
  const release = DragRelease(false, BASE_FRICTION);

  let isDragging = false;
  let isActive = false;
  let isMouse = false;
  let startPos = 0;
  let currentOffset = 0;
  let velocity = 0;
  let lastTime = 0;
  let lastPos = 0;

  const render = (value: number): void => {
    dialog.style.transform = value ? `translate${axis}(${value}px)` : "";
  };
  const motion = Motion1D({
    value: 0,
    friction: BASE_FRICTION,
    render,
    onSettle: () => {
      // The interpolated value stops within 0.001 px of the target: clear the inline styles.
      dialog.style.transform = "";
      dialog.style.transition = "";
    },
  });

  const getPos = (e: PointerEvent): number => (isVertical ? e.clientY : e.clientX);

  const clamp = (delta: number): number => {
    // Only allow drag in the dismiss direction
    switch (placement) {
      case "bottom":
        return Math.max(0, delta);
      case "top":
        return Math.min(0, delta);
      case "right":
        return Math.max(0, delta);
      case "left":
        return Math.min(0, delta);
      default:
        return delta;
    }
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;

    if (!isDrawerDragTargetOwnedBy(target, dialog)) return;

    // Don't drag from interactive elements or scrollable body
    if (target.closest("input, textarea, button, [role='button'], select, a, [data-slot='drawer-body']")) {
      return;
    }

    isDragging = true;
    isActive = false;
    isMouse = e.pointerType === "mouse";
    startPos = getPos(e);
    lastPos = startPos;
    lastTime = Date.now();
    currentOffset = 0;
    velocity = 0;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!isDragging) return;

    const pos = getPos(e);
    const rawDelta = pos - startPos;
    const delta = clamp(rawDelta);

    // Activate only after passing threshold to avoid false starts
    if (!isActive) {
      if (Math.abs(rawDelta) < DRAG_THRESHOLD) return;
      isActive = true;
      dialog.style.transition = "none";
      try {
        dialog.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointers have no capture.
      }
      tracker.pointerDown(startPos, e.timeStamp);
      motion.hold(true);
    }

    currentOffset = delta;
    tracker.pointerMove(pos, e.timeStamp);

    // Track velocity for flick detection
    const now = Date.now();
    const dt = now - lastTime;

    if (dt > 0) {
      velocity = (pos - lastPos) / dt;
      lastTime = now;
      lastPos = pos;
    }

    motion.drag(delta - motion.target.get());
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!isDragging) return;
    isDragging = false;

    if (!isActive) {
      isActive = false;

      return;
    }
    isActive = false;

    // Release pointer capture
    try {
      dialog.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may already be released
    }

    const dimension = isVertical ? dialog.offsetHeight : dialog.offsetWidth;
    const absOffset = Math.abs(currentOffset);
    const absVelocity = Math.abs(velocity);

    const shouldDismiss = absOffset > dimension * DISMISS_FRACTION || absVelocity > VELOCITY_THRESHOLD;

    motion.hold(false);
    if (shouldDismiss) {
      // Keep the inline transform — it compounds with the content exit animation
      // so the drawer continues sliding from the dragged position
      motion.stop();
      render(currentOffset);
      close();
    } else {
      // Settle back on the house motion (upstream: a 300 ms spring-like CSS transition)
      const current = motion.get();
      if (view.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        motion.to(0, true);
      } else {
        const rawForce = tracker.pointerUp(e.timeStamp) * release.forceBoost(isMouse);
        const { duration, friction } = release.settle(rawForce, -current);
        motion.scrollBody.useDuration(duration).useFriction(friction);
        motion.target.set(0);
        motion.animation.start();
      }
    }

    currentOffset = 0;
    velocity = 0;
  };

  dialog.addEventListener("pointerdown", onPointerDown);
  dialog.addEventListener("pointermove", onPointerMove);
  dialog.addEventListener("pointerup", onPointerUp);
  return () => {
    motion.stop();
    dialog.removeEventListener("pointerdown", onPointerDown);
    dialog.removeEventListener("pointermove", onPointerMove);
    dialog.removeEventListener("pointerup", onPointerUp);
  };
}
