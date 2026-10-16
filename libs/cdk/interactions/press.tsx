// pressProps: press interactions across mouse, pen, touch, keyboard (Enter / Space) and virtual clicks
// (screen readers, element.click()), normalized: pressstart / pressup / pressend / press, press state,
// pointer leave / re-enter, cancel on drag start / pointercancel, focus prevention, text selection
// suppression, links opened by Space on role overrides, the macOS Meta-key keyup bug.
// Ported from @react-aria/interactions usePress (react-spectrum), Apache-2.0, © Adobe; portions from
// React (react-interactions), MIT, © Meta.
//
// Rivet: the returned handlers are resumable symbols (R2: function expressions in the returned
// object), state is a plain JSON object plus an `isPressed` signal, all browser listeners are added
// inside handlers. `pressProps` holds only runtime-delegated handlers (keydown / click / pointerdown /
// mousedown / pointerup: no listener per element); the target's `dragstart` / `pointerenter` /
// `pointerleave` (RA: element listeners for the element's whole life, acting only while a pointer press is
// active) bind at pointerdown and unbind when the press ends (`Press.track`). THE press implementation of the package: `button/press.ts` (Button, ToggleButton)
// drives the exported `press*` handler functions with per-element state (`createPressState`).
// Deviations: no mouse/touch fallback branch (the original's is test-only, for JSDOM); the
// double-tap-zoom `touch-action` is set through the CSSOM on the first pointerdown (CSP-safe, no
// stylesheet) instead of an injected <style>. Resumability (cold handlers run after later events
// already passed): a keydown whose click was already seen (`lastClick`) starts nothing; on native
// activatable elements (`<button>`, `<input type=button|submit|…>`) a keyboard press ends at the
// native `click` the browser fires (Enter keydown / Space keyup), not at keyup, and blur cancels it; after a
// pointerup, RA's 80 ms "no click → cancel" fallback waits (≤ 10 s) for a click the document saw but this press's
// own click handler has not (held by the loader behind an earlier cold event, replayed in order).
import { createContext, signal, useContext } from "@rivetjs/reactivity";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { mergeProps } from "./merge-props.tsx";
import {
  disableTextSelection,
  focusWithoutScrolling,
  getEventTarget,
  getOwnerDocument,
  isMac,
  isVirtualClick,
  isVirtualPointerEvent,
  linkState,
  nodeContains,
  nonTextInputTypes,
  openLink,
  preventFocus,
  read,
  restoreTextSelection,
  type FocusableElement,
  type MaybeAccessor,
  type PointerType,
} from "./utils.ts";

export type { PointerType } from "./utils.ts";

export interface PressEvent {
  /** The type of press event being fired. */
  type: "pressstart" | "pressend" | "pressup" | "press";
  /** The pointer type that triggered the press event. */
  pointerType: PointerType;
  /** The target element of the press event. */
  target: Element;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** X position relative to the target. */
  x: number;
  /** Y position relative to the target. */
  y: number;
  /** The key that triggered the press event (keyboard presses): Space vs Enter. */
  key?: string;
  /** Press events stop propagation by default; call this to let a parent handle the event too. */
  continuePropagation(): void;
}

export interface PressEvents {
  /** Called when the press is released over the target. */
  onPress?: ((e: PressEvent) => void) | undefined;
  /** Called when a press interaction starts. */
  onPressStart?: ((e: PressEvent) => void) | undefined;
  /** Called when a press interaction ends, over the target or when the pointer leaves it. */
  onPressEnd?: ((e: PressEvent) => void) | undefined;
  /** Called when the press state changes. */
  onPressChange?: ((isPressed: boolean) => void) | undefined;
  /** Called when a press is released over the target, whether or not it started there. */
  onPressUp?: ((e: PressEvent) => void) | undefined;
  /** Not recommended (use `onPress`): a click alias for compatibility with other libraries. */
  onClick?: ((e: MouseEvent) => void) | undefined;
}

export interface PressProps extends PressEvents {
  /** Controlled press state (e.g. an overlay it triggers is open). */
  isPressed?: MaybeAccessor<boolean | undefined>;
  /** Disable press events. */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** Do not focus the target on press. */
  preventFocusOnPress?: boolean;
  /**
   * Cancel the press when the pointer leaves the target while pressed (default false: re-entering
   * fires onPressStart again).
   */
  shouldCancelOnPointerExit?: boolean;
  /** Allow text selection on the pressable element. */
  allowTextSelectionOnPress?: boolean;
}

