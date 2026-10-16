// hoverProps: pointer hover (mouse / pen) with emulated-mouse-after-touch suppression (iOS fires
// pointerenter twice: touch, then mouse) and hover end when the hovered element is removed.
// Ported from @react-aria/interactions useHover (react-spectrum), Apache-2.0, © Adobe; portions from
// React (react-interactions), MIT, © Meta.
//
// Rivet: resumable handlers + `isHovered` signal. Deviation: the global touch listener (sets the
// "ignore emulated mouse" flag for 500 ms after a touch pointerup) installs on the first handler call,
// not at mount, so a page whose first-ever interaction is a touch is covered by the pointerType check
// alone (touch enters never hover).
// Delegated when nothing can observe the order (no hover callbacks, no pointer enter / leave handler merged before
// the bag; else native `onPointerEnter` / `onPointerLeave`, React Aria's chain order) —
// React's model: React emulates onPointerEnter / onPointerLeave from root pointerover / pointerout:
// the hover starts from the runtime-delegated `pointerover` (`onPointerOver`, no listener per element; an
// over whose `relatedTarget` is inside the element is a move within it, not an enter) and the hovered
// element gets a transient native `pointerleave` listener until the hover ends (one at a time, not one per
// instance). Edge: a `pointerover` stopped below the element (stopPropagation) starts no hover.
import { signal } from "@rivetjs/reactivity";
import { browserDocument, getEventTarget, getOwnerDocument, nodeContains, read, type MaybeAccessor } from "./utils.ts";

export interface HoverEvent {
  type: "hoverstart" | "hoverend";
  pointerType: "mouse" | "pen";
  target: HTMLElement;
}

export interface HoverEvents {
  onHoverStart?: (e: HoverEvent) => void;
  onHoverEnd?: (e: HoverEvent) => void;
  onHoverChange?: (isHovering: boolean) => void;
}

export interface HoverProps extends HoverEvents {
  /** Disable hover events (read at event time). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
}

export interface HoverResult {
  /** Handlers to spread on the target element (`onPointerOver`: delegated, the leave binds while hovered). */
  hoverProps: Record<string, unknown>;
  /** Hover state (signal accessor). */
  isHovered: () => boolean;
}

// Mutable module state in one object (resume-extracted symbols import module bindings read-only).
const g = { globalIgnoreEmulatedMouseEvents: false, touchTracking: false };

function setGlobalIgnoreEmulatedMouseEvents(): void {
  g.globalIgnoreEmulatedMouseEvents = true;
  // iOS fires the emulated mouse pointerenter right after pointerup; elsewhere do not ignore a much later hover.
  setTimeout(() => (g.globalIgnoreEmulatedMouseEvents = false), 500);
}

function handleGlobalPointerEvent(e: PointerEvent): void {
  if (e.pointerType === "touch") setGlobalIgnoreEmulatedMouseEvents();
}

/** Install the global touch listener once (browser only). */
export function setupGlobalTouchEvents(): void {
  const doc = browserDocument();
  if (g.touchTracking || !doc) return;
  g.touchTracking = true;
  doc.addEventListener("pointerup", handleGlobalPointerEvent);
}

interface Hover {
  props: HoverProps;
  /** Native `onPointerEnter` / `onPointerLeave` bag (the leave is the bag's, no transient one). */
  native?: boolean;
  state: { isHovered: boolean; pointerType: string; target: HTMLElement | null; globals: (() => void)[] };
  hovered: { set(value: boolean): unknown };
}

function triggerHoverStart(hover: Hover, event: PointerEvent, pointerType: string): void {
  const { state, props } = hover;
  state.pointerType = pointerType;
  const currentTarget = event.currentTarget as HTMLElement;
  if (read(props.isDisabled) || pointerType === "touch" || state.isHovered || !nodeContains(currentTarget, getEventTarget(event))) return;
  state.isHovered = true;
  state.target = currentTarget;
  // A removed hovered element fires no pointerleave; the next pointerover elsewhere ends the hover.
  const doc = getOwnerDocument(getEventTarget(event));
  const onOver = (e: PointerEvent) => {
    if (state.isHovered && state.target && !nodeContains(state.target, getEventTarget(e))) triggerHoverEnd(hover, e, e.pointerType);
  };
  doc.addEventListener("pointerover", onOver, { capture: true });
  if (hover.native) state.globals.push(() => doc.removeEventListener("pointerover", onOver, { capture: true }));
  else {
    // The leave of the hovered element (native, the target itself): bound while hovered only.
    const onLeave = (e: PointerEvent) => hoverPointerLeave(hover, e);
    currentTarget.addEventListener("pointerleave", onLeave);
    state.globals.push(() => (doc.removeEventListener("pointerover", onOver, { capture: true }), currentTarget.removeEventListener("pointerleave", onLeave)));
  }
  props.onHoverStart?.({ type: "hoverstart", target: currentTarget, pointerType: pointerType as "mouse" | "pen" });
  props.onHoverChange?.(true);
  hover.hovered.set(true);
}

