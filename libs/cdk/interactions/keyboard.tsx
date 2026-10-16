// keyboardProps: keydown / keyup handlers whose events stop propagating by default
// (`continuePropagation()` opts out), plus declarative shortcuts.
// Ported from @react-aria/interactions useKeyboard (react-spectrum), Apache-2.0, © Adobe.
//
// Rivet: handlers are resumable symbols; the event is the native KeyboardEvent augmented for the call
// (`continuePropagation`, `isPropagationStopped`). Resumed pages: delegated dispatch runs only the
// innermost handler of a type, so `continuePropagation()` reaches native ancestors' listeners but not
// other resumed handlers (queued runtime work, see the parity spec).
import { createKeyboardShortcutHandler, type KeyboardShortcutBindings } from "../keys/index.ts";
import { createEventHandler, getEventTarget, nodeContains, read, type BaseEvent, type MaybeAccessor } from "./utils.ts";

export type { KeyboardShortcutBindings } from "../keys/index.ts";

/** The keyboard event handlers receive: native event + `continuePropagation()`. */
export type RivetKeyboardEvent = BaseEvent<KeyboardEvent>;

export interface KeyboardEvents {
  onKeyDown?: (e: RivetKeyboardEvent) => void;
  onKeyUp?: (e: RivetKeyboardEvent) => void;
}

export interface KeyboardProps extends KeyboardEvents {
  /** Disable the keyboard events (read at event time). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** Keyboard shortcuts to handle (`{"Mod+s": (e) => save()}`). */
  shortcuts?: KeyboardShortcutBindings;
  /** Allow repeating keys (shortcuts only). */
  allowRepeats?: boolean;
  /** Allow composing keys (shortcuts only). */
  allowComposing?: boolean;
}

export interface KeyboardResult {
  keyboardProps: Record<string, unknown>;
}

function shortcutSkip(props: KeyboardProps, e: RivetKeyboardEvent): boolean {
  // Not from a descendant (a portal): ignore.
  if (!nodeContains(e.currentTarget as Node, getEventTarget(e))) return true;
  return (e.repeat && !props.allowRepeats) || (e.isComposing && !props.allowComposing);
}

/** @internal keydown handler of keyboardProps. */
export function keyboardKeyDown(props: KeyboardProps, e: KeyboardEvent): void {
  if (read(props.isDisabled)) return;
  const { shortcuts } = props;
  if (!shortcuts) return createEventHandler(props.onKeyDown)?.(e);
  // chain(onKeyDown, shortcut handler): the user's handler sees the plain event first.
  props.onKeyDown?.(e as RivetKeyboardEvent);
  createEventHandler<KeyboardEvent>((event) => {
    if (shortcutSkip(props, event)) return event.continuePropagation();
    createKeyboardShortcutHandler(shortcuts)(event);
  })!(e);
}

/** @internal keyup handler of keyboardProps. */
export function keyboardKeyUp(props: KeyboardProps, e: KeyboardEvent): void {
  if (read(props.isDisabled)) return;
  if (!props.shortcuts) return createEventHandler(props.onKeyUp)?.(e);
  props.onKeyUp?.(e as RivetKeyboardEvent);
  // Shortcuts act on keydown only; keyup keeps propagating.
  createEventHandler<KeyboardEvent>((event) => event.continuePropagation())!(e);
}

/** Keyboard interactions for a focusable element. Spread `keyboardProps` on it. */
export function keyboardProps(props: KeyboardProps = {}): KeyboardResult {
  // Separate object literals: R2 wraps object-literal function values, not conditional expressions.
  const keyboardProps: Record<string, unknown> = {};
  if (props.onKeyDown || props.shortcuts) Object.assign(keyboardProps, { onKeyDown: (e: KeyboardEvent) => keyboardKeyDown(props, e) });
  if (props.onKeyUp || props.shortcuts) Object.assign(keyboardProps, { onKeyUp: (e: KeyboardEvent) => keyboardKeyUp(props, e) });
  return { keyboardProps };
}
