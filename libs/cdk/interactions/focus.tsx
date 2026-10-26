// focusProps (the target itself) and focusWithinProps (the target or a descendant), with the synthetic
// blur for elements disabled while focused (Firefox fires no focusout then).
// Ported from @react-aria/interactions useFocus / useFocusWithin (react-spectrum), Apache-2.0,
// © Adobe; portions from React (react-interactions), MIT, © Meta.
//
// Rivet: React's onFocus / onBlur are focusin / focusout (delegated at the root); here useFocus binds the
// native `focus` / `blur` (only when a callback is given), so handlers merged around its bag keep React Aria's
// mergeProps chain order; useFocusWithin binds `focusin` / `focusout` (both delegated). Handlers are resumable
// symbols. Rivet-internal focus state (useFocusRing, cdk data-* writers) uses the delegated `focusin` + a native
// `blur` bound while focused (`bindBlur`): it carries no user callbacks and runs after every native focus handler
// of the element, where React Aria's components merge it (last).
import { createContext } from "@rivetjs/reactivity";
import type { RefValue } from "../slots/index.tsx";
import { getActiveElement, getEventTarget, getOwnerDocument, getOwnerWindow, nodeContains, read, type MaybeAccessor } from "./utils.ts";

export interface FocusableContextValue {
  ref?: RefValue<Element>;
  [attribute: string]: unknown;
}

/**
 * DOM props for the nearest focusable child (RA `FocusableContext`, useFocusable.tsx, exported for collections).
 * Defined here, not in `../focus/focusable.tsx` (which re-exports it): Button / Link / Tabs read the context without
 * reaching `focusableProps` / `<Focusable>` / `<FocusableProvider>` + their keyboard / `focusSafely` imports, and this
 * module is already in each of their closures (BUTTONDIET 2026-10-26).
 */
export const FocusableContext = createContext<FocusableContextValue | null>(null);

export interface FocusEvents<E extends Event = FocusEvent> {
  /** Called when the element receives focus. */
  onFocus?: (e: E) => void;
  /** Called when the element loses focus. */
  onBlur?: (e: E) => void;
  /** Called when the element's focus status changes. */
  onFocusChange?: (isFocused: boolean) => void;
}

export interface FocusProps extends FocusEvents {
  /** Disable the focus events (read at event time). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
}

export interface FocusResult {
  /** Handlers to spread onto the target element. */
  focusProps: Record<string, unknown>;
}

export interface FocusWithinProps {
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** Called when the target or a descendant receives focus. */
  onFocusWithin?: (e: FocusEvent) => void;
  /** Called when the target and all descendants lose focus. */
  onBlurWithin?: (e: FocusEvent) => void;
  /** Called when the focus-within state changes. */
  onFocusWithinChange?: (isFocusWithin: boolean) => void;
}

export interface FocusWithinResult {
  focusWithinProps: Record<string, unknown>;
}

/**
 * React fires no blur for an element that becomes disabled while focused (Firefox fires no focusout
 * either): watch the `disabled` attribute and dispatch blur + focusout ourselves.
 */
function watchDisabledBlur(e: FocusEvent, onBlur: (e: FocusEvent) => void): void {
  const target = getEventTarget(e);
  if (!(
    target instanceof HTMLButtonElement ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ))
    return;
  let focused = true;
  let observer: MutationObserver | null = null;
  target.addEventListener(
    "focusout",
    (event) => {
      focused = false;
      if (target.disabled) onBlur(event as FocusEvent);
      observer?.disconnect();
      observer = null;
    },
    { once: true },
  );
  observer = new MutationObserver(() => {
    if (focused && target.disabled) {
      observer?.disconnect();
      const related = target === getActiveElement() ? null : getActiveElement();
      target.dispatchEvent(new FocusEvent("blur", { relatedTarget: related }));
      target.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: related }));
    }
  });
  observer.observe(target, { attributes: true, attributeFilter: ["disabled"] });
}

/** @internal blur handler of focusProps. */
export function focusBlur(props: FocusProps, e: FocusEvent): boolean | undefined {
  if (read(props.isDisabled)) return;
  if (getEventTarget(e) === e.currentTarget) {
    props.onBlur?.(e);
    props.onFocusChange?.(false);
    return true;
  }
}

/** @internal focus handler of focusProps. */
export function focusFocus(props: FocusProps, e: FocusEvent): void {
  if (read(props.isDisabled)) return;
  // A previous focus handler may already have moved focus elsewhere.
  const target = getEventTarget(e);
  const active = getActiveElement(getOwnerDocument(target));
  if (target === e.currentTarget && target === active) {
    props.onFocus?.(e);
    props.onFocusChange?.(true);
    watchDisabledBlur(e, (event) => focusBlur(props, event));
  }
}

