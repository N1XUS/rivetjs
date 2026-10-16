// Ported from @react-aria/tooltip (useTooltipTrigger.ts, useTooltip.ts) and React Aria Components
// (Tooltip.tsx: TooltipInner's useOverlayPosition), Apache-2.0, © Adobe.
//
// Rivet: the hooks are resumable event handlers over serializable state; names follow the cdk
// convention (`useTooltipTrigger` → `tooltipTriggerProps(props, state)`, `useTooltip` →
// `tooltipProps(props, state)`, handlers `tooltipTrigger<Event>(event, props, state)` /
// `tooltip<Event>(event, props, state)`). `.tsx`: the bags' closures may be captured by resumed bindings.
// - Trigger (`useTooltipTrigger`): handlers of the trigger element (TooltipTrigger passes them through
//   FocusableProvider): hover via pointerenter / pointerleave (useHover: mouse / pen only, emulated mouse
//   after touch ignored, hover ends when the hovered element is removed), focus / blur (useFocusable),
//   press start via document pointerdown / keydown (capture) while hovered or focused. The per-trigger
//   `isHovered` / `isFocused` refs live in a browser-side WeakMap keyed by the state. Nothing runs at
//   import or load.
// - Tooltip (`useTooltip`): hovering the tooltip keeps it open (pointerenter / pointerleave).
// - `attachTooltip`: while open (a client effect of the open tooltip) — position (useOverlayPosition,
//   closes on scroll of a scroll parent of the trigger), Escape closes (document keydown, capture),
//   `aria-describedby` on the trigger.
import { effect, untrack, type Signal } from "@rivetjs/reactivity";
import {
  getInteractionModality,
  isFocusVisible,
  setInteractionModality,
  setupGlobalFocusEvents,
  syncModalityFromFocus,
} from "../interactions/focus-visible.tsx";
import { getEventTarget, getOwnerDocument, nodeContains, read } from "../interactions/utils.ts";
import { overlayPosition, type ElementSource, type Placement, type PlacementAxis } from "../overlay/position.ts";
import { closeTooltip, openTooltip, type TooltipTriggerState } from "../state/tooltip.ts";

export type { Placement, PlacementAxis };

/** Trigger options (react-aria `TooltipTriggerProps` beyond the state's). */
export interface TooltipTriggerOptions {
  /** Whether the tooltip should be disabled, independent from the trigger. A boolean, or an accessor read at event time (Rivet). */
  isDisabled?: boolean | (() => boolean | undefined);
  /** By default, opens for both focus and hover. Can be made to open only for focus (or an accessor read at event time). @default 'hover' */
  trigger?: "hover" | "focus" | (() => "hover" | "focus" | undefined);
  /** Whether the tooltip should close when the trigger is pressed (or an accessor read at event time). @default true */
  shouldCloseOnPress?: boolean | (() => boolean | undefined);
}

/** Positioning options (RAC `Tooltip` PositionProps + `arrowBoundaryOffset`). */
export interface TooltipPositionOptions {
  /** The placement of the tooltip with respect to the trigger. @default 'top' */
  placement?: Placement;
  /** The additional offset applied along the main axis between the element and its anchor element. @default 0 */
  offset?: number;
  /** The additional offset applied along the cross axis between the element and its anchor element. @default 0 */
  crossOffset?: number;
  /** The placement padding that should be applied between the element and its surrounding container. @default 12 */
  containerPadding?: number;
  /** Whether the element should flip its orientation when there is insufficient room for it to render completely. @default true */
  shouldFlip?: boolean;
  /** The minimum distance the arrow's edge should be from the edge of the overlay element. @default 0 */
  arrowBoundaryOffset?: number;
}

interface TriggerRefs {
  isHovered: boolean;
  isFocused: boolean;
  /** useHover: the hovered wrapper and the document listener ending the hover when it goes away. */
  hoverTarget: Element | null;
  removeGlobal: (() => void) | null;
  /** Focus is within the trigger (visible or not). */
  focusTarget: Element | null;
  /** Document press listeners (capture), installed while the trigger is hovered or focused. */
  removePress: (() => void) | null;
}

const triggerRefs = new WeakMap<TooltipTriggerState, TriggerRefs>();
const refs = (state: TooltipTriggerState): TriggerRefs => {
  let r = triggerRefs.get(state);
  if (!r) triggerRefs.set(state, (r = { isHovered: false, isFocused: false, hoverTarget: null, removeGlobal: null, focusTarget: null, removePress: null }));
  return r;
};

