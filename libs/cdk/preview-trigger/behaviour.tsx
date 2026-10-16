// Ported from @react-aria/tooltip (usePreviewTrigger.ts; react-aria/src/tooltip/usePreviewTrigger.ts), Apache-2.0, © Adobe.
// A preview trigger displays a popover on hover, focus, or long press. Unlike a tooltip, the popover
// may contain interactive content (React Aria `usePreviewTrigger` → `previewTriggerProps`).
// Rivet:
// - the hook's handlers are free functions over the serializable `TooltipTriggerState` (resumable:
//   call them from inline arrows); the hook's refs (`ignoreFocus`, `shouldFocusOnOpen`,
//   `pointerInSafeArea`) live in a browser-side WeakMap keyed by the state; `isFocusVisible` is read
//   from the global modality at event time (RA keeps it in sync with `useFocusVisibleListener`).
// - RA's effects become `attachPreviewTrigger(state, options)`: call while open (from the popover's
//   client effect) — the safe area (`../overlay/safe-area.ts`) and the focus move after a long press.
// - RA's `useEvent(triggerRef, 'react-aria-focus-scope-restore')` → `previewTriggerFocusScopeRestore`,
//   the trigger's `on:rv-focus-scope-restore` handler (cdk FocusScope's restore event).
// - `useHover` → `previewTriggerPointerEnter` / `Leave` (useHover semantics: mouse / pen only,
//   emulated mouse after touch ignored); the touch long press is `previewTriggerTouchStart` (delegated
//   RA useLongPress `{ pointerType: "touch" }`, threshold 500 ms) calling `previewTriggerLongPress`.
// - `aria-expanded` / `aria-controls` / `aria-describedby` are accessors.
// Deviation: `isDisabled` also stops keyboard focus from opening (upstream gates only hover / long press).
import { untrack } from "@rivetjs/reactivity";
import { focusWithoutScrolling, getActiveElement, getOwnerDocument, nodeContains, read as readValue, type FocusableElement } from "../interactions/utils.ts";
import { getInteractionModality, isFocusVisible, setInteractionModality, setupGlobalFocusEvents } from "../interactions/focus-visible.tsx";
import { hoverPointerEnter, hoverPointerLeave } from "../interactions/hover.tsx";
import { getFocusableTreeWalker } from "../focus/index.ts";
import { safeArea } from "../overlay/safe-area.ts";
import type { ElementSource } from "../overlay/position.ts";
import { closeTooltip, openTooltip, type TooltipTriggerProps, type TooltipTriggerState } from "../state/tooltip.ts";

export interface AriaPreviewTriggerProps extends Omit<TooltipTriggerProps, "trigger" | "shouldCloseOnPress"> {}

export interface AriaPreviewTriggerOptions extends AriaPreviewTriggerProps {
  /** A ref to the trigger element (e.g. a Link). */
  triggerRef: ElementSource<FocusableElement>;
  /** A ref to the popover element. */
  popoverRef: ElementSource<HTMLElement>;
  /** Rivet: the popover id (RA: `useId()`), so the server and the browser agree. */
  popoverId: string;
}

export interface PreviewTriggerTriggerAria {
  /** Props for the trigger element (e.g. a Link). */
  triggerProps: Record<string, unknown>;
  /** Props for the popover overlay element. */
  popoverProps: { id: string; onFocusWithin: () => void; onBlurWithin: () => void };
}

interface Refs {
  // Suppresses the next focus from reopening the preview (e.g. when restoring focus on Escape).
  ignoreFocus: boolean;
  // When opened via long press, move focus into the popover once it opens so touch screen readers
  // (e.g. VoiceOver) move their virtual cursor into the preview.
  shouldFocusOnOpen: boolean;
  // Rivet: the touch long press timer (delegated useLongPress, see `previewTriggerTouchStart`).
  longPress: ReturnType<typeof setTimeout> | null;
  // Whether the pointer is currently within the safe area (the trigger, the popover, or the region
  // between them). Tracked by the safe area so the preview stays open while the pointer travels
  // from the link to the popover, even with closeDelay of 0.
  pointerInSafeArea: boolean;
  hover: Parameters<typeof hoverPointerEnter>[0] | null;
}

