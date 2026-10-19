// Ported from react-aria-components `Button` (packages/react-aria-components/src/Button.tsx) + react-aria
// `useButton` (packages/react-aria/src/button/useButton.ts), Apache-2.0, © Adobe.
// A native <button>: press events (THE usePress port via press.ts), hover / focus ring (data-attrs.ts), pending
// state, form attributes, `ButtonContext` (slots: `<Button slot="close">`, MenuTrigger / DialogTrigger / Select /
// NumberField triggers).
// Rivet:
// - render props are accessors (`class={({ isPressed }) => (isPressed() ? "on" : "")}`); the states are signals
//   only when a `class` / `style` / `children` function asks for them. `data-hovered` / `data-pressed` /
//   `data-focused` / `data-focus-visible` are written by the handlers on the element (zero cost before
//   interaction: no effect, no signal at render).
// - `isPending` (and the context's `isPressed`) may be accessors / signals: they change without re-creating the
//   button. The pending announcement (RAC `useEffect` + `announce`) runs from a reactive effect created in the
//   focus handler and disposed on blur (RAC announces only while focused); `announce` loads on first use.
// - `class` = RAC `className` (default `rv-Button`).
// - RAC createHideableComponent: renders nothing in the collection build pass (`isHiddenPart`, `../collections/hidden.ts`).
// - RA usePress `isDisabled` effect: an accessor `isDisabled` turning true mid-press cancels the press; the watcher
//   starts at press start (pointerdown / keydown), not at render.
// `render` (RAC DOMRenderProps): given, the attributes object goes to `render(attrs, ButtonRenderProps)` instead of the default `<button>`. Deviations: while pending only the press and the chained owned
// handlers (`onPointerDown`, `onPointerUp`, `onMouseDown`, `onClick`, `onKeyDown`, `onKeyUp`) are disabled
// (RAC drops every non-hover/focus `on*` prop) — other forwarded DOM event props keep firing; the progress
// element joins `aria-labelledby` through `ProgressBarContext` (`{ id: <id>-progress }`, RAC: a second `useId()`).
import { createContext, createRoot, effect, provide, runWithOwner, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { isSlot } from "@rivetjs/runtime/slot";
import { type DOMRenderProps } from "../utils/render.ts";
import { createId } from "../utils/id.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { dataBool, readAttrs, mergeFocusableContext, focusStateIn, hoverStateOver, type InteractionStateOptions } from "../utils/data-attrs.tsx";
import { keyboardKeyDown, keyboardKeyUp } from "../interactions/keyboard.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import {
  contextProps,
  mergeRefValues,
  renderProps as resolveRenderProps,
  resumableContext,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
} from "../slots/index.tsx";
import { PressResponderContext } from "../interactions/press.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { mergeProps as mergeLive } from "@rivetjs/runtime/props";
import { hasLive, isLive, liveAt, liveView } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import { ProgressBarContext } from "../progress-bar/context.ts";
import { FocusableContext } from "../focus/focusable.tsx";
import type { HoverEvents } from "../utils/types.ts";
import {
  buttonClick,
  buttonKeyDown,
  buttonMouseDown,
  buttonPointerDown,
  buttonPointerUp,
  buttonProps as ariaButtonProps,
  isPendingNow,
  type AriaButtonProps,
} from "./behaviour.ts";
import { cancelPress, isPressed as isPressedNow, type PressOptions } from "./press.ts";
import { isHiddenPart } from "../collections/hidden.ts";
import { slotProbing } from "#server";

export type { PressEvent, PointerType } from "./press.ts";

/** Render props of `Button` (accessors; `@selector` = the matching attribute). */
export interface ButtonRenderProps {
  /** Hovered with a mouse. @selector [data-hovered] */
  isHovered: () => boolean;
  /** Pressed. @selector [data-pressed] */
  isPressed: () => boolean;
  /** Focused (mouse or keyboard). @selector [data-focused] */
  isFocused: () => boolean;
  /** Keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Disabled. @selector [data-disabled] */
  isDisabled: () => boolean;
  /** Pending. @selector [data-pending] */
  isPending: () => boolean;
}

