// longPressProps: long press across mouse and touch, with threshold, accessibility description,
// pointercancel of other press handlers, click / context menu suppression after a long press.
// Ported from @react-aria/interactions useLongPress (react-spectrum), Apache-2.0, © Adobe.
//
// Rivet: built on pressProps (resumable handlers); the description is an element rendered by the
// caller from `descriptionProps` + `description` (the original's useDescription creates a hidden node
// at run time — not resumable; render `<span id={descriptionId} hidden>{text}</span>` once).
import { resumedId } from "../utils/id.ts";
import { focusWithoutScrolling, getOwnerDocument, getOwnerWindow, read, type FocusableElement, type MaybeAccessor } from "./utils.ts";
import { pressProps, type PressEvent } from "./press.tsx";
import { mergeProps } from "./merge-props.tsx";

export interface LongPressEvent extends Omit<PressEvent, "type" | "continuePropagation"> {
  type: "longpressstart" | "longpressend" | "longpress";
}

export interface LongPressProps {
  /** Disable long press events (read at event time). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** Which pointer type to listen for (default: mouse and touch). */
  pointerType?: "mouse" | "touch";
  /** Called when a long press interaction starts. */
  onLongPressStart?: (e: LongPressEvent) => void;
  /** Called when a long press interaction ends, over the target or when the pointer leaves it. */
  onLongPressEnd?: (e: LongPressEvent) => void;
  /** Called when the threshold time is met while the press is over the target. */
  onLongPress?: (e: LongPressEvent) => void;
  /** Milliseconds before a long press triggers (default 500). */
  threshold?: number;
  /** Description for assistive technology users, e.g. "Long press to open menu". */
  accessibilityDescription?: string;
}

export interface LongPressResult {
  /** Props to spread on the target (press handlers + `aria-describedby` when described). */
  longPressProps: Record<string, unknown>;
  /** The id the description element must carry, or undefined (no description / no onLongPress). */
  descriptionId?: string;
}

const DEFAULT_THRESHOLD = 500;

interface LongPress {
  props: LongPressProps;
  state: { timer: ReturnType<typeof setTimeout> | undefined; globals: (() => void)[] };
}

const accepted = (lp: LongPress, e: PressEvent): boolean =>
  lp.props.pointerType ? e.pointerType === lp.props.pointerType : e.pointerType === "mouse" || e.pointerType === "touch";

function addGlobal(lp: LongPress, target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions): void {
  target.addEventListener(type, fn, options);
  lp.state.globals.push(() => target.removeEventListener(type, fn, options));
}

const removeAllGlobals = (lp: LongPress): void => {
  for (const remove of lp.state.globals.splice(0)) remove();
};

const toLongPress = (e: PressEvent, type: LongPressEvent["type"]): LongPressEvent => ({
  type,
  pointerType: e.pointerType,
  target: e.target,
  shiftKey: e.shiftKey,
  ctrlKey: e.ctrlKey,
  metaKey: e.metaKey,
  altKey: e.altKey,
  x: e.x,
  y: e.y,
  key: e.key,
});

/** @internal onPressStart of longPressProps. */
export function longPressStart(lp: LongPress, e: PressEvent): void {
  e.continuePropagation();
  if (!accepted(lp, e)) return;
  const { props, state } = lp;
  props.onLongPressStart?.(toLongPress(e, "longpressstart"));
  state.timer = setTimeout(() => {
    // Stop other pressProps handlers from handling this press.
    e.target.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
    // No default click action (e.g. following a link) after a long press.
    addGlobal(lp, e.target, "click", (event) => event.preventDefault(), { once: true });
    // Touch devices focus on pointer up: focus now.
    if (getOwnerDocument(e.target).activeElement !== e.target) focusWithoutScrolling(e.target as FocusableElement);
    props.onLongPress?.(toLongPress(e, "longpress"));
    state.timer = undefined;
  }, props.threshold ?? DEFAULT_THRESHOLD);
  // Touch long press may open the context menu.
  if (e.pointerType === "touch") addGlobal(lp, e.target, "contextmenu", (event) => event.preventDefault(), { once: true });
  // Without a quick contextmenu / click after pointerup, drop the handlers so later events pass.
  addGlobal(lp, getOwnerWindow(e.target), "pointerup", () => setTimeout(() => removeAllGlobals(lp), 100), { once: true });
}

/** @internal onPressEnd of longPressProps. */
export function longPressEnd(lp: LongPress, e: PressEvent): void {
  if (lp.state.timer) clearTimeout(lp.state.timer);
  if (lp.props.onLongPressEnd && accepted(lp, e)) lp.props.onLongPressEnd(toLongPress(e, "longpressend"));
}

/** Long press interactions across mouse and touch devices. */
export function longPressProps(props: LongPressProps = {}): LongPressResult {
  const lp: LongPress = { props, state: { timer: undefined, globals: [] } };
  const press = pressProps({
    isDisabled: props.isDisabled,
    onPressStart: (e: PressEvent) => longPressStart(lp, e),
    onPressEnd: (e: PressEvent) => longPressEnd(lp, e),
  });
  const described = props.onLongPress && !read(props.isDisabled) && props.accessibilityDescription;
  const descriptionId = described ? resumedId() : undefined;
  return {
    longPressProps: mergeProps(press.pressProps, descriptionId ? { "aria-describedby": descriptionId } : {}),
    descriptionId,
  };
}