// useHover's global touch tracking: iOS fires an emulated mouse pointer event right after a touch.
const touch = { ignoreEmulatedMouse: false, tracking: false };
function setupTouchTracking(doc: Document): void {
  if (touch.tracking) return;
  touch.tracking = true;
  doc.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;
    touch.ignoreEmulatedMouse = true;
    setTimeout(() => (touch.ignoreEmulatedMouse = false), 500);
  });
}

// --- useTooltipTrigger ---------------------------------------------------------------------------

const handleShow = (state: TooltipTriggerState, r: TriggerRefs): void => {
  if (r.isHovered || r.isFocused) openTooltip(state, r.isFocused);
};

const handleHide = (state: TooltipTriggerState, r: TriggerRefs, immediate?: boolean): void => {
  if (!r.isHovered && !r.isFocused) closeTooltip(state, immediate);
};

/** useTooltipTrigger `onHoverStart`. */
export function tooltipTriggerHoverStart(options: TooltipTriggerOptions, state: TooltipTriggerState): void {
  if (read(options.trigger) === "focus") return;
  const r = refs(state);
  // In chrome, if you hover a trigger, then another element obscures it, due to keyboard
  // interactions for example, hover will end. When hover is restored after that element disappears,
  // focus moves on for example, then the tooltip will reopen. We check the modality to know if the
  // hover is the result of moving the mouse.
  r.isHovered = getInteractionModality() === "pointer";
  handleShow(state, r);
}

/** useTooltipTrigger `onHoverEnd`. */
export function tooltipTriggerHoverEnd(options: TooltipTriggerOptions, state: TooltipTriggerState): void {
  if (read(options.trigger) === "focus") return;
  const r = refs(state);
  // no matter how the trigger is left, we should close the tooltip
  r.isFocused = false;
  r.isHovered = false;
  handleHide(state, r);
}

/** useTooltipTrigger `onPressStart` (pointerdown / keydown on the trigger). */
export function tooltipTriggerPressStart(options: TooltipTriggerOptions, state: TooltipTriggerState): void {
  // if shouldCloseOnPress is false, we should not close the tooltip
  if (read(options.shouldCloseOnPress) === false) return;
  const r = refs(state);
  // no matter how the trigger is pressed, we should close the tooltip
  r.isFocused = false;
  r.isHovered = false;
  handleHide(state, r, true);
}

/** useTooltipTrigger `onFocus` (state part). */
function triggerFocus(options: TooltipTriggerOptions, state: TooltipTriggerState): void {
  if (read(options.isDisabled)) return; // useFocusable({isDisabled})
  if (isFocusVisible()) {
    const r = refs(state);
    r.isFocused = true;
    handleShow(state, r);
  }
}

/** useTooltipTrigger `onBlur` (state part). */
function triggerBlur(options: TooltipTriggerOptions, state: TooltipTriggerState): void {
  if (read(options.isDisabled)) return;
  const r = refs(state);
  r.isFocused = false;
  r.isHovered = false;
  handleHide(state, r, true);
}

// Event handlers of the trigger element (RAC: passed to it through FocusableProvider).

const inside = (wrapper: Element, node: EventTarget | null): boolean => node instanceof Node && nodeContains(wrapper, node);

// The trigger's onPointerDown / onKeyDown: a document capture listener (a pressable child such as
// Button stops pointerdown propagation; capture-phase JSX handlers are not resumable), installed while
// the trigger is hovered or holds focus — the only times a press can close or cancel a tooltip.
function engage(state: TooltipTriggerState, wrapper: Element, options: TooltipTriggerOptions): void {
  const r = refs(state);
  if (r.removePress) return;
  const doc = getOwnerDocument(wrapper);
  const onPress = (e: Event) => {
    if (inside(wrapper, getEventTarget(e))) tooltipTriggerPressStart(options, state);
  };
  doc.addEventListener("pointerdown", onPress, true);
  doc.addEventListener("keydown", onPress, true);
  r.removePress = () => {
    doc.removeEventListener("pointerdown", onPress, true);
    doc.removeEventListener("keydown", onPress, true);
  };
}

function disengage(r: TriggerRefs): void {
  if (r.hoverTarget || r.focusTarget) return;
  r.removePress?.();
  r.removePress = null;
}

function endHover(state: TooltipTriggerState, options: TooltipTriggerOptions): void {
  const r = refs(state);
  if (!r.hoverTarget) return;
  r.hoverTarget = null;
  r.removeGlobal?.();
  r.removeGlobal = null;
  disengage(r);
  tooltipTriggerHoverEnd(options, state);
}

