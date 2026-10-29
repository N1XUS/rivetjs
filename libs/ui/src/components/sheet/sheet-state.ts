// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no sheet). Feature set (props, defaults) inspired by commercial UI kits' public
// Sheet docs; independent implementation. Sheet state (plain data + signals + the caller's callbacks); free functions take
// the state first (handlers resume).
import { controllable, controlledValue, setControlledValue, type ControlledState } from "@rivetjs/cdk/interactions";
import type { SheetPlacement, SheetSnapPoint } from "@rivetjs/cdk/sheet-motion";
import { closeOverlay, type OverlayTriggerState } from "@rivetjs/cdk/state/overlays";
import { untrack, type Signal } from "@rivetjs/reactivity";

export type { SheetPlacement, SheetSnapPoint };

export interface SheetOptions {
  /** The edge the sheet slides in from. @default "bottom" */
  placement?: SheetPlacement;
  /** Close on a drag, a press outside or Escape. @default true */
  isDismissable?: boolean;
  /** Floating sheet: inset from the viewport edges, fully rounded. @default false */
  isDetached?: boolean;
  /** Blocks interaction outside (backdrop, focus trap, scroll lock). `false`: the page stays usable. @default true */
  isModal?: boolean;
  /** Drags start on `Sheet.Handle` only. @default false */
  isHandleOnly?: boolean;
  /** Snap points, smallest first: fractions (0…1) of the viewport, or CSS lengths (`"148px"`, `"20rem"`). */
  snapPoints?: SheetSnapPoint[];
  /** The active snap point (controlled): a value, a two-way Signal, or an accessor. */
  activeSnapPoint?: SheetSnapPoint | null | Signal<SheetSnapPoint | null> | (() => SheetSnapPoint | null);
  /** Rivet: the snap point a sheet opens at (uncontrolled). @default the first snap point */
  defaultActiveSnapPoint?: SheetSnapPoint | null;
  /** Called when a drag / handle press / snap changes the active snap point. */
  onActiveSnapPointChange?: (snapPoint: SheetSnapPoint | null) => void;
  /** With snap points: the backdrop is fully opaque from this index (fades in from the previous point). @default the last index */
  fadeFromIndex?: number;
  /** Fraction of the remaining distance a drag must pass to dismiss. @default 0.25 */
  closeThreshold?: number;
  /** Scales the `[data-sheet-wrapper]` element back while the sheet is open. @default false */
  shouldScaleBackground?: boolean;
  /** Rivet: a release moves at most one snap point (never skips points; dismiss only from the first). @default false */
  snapToSequentialPoint?: boolean;
  /** Every drag frame: the pointer event and the dragged fraction (0 = fully shown). */
  onDrag?: (event: PointerEvent, percentageDragged: number) => void;
  /** Pointer released after a drag: whether the sheet stays open. */
  onRelease?: (event: PointerEvent, open: boolean) => void;
  /** The enter (`true`) / exit (`false`) animation finished. */
  onAnimationEnd?: (open: boolean) => void;
  /** Moves focus to the first focusable element inside on open (default: the dialog itself). @default false */
  shouldAutoFocus?: boolean;
}

/** Sheet state (serializable). */
export interface SheetState {
  readonly placement: SheetPlacement;
  readonly isDismissable: boolean;
  readonly isDetached: boolean;
  readonly isModal: boolean;
  readonly isHandleOnly: boolean;
  readonly snapPoints: SheetSnapPoint[] | undefined;
  /** Active snap point (`null` without snap points). */
  readonly snap: ControlledState<SheetSnapPoint | null>;
  /** Whether `snap` is uncontrolled (re-opens at the default point). */
  readonly snapUncontrolled: boolean;
  readonly defaultSnap: SheetSnapPoint | null;
  readonly fadeFromIndex: number | undefined;
  readonly closeThreshold: number | undefined;
  readonly shouldScaleBackground: boolean;
  readonly sequential: boolean;
  readonly shouldAutoFocus: boolean;
  /** The sheet's id (`data-sheet-id` on its dialog: nested sheets find their parent by it). */
  readonly sheetId: string;
  /** Nested sheet: the parent sheet's id. */
  readonly parentId: string | undefined;
  readonly onDrag: SheetOptions["onDrag"];
  readonly onRelease: SheetOptions["onRelease"];
  readonly onAnimationEnd: SheetOptions["onAnimationEnd"];
}

/** Creates the sheet state. */
export function createSheetState(options: SheetOptions, sheetId: string, parentId: string | undefined): SheetState {
  const points = options.snapPoints?.length ? options.snapPoints : undefined;
  const defaultSnap = options.defaultActiveSnapPoint !== undefined ? options.defaultActiveSnapPoint : (points?.[0] ?? null);
  return {
    placement: options.placement ?? "bottom",
    isDismissable: options.isDismissable ?? true,
    isDetached: !!options.isDetached,
    isModal: options.isModal ?? true,
    isHandleOnly: !!options.isHandleOnly,
    snapPoints: points,
    snap: controllable<SheetSnapPoint | null>(options.activeSnapPoint, defaultSnap, options.onActiveSnapPointChange),
    snapUncontrolled: options.activeSnapPoint === undefined,
    defaultSnap,
    fadeFromIndex: options.fadeFromIndex,
    closeThreshold: options.closeThreshold,
    shouldScaleBackground: !!options.shouldScaleBackground,
    sequential: !!options.snapToSequentialPoint,
    shouldAutoFocus: !!options.shouldAutoFocus,
    sheetId,
    parentId,
    onDrag: options.onDrag,
    onRelease: options.onRelease,
    onAnimationEnd: options.onAnimationEnd,
  };
}

/** Index of the active snap point (`-1` without snap points; an unknown value → 0). */
export function sheetSnapIndex(state: SheetState, value: SheetSnapPoint | null = state.snap.value()): number {
  const points = state.snapPoints;
  if (!points) return -1;
  const index = points.indexOf(value as SheetSnapPoint);
  return index < 0 ? 0 : index;
}

/** Sets the active snap point by index. */
export function setSheetSnapIndex(state: SheetState, index: number): void {
  const points = state.snapPoints;
  if (!points) return;
  untrack(() => setControlledValue(state.snap, points[Math.max(0, Math.min(points.length - 1, index))]!));
}

/** `Sheet.Handle` press: the next snap point; past the last one a dismissable sheet closes, else it returns to the first. No snap points: nothing. */
export function cycleSheetSnap(state: SheetState, overlay: OverlayTriggerState | null | undefined): void {
  const points = state.snapPoints;
  if (!points) return;
  const index = untrack(() => sheetSnapIndex(state, controlledValue(state.snap)));
  if (index >= points.length - 1) {
    if (state.isDismissable && overlay) closeOverlay(overlay);
    else setSheetSnapIndex(state, 0);
    return;
  }
  setSheetSnapIndex(state, index + 1);
}

/** Resets an uncontrolled snap point to its default (after the sheet closed). */
export function resetSheetSnap(state: SheetState): void {
  if (state.snapUncontrolled && state.snapPoints) untrack(() => setControlledValue(state.snap, state.defaultSnap));
}
