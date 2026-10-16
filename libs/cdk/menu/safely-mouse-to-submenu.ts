// Ported from react-aria menu/useSafelyMouseToSubmenu.ts (packages/react-aria/src/menu), Apache-2.0, © Adobe.
//
// Lets the user move the pointer to an open submenu without the submenu closing when the pointer
// leaves its trigger: while the pointer moves towards the submenu, `pointer-events: none` is set on
// the parent menu so the items it crosses do not take hover / focus.
// Rivet:
// - the hook's effect → `safelyMouseToSubmenu(menu, submenu, options)`: attach while the submenu is
//   open (browser only, from the submenu's open path), returns the cleanup. No load-time JS.
// - `useResizeObserver` on the submenu → one ResizeObserver while attached; `useInteractionModality` →
//   `getInteractionModality()` read at attach time (upstream re-runs the effect on modality change:
//   the cleanup + re-attach happens on the next open).
// - the `NODE_ENV === "test"` guard of the capture pointerdown listener → `options.preventPointerDown`
//   (default true; tests without hit testing pass false).
import { getInteractionModality } from "../interactions/focus-visible.tsx";
import { nodeContains } from "../interactions/utils.ts";

export interface SafelyMouseToSubmenuOptions {
  /** Whether this feature is disabled. */
  isDisabled?: boolean;
  /** Capture `pointerdown` over the safe triangle (default true). */
  preventPointerDown?: boolean;
}

const ALLOWED_INVALID_MOVEMENTS = 2;
const THROTTLE_TIME = 50;
const TIMEOUT_TIME = 1000;
const ANGLE_PADDING = Math.PI / 12; // 15°

/**
 * Allows the user to move their pointer to the submenu without it closing when their mouse leaves
 * the trigger element. Prevents pointer events from going to the underlying menu if the user is
 * moving their pointer towards the sub-menu. Returns the cleanup.
 */
export function safelyMouseToSubmenu(menu: HTMLElement | null, submenu: HTMLElement | null, options: SafelyMouseToSubmenuOptions = {}): () => void {
  let prevPointerPos: { x: number; y: number } | undefined;
  let submenuRect: DOMRect | undefined;
  let lastProcessedTime = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let autoCloseTimeout: ReturnType<typeof setTimeout> | undefined;
  let submenuSide: "left" | "right" | undefined;
  let movementsTowardsSubmenuCount = ALLOWED_INVALID_MOVEMENTS;
  let preventPointerEvents = false;

  const setPreventPointerEvents = (value: boolean): void => {
    preventPointerEvents = value;
    if (menu) menu.style.pointerEvents = value ? "none" : "";
  };
  const reset = (): void => {
    setPreventPointerEvents(false);
    movementsTowardsSubmenuCount = ALLOWED_INVALID_MOVEMENTS;
    prevPointerPos = undefined;
  };

  if (options.isDisabled || !submenu || !menu || getInteractionModality() !== "pointer") {
    reset();
    return () => {};
  }
  submenuRect = submenu.getBoundingClientRect();

  const updateSubmenuRect = (): void => {
    submenuRect = submenu.getBoundingClientRect();
    submenuSide = undefined;
  };
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(updateSubmenuRect) : null;
  observer?.observe(submenu);

  // Prevent mouse down over safe triangle. Clicking while pointer-events: none is applied
  // will cause focus to move unexpectedly since it will go to an element behind the menu.
  const onPointerDown = (e: PointerEvent): void => {
    if (preventPointerEvents) e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    const currentTime = Date.now();
    // Throttle
    if (currentTime - lastProcessedTime < THROTTLE_TIME) return;
    clearTimeout(timeout);
    clearTimeout(autoCloseTimeout);
    const { clientX: mouseX, clientY: mouseY } = e;
    if (!prevPointerPos) {
      prevPointerPos = { x: mouseX, y: mouseY };
      return;
    }
    if (!submenuRect) return;
    if (!submenuSide) submenuSide = mouseX > submenuRect.right ? "left" : "right";
    // Pointer is outside of parent menu
    const menuRect = menu.getBoundingClientRect();
    if (mouseX < menuRect.left || mouseX > menuRect.right || mouseY < menuRect.top || mouseY > menuRect.bottom) {
      reset();
      return;
    }
    // Check if pointer is moving towards submenu (2-argument arctangent of the previous pointer
    // against the submenu's top / bottom corners and the pointer delta).
    const prevMouseX = prevPointerPos.x;
    const prevMouseY = prevPointerPos.y;
    const toSubmenuX = submenuSide === "right" ? submenuRect.left - prevMouseX : prevMouseX - submenuRect.right;
    const angleTop = Math.atan2(prevMouseY - submenuRect.top, toSubmenuX) + ANGLE_PADDING;
    const angleBottom = Math.atan2(prevMouseY - submenuRect.bottom, toSubmenuX) - ANGLE_PADDING;
    const anglePointer = Math.atan2(prevMouseY - mouseY, submenuSide === "left" ? -(mouseX - prevMouseX) : mouseX - prevMouseX);
    const isMovingTowardsSubmenu = anglePointer < angleTop && anglePointer > angleBottom;
    movementsTowardsSubmenuCount = isMovingTowardsSubmenu
      ? Math.min(movementsTowardsSubmenuCount + 1, ALLOWED_INVALID_MOVEMENTS)
      : Math.max(movementsTowardsSubmenuCount - 1, 0);
    setPreventPointerEvents(movementsTowardsSubmenuCount >= ALLOWED_INVALID_MOVEMENTS);
    lastProcessedTime = currentTime;
    prevPointerPos = { x: mouseX, y: mouseY };
    // If the pointer is moving towards the submenu, start a timeout to close if no other movements are made after 500ms.
    if (isMovingTowardsSubmenu) {
      timeout = setTimeout(() => {
        reset();
        autoCloseTimeout = setTimeout(() => {
          // Fire a pointerover event to trigger the menu to close.
          // Wait until pointer-events:none is no longer applied
          const target = document.elementFromPoint(mouseX, mouseY);
          if (target && nodeContains(menu, target)) target.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, cancelable: true }));
        }, 100);
      }, TIMEOUT_TIME);
    }
  };

  const preventDown = options.preventPointerDown ?? true;
  window.addEventListener("pointermove", onPointerMove);
  if (preventDown) window.addEventListener("pointerdown", onPointerDown, true);
  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    if (preventDown) window.removeEventListener("pointerdown", onPointerDown, true);
    clearTimeout(timeout);
    clearTimeout(autoCloseTimeout);
    observer?.disconnect();
    movementsTowardsSubmenuCount = ALLOWED_INVALID_MOVEMENTS;
    setPreventPointerEvents(false);
  };
}
