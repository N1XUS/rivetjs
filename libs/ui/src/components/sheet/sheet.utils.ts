// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no sheet). Feature set inspired by HeroUI Pro's public Sheet docs;
// independent implementation. DOM side of `Sheet.Dialog`, called from its client effects (browser only): the drag / snap
// gesture (`@rivetjs/cdk/sheet-motion`), background scaling, nested-sheet step back, auto focus, `onAnimationEnd`.
import { sheetMotion, type SheetMotionController } from "@rivetjs/cdk/sheet-motion";
import { closeOverlay, type OverlayTriggerState } from "@rivetjs/cdk/state/overlays";
import { untrack } from "@rivetjs/reactivity";

import { resetSheetSnap, setSheetSnapIndex, sheetSnapIndex, type SheetState } from "./sheet-state.ts";

/** Holder shared by the dialog's effects (the controller lives on the client only). */
export interface SheetDialogHolder {
  controller?: SheetMotionController;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The `shouldScaleBackground` wrapper and the parent sheet's dialog (nested). */
function surroundings(dialog: HTMLElement, state: SheetState): { wrapper: HTMLElement | null; parent: HTMLElement | null } {
  const doc = dialog.ownerDocument;
  return {
    wrapper: state.shouldScaleBackground ? doc.querySelector<HTMLElement>("[data-sheet-wrapper]") : null,
    parent: state.parentId ? doc.querySelector<HTMLElement>(`[data-sheet-id="${state.parentId}"]`) : null,
  };
}

const setDragging = (els: (HTMLElement | null)[], on: boolean): void => {
  for (const el of els) {
    if (on) el?.setAttribute("data-sheet-dragging", "true");
    else el?.removeAttribute("data-sheet-dragging");
  }
};

/** Attaches the gesture to a mounted sheet dialog. Returns the cleanup (resets an uncontrolled snap point). */
export function attachSheetDialog(
  dialog: HTMLElement,
  state: SheetState,
  overlay: OverlayTriggerState | null | undefined,
  holder: SheetDialogHolder,
): () => void {
  const backdrop = dialog.closest<HTMLElement>('[data-slot="sheet-backdrop"]');
  const { wrapper, parent } = surroundings(dialog, state);
  const dragged = [wrapper, parent, backdrop];
  const controller = sheetMotion(dialog, {
    placement: state.placement,
    close: () => overlay && closeOverlay(overlay),
    dismissible: state.isDismissable,
    snapPoints: state.snapPoints,
    activeSnapIndex: Math.max(
      0,
      untrack(() => sheetSnapIndex(state)),
    ),
    onSnap: (index) => setSheetSnapIndex(state, index),
    closeThreshold: state.closeThreshold,
    sequential: state.sequential,
    handle: state.isHandleOnly ? '[data-slot="sheet-handle"]' : undefined,
    backdrop,
    fadeFromIndex: state.fadeFromIndex,
    // A detached sheet floats away from the edge: no overdrag bleed.
    bleed: !state.isDetached,
    onDrag: (event, percentage) => {
      setDragging(dragged, true);
      state.onDrag?.(event, percentage);
    },
    onRelease: (event, open) => state.onRelease?.(event, open),
    onProgress: (shown) => {
      wrapper?.style.setProperty("--sheet-open-progress", String(+shown.toFixed(4)));
      parent?.style.setProperty("--sheet-nested-progress", String(+shown.toFixed(4)));
    },
    onSettle: () => setDragging(dragged, false),
  });
  holder.controller = controller;
  if (state.shouldAutoFocus) {
    const view = dialog.ownerDocument.defaultView;
    view?.requestAnimationFrame(() => dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus());
  }
  return () => {
    controller.destroy();
    if (holder.controller === controller) holder.controller = undefined;
    setDragging(dragged, false);
    wrapper?.style.removeProperty("--sheet-open-progress");
    parent?.style.removeProperty("--sheet-nested-progress");
    resetSheetSnap(state);
  };
}

/** Moves the sheet to the active snap point when it changed from outside the gesture (controlled value, handle press). */
export function followSheetSnap(state: SheetState, holder: SheetDialogHolder, index: number): void {
  const controller = holder.controller;
  if (controller && index >= 0 && index !== controller.index()) controller.snapTo(index);
}

/** Open state changed while the dialog is mounted: background scale, nested step back, `onAnimationEnd`. */
export function sheetOpenChanged(dialog: HTMLElement, state: SheetState, open: boolean): () => void {
  const { wrapper, parent } = surroundings(dialog, state);
  const set = (el: HTMLElement | null, name: string): void => {
    if (open) el?.setAttribute(name, "true");
    else el?.removeAttribute(name);
  };
  set(wrapper, "data-sheet-scaled");
  set(parent, "data-sheet-nested-open");
  const view = dialog.ownerDocument.defaultView;
  const onEnd = state.onAnimationEnd;
  let cancelled = false;
  if (onEnd && view) {
    const scope = dialog.closest<HTMLElement>('[data-slot="sheet-backdrop"], [data-slot="sheet-content"]') ?? dialog;
    // A frame later: the enter / exit transition has started (attributes flipped).
    view.requestAnimationFrame(() => {
      const animations = "getAnimations" in scope ? scope.getAnimations({ subtree: true }) : [];
      void Promise.allSettled(animations.map((a) => a.finished)).then(() => {
        if (!cancelled) onEnd(open);
      });
    });
  }
  return () => {
    cancelled = true;
    if (open) {
      wrapper?.removeAttribute("data-sheet-scaled");
      parent?.removeAttribute("data-sheet-nested-open");
    }
  };
}

/**
 * The backdrop starts its exit (ModalOverlay `onExit`, before its running animations are collected): a gesture motion
 * still settling (Escape right after a drag) holds `transition: none` on the backdrop and the sheet until it rests, which
 * would unmount both without their CSS exit fade + blur / slide.
 */
export function sheetBackdropExit(backdrop: HTMLElement): void {
  backdrop.style.removeProperty("transition");
  backdrop.querySelector<HTMLElement>('[data-slot="sheet-dialog"]')?.style.removeProperty("transition");
}