export interface ButtonProps
  extends
    Omit<AriaButtonProps, "elementType" | "href" | "target" | "rel">,
    HoverEvents,
    SlotProps,
    RenderProps<ButtonRenderProps>,
    DOMRenderProps<"button", ButtonRenderProps>,
    Omit<GlobalDOMAttributes<HTMLButtonElement>, "onClick"> {
  /**
   * Pending: press and hover disabled, focus kept, announced to screen readers; a submit button stops
   * submitting. A boolean, or an accessor / signal (changes without re-creating the button).
   */
  isPending?: MaybeAccessor<boolean | undefined>;
  ref?: RefValue<HTMLButtonElement>;
}

/** Value of `ButtonContext` (RAC `ButtonContextValue`): Button props + a controlled `isPressed` (trigger of an open overlay). */
export interface ButtonContextValue extends ButtonProps {
  isPressed?: MaybeAccessor<boolean | undefined>;
}

/** RAC `ButtonContext`: props for the Buttons inside a component, optionally per `slot`. */
export const ButtonContext = resumableContext(createContext<ContextValue<ButtonContextValue, HTMLButtonElement>>({}, { id: "rv-button" }));

/** Global DOM events Button handles itself (the user's run from its own handler) + the `style` render prop. */
const OWNED = ["render", "onPointerDown", "onPointerUp", "onMouseDown", "onClick", "onPointerEnter", "onPointerLeave", "onPointerOver", "style"] as const;

const isFn = (v: unknown): boolean => typeof v === "function" && !isSlot(v);

/** Props read through the live view (bindings / event time) when a prop is live. */
const LIVE_KEYS = [
  "isDisabled",
  "isPending",
  "isPressed",
  "excludeFromTabOrder",
  "allowFocusWhenDisabled",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-details",
  "aria-expanded",
  "aria-haspopup",
  "aria-controls",
  "aria-pressed",
  "aria-current",
  "aria-disabled",
  "type",
  "name",
  "value",
  "form",
  "formAction",
  "formNoValidate",
  "formEncType",
  "formMethod",
  "formTarget",
] as const;

// Pending announcement while focused (RAC: `announce` when isPending flips on the focused button).
const watchers = new WeakMap<Element, () => void>();
function watchPending(el: Element, isPending: MaybeAccessor<boolean | undefined> | undefined, labelledBy: () => string): void {
  if (typeof isPending !== "function") return; // a constant cannot flip while focused
  // Dropped on blur (a native listener bound for this focus only).
  if (!watchers.has(el)) el.addEventListener("blur", () => unwatchPending(el), { once: true });
  watchers.get(el)?.();
  let was = !!read(isPending);
  // Detached: with `render` the handlers run under the element spread effect's owner, which disposes a root created there on its next run.
  const root = runWithOwner(null, () =>
    createRoot((dispose) => {
      effect(() => {
        const now = !!read(isPending);
        if (now !== was) {
          const message = { "aria-labelledby": labelledBy() };
          void import("../announcer/live-announcer.ts").then((m) => m.announce(message, "assertive"));
        }
        was = now;
      });
      return dispose;
    }),
  );
  watchers.set(el, root.value);
}
function unwatchPending(el: Element): void {
  watchers.get(el)?.();
  watchers.delete(el);
}

// RA usePress `isDisabled` effect: an accessor `isDisabled` turning true while pressed cancels the press. Rivet
// watches only from press start (zero cost at render); the watcher ends at the next run after the press is over.
const disabledWatchers = new WeakMap<Element, () => void>();
function watchDisabled(el: Element, press: PressOptions, isDisabled: MaybeAccessor<boolean | undefined>): void {
  if (typeof isDisabled !== "function" || !isPressedNow(el)) return;
  disabledWatchers.get(el)?.();
  const root = runWithOwner(null, () =>
    createRoot((dispose) => {
      let first = true;
      effect(() => {
        const disabled = !!read(isDisabled);
        if (first) return void (first = false);
        untrack(() => {
          if (disabled && isPressedNow(el)) cancelPress(press, el);
          if (disabled || !isPressedNow(el)) queueMicrotask(() => unwatchDisabled(el, dispose));
        });
      });
      return dispose;
    }),
  );
  disabledWatchers.set(el, root.value);
}
function unwatchDisabled(el: Element, dispose: () => void): void {
  dispose();
  if (disabledWatchers.get(el) === dispose) disabledWatchers.delete(el);
}