export interface PressHookProps extends PressProps {
  /** Other attributes / handlers merged into `pressProps` (like the original's DOM props pass-through). */
  [attribute: string]: unknown;
}

export interface PressResult {
  /** Whether the target is currently pressed (signal accessor). */
  isPressed: () => boolean;
  /** Attributes and handlers to spread on the target element. */
  pressProps: Record<string, unknown>;
}

interface PressState {
  isPressed: boolean;
  ignoreEmulatedMouseEvents: boolean;
  didFirePressStart: boolean;
  isTriggeringEvent: boolean;
  activePointerId: number | null;
  target: FocusableElement | null;
  isOverTarget: boolean;
  pointerType: PointerType | null;
  metaKeyEvents: Map<string, KeyboardEvent> | null;
  /** Browser-only: cleanup functions and global listeners of the current press. */
  disposables: (() => void)[];
  globals: (() => void)[];
  /** `timeStamp` of the last click seen (a replayed cold keydown older than it starts nothing). */
  lastClick: number;
}

interface EventBase {
  currentTarget: EventTarget | null;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  clientX?: number;
  clientY?: number;
  key?: string;
}

/** A press instance: options, transient state and the pressed sink (a signal, or `data-pressed` on the element). */
export interface Press {
  props: PressHookProps;
  state: PressState;
  pressed: { set(value: boolean): unknown };
  /**
   * Element listeners a pointer press binds on its target while pressed (`PRESS_TRACK_*` bits): `dragstart`
   * (cancel) and `pointerenter` / `pointerleave` (exit / re-entry). RA binds them on the element for its whole
   * life; they act only during a pointer press, so Rivet binds them at pointerdown and drops them when it ends.
   */
  track?: number;
}

/** `Press.track`: bind `dragstart` while pressed. */
export const PRESS_TRACK_DRAG = 1;
/** `Press.track`: bind `pointerenter` / `pointerleave` while pressed. */
export const PRESS_TRACK_EXIT = 2;

/** Fresh transient press state (browser-only, never serialized). */
export function createPressState(): PressState {
  return {
    isPressed: false,
    ignoreEmulatedMouseEvents: false,
    didFirePressStart: false,
    isTriggeringEvent: false,
    activePointerId: null,
    target: null,
    isOverTarget: false,
    pointerType: null,
    metaKeyEvents: null,
    disposables: [],
    globals: [],
    lastClick: -1,
  };
}

/** Context through which a parent (e.g. a trigger wrapper) passes press props to a child's usePress. */
export const PressResponderContext = resumableContext(createContext<(PressProps & { register?: () => void }) | null>(null, { id: "rv-press-responder" }));

const LINK_CLICKED = "__rvLinkClicked";
/** Longest wait (ms) for a click the resume loader holds behind earlier cold events before the press is cancelled. */
const PENDING_CLICK_MAX = 10_000;

class PressEventImpl implements PressEvent {
  type: PressEvent["type"];
  pointerType: PointerType;
  target: Element;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  x = 0;
  y = 0;
  key: string | undefined;
  #shouldStopPropagation = true;

  constructor(type: PressEvent["type"], pointerType: PointerType, originalEvent: EventBase, state?: PressState) {
    const currentTarget = state?.target ?? originalEvent.currentTarget;
    const rect = (currentTarget as Element | null)?.getBoundingClientRect?.();
    if (rect) {
      if (originalEvent.clientX != null && originalEvent.clientY != null) {
        this.x = originalEvent.clientX - rect.left;
        this.y = originalEvent.clientY - rect.top;
      } else {
        this.x = rect.width / 2;
        this.y = rect.height / 2;
      }
    }
    this.type = type;
    this.pointerType = pointerType;
    this.target = originalEvent.currentTarget as Element;
    this.shiftKey = originalEvent.shiftKey;
    this.metaKey = originalEvent.metaKey;
    this.ctrlKey = originalEvent.ctrlKey;
    this.altKey = originalEvent.altKey;
    this.key = originalEvent.key;
  }

