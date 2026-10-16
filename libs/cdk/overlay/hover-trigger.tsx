// Ported from @react-aria/tooltip (useTooltipTrigger.ts hover / focus handling, usePreviewTrigger.ts
// safe area, useSafeArea.ts), Apache-2.0, © Adobe.
// Rivet extension: hover / focus opening for any overlay trigger (DialogTrigger `trigger="hover" |
// "focus"`, Popover triggers) with React Aria's own hover-intent rules — open after `delay`, close after
// `closeDelay`, and a safe area (the trigger, the overlay and the convex hull between them,
// `./safe-area.ts`) that keeps the overlay open while the pointer travels from the trigger into it,
// diagonally and across any gap (offset / arrow), even with `closeDelay` 0.
// - hover: mouse / pen only (useHover rules: emulated mouse events after touch are ignored); touch keeps
//   the press behaviour of the trigger.
// - focus: keyboard focus only (focus-visible, as useTooltipTrigger); focus moving into the overlay keeps
//   it open, leaving both closes it.
// - the focus the overlay's FocusScope restores to the trigger (Escape / close) does not reopen it
//   (`rv-focus-scope-restore` → `ignoreFocus`, as RA usePreviewTrigger).
// - free functions over the serializable `OverlayTriggerState` (call them from inline arrows; resumable);
//   per-state timers / flags in a browser-side WeakMap. `attachHoverTrigger` runs while open (client
//   effect of the open overlay): the safe area. `.tsx`: the `hoverTriggerProps` bag's closures may be
//   captured by resumed bindings.
import { untrack } from "@rivetjs/reactivity";
import { getInteractionModality, isFocusVisible, setInteractionModality, setupGlobalFocusEvents } from "../interactions/focus-visible.tsx";
import { nodeContains } from "../interactions/utils.ts";
import { closeOverlay, openOverlay, type OverlayTriggerState } from "../state/overlays.ts";
import type { ElementSource } from "./position.ts";
import { safeArea } from "./safe-area.ts";

/** Which interaction opens the overlay (DialogTrigger `trigger`, RAC vocabulary). */
export type OverlayTriggerMode = "press" | "longPress" | "hover" | "focus";

export interface HoverTriggerProps {
  /** `"hover"`: hover (mouse / pen) or keyboard focus opens; `"focus"`: keyboard focus only. @default 'hover' */
  trigger?: "hover" | "focus";
  /** Delay before opening on hover (ms; or an accessor read at event time: live). @default 300 */
  delay?: number | (() => number | undefined);
  /** Delay before closing once the pointer left the safe area (ms; or an accessor read at event time: live). @default 200 */
  closeDelay?: number | (() => number | undefined);
  /** Disable hover / focus opening. */
  isDisabled?: boolean;
  /** The trigger element. */
  triggerRef: ElementSource;
  /** The overlay element (popover). */
  overlayRef: ElementSource;
}

export const HOVER_TRIGGER_DELAY = 300;
export const HOVER_TRIGGER_CLOSE_DELAY = 200;

type Timer = ReturnType<typeof setTimeout>;
interface Refs {
  openTimer: Timer | null;
  closeTimer: Timer | null;
  /** The pointer is over the trigger, the overlay or the hull between them. */
  inSafeArea: boolean;
  /** Focus is within the trigger (keyboard) or the overlay. */
  hasFocus: boolean;
  /** Suppresses the next trigger focus from reopening (focus restored on Escape / close; RA usePreviewTrigger). */
  ignoreFocus: boolean;
}

const refsByState = new WeakMap<OverlayTriggerState, Refs>();
const refsOf = (state: OverlayTriggerState): Refs => {
  let r = refsByState.get(state);
  if (!r) refsByState.set(state, (r = { openTimer: null, closeTimer: null, inSafeArea: false, hasFocus: false, ignoreFocus: false }));
  return r;
};
/** A live delay (accessor, untracked: event time) or a static one. */
const delayOf = (delay: number | (() => number | undefined) | undefined): number | undefined => (typeof delay === "function" ? untrack(delay) : delay);
const read = (source: ElementSource | undefined): Element | null => (typeof source === "function" ? untrack(source) : source) ?? null;