function triggerHoverEnd(hover: Hover, _event: Event | null, pointerType: string): void {
  const { state, props } = hover;
  const target = state.target;
  state.pointerType = "";
  state.target = null;
  if (pointerType === "touch" || !state.isHovered || !target) return;
  state.isHovered = false;
  for (const remove of state.globals.splice(0)) remove();
  props.onHoverEnd?.({ type: "hoverend", target, pointerType: pointerType as "mouse" | "pen" });
  props.onHoverChange?.(false);
  hover.hovered.set(false);
}

/**
 * @internal pointerover handler of hoverProps (delegated): an enter of `currentTarget` when the pointer comes from
 * outside it (React's pointerenter emulation).
 */
export function hoverPointerOver(hover: Hover, e: PointerEvent): void {
  setupGlobalTouchEvents();
  if (nodeContains(e.currentTarget as Node, e.relatedTarget as Node | null)) return; // a move within the element
  if (g.globalIgnoreEmulatedMouseEvents && e.pointerType === "mouse") return;
  triggerHoverStart(hover, e, e.pointerType);
}

/** @internal pointerenter handler (a native listener per element; prefer `hoverPointerOver`). */
export function hoverPointerEnter(hover: Hover, e: PointerEvent): void {
  if (e.target === e.currentTarget) hoverPointerOver(hover, e); // not a delegated dispatch of a descendant's enter
}

/** @internal pointerleave handler of a hover (bound on the hovered element while hovered). */
export function hoverPointerLeave(hover: Hover, e: PointerEvent): void {
  if (e.target !== e.currentTarget) return;
  if (!read(hover.props.isDisabled) && nodeContains(e.currentTarget as Node, getEventTarget(e))) triggerHoverEnd(hover, e, e.pointerType);
}

/** End a hover now (the original's `isDisabled` effect: call when a disabled signal turns true). */
export function endHover(hover: Hover): void {
  triggerHoverEnd(hover, null, hover.state.pointerType);
}

/**
 * Pointer hover interactions for an element; ignores emulated mouse events on touch devices.
 * Spread `hoverProps` on the target.
 */
export function hoverProps(props: HoverProps = {}, dom?: object | null): HoverResult {
  const hovered = signal(false);
  // React Aria order: the hover callbacks run in the `pointerenter` handler chain, after an `onPointerEnter`
  // merged before the bag (RAC: `mergeProps(DOMProps, …, hoverProps)`). With callbacks, or a pointer enter / leave
  // handler in `dom` (Rivet: the bag the caller merges before this one), the bag is native `onPointerEnter` /
  // `onPointerLeave`; otherwise (state only: nothing can observe the order) the delegated `onPointerOver`.
  const native = !!(props.onHoverStart || props.onHoverEnd || props.onHoverChange || hasPointerEnterLeave(dom));
  const hover: Hover = { props, hovered, native, state: { isHovered: false, pointerType: "", target: null, globals: [] } };
  const bag: Record<string, unknown> = {};
  if (native)
    Object.assign(bag, {
      onPointerEnter: (e: PointerEvent) => hoverPointerEnter(hover, e),
      onPointerLeave: (e: PointerEvent) => hoverPointerLeave(hover, e),
    });
  else Object.assign(bag, { onPointerOver: (e: PointerEvent) => hoverPointerOver(hover, e) });
  return { isHovered: hovered, hoverProps: bag };
}

/** Whether `dom` holds an `onPointerEnter` / `onPointerLeave` handler (own getters of live props unread: key only). */
function hasPointerEnterLeave(dom: object | null | undefined): boolean {
  if (!dom) return false;
  for (const key of ["onPointerEnter", "onPointerLeave"]) {
    const desc = Object.getOwnPropertyDescriptor(dom, key);
    if (desc && (desc.get !== undefined || desc.value != null)) return true;
  }
  return false;
}