  continuePropagation(): void {
    this.#shouldStopPropagation = false;
  }

  get shouldStopPropagation(): boolean {
    return this.#shouldStopPropagation;
  }
}

const disabled = (press: Press): boolean => !!read(press.props.isDisabled);

function addGlobal(press: Press, target: EventTarget, type: string, listener: (e: never) => void, options?: boolean | AddEventListenerOptions): void {
  const fn = listener as unknown as EventListener;
  target.addEventListener(type, fn, options);
  press.state.globals.push(() => target.removeEventListener(type, fn, options));
}

function removeAllGlobals(press: Press): void {
  for (const remove of press.state.globals.splice(0)) remove();
}

function triggerPressStart(press: Press, originalEvent: EventBase, pointerType: PointerType): boolean {
  const { state, props } = press;
  if (disabled(press) || state.didFirePressStart) return false;
  let shouldStopPropagation = true;
  state.isTriggeringEvent = true;
  if (props.onPressStart) {
    const event = new PressEventImpl("pressstart", pointerType, originalEvent);
    props.onPressStart(event);
    shouldStopPropagation = event.shouldStopPropagation;
  }
  props.onPressChange?.(true);
  state.isTriggeringEvent = false;
  state.didFirePressStart = true;
  press.pressed.set(true);
  return shouldStopPropagation;
}

function triggerPressEnd(press: Press, originalEvent: EventBase, pointerType: PointerType, wasPressed = true): boolean {
  const { state, props } = press;
  if (!state.didFirePressStart) return false;
  state.didFirePressStart = false;
  state.isTriggeringEvent = true;
  let shouldStopPropagation = true;
  if (props.onPressEnd) {
    const event = new PressEventImpl("pressend", pointerType, originalEvent);
    props.onPressEnd(event);
    shouldStopPropagation = event.shouldStopPropagation;
  }
  props.onPressChange?.(false);
  press.pressed.set(false);
  if (props.onPress && wasPressed && !disabled(press)) {
    const event = new PressEventImpl("press", pointerType, originalEvent);
    props.onPress(event);
    shouldStopPropagation &&= event.shouldStopPropagation;
  }
  state.isTriggeringEvent = false;
  return shouldStopPropagation;
}

function triggerPressUp(press: Press, originalEvent: EventBase, pointerType: PointerType): boolean {
  const { state, props } = press;
  if (disabled(press)) return false;
  if (props.onPressUp) {
    state.isTriggeringEvent = true;
    const event = new PressEventImpl("pressup", pointerType, originalEvent);
    props.onPressUp(event);
    state.isTriggeringEvent = false;
    return event.shouldStopPropagation;
  }
  return true;
}

function cancel(press: Press, e: EventBase): void {
  const { state, props } = press;
  if (state.isPressed && state.target) {
    if (state.didFirePressStart && state.pointerType != null) triggerPressEnd(press, createEvent(state.target, e), state.pointerType, false);
    state.isPressed = false;
    state.isOverTarget = false;
    state.activePointerId = null;
    state.pointerType = null;
    removeAllGlobals(press);
    if (!props.allowTextSelectionOnPress) restoreTextSelection(state.target);
    for (const dispose of state.disposables.splice(0)) dispose();
  }
}

function cancelOnPointerExit(press: Press, e: EventBase): void {
  if (press.props.shouldCancelOnPointerExit) cancel(press, e);
}

function triggerClick(press: Press, e: MouseEvent): void {
  if (disabled(press)) return;
  press.props.onClick?.(e);
}

function triggerSyntheticClick(press: Press, e: KeyboardEvent | TouchEvent, target: FocusableElement): void {
  if (disabled(press)) return;
  // Some libraries pass onClick instead of onPress: fire it like the browser's activation behaviour.
  if (press.props.onClick) {
    const event = new MouseEvent("click", e as MouseEventInit);
    Object.defineProperty(event, "target", { value: target });
    Object.defineProperty(event, "currentTarget", { value: target });
    press.props.onClick(event);
  }
}

/**
 * Release a press if the hook became disabled while pressed (the original's `isDisabled` effect).
 * Rivet reads `isDisabled` at event time; call this when a controlled disabled signal turns true
 * during a press.
 */