// useHover: iOS fires an emulated mouse pointer event right after a touch.
const touch = { ignoreEmulatedMouse: false, tracking: false };
function trackTouch(doc: Document): void {
  if (touch.tracking) return;
  touch.tracking = true;
  doc.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;
    touch.ignoreEmulatedMouse = true;
    setTimeout(() => (touch.ignoreEmulatedMouse = false), 500);
  });
}

function cancelOpen(r: Refs): void {
  if (r.openTimer) clearTimeout(r.openTimer);
  r.openTimer = null;
}

function cancelClose(r: Refs): void {
  if (r.closeTimer) clearTimeout(r.closeTimer);
  r.closeTimer = null;
}

/** Open after `delay` (immediately with `immediate` or a delay of 0); cancels a pending close. */
export function hoverTriggerOpen(props: Pick<HoverTriggerProps, "delay">, state: OverlayTriggerState, immediate?: boolean): void {
  const r = refsOf(state);
  cancelClose(r);
  if (untrack(state.isOpen) || r.openTimer) return;
  const delay = immediate ? 0 : (delayOf(props.delay) ?? HOVER_TRIGGER_DELAY);
  if (delay <= 0) return openOverlay(state);
  r.openTimer = setTimeout(() => {
    r.openTimer = null;
    openOverlay(state);
  }, delay);
}

/** Close after `closeDelay` unless the pointer is in the safe area or focus is within; cancels a pending open. */
export function hoverTriggerCheckClose(props: Pick<HoverTriggerProps, "closeDelay">, state: OverlayTriggerState): void {
  const r = refsOf(state);
  cancelOpen(r);
  if (r.inSafeArea || r.hasFocus || !untrack(state.isOpen) || r.closeTimer) return;
  const closeDelay = delayOf(props.closeDelay) ?? HOVER_TRIGGER_CLOSE_DELAY;
  if (closeDelay <= 0) return closeOverlay(state);
  r.closeTimer = setTimeout(() => {
    r.closeTimer = null;
    if (!r.inSafeArea && !r.hasFocus) closeOverlay(state);
  }, closeDelay);
}

const installed = new WeakSet<Element>();

/**
 * RA usePreviewTrigger's `useEvent(triggerRef, 'react-aria-focus-scope-restore')`: installed on the trigger at
 * its first pointerenter / focus (an overlay opens only after one of them; nothing at load on a resumed page).
 */
function installRestoreListener(trigger: Element | null, state: OverlayTriggerState): void {
  if (!trigger || installed.has(trigger)) return;
  installed.add(trigger);
  trigger.addEventListener("rv-focus-scope-restore", (e) => hoverTriggerFocusScopeRestore(e, state));
}

/** The trigger's `rv-focus-scope-restore` (the overlay's FocusScope restores focus): restore it without reopening. */
export function hoverTriggerFocusScopeRestore(e: Event, state: OverlayTriggerState): void {
  e.preventDefault();
  const trigger = e.currentTarget as HTMLElement | null;
  // Already focused: no focus event follows, nothing to ignore.
  if (trigger && trigger.ownerDocument.activeElement !== trigger) refsOf(state).ignoreFocus = true;
  trigger?.focus();
}

/** The trigger's `onPointerEnter` (useHover start). */
export function hoverTriggerPointerEnter(e: PointerEvent, props: HoverTriggerProps, state: OverlayTriggerState): void {
  const target = e.currentTarget as Element;
  installRestoreListener(target, state);
  trackTouch(target.ownerDocument);
  // Resumed page: modality tracking installs on first use; the hover's own pointer event is the evidence.
  setupGlobalFocusEvents(target);
  if (getInteractionModality() === null) setInteractionModality("pointer");
  if (props.isDisabled || props.trigger === "focus" || e.pointerType === "touch") return;
  if (touch.ignoreEmulatedMouse && e.pointerType === "mouse") return;
  refsOf(state).inSafeArea = true;
  hoverTriggerOpen(props, state);
}

/** The trigger's `onPointerLeave` (useHover end): before opening, cancel; once open the safe area decides. */
export function hoverTriggerPointerLeave(e: PointerEvent, props: HoverTriggerProps, state: OverlayTriggerState): void {
  if (props.isDisabled || props.trigger === "focus" || e.pointerType === "touch") return;
  const r = refsOf(state);
  if (!untrack(state.isOpen)) {
    r.inSafeArea = false;
    cancelOpen(r);
    return;
  }
  // Open but the overlay is not tracking yet (no safe area attached): treat the leave as leaving.
  if (!read(props.overlayRef)) {
    r.inSafeArea = false;
    hoverTriggerCheckClose(props, state);
  }
}