/** Attribute value of a prop that may be an accessor (context-provided `aria-expanded={() => state.isOpen()}`). */
const val = (v: unknown): string | undefined => {
  const x = typeof v === "function" ? (v as () => unknown)() : v;
  return x == null ? undefined : String(x);
};

type BE<T extends Event> = T & { currentTarget: HTMLButtonElement };

/** A button: press, hover, focus ring, pending (RAC `Button`). */
export function Button(inProps: ButtonProps) {
  // RAC createHideableComponent: nothing in the collection build pass (before any context is read).
  if (slotProbing || isHiddenPart()) return null;
  let [props, ref] = contextProps(inProps, inProps.ref, ButtonContext) as [ButtonContextValue, RefValue<HTMLButtonElement> | undefined];
  // RA usePress: a PressResponder above (DialogTrigger, MenuTrigger, Select…) passes its trigger props, `isPressed`
  // and its ref through context; they merge under the button's own props (handlers chain, responder first).
  const responder = useContext(PressResponderContext) as (Record<string, unknown> & { register?: () => void; ref?: RefValue<Element> }) | null;
  if (responder) {
    const { register, ref: responderRef, ...responderProps } = responder;
    props = mergeProps(responderProps, props as Record<string, unknown>) as ButtonContextValue;
    register?.();
    ref = mergeRefValues(ref, responderRef as RefValue<HTMLButtonElement> | undefined);
  }
  // RA useButton → useFocusable: FocusableContext (TooltipTrigger) props / handlers / ref reach the <button>.
  // `isDisabled` is never read here: an accessor / live one goes to the merge as an accessor (gated at event time and
  // in the attribute binding). A read here would make the Button's enclosing region re-create it on its first change
  // on a resumed page (Calendar page buttons dropped focus; a live `isDisabled` under a TooltipTrigger threw).
  const focusable = useContext(FocusableContext);
  const disabledAt = focusable ? (liveAt(props, "isDisabled") as MaybeAccessor<boolean | undefined>) : undefined;
  const [focusableMerged, focusableRef, focusAttrs] = mergeFocusableContext(props, focusable, typeof disabledAt === "function" ? disabledAt : !!disabledAt);
  props = focusableMerged;
  ref = mergeRefValues(ref, focusableRef as RefValue<HTMLButtonElement> | undefined);
  // Live props (P5): with a live prop the state / ARIA props are read through a narrow view (getters unread, read in
  // bindings and at event time); without one every value is taken as given (static path unchanged). Handlers, `slot`,
  // `id`, `elementType` and the render-prop form of `class` / `style` / `children` are read once (identity props).
  const lv = hasLive(props) ? liveView(props, LIVE_KEYS) : undefined;
  const { onPointerDown, onPointerUp, onMouseDown, onKeyDown, onKeyUp, onPointerEnter, onPointerLeave, onPointerOver } = props;
  const isPending = (lv ? liveAt(lv, "isPending") : props.isPending) as MaybeAccessor<boolean | undefined>;
  const ctxPressed = (lv ? liveAt(lv, "isPressed") : props.isPressed) as MaybeAccessor<boolean | undefined>;
  // May be an accessor (Calendar previous / next at min / max): read in bindings and at event time.
  const isDisabled = (lv ? liveAt(lv, "isDisabled") : props.isDisabled) as MaybeAccessor<boolean | undefined>;
  // Untracked: a live `class` / `style` / `children` read in the body would make a resumed page re-create the Button.
  const wantsStates = untrack(() => isFn(props.class) || isFn(props.style) || isFn(props.children));
  const hovered: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const pressed: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focused: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focusVisible: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const userPressChange = props.onPressChange;
  const press: PressOptions = {
    onPress: props.onPress,
    onPressStart: props.onPressStart,
    onPressEnd: props.onPressEnd,
    onPressUp: props.onPressUp,
    onPressChange: (isPressed: boolean) => {
      pressed?.set(isPressed);
      userPressChange?.(isPressed);
    },
    onClick: props.onClick,
    isDisabled,
    isPressed: ctxPressed,
    preventFocusOnPress: props.preventFocusOnPress,
  };
  const interaction: InteractionStateOptions = {
    isDisabled: () => !!read(isDisabled) || isPendingNow(isPending),
    onHoverStart: props.onHoverStart,
    onHoverEnd: props.onHoverEnd,
    onHoverChange: props.onHoverChange,
    onFocus: props.onFocus as InteractionStateOptions["onFocus"],
    onBlur: props.onBlur as InteractionStateOptions["onBlur"],
    onFocusChange: props.onFocusChange,
    states: wantsStates ? { isHovered: hovered, isFocused: focused, isFocusVisible: focusVisible } : undefined,
  };
  const values: ButtonRenderProps = {
    isHovered: () => !!hovered?.(),
    isPressed: () => (!!read(ctxPressed) || !!pressed?.()) && !isPendingNow(isPending),
    isFocused: () => !!focused?.(),
    isFocusVisible: () => !!focusVisible?.(),
    isDisabled: () => !!read(isDisabled),
    isPending: () => isPendingNow(isPending),
  };
  const renderProps = lv
    ? resolveRenderProps({ values, defaultClassName: "rv-Button" }, liveRenderProps(props) as never)
    : resolveRenderProps({ class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-Button" });
  // Untracked: its `isDisabled`-derived fields (`disabled`) are bound below from the accessor; a tracked read
  // here would re-render the whole Button on the first change of a resumed page (Calendar page buttons).
  const ariaBag = untrack(() => ariaButtonProps(props));
  // Live: ARIA / form keys forward to the props (runtime mergeProps: a defined live value wins per read).
  const aria = lv ? (mergeLive(ariaBag, lv) as Record<string, unknown>) : ariaBag;
  // RAC: `useId(buttonProps.id)` + `useId()` for the progress bar (Rivet derives it: one id per button).
  const id = (aria.id as string | undefined) ?? createId();
  const progressId = id + "-progress";
  // Accessor rule: aria-label / aria-labelledby may be accessors (Tree chevron Expand ↔ Collapse): read in bindings.
  const labelledByProp = (lv ? liveAt(lv, "aria-labelledby") : aria["aria-labelledby"]) as MaybeAccessor<string | undefined>;
  const ariaLabelProp = (lv ? liveAt(lv, "aria-label") : aria["aria-label"]) as MaybeAccessor<string | undefined>;
  // aria-labelledby wins over aria-label (accname): the pending name is label + progress.
  const labelledBy = (): string | undefined => {
    const lb = read(labelledByProp);
    if (!isPendingNow(isPending)) return lb;
    return lb ? `${lb} ${progressId}` : read(ariaLabelProp) ? `${id} ${progressId}` : undefined;
  };
  const announceLabel = () => labelledBy() || id;
  // `type` is live (a submit ↔ button switch updates in place); a pending submit renders `type="button"`.
  const typeProp = (lv ? liveAt(aria, "type") : aria.type) as MaybeAccessor<"button" | "submit" | "reset">;
  const buttonType = () => {
    const type = read(typeProp);
    return type === "submit" && isPendingNow(isPending) ? "button" : type;
  };
  const ariaDisabled = (lv ? liveAt(aria, "aria-disabled") : aria["aria-disabled"]) as MaybeAccessor<unknown>;
  const slot = props.slot || undefined;
  const excludeFromTabOrder = (lv ? liveAt(lv, "excludeFromTabOrder") : props.excludeFromTabOrder) as MaybeAccessor<boolean | undefined>;
  const allowFocusWhenDisabled = (lv ? liveAt(lv, "allowFocusWhenDisabled") : props.allowFocusWhenDisabled) as MaybeAccessor<boolean | undefined>;
  // Read every prop up front: an element with a spread resumes as one binding over all its attributes, and
  // reading `props` there would capture the whole props object (children included).
  const dom = globalDOMProps(props, OWNED);
  // Form attributes the JSX typings lack go through the spread (HTML attribute names are case-insensitive).
  // A live one is an accessor (undefined renders no attribute); a static one only when given.
  if (isLive(props, "formEncType")) dom.formenctype = liveAt(aria, "formEncType");
  else if (aria.formEncType !== undefined) dom.formenctype = aria.formEncType;
  if (isLive(props, "formMethod")) dom.formmethod = liveAt(aria, "formMethod");
  else if (aria.formMethod !== undefined) dom.formmethod = aria.formMethod;
  if (isLive(props, "formTarget")) dom.formtarget = liveAt(aria, "formTarget");
  else if (aria.formTarget !== undefined) dom.formtarget = aria.formTarget;
  // `render`: the same attributes as one object (reactive entries are accessors, read by the element spread). Built only when given: the default path below is the compiled `<button>`.
  if (props.render) {
    const provideChildren = () => provide(ProgressBarContext, { id: progressId }, () => renderProps.children());
    const attrs = {
      ...dom,
      ...focusAttrs,
      type: () => buttonType(),
      id,
      ref: ref as never,
      name: aria.name as string | undefined,
      value: aria.value as string | undefined,
      form: aria.form as string | undefined,
      formAction: aria.formAction as string | undefined,
      formNoValidate: aria.formNoValidate as boolean | undefined,
      disabled: () => read(isDisabled) || undefined,
      tabindex: () => (read(excludeFromTabOrder) || (read(allowFocusWhenDisabled) && read(isDisabled)) ? -1 : undefined),
      autoFocus: aria.autoFocus as boolean | undefined,
      class: () => renderProps.class(),
      style: () => renderProps.style(),
      slot: slot,
      "aria-label": () => read(ariaLabelProp),
      "aria-labelledby": () => labelledBy(),
      "aria-describedby": aria["aria-describedby"] as string | undefined,
      "aria-details": aria["aria-details"] as string | undefined,
      "aria-expanded": () => val(aria["aria-expanded"]),
      "aria-haspopup": () => val(aria["aria-haspopup"]),
      "aria-controls": () => val(aria["aria-controls"]),
      "aria-pressed": () => val(aria["aria-pressed"]),
      "aria-current": () => val(aria["aria-current"]),
      "aria-disabled": () => (isPendingNow(isPending) ? "true" : val(read(ariaDisabled))),
      "data-disabled": () => dataBool(read(isDisabled)),
      "data-pressed": () => dataBool(values.isPressed()),
      "data-pending": () => dataBool(isPendingNow(isPending)),
      onPointerDown: (event: BE<PointerEvent>) => {
        buttonPointerDown(event, press, isPending);
        watchDisabled(event.currentTarget, press, isDisabled);
        if (!isPendingNow(isPending)) onPointerDown?.(event);
      },
      // Unconditional inline arrows (a resumed spread only takes inline functions in an object literal, not a conditional).
      onPointerUp: (event: BE<PointerEvent>) => {
        if (press.onPressUp) buttonPointerUp(event, press, isPending);
        if (!isPendingNow(isPending)) onPointerUp?.(event);
      },
      onMouseDown: (event: BE<MouseEvent>) => {
        if (press.preventFocusOnPress) buttonMouseDown(event, press);
        if (!isPendingNow(isPending)) onMouseDown?.(event);
      },
      onKeyDown: (event: BE<KeyboardEvent>) => {
        buttonKeyDown(event, press, isPending);
        watchDisabled(event.currentTarget, press, isDisabled);
        if (onKeyDown && !isPendingNow(isPending)) keyboardKeyDown({ onKeyDown }, event);
      },
      onKeyUp: (event: BE<KeyboardEvent>) => {
        if (onKeyUp && !isPendingNow(isPending)) keyboardKeyUp({ onKeyUp }, event);
      },
      onClick: (event: BE<MouseEvent>) => buttonClick(event, press, isPending),
      // Hover / focus: delegated (`pointerover` / `focusin`); the leave / blur bind while hovered / focused.
      onPointerOver: (event: BE<PointerEvent>) => {
        // The user's pointerover first: React Aria starts the hover on pointerenter, after it.
        onPointerOver?.(event as never);
        hoverStateOver(interaction, event);
      },
      // A user enter / leave binds natively (conditional object literals: resumable inline arrows).
      ...(onPointerEnter ? { onPointerEnter: (event: PointerEvent) => onPointerEnter(event as never) } : {}),
      ...(onPointerLeave ? { onPointerLeave: (event: PointerEvent) => onPointerLeave(event as never) } : {}),
      onFocusIn: (event: BE<FocusEvent>) => {
        focusStateIn(interaction, event);
        if (event.target === event.currentTarget) watchPending(event.currentTarget, isPending, announceLabel);
      },
      children: provideChildren,
    };
    return props.render(attrs as never, values);
  }
  return (
    <button
      {...dom}
      {...readAttrs(focusAttrs)}
      type={buttonType()}
      id={id}
      ref={ref as never}
      name={aria.name as string | undefined}
      value={aria.value as string | undefined}
      form={aria.form as string | undefined}
      formAction={aria.formAction as string | undefined}
      formNoValidate={aria.formNoValidate as boolean | undefined}
      disabled={read(isDisabled) || undefined}
      tabIndex={read(excludeFromTabOrder) || (read(allowFocusWhenDisabled) && read(isDisabled)) ? -1 : undefined}
      autoFocus={aria.autoFocus as boolean | undefined}
      class={renderProps.class()}
      style={renderProps.style()}
      slot={slot}
      aria-label={read(ariaLabelProp)}
      aria-labelledby={labelledBy()}
      aria-describedby={aria["aria-describedby"] as string | undefined}
      aria-details={aria["aria-details"] as string | undefined}
      aria-expanded={val(aria["aria-expanded"])}
      aria-haspopup={val(aria["aria-haspopup"])}
      aria-controls={val(aria["aria-controls"])}
      aria-pressed={val(aria["aria-pressed"])}
      aria-current={val(aria["aria-current"])}
      aria-disabled={isPendingNow(isPending) ? "true" : val(read(ariaDisabled))}
      data-disabled={dataBool(read(isDisabled))}
      data-pressed={dataBool(values.isPressed())}
      data-pending={dataBool(isPendingNow(isPending))}
      onPointerDown={(event) => {
        buttonPointerDown(event, press, isPending);
        watchDisabled(event.currentTarget, press, isDisabled);
        if (!isPendingNow(isPending)) onPointerDown?.(event);
      }}
      onPointerUp={
        press.onPressUp || onPointerUp
          ? (event) => {
              if (press.onPressUp) buttonPointerUp(event, press, isPending);
              if (!isPendingNow(isPending)) onPointerUp?.(event);
            }
          : undefined
      }
      onMouseDown={
        press.preventFocusOnPress || onMouseDown
          ? (event) => {
              if (press.preventFocusOnPress) buttonMouseDown(event, press);
              if (!isPendingNow(isPending)) onMouseDown?.(event);
            }
          : undefined
      }
      onKeyDown={(event) => {
        buttonKeyDown(event, press, isPending);
        watchDisabled(event.currentTarget, press, isDisabled);
        if (onKeyDown && !isPendingNow(isPending)) keyboardKeyDown({ onKeyDown }, event);
      }}
      onKeyUp={onKeyUp ? (event) => (isPendingNow(isPending) ? undefined : keyboardKeyUp({ onKeyUp }, event)) : undefined}
      onClick={(event) => buttonClick(event, press, isPending)}
      // Hover / focus: delegated (`pointerover` / `focusin`, no listener per button); the leave / blur bind on
      // the element while hovered / focused (data-attrs.tsx). A user `onPointerEnter` / `onPointerLeave` binds natively.
      onPointerOver={(event) => {
        // The user's pointerover first: React Aria starts the hover on pointerenter, after it.
        onPointerOver?.(event as never);
        hoverStateOver(interaction, event);
      }}
      onPointerEnter={onPointerEnter ? (event) => onPointerEnter(event as never) : undefined}
      onPointerLeave={onPointerLeave ? (event) => onPointerLeave(event as never) : undefined}
      onFocusIn={(event) => {
        focusStateIn(interaction, event);
        if (event.target === event.currentTarget) watchPending(event.currentTarget, isPending, announceLabel);
      }}
    >
      {provide(ProgressBarContext, { id: progressId }, () => renderProps.children())}
    </button>
  );
}