export function cancelPress(press: Press): void {
  const { state } = press;
  if (state.isPressed) cancel(press, { currentTarget: state.target, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false });
}

/** @internal keydown handler of pressProps. */
export function pressKeyDown(press: Press, e: KeyboardEvent): void {
  const { state } = press;
  const currentTarget = e.currentTarget as FocusableElement;
  if (isValidKeyboardEvent(e, currentTarget) && nodeContains(currentTarget, getEventTarget(e))) {
    // A cold (replayed) keydown whose click was already handled: nothing to start.
    if (state.lastClick >= e.timeStamp) return;
    const native = isNativeActivatable(currentTarget);
    // Native buttons keep their default: the native click ends the press (see header).
    if (!native && shouldPreventDefaultKeyboard(getEventTarget(e), e.key)) e.preventDefault();
    // A repeating key may have started on another element before focus moved here: only the first keydown counts.
    let shouldStopPropagation = true;
    if (!state.isPressed && !e.repeat) {
      state.target = currentTarget;
      state.isPressed = true;
      state.pointerType = "keyboard";
      shouldStopPropagation = triggerPressStart(press, e, "keyboard");
      // Focus moved away before the key went up (no native click will come): end without a press.
      if (native)
        addGlobal(press, currentTarget, "blur", () =>
          cancel(press, createEvent(currentTarget, { currentTarget, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false })),
        );
    }
    // Focus may move before keyup: listen on the document, capturing (before a child's stopPropagation).
    const originalTarget = currentTarget;
    const pressUp = (event: KeyboardEvent) => {
      if (isValidKeyboardEvent(event, originalTarget) && !event.repeat && nodeContains(originalTarget, getEventTarget(event)) && state.target)
        triggerPressUp(press, createEvent(state.target, event), "keyboard");
    };
    addGlobal(
      press,
      getOwnerDocument(currentTarget),
      "keyup",
      (event: KeyboardEvent) => {
        pressUp(event);
        onKeyUp(press, event);
      },
      true,
    );
    if (shouldStopPropagation) e.stopPropagation();
    // macOS does not fire keyup for keys released while Meta is held: remember them and release them
    // when Meta goes up.
    if (e.metaKey && isMac()) state.metaKeyEvents?.set(e.key, e);
  } else if (e.key === "Meta") state.metaKeyEvents = new Map();
}

function onKeyUp(press: Press, e: KeyboardEvent): void {
  const { state } = press;
  if (state.isPressed && state.target && isValidKeyboardEvent(e, state.target)) {
    const target = getEventTarget(e);
    // Native activatable elements: the click (Enter keydown / Space keyup) ends the press.
    if (isNativeActivatable(state.target) && nodeContains(state.target, target)) return;
    if (shouldPreventDefaultKeyboard(target, e.key)) e.preventDefault();
    const wasPressed = nodeContains(state.target, target);
    triggerPressEnd(press, createEvent(state.target, e), "keyboard", wasPressed);
    if (wasPressed) triggerSyntheticClick(press, e, state.target);
    removeAllGlobals(press);
    // A link triggered by a key other than Enter has a role override: open it ourselves (once per event).
    const flagged = e as KeyboardEvent & { [LINK_CLICKED]?: boolean };
    if (e.key !== "Enter" && isHTMLAnchorLink(state.target) && nodeContains(state.target, target) && !flagged[LINK_CLICKED]) {
      flagged[LINK_CLICKED] = true;
      openLink(state.target, e, false);
    }
    state.isPressed = false;
    state.metaKeyEvents?.delete(e.key);
  } else if (e.key === "Meta" && state.metaKeyEvents?.size) {
    const events = state.metaKeyEvents;
    state.metaKeyEvents = null;
    for (const event of events.values()) state.target?.dispatchEvent(new KeyboardEvent("keyup", event));
  }
}

