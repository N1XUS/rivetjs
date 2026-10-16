// Ported from React Stately (@react-stately/overlays useOverlayTriggerState), Apache-2.0, © Adobe.
// Modifications: React state → `controllable` (react-stately useControlledState: `isOpen` plain value OR a
// two-way Signal, or a read-only accessor `() => boolean`, `defaultOpen`, `onOpenChange`); the methods are free functions (`setOpen(state, v)`, …)
// so state stays JSON (signals + plain data) and handlers resume. `state.isOpen` is the shown value's
// signal (read it in bindings: `state.isOpen()`); never `.set` it — use `setOpen` / `openOverlay` / …
import { signal, untrack, _regionState, type Signal } from "@rivetjs/reactivity";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";

export interface OverlayTriggerProps {
  /** Whether the overlay is open (controlled): a plain value, a two-way Signal, or a read-only accessor (never written: dismissing only calls `onOpenChange`). */
  isOpen?: boolean | Signal<boolean> | (() => boolean);
  /** Whether the overlay is open by default (uncontrolled). */
  defaultOpen?: boolean;
  /** Handler that is called when the overlay's open state changes (resumed pages: an inline arrow or a local function). */
  onOpenChange?: (isOpen: boolean) => void;
}

export interface Point {
  x: number;
  y: number;
}

export interface OverlayTriggerState {
  /** Whether the overlay is currently open (signal of the shown value). */
  readonly isOpen: Signal<boolean>;
  /** The cursor position when the overlay was triggered, relative to the window viewport. */
  readonly point: Signal<Point | null>;
  /** @internal The controlled-state record behind `isOpen` (`controllable`). */
  readonly open: ControlledState<boolean>;
}

/** Manages state for an overlay trigger (react-stately `useOverlayTriggerState`). Region state: a
 * resumed page re-creating the overlay's region (its first open) keeps it. */
export function createOverlayTriggerState(props: OverlayTriggerProps = {}): OverlayTriggerState {
  return _regionState(() => {
    const open = controllable<boolean>(props.isOpen, props.defaultOpen || false, props.onOpenChange);
    return { isOpen: open.value, point: signal<Point | null>(null), open };
  });
}

/** Sets whether the overlay is open (calls `onOpenChange` when the value changes). */
export function setOpen(state: OverlayTriggerState, isOpen: boolean): void {
  untrack(() => setControlledValue(state.open, isOpen));
}

/** Opens the overlay. */
export const openOverlay = (state: OverlayTriggerState): void => setOpen(state, true);
/** Closes the overlay. */
export const closeOverlay = (state: OverlayTriggerState): void => setOpen(state, false);
/** Toggles the overlay's visibility. */
export const toggleOverlay = (state: OverlayTriggerState): void => setOpen(state, !untrack(() => controlledValue(state.open)));
/** Sets the cursor position relative to the window viewport. */
export const setPoint = (state: OverlayTriggerState, point: Point): void => {
  state.point.set(point);
};