const refsByState = new WeakMap<TooltipTriggerState, Refs>();
const refsOf = (state: TooltipTriggerState): Refs => {
  let r = refsByState.get(state);
  if (!r) refsByState.set(state, (r = { ignoreFocus: false, shouldFocusOnOpen: false, longPress: null, pointerInSafeArea: false, hover: null }));
  return r;
};

const read = <T extends Element>(source: ElementSource<T>): T | null => (typeof source === "function" ? untrack(source) : source) ?? null;

/** Cancel a pending close and keep the preview open. */
export function previewTriggerKeepOpen(state: TooltipTriggerState): void {
  openTooltip(state, true);
}

/**
 * Close the preview unless something is still keeping it open: the pointer is within the safe area, or
 * focus is within the trigger or popover. During focus transitions the active element may briefly be
 * the body; the popover's focusin handler re-opens in that case (focus moving in).
 */
export function previewTriggerCheckClose(state: TooltipTriggerState, options: Pick<AriaPreviewTriggerOptions, "triggerRef" | "popoverRef">): void {
  const r = refsOf(state);
  if (r.pointerInSafeArea) return;
  const trigger = read(options.triggerRef),
    popover = read(options.popoverRef);
  const active = trigger ? getActiveElement(getOwnerDocument(trigger)) : null;
  if (isFocusVisible() && ((trigger && nodeContains(trigger, active)) || (popover && nodeContains(popover, active)))) return;
  closeTooltip(state);
}

/** useHover `onHoverStart`. */
export function previewTriggerHoverStart(state: TooltipTriggerState): void {
  // Match useTooltipTrigger: only treat as hovered when the modality is actually a pointer.
  if (getInteractionModality() === "pointer") {
    refsOf(state).pointerInSafeArea = true;
    openTooltip(state);
  }
}

/** useHover `onHoverEnd`. */
export function previewTriggerHoverEnd(state: TooltipTriggerState): void {
  // Before the preview opens, cancel a pending warmup if the pointer leaves the trigger. Once
  // open, the safe-area polygon governs closing as the pointer moves to the popover.
  if (!untrack(state.isOpen)) {
    refsOf(state).pointerInSafeArea = false;
    closeTooltip(state);
  }
}

function hoverOf(state: TooltipTriggerState, isDisabled: boolean | undefined): NonNullable<Refs["hover"]> {
  const r = refsOf(state);
  if (!r.hover)
    r.hover = {
      props: { isDisabled, onHoverStart: () => previewTriggerHoverStart(state), onHoverEnd: () => previewTriggerHoverEnd(state) },
      state: { isHovered: false, pointerType: "", target: null, globals: [] },
      hovered: { set: () => undefined },
    };
  return r.hover;
}

/** The trigger's `onPointerEnter` (useHover). */
export function previewTriggerPointerEnter(e: PointerEvent, props: AriaPreviewTriggerProps, state: TooltipTriggerState): void {
  // Resumed page: modality tracking installs on first use; the hover's own pointer event is the evidence.
  setupGlobalFocusEvents(e.currentTarget as Element);
  if (getInteractionModality() === null && e.pointerType !== "touch") setInteractionModality("pointer");
  installTriggerListeners(e.currentTarget as Element, props, state);
  hoverPointerEnter(hoverOf(state, readValue(props.isDisabled)), e);
}

/** The trigger's `onPointerLeave` (useHover). */
export function previewTriggerPointerLeave(e: PointerEvent, props: AriaPreviewTriggerProps, state: TooltipTriggerState): void {
  hoverPointerLeave(hoverOf(state, readValue(props.isDisabled)), e);
}