/** @internal click handler of pressProps (virtual clicks and the end of pointer presses). */
export function pressClick(press: Press, e: MouseEvent): void {
  const { state } = press;
  if (e && !nodeContains(e.currentTarget as Node, getEventTarget(e))) return;
  state.lastClick = e.timeStamp;
  if (e && e.button === 0 && !state.isTriggeringEvent && !linkState.isOpening) {
    let shouldStopPropagation = true;
    if (disabled(press)) e.preventDefault();
    // Screen reader or element.click(): press as if from the keyboard.
    if (!state.ignoreEmulatedMouseEvents && !state.isPressed && (state.pointerType === "virtual" || isVirtualClick(e))) {
      const stopPressStart = triggerPressStart(press, e, "virtual");
      const stopPressUp = triggerPressUp(press, e, "virtual");
      const stopPressEnd = triggerPressEnd(press, e, "virtual");
      triggerClick(press, e);
      shouldStopPropagation = stopPressStart && stopPressUp && stopPressEnd;
    } else if (state.isPressed && (state.pointerType !== "keyboard" || isNativeActivatable(e.currentTarget as Element))) {
      const pointerType = state.pointerType || ((e as PointerEvent).pointerType as PointerType) || "virtual";
      const target = e.currentTarget as FocusableElement;
      // Keyboard press ending at the native click: pressup already fired on keyup.
      const stopPressUp = pointerType === "keyboard" ? true : triggerPressUp(press, createEvent(target, e), pointerType);
      const stopPressEnd = triggerPressEnd(press, createEvent(target, e), pointerType, true);
      shouldStopPropagation = stopPressUp && stopPressEnd;
      state.isOverTarget = false;
      triggerClick(press, e);
      cancel(press, e);
    }
    state.ignoreEmulatedMouseEvents = false;
    if (shouldStopPropagation) e.stopPropagation();
  }
}

/** @internal pointerdown handler of pressProps. */
export function pressPointerDown(press: Press, e: PointerEvent): void {
  const { state, props } = press;
  // Left button only; ignore events bubbling through portals.
  if (e.button !== 0 || !nodeContains(e.currentTarget as Node, getEventTarget(e))) return;
  // react-aria's `[data-react-aria-pressable] { touch-action: pan-x pan-y pinch-zoom }`: no double-tap zoom delay.
  const current = e.currentTarget as HTMLElement;
  if (current.style && !current.style.touchAction) current.style.touchAction = "pan-x pan-y pinch-zoom";
  // iOS VoiceOver fires pointer events with wrong coordinates / target: leave it to onClick.
  if (isVirtualPointerEvent(e)) {
    state.pointerType = "virtual";
    return;
  }
  state.pointerType = e.pointerType as PointerType;
  let shouldStopPropagation = true;
  if (!state.isPressed) {
    state.isPressed = true;
    state.isOverTarget = true;
    state.activePointerId = e.pointerId;
    state.target = e.currentTarget as FocusableElement;
    if (!props.allowTextSelectionOnPress) disableTextSelection(state.target);
    shouldStopPropagation = triggerPressStart(press, e, state.pointerType);
    // Release implicit pointer capture so touch interactions can leave the target (pointerleave / enter).
    const target = getEventTarget<Element>(e);
    if (target && "releasePointerCapture" in target && (!("hasPointerCapture" in target) || target.hasPointerCapture(e.pointerId)))
      target.releasePointerCapture(e.pointerId);
    const doc = getOwnerDocument(e.currentTarget as Element);
    addGlobal(press, doc, "pointerup", (event: PointerEvent) => onGlobalPointerUp(press, event), false);
    addGlobal(press, doc, "pointercancel", (event: PointerEvent) => cancel(press, event), false);
    // The target's own drag start / exit / re-entry, only while pressed (no listener per element at render).
    const track = press.track ?? 0;
    if (track & PRESS_TRACK_DRAG) addGlobal(press, current, "dragstart", (event: DragEvent) => pressDragStart(press, event));
    if (track & PRESS_TRACK_EXIT) {
      addGlobal(press, current, "pointerenter", (event: PointerEvent) => pressPointerEnter(press, event));
      addGlobal(press, current, "pointerleave", (event: PointerEvent) => pressPointerLeave(press, event));
    }
  }
  if (shouldStopPropagation) e.stopPropagation();
}

/** @internal mousedown handler of pressProps (focus prevention). */
export function pressMouseDown(press: Press, e: MouseEvent): void {
  if (!nodeContains(e.currentTarget as Node, getEventTarget(e))) return;
  if (e.button === 0) {
    if (press.props.preventFocusOnPress) {
      const dispose = preventFocus(e.target as FocusableElement);
      if (dispose) press.state.disposables.push(dispose);
    }
    e.stopPropagation();
  }
}

