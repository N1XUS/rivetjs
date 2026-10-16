// useFocusRing: whether a focus ring should show — focused and the last interaction was keyboard
// (or virtual), on the element itself or within it.
// Ported from @react-aria/focus useFocusRing (react-spectrum), Apache-2.0, © Adobe.
//
// Rivet: `isFocused` / `isFocusVisible` are signals; handlers resumable. While focused, the
// modality listener is subscribed from the focus handler (browser only) and dropped on blur, so no
// client effect runs at load. A page resumed without tracking adopts the browser's `:focus-visible`
// verdict on the first focus (see focus-visible.tsx). Not `within`: the bag is the delegated `onFocusIn` only (RA's
// `target === currentTarget` check, `focusRingIn`); the native `blur` binds on the element while focused (`bindBlur`),
// so a mounted element carries no listener of its own.
import { signal } from "@rivetjs/reactivity";
import { addFocusVisibleListener, isFocusVisible, syncModalityFromFocus } from "../interactions/focus-visible.tsx";
import { getEventTarget } from "../interactions/utils.ts";
import { bindBlur, focusWithinBlur, focusWithinFocus, focusBlur, focusFocus, type BlurSlot } from "../interactions/focus.tsx";

export interface AriaFocusRingProps {
  /** Show the ring when something inside the element has focus (true) or only the element itself (default false). */
  within?: boolean;
  /** The element is a text input (only Tab / Escape make focus visible). */
  isTextInput?: boolean;
  /** The element will be auto focused. */
  autoFocus?: boolean;
}

export interface FocusRingAria {
  /** Whether the element is focused (signal). */
  isFocused: () => boolean;
  /** Whether keyboard focus should be visible (signal). */
  isFocusVisible: () => boolean;
  /** Handlers for the element with the focus ring. */
  focusProps: Record<string, unknown>;
}

interface Ring {
  props: AriaFocusRingProps;
  focused: { (): boolean; set(v: boolean): unknown };
  visible: { set(v: boolean): unknown };
  state: { isFocused: boolean; isFocusVisible: boolean; unsubscribe: (() => void) | null };
}

/** @internal focus-change handler of useFocusRing. */
export function focusRingChange(ring: Ring, isFocused: boolean, target: Element | null): void {
  const { state } = ring;
  if (isFocused) syncModalityFromFocus(target);
  state.isFocused = isFocused;
  state.isFocusVisible = isFocusVisible();
  ring.focused.set(isFocused);
  ring.visible.set(state.isFocused && state.isFocusVisible);
  state.unsubscribe?.();
  state.unsubscribe = isFocused
    ? addFocusVisibleListener(
        (value) => {
          state.isFocusVisible = value;
          ring.visible.set(state.isFocused && state.isFocusVisible);
        },
        { isTextInput: ring.props.isTextInput },
      )
    : null;
}

/** @internal */
export function focusRingFocus(ring: Ring, e: FocusEvent): void {
  if (ring.props.within) focusWithinFocus({ props: { onFocusWithinChange: (v) => focusRingChange(ring, v, getEventTarget(e)) }, state: ringWithin(ring) }, e);
  else focusFocus({ onFocusChange: (v) => focusRingChange(ring, v, getEventTarget(e)) }, e);
}

/** @internal focusin handler of a non-`within` ring: the element's own focus, its blur bound until it fires. */
export function focusRingIn(ring: Ring, e: FocusEvent): void {
  const el = e.currentTarget as Element;
  if (getEventTarget(e) !== el) return;
  bindBlur(el, ringSlot(ring), (event) => focusRingBlur(ring, event));
  focusRingFocus(ring, e);
}

function ringSlot(ring: Ring): BlurSlot {
  const state = ring.state as Ring["state"] & { blur?: BlurSlot };
  return (state.blur ??= {});
}

/** @internal */
export function focusRingBlur(ring: Ring, e: FocusEvent): void {
  if (ring.props.within) focusWithinBlur({ props: { onFocusWithinChange: (v) => focusRingChange(ring, v, null) }, state: ringWithin(ring) }, e);
  else focusBlur({ onFocusChange: (v) => focusRingChange(ring, v, null) }, e);
}

// Focus-within bookkeeping lives on the ring state (JSON), shared by both handlers.
function ringWithin(ring: Ring): { isFocusWithin: boolean; globals: (() => void)[] } {
  const state = ring.state as Ring["state"] & { within?: { isFocusWithin: boolean; globals: (() => void)[] } };
  return (state.within ??= { isFocusWithin: false, globals: [] });
}

/** Whether a focus ring should be shown (keyboard focus only). */
export function useFocusRing(props: AriaFocusRingProps = {}): FocusRingAria {
  const { autoFocus = false } = props;
  const initialVisible = autoFocus || isFocusVisible();
  const focused = signal(false);
  const visible = signal(false);
  const ring: Ring = { props, focused, visible, state: { isFocused: false, isFocusVisible: initialVisible, unsubscribe: null } };
  return {
    isFocused: focused,
    isFocusVisible: visible,
    focusProps: props.within
      ? { onFocusIn: (e: FocusEvent) => focusRingFocus(ring, e), onFocusOut: (e: FocusEvent) => focusRingBlur(ring, e) }
      : { onFocusIn: (e: FocusEvent) => focusRingIn(ring, e) },
  };
}