/** The trigger's `onFocus`. */
export function previewTriggerFocus(e: FocusEvent, options: Pick<AriaPreviewTriggerOptions, "popoverRef" | "isDisabled">, state: TooltipTriggerState): void {
  installTriggerListeners(e.currentTarget as Element, options, state);
  // Rivet: a disabled preview trigger never opens on focus either (RA usePreviewTrigger passes
  // `isDisabled` only to useHover / useLongPress; useTooltipTrigger gates focus through useFocusable).
  if (readValue(options.isDisabled)) return;
  const r = refsOf(state);
  if (r.ignoreFocus) {
    r.ignoreFocus = false;
    return;
  }
  const popover = read(options.popoverRef);
  // Prevent browser focusing the link on long press when focus is already in the popover.
  if (untrack(state.isOpen) && popover && e.relatedTarget === popover) {
    focusWithoutScrolling(popover);
    return;
  }
  if (isFocusVisible()) {
    // Open after the warmup delay on keyboard focus, not immediately like a tooltip. This way
    // tabbing quickly through the page doesn't open previews (and add their tab stops); the
    // delay ensures the user is actually interested in the link's details.
    openTooltip(state);
  }
}

/** The trigger's `onBlur`. */
export function previewTriggerBlur(_e: FocusEvent, options: Pick<AriaPreviewTriggerOptions, "triggerRef" | "popoverRef">, state: TooltipTriggerState): void {
  previewTriggerCheckClose(state, options);
}

/** The trigger's `on:rv-focus-scope-restore` (RA `react-aria-focus-scope-restore`): restore focus without reopening. */
export function previewTriggerFocusScopeRestore(e: Event, state: TooltipTriggerState): void {
  e.preventDefault();
  refsOf(state).ignoreFocus = true;
  (e.currentTarget as FocusableElement | null)?.focus();
}

/**
 * The trigger's `onKeyDown`: move focus from the link into the preview when the user presses Tab while
 * it is open (tabbing back out of the popover is handled by the popover's own FocusScope); Escape closes.
 */