/** @internal pointerup handler on the target of pressProps. */
export function pressPointerUp(press: Press, e: PointerEvent): void {
  const { state } = press;
  // iOS fires pointerup with zero size: check the pointer type recorded at pointerdown.
  if (!nodeContains(e.currentTarget as Node, getEventTarget(e)) || state.pointerType === "virtual") return;
  // Left button; a press that started here waits for onClick.
  if (e.button === 0 && !state.isPressed) triggerPressUp(press, e, state.pointerType || (e.pointerType as PointerType));
}

/** @internal pointerenter handler of a press (bound on the target while pressed: `PRESS_TRACK_EXIT`). */
export function pressPointerEnter(press: Press, e: PointerEvent): void {
  const { state } = press;
  if (e.target !== e.currentTarget) return; // delegated dispatch of a descendant's (non-bubbling) enter
  if (e.pointerId === state.activePointerId && state.target && !state.isOverTarget && state.pointerType != null) {
    state.isOverTarget = true;
    triggerPressStart(press, createEvent(state.target, e), state.pointerType);
  }
}

/** @internal pointerleave handler of a press (bound on the target while pressed: `PRESS_TRACK_EXIT`). */
export function pressPointerLeave(press: Press, e: PointerEvent): void {
  const { state } = press;
  if (e.target !== e.currentTarget) return;
  if (e.pointerId === state.activePointerId && state.target && state.isOverTarget && state.pointerType != null) {
    state.isOverTarget = false;
    triggerPressEnd(press, createEvent(state.target, e), state.pointerType, false);
    cancelOnPointerExit(press, e);
  }
}

function onGlobalPointerUp(press: Press, e: PointerEvent): void {
  const { state } = press;
  if (e.pointerId === state.activePointerId && state.isPressed && e.button === 0 && state.target) {
    if (nodeContains(state.target, getEventTarget(e)) && state.pointerType != null) {
      // onPress waits for onClick (DOM mutations between pointerup and click break browsers). iOS and
      // Android do not click after a long press: click ourselves after 80 ms unless a click came first
      // (≥ 32 ms: iOS delays clicks on non-form elements for hover emulation).
      // `timeStamp` of the click that followed (null: none yet).
      let clicked: number | null = null;
      const settle = (waited: number): void => {
        const timeout = setTimeout(() => {
          if (!state.isPressed || !(state.target instanceof HTMLElement)) return;
          if (clicked === null) {
            focusWithoutScrolling(state.target);
            state.target.click();
          } else if (state.lastClick < clicked && waited < PENDING_CLICK_MAX) {
            // Rivet (resumability): the click came, but this press's own click handler has not seen it yet — the
            // resume loader holds it behind an earlier cold event whose chunk is still loading (a cold `focusin`
            // on an ancestor, say) and replays it in order. Cancelling here would drop the press: wait for it.
            settle(waited + 80);
          } else cancel(press, e);
        }, 80);
        state.disposables.push(() => clearTimeout(timeout));
      };
      settle(0);
      // Capturing: stopPropagation elsewhere must not hide the click.
      addGlobal(press, e.currentTarget as Document, "click", (event: MouseEvent) => (clicked = event.timeStamp), true);
    } else cancel(press, e);
    // Ignore the pointerleave touch devices fire before onClick.
    state.isOverTarget = false;
  }
}

/** @internal dragstart handler of a press (bound on the target while pressed: `PRESS_TRACK_DRAG`; Safari fires no pointercancel when a drag starts). */
export function pressDragStart(press: Press, e: DragEvent): void {
  if (!nodeContains(e.currentTarget as Node, getEventTarget(e))) return;
  cancel(press, e);
}

/**
 * Handle press interactions across mouse, touch, keyboard and screen readers. Spread `pressProps`
 * on the target (`<div {...pressProps}>`); `isPressed()` reads the press state. Options are read at
 * event time, so `isDisabled` / `isPressed` may be signals.
 */
