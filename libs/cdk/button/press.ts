// Press handlers for elements that wire explicit `onX` attributes (Button, ToggleButton): a thin
// layer over THE usePress port in `../interactions/press.tsx` (react-aria `usePress`, Apache-2.0,
// © Adobe). Press state is per element (module WeakMap, transient, never serialized) and the
// pressed render state is written as `data-pressed="true"` on the element instead of a signal.
// All press semantics (keyboard / pointer / virtual clicks, resumability deviations) live in the
// shared implementation; this file only adapts `(options, event)` calls to a `Press` instance.
import {
  cancelPress as cancelPressInstance,
  createPressState,
  pressClick as click,
  pressDragStart as dragStart,
  pressKeyDown as keyDown,
  pressMouseDown as mouseDown,
  pressPointerDown as pointerDown,
  pressPointerEnter as pointerEnter,
  pressPointerLeave as pointerLeave,
  pressPointerUp as pointerUp,
  PRESS_TRACK_DRAG,
  type Press,
  type PressHookProps,
  type PressProps,
} from "../interactions/press.tsx";
import { read } from "../interactions/utils.ts";

export type { PointerType, PressEvent, PressEvents, PressProps } from "../interactions/press.tsx";
export { isVirtualClick, isVirtualPointerEvent } from "../platform/index.ts";

/** Press options of the explicit-handler style (react-aria `PressProps`). */
export type PressOptions = PressProps;

type PressState = ReturnType<typeof createPressState>;
const states = new WeakMap<Element, PressState>();

const stateOf = (el: Element): PressState => {
  let s = states.get(el);
  if (!s) states.set(el, (s = createPressState()));
  return s;
};

const setPressed = (el: Element, pressed: boolean): void => {
  if (pressed) el.setAttribute("data-pressed", "true");
  else el.removeAttribute("data-pressed");
};

/** The `Press` instance of `el` for `options` (options are read per event: build them in the handler). */
function pressOf(el: Element, options: PressOptions): Press {
  // A controlled `isPressed` (RAC: MenuTrigger / DialogTrigger keep the trigger pressed while open) holds the attribute.
  // `dragstart` cancels a pointer press: bound on the element while pressed only (no listener at render).
  return {
    props: options as PressHookProps,
    state: stateOf(el),
    pressed: { set: (value: boolean) => setPressed(el, value || !!read(options.isPressed)) },
    track: PRESS_TRACK_DRAG,
  };
}

const target = (e: Event): Element => e.currentTarget as Element;

/** keydown */
export const pressKeyDown = (o: PressOptions, e: KeyboardEvent): void => keyDown(pressOf(target(e), o), e);
/** click (virtual clicks and the end of pointer / native keyboard presses) */
export const pressClick = (o: PressOptions, e: MouseEvent): void => click(pressOf(target(e), o), e);
/** pointerdown */
export const pressPointerDown = (o: PressOptions, e: PointerEvent): void => pointerDown(pressOf(target(e), o), e);
/** mousedown: `preventFocusOnPress` keeps focus where it is (react-aria `preventFocus`). */
export const pressMouseDown = (o: PressOptions, e: MouseEvent): void => mouseDown(pressOf(target(e), o), e);
/** pointerup on the element (press up without a press start, e.g. dragged in). */
export const pressPointerUp = (o: PressOptions, e: PointerEvent): void => pointerUp(pressOf(target(e), o), e);
/** pointerenter: re-press when the active pointer comes back. */
export const pressPointerEnter = (o: PressOptions, e: PointerEvent): void => pointerEnter(pressOf(target(e), o), e);
/** pointerleave: un-press (and cancel with `shouldCancelOnPointerExit`). */
export const pressPointerLeave = (o: PressOptions, e: PointerEvent): void => pointerLeave(pressOf(target(e), o), e);
/** dragstart cancels the press (bound by `pressPointerDown` on the element while pressed; for explicit wiring). */
export const pressDragStart = (o: PressOptions, e: DragEvent): void => dragStart(pressOf(target(e), o), e);

/** Cancel an active press of `el` (react-aria: `isDisabled` while pressed). */
export const cancelPress = (o: PressOptions, el: Element): void => cancelPressInstance(pressOf(el, o));

/** Whether `el` is pressed right now. */
export const isPressed = (el: Element): boolean => states.get(el)?.didFirePressStart ?? false;
