// Ported from React Stately (@react-stately/tooltip useTooltipTriggerState), Apache-2.0, © Adobe.
// Modifications: the open state is a serializable signal (`isOpen` / `defaultOpen`), created as region
// state (a resumed page re-creating the tooltip's region keeps it); the methods are free functions
// (`openTooltip(state)`, `closeTooltip(state)`) so state stays JSON and handlers resume. Per-instance
// timers live in a browser-side WeakMap keyed by the state object (never serialized); the global
// warmup / cooldown state is module state, as in the original (one per page, created on first use),
// held in one mutable object (resume-extracted symbols import module bindings read-only).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { createOverlayTriggerState, setOpen, type OverlayTriggerProps, type OverlayTriggerState } from "./overlays.ts";

export interface TooltipTriggerProps extends OverlayTriggerProps {
  /** Whether the tooltip should be disabled, independent from the trigger. A boolean, or an accessor read at event time (Rivet; e.g. Sidebar menu tooltips, enabled only while collapsed). */
  isDisabled?: boolean | (() => boolean | undefined);
  /** The delay time for the tooltip to show up (ms; a number, or an accessor read at event time: live). @default 1500 */
  delay?: number | (() => number | undefined);
  /** The delay time for the tooltip to close (ms; a number, or an accessor read at event time: live). @default 500 */
  closeDelay?: number | (() => number | undefined);
  /** By default, opens for both focus and hover. Can be made to open only for focus (or an accessor read at event time: live). @default 'hover' */
  trigger?: "hover" | "focus" | (() => "hover" | "focus" | undefined);
  /** Whether the tooltip should close when the trigger is pressed (or an accessor read at event time: live). @default true */
  shouldCloseOnPress?: boolean | (() => boolean | undefined);
}

export const TOOLTIP_DELAY = 1500; // this seems to be a 1.5 second delay, check with design
export const TOOLTIP_COOLDOWN = 500;

export interface TooltipTriggerState extends OverlayTriggerState {
  /**
   * Whether the tooltip is being shown or hidden without an animation. This is true while the
   * global warmup timer is active, i.e. when quickly moving between tooltips.
   */
  readonly shouldSkipAnimation: Signal<boolean>;
  /** The show delay when the state was created (live: `tooltipDelay(state)`). */
  readonly delay: number;
  /** The close delay when the state was created (live: `tooltipCloseDelay(state)`). */
  readonly closeDelay: number;
  /** Rivet: live `delay` / `closeDelay` accessors (read at event time). */
  readonly live?: { readonly delay?: () => number | undefined; readonly closeDelay?: () => number | undefined };
}

/** The show delay now (ms): the live accessor when given (untracked: event time), else `state.delay`. */
export const tooltipDelay = (state: TooltipTriggerState): number => (state.live?.delay ? (untrack(state.live.delay) ?? TOOLTIP_DELAY) : state.delay);

/** The close delay now (ms): the live accessor when given (untracked: event time), else `state.closeDelay`. */
export const tooltipCloseDelay = (state: TooltipTriggerState): number =>
  state.live?.closeDelay ? (untrack(state.live.closeDelay) ?? TOOLTIP_COOLDOWN) : state.closeDelay;

type Timer = ReturnType<typeof setTimeout>;

// Global state (react-stately module scope): which tooltips are open, the warmup and cooldown timers.
const tooltips = new Map<TooltipTriggerState, (immediate?: boolean, instant?: boolean) => void>();
const g = {
  globalWarmedUp: false,
  globalWarmUpTimeout: null as Timer | null,
  globalCooldownTimeout: null as Timer | null,
};
// `closeTimeout` ref of the original, per state object.
const closeTimeouts = new WeakMap<TooltipTriggerState, Timer | null>();

/**
 * Manages state for a tooltip trigger. Tracks whether the tooltip is open, and provides methods to
 * toggle this state. Ensures only one tooltip is open at a time and controls the delay for showing a
 * tooltip (react-stately `useTooltipTriggerState`).
 */
export function createTooltipTriggerState(props: TooltipTriggerProps = {}): TooltipTriggerState {
  const delayProp = props.delay,
    closeDelayProp = props.closeDelay;
  const liveDelay = typeof delayProp === "function" ? delayProp : undefined;
  const liveCloseDelay = typeof closeDelayProp === "function" ? closeDelayProp : undefined;
  const delay: number = (liveDelay ? untrack(liveDelay) : (delayProp as number | undefined)) ?? TOOLTIP_DELAY;
  const closeDelay: number = (liveCloseDelay ? untrack(liveCloseDelay) : (closeDelayProp as number | undefined)) ?? TOOLTIP_COOLDOWN;
  const live = liveDelay || liveCloseDelay ? { delay: liveDelay, closeDelay: liveCloseDelay } : undefined;
  return { ...createOverlayTriggerState(props), shouldSkipAnimation: signal(false), delay, closeDelay, ...(live ? { live } : {}) };
}