export function pressProps(props: PressHookProps = {}): PressResult {
  // PressResponder: a parent passes press props to the pressable child through context.
  const context = useContext(PressResponderContext);
  if (context) {
    const { register, ...contextProps } = context;
    props = mergePressProps(contextProps, props);
    register?.();
  }
  const {
    onPress: _onPress,
    onPressChange: _onPressChange,
    onPressStart: _onPressStart,
    onPressEnd: _onPressEnd,
    onPressUp: _onPressUp,
    onClick: _onClick,
    isDisabled: _isDisabled,
    isPressed: _isPressed,
    preventFocusOnPress: _preventFocusOnPress,
    shouldCancelOnPointerExit: _shouldCancelOnPointerExit,
    allowTextSelectionOnPress: _allowTextSelectionOnPress,
    ref: _ref,
    ...domProps
  } = props as PressHookProps & { ref?: unknown };
  const pressed = signal(false);
  const press: Press = {
    props,
    pressed,
    state: createPressState(),
    track: PRESS_TRACK_DRAG | PRESS_TRACK_EXIT,
  };
  const handlers = {
    "data-rv-pressable": "",
    onKeyDown: (e: KeyboardEvent) => pressKeyDown(press, e),
    onClick: (e: MouseEvent) => pressClick(press, e),
    onPointerDown: (e: PointerEvent) => pressPointerDown(press, e),
    onMouseDown: (e: MouseEvent) => pressMouseDown(press, e),
    onPointerUp: (e: PointerEvent) => pressPointerUp(press, e),
  };
  return {
    isPressed: () => !!read(_isPressed) || pressed(),
    // No pass-through props (the usual case): the handler bag as is (what `mergeProps({}, handlers)` returns).
    pressProps: hasKeys(domProps) ? mergeProps(domProps, handlers) : handlers,
  };
}

function hasKeys(o: object): boolean {
  for (const _ in o) return true;
  return false;
}

/** Merge press props: handlers chain (parent first), other values: later wins. */
function mergePressProps(a: PressHookProps, b: PressHookProps): PressHookProps {
  return mergeProps(a as Record<string, unknown>, b as Record<string, unknown>) as PressHookProps;
}

function isHTMLAnchorLink(target: Element): target is HTMLAnchorElement {
  return target.tagName === "A" && target.hasAttribute("href");
}

/** Elements the browser clicks itself on Enter / Space (the native click ends a keyboard press). */
function isNativeActivatable(el: Element): boolean {
  return el instanceof HTMLButtonElement || (el instanceof HTMLInputElement && /^(button|submit|reset|checkbox|radio|image)$/.test(el.type));
}

function isValidKeyboardEvent(event: KeyboardEvent, currentTarget: Element): boolean {
  const { key, code } = event;
  const element = currentTarget as HTMLElement;
  const role = element.getAttribute("role");
  // Enter and Space only ("Spacebar": IE 11); not inside text inputs / textareas / contenteditable;
  // links only with Enter.
  return (
    (key === "Enter" || key === " " || key === "Spacebar" || code === "Space") &&
    !((element instanceof HTMLInputElement && !isValidInputKey(element, key)) || element instanceof HTMLTextAreaElement || element.isContentEditable) &&
    !((role === "link" || (!role && isHTMLAnchorLink(element))) && key !== "Enter")
  );
}

function createEvent(target: FocusableElement, e: EventBase): EventBase {
  return {
    currentTarget: target,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    clientX: e.clientX,
    clientY: e.clientY,
    key: e.key,
  };
}

function shouldPreventDefaultUp(target: Element): boolean {
  if (target instanceof HTMLInputElement) return false;
  if (target instanceof HTMLButtonElement) return target.type !== "submit" && target.type !== "reset";
  if (isHTMLAnchorLink(target)) return false;
  return true;
}

function shouldPreventDefaultKeyboard(target: Element, key: string): boolean {
  // Keep the macOS context-menu shortcut.
  if (isMac() && key === "Enter") return false;
  if (target instanceof HTMLInputElement) {
    // Enter on a checkbox / radio submits the form implicitly but does not toggle.
    if (key === "Enter" && (target.type === "checkbox" || target.type === "radio")) return false;
    return !isValidInputKey(target, key);
  }
  return shouldPreventDefaultUp(target);
}

function isValidInputKey(target: HTMLInputElement, key: string): boolean {
  // Only Space toggles checkboxes and radios, not Enter.
  return target.type === "checkbox" || target.type === "radio" ? key === " " : nonTextInputTypes.has(target.type);
}