/** The trigger's `onPointerEnter` (useHover start). */
export function tooltipTriggerPointerEnter(e: PointerEvent, options: TooltipTriggerOptions, state: TooltipTriggerState): void {
  const wrapper = e.currentTarget as Element;
  const doc = getOwnerDocument(wrapper);
  setupTouchTracking(doc);
  // Resumed page: modality tracking installs on first use; the hover's own pointer event is the evidence.
  setupGlobalFocusEvents(wrapper);
  if (getInteractionModality() === null && e.pointerType !== "touch") setInteractionModality("pointer");
  const r = refs(state);
  if (read(options.isDisabled) || e.pointerType === "touch" || r.hoverTarget || inside(wrapper, e.relatedTarget)) return;
  if (touch.ignoreEmulatedMouse && e.pointerType === "mouse") return;
  r.hoverTarget = wrapper;
  // A removed hovered element fires no pointerout; the next pointerover elsewhere ends the hover.
  const onOver = (event: PointerEvent) => {
    if (r.hoverTarget && !inside(r.hoverTarget, getEventTarget(event))) endHover(state, options);
  };
  doc.addEventListener("pointerover", onOver, { capture: true });
  r.removeGlobal = () => doc.removeEventListener("pointerover", onOver, { capture: true });
  engage(state, wrapper, options);
  tooltipTriggerHoverStart(options, state);
}

/** The trigger's `onPointerLeave` (useHover end). */
export function tooltipTriggerPointerLeave(e: PointerEvent, options: TooltipTriggerOptions, state: TooltipTriggerState): void {
  if (e.pointerType === "touch" || inside(e.currentTarget as Element, e.relatedTarget)) return;
  endHover(state, options);
}

/** The trigger's `onFocus` (useFocusable). */
export function tooltipTriggerFocus(e: FocusEvent, options: TooltipTriggerOptions, state: TooltipTriggerState): void {
  const wrapper = e.currentTarget as Element;
  if (inside(wrapper, e.relatedTarget)) return;
  refs(state).focusTarget = wrapper;
  engage(state, wrapper, options);
  syncModalityFromFocus(getEventTarget(e));
  triggerFocus(options, state);
}

/** The trigger's `onBlur` (useFocusable). */
export function tooltipTriggerBlur(e: FocusEvent, options: TooltipTriggerOptions, state: TooltipTriggerState): void {
  if (inside(e.currentTarget as Element, e.relatedTarget)) return;
  const r = refs(state);
  r.focusTarget = null;
  disengage(r);
  triggerBlur(options, state);
}

// --- useTooltip ----------------------------------------------------------------------------------

/** pointerenter on the tooltip: hovering it keeps it open. */
export function tooltipPointerEnter(e: PointerEvent, props: TooltipOptions, state: TooltipTriggerState | undefined): void {
  if (e.target !== e.currentTarget || e.pointerType === "touch") return;
  if (touch.ignoreEmulatedMouse && e.pointerType === "mouse") return;
  if (read(props.trigger) !== "focus" && state) openTooltip(state, true);
}

/** pointerleave on the tooltip. */
export function tooltipPointerLeave(e: PointerEvent, props: TooltipOptions, state: TooltipTriggerState | undefined): void {
  if (e.target !== e.currentTarget || e.pointerType === "touch") return;
  if (read(props.trigger) !== "focus" && state) closeTooltip(state);
}

/** useTooltip props (react-aria `AriaTooltipProps`). */
export interface TooltipOptions {
  /** Whether the tooltip opens on focus only (hovering the tooltip then does not keep it open; or an accessor read at event time). */
  trigger?: "hover" | "focus" | (() => "hover" | "focus" | undefined);
  id?: string;
  isOpen?: boolean;
}

export interface TooltipAria {
  /** Props for the tooltip element. */
  tooltipProps: Record<string, unknown>;
}

/** Provides the accessibility implementation for a Tooltip component (react-aria `useTooltip`). */
export function tooltipProps(props: TooltipOptions, state?: TooltipTriggerState): TooltipAria {
  return {
    tooltipProps: {
      role: "tooltip",
      id: props.id,
      onPointerEnter: (e: PointerEvent) => tooltipPointerEnter(e, props, state),
      onPointerLeave: (e: PointerEvent) => tooltipPointerLeave(e, props, state),
    },
  };
}