export function previewTriggerKeyDown(e: KeyboardEvent, options: Pick<AriaPreviewTriggerOptions, "popoverRef">, state: TooltipTriggerState): void {
  const popover = read(options.popoverRef);
  if (e.key === "Tab" && !e.shiftKey && untrack(state.isOpen) && popover) {
    const walker = getFocusableTreeWalker(popover, { tabbable: true });
    const first = walker.nextNode() as FocusableElement | null;
    if (first) {
      e.preventDefault();
      first.focus();
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    closeTooltip(state, true);
  }
}

/** useLongPress `onLongPress` (touch): open the preview and move focus into it once it opens. */
export function previewTriggerLongPress(state: TooltipTriggerState): void {
  refsOf(state).shouldFocusOnOpen = true;
  openTooltip(state, true);
}

const LONG_PRESS_THRESHOLD = 500;

/**
 * Rivet (delegated useLongPress `{ pointerType: "touch" }`): the wrapper's `onPointerDown` — a touch held
 * for 500 ms opens the preview (no click / context menu after it), released earlier it does nothing.
 */
export function previewTriggerTouchStart(e: PointerEvent, props: AriaPreviewTriggerProps, state: TooltipTriggerState): void {
  if (e.pointerType !== "touch" || readValue(props.isDisabled)) return;
  const r = refsOf(state);
  const target = e.target as Element;
  const win = target.ownerDocument;
  const cancel = () => {
    if (r.longPress) clearTimeout(r.longPress);
    r.longPress = null;
    win.removeEventListener("pointerup", cancel, true);
    win.removeEventListener("pointercancel", cancel, true);
  };
  cancel();
  win.addEventListener("pointerup", cancel, true);
  win.addEventListener("pointercancel", cancel, true);
  r.longPress = setTimeout(() => {
    cancel();
    // No default click action (e.g. following a link) and no context menu after a long press.
    const prevent = (event: Event) => event.preventDefault();
    target.addEventListener("click", prevent, { once: true });
    target.addEventListener("contextmenu", prevent, { once: true });
    setTimeout(() => {
      target.removeEventListener("click", prevent);
      target.removeEventListener("contextmenu", prevent);
    }, 600);
    previewTriggerLongPress(state);
  }, LONG_PRESS_THRESHOLD);
}

const installed = new WeakSet<Element>();

/**
 * Rivet: listeners RA puts on the trigger element (`useEvent(triggerRef, 'react-aria-focus-scope-restore')`,
 * useLongPress's pointerdown), installed once at its first pointerenter (touch fires it before
 * pointerdown) or focus — nothing at load on a resumed page.
 */
function installTriggerListeners(trigger: Element | null, props: AriaPreviewTriggerProps, state: TooltipTriggerState): void {
  if (!trigger || installed.has(trigger)) return;
  installed.add(trigger);
  trigger.addEventListener("rv-focus-scope-restore", (e) => previewTriggerFocusScopeRestore(e, state));
  trigger.addEventListener("pointerdown", (e) => previewTriggerTouchStart(e as PointerEvent, props, state));
}

/**
 * RA's effects while open (call from the popover's client effect; returns the release): the safe area
 * connecting the link and the popover keeps the preview open while the pointer moves between them (even
 * diagonally, any placement, even with closeDelay 0); after a long press, focus moves to the popover.
 */
export function attachPreviewTrigger(state: TooltipTriggerState, options: AriaPreviewTriggerOptions): () => void {
  const r = refsOf(state);
  const popover = read(options.popoverRef);
  if (popover && r.shouldFocusOnOpen) {
    // When opened via long press, move focus to the popover itself so touch screen readers move
    // their virtual cursor into the preview.
    r.shouldFocusOnOpen = false;
    focusWithoutScrolling(popover);
  }
  const release = safeArea({
    triggerRef: options.triggerRef,
    overlayRef: options.popoverRef,
    isDisabled: readValue(options.isDisabled),
    onSafeAreaChange: (isInSafeArea) => {
      if (isInSafeArea === r.pointerInSafeArea) return;
      r.pointerInSafeArea = isInSafeArea;
      if (isInSafeArea) previewTriggerKeepOpen(state);
      else previewTriggerCheckClose(state, options);
    },
  });
  return () => {
    release();
  };
}

/**
 * Provides the behavior and accessibility implementation for a preview trigger (React Aria
 * `usePreviewTrigger`). The bag's closures are created in this `.tsx` module, so resumed bindings may
 * capture them. Long press: wire
 * `previewTriggerTouchStart` on the trigger's `onPointerDown`.
 */
export function previewTriggerProps(options: AriaPreviewTriggerOptions, state: TooltipTriggerState): PreviewTriggerTriggerAria {
  const popoverId = options.popoverId;
  return {
    triggerProps: {
      onFocus: (e: FocusEvent) => previewTriggerFocus(e, options, state),
      onBlur: (e: FocusEvent) => previewTriggerBlur(e, options, state),
      onKeyDown: (e: KeyboardEvent) => previewTriggerKeyDown(e, options, state),
      onPointerEnter: (e: PointerEvent) => previewTriggerPointerEnter(e, options, state),
      onPointerLeave: (e: PointerEvent) => previewTriggerPointerLeave(e, options, state),
      "on:rv-focus-scope-restore": (e: Event) => previewTriggerFocusScopeRestore(e, state),
      "aria-haspopup": "dialog",
      "aria-expanded": () => state.isOpen(),
      "aria-controls": () => (state.isOpen() ? popoverId : undefined),
      "aria-describedby": () => (state.isOpen() ? popoverId : undefined),
      style: { WebkitTouchCallout: "none", WebkitUserDrag: "none" },
    },
    popoverProps: {
      id: popoverId,
      onFocusWithin: () => previewTriggerKeepOpen(state),
      onBlurWithin: () => previewTriggerCheckClose(state, options),
    },
  };
}