/** The trigger's `onFocus`: keyboard focus opens (focus-visible only, as useTooltipTrigger). */
export function hoverTriggerFocus(e: FocusEvent, props: HoverTriggerProps, state: OverlayTriggerState): void {
  installRestoreListener(e.currentTarget as Element | null, state);
  const r = refsOf(state);
  if (r.ignoreFocus) {
    // Focus restored from the closing overlay (Escape / close): keep it closed (RA usePreviewTrigger).
    r.ignoreFocus = false;
    r.hasFocus = true;
    return;
  }
  if (props.isDisabled || !isFocusVisible()) return;
  r.hasFocus = true;
  hoverTriggerOpen(props, state, true);
}

/** The trigger's `onBlur`: focus moving into the overlay keeps it open, elsewhere closes. */
export function hoverTriggerBlur(e: FocusEvent, props: HoverTriggerProps, state: OverlayTriggerState): void {
  const r = refsOf(state);
  const overlay = read(props.overlayRef);
  if (overlay && e.relatedTarget instanceof Node && nodeContains(overlay, e.relatedTarget)) return;
  r.hasFocus = false;
  hoverTriggerCheckClose({ closeDelay: 0 }, state);
}

/** The overlay's `onFocusWithin` (focus entered it). */
export function hoverTriggerOverlayFocusWithin(state: OverlayTriggerState): void {
  const r = refsOf(state);
  r.hasFocus = true;
  cancelClose(r);
}

/** The overlay's `onBlurWithin`: focus left it; back to the trigger keeps it open, elsewhere closes. */
export function hoverTriggerOverlayBlurWithin(e: FocusEvent, props: HoverTriggerProps, state: OverlayTriggerState): void {
  const r = refsOf(state);
  const trigger = read(props.triggerRef);
  if (trigger && e.relatedTarget instanceof Node && nodeContains(trigger, e.relatedTarget)) return;
  r.hasFocus = false;
  hoverTriggerCheckClose({ closeDelay: 0 }, state);
}

/**
 * While open (client effect of the open overlay; returns the release): the safe area between the trigger
 * and the overlay keeps it open while the pointer travels into it; leaving it closes after `closeDelay`.
 */
export function attachHoverTrigger(props: HoverTriggerProps, state: OverlayTriggerState): () => void {
  const r = refsOf(state);
  if (props.trigger === "focus") return () => {};
  const release = safeArea({
    triggerRef: props.triggerRef,
    overlayRef: props.overlayRef,
    isDisabled: props.isDisabled,
    onSafeAreaChange: (isInSafeArea) => {
      if (isInSafeArea === r.inSafeArea) return;
      r.inSafeArea = isInSafeArea;
      if (isInSafeArea) cancelClose(r);
      else hoverTriggerCheckClose(props, state);
    },
  });
  return () => {
    release();
    cancelOpen(r);
    cancelClose(r);
    r.inSafeArea = false;
  };
}

export interface HoverTriggerAria {
  /** Props for the trigger element. */
  triggerProps: Record<string, unknown>;
  /** Props for the overlay element (Popover: `onFocusWithin` / `onBlurWithin` through PopoverContext). */
  overlayProps: { onFocusWithin: () => void; onBlurWithin: (e: FocusEvent) => void };
}

/** Hover / focus opening for an overlay trigger (Rivet; see the header). */
export function hoverTriggerProps(props: HoverTriggerProps, state: OverlayTriggerState): HoverTriggerAria {
  return {
    triggerProps: {
      onPointerEnter: (e: PointerEvent) => hoverTriggerPointerEnter(e, props, state),
      onPointerLeave: (e: PointerEvent) => hoverTriggerPointerLeave(e, props, state),
      onFocus: (e: FocusEvent) => hoverTriggerFocus(e, props, state),
      onBlur: (e: FocusEvent) => hoverTriggerBlur(e, props, state),
    },
    overlayProps: {
      onFocusWithin: () => hoverTriggerOverlayFocusWithin(state),
      onBlurWithin: (e: FocusEvent) => hoverTriggerOverlayBlurWithin(e, props, state),
    },
  };
}