/** The transient blur listener of one focus handler (`off`: removes it). */
export interface BlurSlot {
  off?: () => void;
}

/**
 * Bind `onBlur` as a native `blur` listener on the focused `el` until it fires (one per `slot`): the blur half of
 * a delegated `focusin` handler (`blur` does not bubble; no listener per element before a focus).
 */
export function bindBlur(el: EventTarget, slot: BlurSlot, onBlur: (e: FocusEvent) => void): void {
  slot.off?.();
  const listener = (e: Event) => {
    slot.off?.();
    onBlur(e as FocusEvent);
  };
  el.addEventListener("blur", listener);
  slot.off = () => (el.removeEventListener("blur", listener), (slot.off = undefined));
}

/** Focus events for the immediate target; focus events of children are ignored. */
export function focusProps(props: FocusProps = {}): FocusResult {
  // Conditional handlers as separate object literals: R2 wraps object-literal function values, not
  // conditional expressions in them (queued compiler work).
  // Native `focus` / `blur` (not the delegated `focusin`): the bag carries user callbacks, and a handler merged
  // around it must run in React Aria's mergeProps chain order (`mergeProps(focusProps, { onFocus })`: the hook's
  // `onFocus` / `onFocusChange` first). Listeners only when a callback is given.
  const focusProps: Record<string, unknown> = {};
  if (props.onFocus || props.onFocusChange || props.onBlur) Object.assign(focusProps, { onFocus: (e: FocusEvent) => focusFocus(props, e) });
  if (props.onBlur || props.onFocusChange) Object.assign(focusProps, { onBlur: (e: FocusEvent) => focusBlur(props, e) });
  return { focusProps };
}

interface FocusWithin {
  props: FocusWithinProps;
  state: { isFocusWithin: boolean; globals: (() => void)[] };
}

/** @internal focusout handler of focusWithinProps. */
export function focusWithinBlur(within: FocusWithin, e: FocusEvent): void {
  const { state, props } = within;
  if (read(props.isDisabled)) return;
  const currentTarget = e.currentTarget as Element;
  // Ignore events bubbling through portals.
  if (!nodeContains(currentTarget, getEventTarget(e))) return;
  // Moving focus inside the element: no blur-within / focus-within pair.
  if (state.isFocusWithin && !nodeContains(currentTarget, e.relatedTarget as Element | null)) {
    state.isFocusWithin = false;
    for (const remove of state.globals.splice(0)) remove();
    props.onBlurWithin?.(e);
    props.onFocusWithinChange?.(false);
  }
}

/** @internal focusin handler of focusWithinProps. */
export function focusWithinFocus(within: FocusWithin, e: FocusEvent): void {
  const { state, props } = within;
  if (read(props.isDisabled)) return;
  const currentTarget = e.currentTarget as Element;
  if (!nodeContains(currentTarget, getEventTarget(e))) return;
  const target = getEventTarget(e);
  const doc = getOwnerDocument(target);
  if (!state.isFocusWithin && getActiveElement(doc) === target) {
    props.onFocusWithin?.(e);
    props.onFocusWithinChange?.(true);
    state.isFocusWithin = true;
    watchDisabledBlur(e, (event) => focusWithinBlur(within, withCurrentTarget(event, currentTarget)));
    // Removed elements fire no blur: a focus outside the element ends focus-within.
    const onFocus = (event: FocusEvent) => {
      const next = getEventTarget(event);
      if (state.isFocusWithin && !nodeContains(currentTarget, next)) {
        const blur = new (getOwnerWindow(doc).FocusEvent)("blur", { relatedTarget: next });
        Object.defineProperty(blur, "target", { value: currentTarget });
        focusWithinBlur(within, withCurrentTarget(blur, currentTarget));
      }
    };
    doc.addEventListener("focus", onFocus, { capture: true });
    state.globals.push(() => doc.removeEventListener("focus", onFocus, { capture: true }));
  }
}

function withCurrentTarget(event: FocusEvent, currentTarget: Element): FocusEvent {
  Object.defineProperty(event, "currentTarget", { value: currentTarget, configurable: true });
  return event;
}

/** Focus events for the target and its descendants (focus-within). */
export function focusWithinProps(props: FocusWithinProps = {}): FocusWithinResult {
  const within: FocusWithin = { props, state: { isFocusWithin: false, globals: [] } };
  return {
    focusWithinProps: {
      onFocusIn: (e: FocusEvent) => focusWithinFocus(within, e),
      onFocusOut: (e: FocusEvent) => focusWithinBlur(within, e),
    },
  };
}