const ensureTooltipEntry = (state: TooltipTriggerState): void => {
  tooltips.set(state, (immediate, instant) => hideTooltip(state, immediate, instant));
};

const closeOpenTooltips = (state: TooltipTriggerState): void => {
  for (const [other, hide] of tooltips)
    if (other !== state) {
      // Close other open tooltips instantly (no exit animation), since they are being replaced by
      // this one during the warmup period.
      hide(true, true);
      tooltips.delete(other);
    }
};

function showTooltip(state: TooltipTriggerState, instant?: boolean): void {
  const closeTimeout = closeTimeouts.get(state);
  if (closeTimeout) clearTimeout(closeTimeout);
  closeTimeouts.set(state, null);
  closeOpenTooltips(state);
  ensureTooltipEntry(state);
  state.shouldSkipAnimation.set(!!instant);
  g.globalWarmedUp = true;
  setOpen(state, true);
  if (g.globalWarmUpTimeout) {
    clearTimeout(g.globalWarmUpTimeout);
    g.globalWarmUpTimeout = null;
  }
  if (g.globalCooldownTimeout) {
    clearTimeout(g.globalCooldownTimeout);
    g.globalCooldownTimeout = null;
  }
}

function hideTooltip(state: TooltipTriggerState, immediate?: boolean, instant?: boolean): void {
  state.shouldSkipAnimation.set(!!instant);
  const closeDelay = tooltipCloseDelay(state);
  if (immediate || closeDelay <= 0) {
    const closeTimeout = closeTimeouts.get(state);
    if (closeTimeout) clearTimeout(closeTimeout);
    closeTimeouts.set(state, null);
    setOpen(state, false);
  } else if (!closeTimeouts.get(state)) {
    closeTimeouts.set(
      state,
      setTimeout(() => {
        closeTimeouts.set(state, null);
        setOpen(state, false);
      }, closeDelay),
    );
  }

  if (g.globalWarmUpTimeout) {
    clearTimeout(g.globalWarmUpTimeout);
    g.globalWarmUpTimeout = null;
  }
  if (g.globalWarmedUp) {
    if (g.globalCooldownTimeout) clearTimeout(g.globalCooldownTimeout);
    g.globalCooldownTimeout = setTimeout(
      () => {
        tooltips.delete(state);
        g.globalCooldownTimeout = null;
        g.globalWarmedUp = false;
      },
      Math.max(TOOLTIP_COOLDOWN, closeDelay),
    );
  }
}

function warmupTooltip(state: TooltipTriggerState): void {
  closeOpenTooltips(state);
  ensureTooltipEntry(state);
  const isOpen = untrack(state.isOpen);
  if (!isOpen && !g.globalWarmedUp) {
    if (g.globalWarmUpTimeout) clearTimeout(g.globalWarmUpTimeout);
    g.globalWarmUpTimeout = setTimeout(() => {
      g.globalWarmUpTimeout = null;
      g.globalWarmedUp = true;
      // First tooltip in a sequence: animate in.
      showTooltip(state, false);
    }, tooltipDelay(state));
  } else if (!isOpen) {
    // Already warmed up: appear instantly without an animation.
    showTooltip(state, true);
  }
}

/**
 * Shows the tooltip. By default, the tooltip becomes visible after a delay depending on a global
 * warmup timer. The `immediate` option shows the tooltip immediately instead.
 */
export function openTooltip(state: TooltipTriggerState, immediate?: boolean): void {
  if (!immediate && tooltipDelay(state) > 0 && !closeTimeouts.get(state)) warmupTooltip(state);
  // Immediate opens (e.g. focus, or delay of 0) appear instantly without an animation only if
  // another tooltip is already warmed up.
  else showTooltip(state, g.globalWarmedUp);
}

/** Hides the tooltip (after `closeDelay` unless `immediate`). */
export function closeTooltip(state: TooltipTriggerState, immediate?: boolean): void {
  hideTooltip(state, immediate);
}

/** The original's unmount effect: cancel the close timer and drop the tooltip from the registry. */
export function disposeTooltip(state: TooltipTriggerState): void {
  const closeTimeout = closeTimeouts.get(state);
  if (closeTimeout) clearTimeout(closeTimeout);
  closeTimeouts.delete(state);
  tooltips.delete(state);
}

/** Test hook: reset the global warmup / cooldown state. */
export function _resetTooltips(): void {
  for (const state of [...tooltips.keys()]) disposeTooltip(state);
  if (g.globalWarmUpTimeout) clearTimeout(g.globalWarmUpTimeout);
  if (g.globalCooldownTimeout) clearTimeout(g.globalCooldownTimeout);
  g.globalWarmUpTimeout = g.globalCooldownTimeout = null;
  g.globalWarmedUp = false;
}