export interface TooltipTriggerAria {
  /** Props for the trigger element (TooltipTrigger passes them to its child through FocusableProvider). */
  triggerProps: Record<string, unknown>;
  /** Props for the overlay container element. */
  tooltipProps: { id: string };
}

/**
 * Handles the behavior and accessibility for an element that has an overlay tooltip that opens on
 * hover or focus (react-aria `useTooltipTrigger`). Rivet: press start (close on press) is a document
 * capture listener while the trigger is hovered or focused (a pressable child stops pointerdown);
 * `aria-describedby` is set on the trigger while open (`attachTooltip`).
 */
export function tooltipTriggerProps(props: TooltipTriggerOptions & { tooltipId: string }, state: TooltipTriggerState): TooltipTriggerAria {
  return {
    triggerProps: {
      onPointerEnter: (e: PointerEvent) => tooltipTriggerPointerEnter(e, props, state),
      onPointerLeave: (e: PointerEvent) => tooltipTriggerPointerLeave(e, props, state),
      onFocus: (e: FocusEvent) => tooltipTriggerFocus(e, props, state),
      onBlur: (e: FocusEvent) => tooltipTriggerBlur(e, props, state),
    },
    tooltipProps: { id: props.tooltipId },
  };
}

// --- RAC TooltipInner + useTooltipTrigger's Escape effect + aria-describedby -----------------------

/** Add / remove an id in an idref list attribute. */
function toggleIdRef(element: Element, name: string, id: string, add: boolean): void {
  const ids = (element.getAttribute(name) ?? "").split(/\s+/).filter((token) => token && token !== id);
  if (add) ids.push(id);
  if (ids.length) element.setAttribute(name, ids.join(" "));
  else element.removeAttribute(name);
}

export interface AttachTooltipOptions extends TooltipPositionOptions {
  /** The trigger element (or an accessor of it). */
  triggerRef: ElementSource;
  /** The OverlayArrow element (RAC `arrowRef`). */
  arrowRef?: ElementSource<HTMLElement>;
  /** Receives the placement after flipping (render props, `data-placement`). */
  placement$?: Signal<PlacementAxis | null>;
  /** Receives RA's `arrowProps.style` offset; given: the arrow element's position is left to `<OverlayArrow>`. */
  arrowOffset$?: Signal<{ left?: number; top?: number } | null>;
  /** z-index written by the positioning; `null`: none (the tooltip's own `style` sets it). */
  zIndex?: number | null;
}

const readSource = <T extends Element>(source: ElementSource<T> | undefined): T | null => (typeof source === "function" ? source() : source) ?? null;

/** Client effect body: while `state` is open — position, Escape, `aria-describedby`. Returns the release. */
export function attachTooltip(element: HTMLElement | undefined, state: TooltipTriggerState, options: AttachTooltipOptions): (() => void) | undefined {
  if (!element || !state.isOpen()) return;
  return untrack(() => {
    const doc = element.ownerDocument;
    const trigger = readSource(options.triggerRef);
    const cleanups: (() => void)[] = [];
    if (trigger && element.id) {
      toggleIdRef(trigger, "aria-describedby", element.id, true);
      cleanups.push(() => toggleIdRef(trigger, "aria-describedby", element.id, false));
    }
    const position = overlayPosition({
      placement: options.placement ?? "top",
      target: trigger,
      overlay: element,
      arrow: () => readSource(options.arrowRef),
      arrowStyle: !options.arrowOffset$,
      offset: options.offset,
      crossOffset: options.crossOffset,
      containerPadding: options.containerPadding,
      shouldFlip: options.shouldFlip,
      arrowBoundaryOffset: options.arrowBoundaryOffset,
      isOpen: true,
      zIndex: options.zIndex,
      onClose: () => closeTooltip(state, true),
    });
    const placement$ = options.placement$;
    if (placement$) cleanups.push(effect(() => placement$.set(position.placement())));
    const arrowOffset$ = options.arrowOffset$;
    if (arrowOffset$)
      cleanups.push(
        effect(() => {
          const result = position.position();
          arrowOffset$.set(result ? { left: result.arrowOffsetLeft, top: result.arrowOffsetTop } : null);
        }),
      );
    cleanups.push(() => position.dispose());
    // Escape after clicking something can give it keyboard focus: dismiss the tooltip on Escape.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeTooltip(state, true);
      }
    };
    doc.addEventListener("keydown", onKeyDown, true);
    cleanups.push(() => doc.removeEventListener("keydown", onKeyDown, true));
    return () => {
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    };
  });
}
