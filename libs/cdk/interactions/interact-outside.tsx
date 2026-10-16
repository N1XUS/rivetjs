// watchInteractOutside: pointer down + click outside an element (capturing, so a stopPropagation
// inside the page does not hide it), ignoring non-primary buttons, targets removed from the document
// and top-layer elements (`[data-rv-top-layer]`, e.g. toasts).
// Ported from @react-aria/interactions useInteractOutside (react-spectrum), Apache-2.0, © Adobe;
// portions from React (react-interactions), MIT, © Meta.
//
// Rivet: the document listeners are client events (`clientEvent(document, …, { capture: true })`):
// a page using it boots the runtime at load and fetches the handler chunk on the first pointerdown.
// `ref` is a `ref()` object (or an element accessor); `isDisabled` is read at event time.
import { clientEvent } from "@rivetjs/runtime/dom";
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import { getEventTarget, nodeContains, read, type MaybeAccessor } from "./utils.ts";

export interface InteractOutsideProps {
  ref: Ref<Element> | (() => Element | null | undefined);
  onInteractOutside?: (e: PointerEvent) => void;
  onInteractOutsideStart?: (e: PointerEvent) => void;
  /** Disable the outside interaction events (read at event time). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
}

/** Whether `event` is a primary-button interaction outside `element`. */
export function isValidOutsideEvent(event: MouseEvent, element: Element | null | undefined): boolean {
  if (event.button > 0) return false;
  const target = getEventTarget<Element>(event);
  if (target) {
    // Target no longer in the document (removed by an earlier handler): ignore.
    const doc = target.ownerDocument;
    if (!doc || !nodeContains(doc.documentElement, target)) return false;
    // Top-layer elements (toasts) are not "outside".
    if (target.closest("[data-rv-top-layer]")) return false;
  }
  if (!element) return false;
  // composedPath sees into open shadow roots.
  return !event.composedPath().includes(element);
}

interface Outside {
  props: InteractOutsideProps;
  state: { isPointerDown: boolean };
}

/** @internal capturing pointerdown listener of watchInteractOutside. */
export function outsidePointerDown(outside: Outside, e: PointerEvent): void {
  const { props, state } = outside;
  if (read(props.isDisabled)) return;
  if (props.onInteractOutside && isValidOutsideEvent(e, props.ref())) {
    props.onInteractOutsideStart?.(e);
    state.isPointerDown = true;
  }
}

/** @internal capturing click listener of watchInteractOutside (click, not pointerup: Android Chrome). */
export function outsideClick(outside: Outside, e: PointerEvent): void {
  const { props, state } = outside;
  if (read(props.isDisabled)) {
    state.isPointerDown = false;
    return;
  }
  if (state.isPointerDown && isValidOutsideEvent(e, props.ref())) props.onInteractOutside?.(e);
  state.isPointerDown = false;
}

/** Call `onInteractOutside` when the user presses outside `ref` (dialogs, popovers). */
export function watchInteractOutside(props: InteractOutsideProps): void {
  const outside: Outside = { props, state: { isPointerDown: false } };
  clientEvent<PointerEvent>(document, "pointerdown", (e) => outsidePointerDown(outside, e), { capture: true });
  clientEvent<PointerEvent>(document, "click", (e) => outsideClick(outside, e), { capture: true });
}
