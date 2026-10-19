// RAC render-state attributes: `data-*` state values (`"true"` or absent, like RAC) and the JS-driven
// interaction states `data-hovered` / `data-focused` / `data-focus-visible` (+ `data-pressed`, written by
// `button/press.ts`) — decision 3 (RAC parity, set from JS on every component).
// Built on THE ports: react-aria useHover (`../interactions/hover.tsx`) and useFocusRing
// (`../focus/focus-ring.tsx`), Apache-2.0, © Adobe.
// Rivet (zero cost before interaction):
// - no signals, no effects, no listener per element: the server renders no interaction attribute; two
//   runtime-delegated handlers (`onPointerOver` → hover start, `onFocusIn` → focus; resumable) write the
//   attributes straight on `event.currentTarget`, and the element gets a transient native `pointerleave` /
//   `blur` listener only while hovered / focused (React's delegated onPointerEnter / onFocus model). Per-element state lives in a module `WeakMap`
//   (transient, browser-only, never serialized) — the `button/press.ts` pattern.
// - render props that need the states (`class={({ isHovered }) => …}`) pass `states` signals: the
//   handlers set them too, so only components whose user asked for a function re-render anything.
import type { Signal } from "@rivetjs/reactivity";
import { endHover, hoverPointerLeave, hoverPointerOver, type HoverEvents } from "../interactions/hover.tsx";
import { focusRingBlur, focusRingFocus } from "../focus/focus-ring.tsx";
import { focusBlur, focusFocus } from "../interactions/focus.tsx";
import { getEventTarget, type MaybeAccessor } from "../interactions/utils.ts";
import { chain2 } from "../interactions/merge-props.tsx";
import { mergeProps as mergeLive } from "@rivetjs/runtime/props";
import { hasLive } from "./live.tsx";

/** A boolean render-state attribute value: `"true"` or absent (RAC `data-x="true"`; never `""`). */
export const dataBool = (value: unknown): "true" | undefined => (value ? "true" : undefined);

/** Set (`"true"`) or remove the boolean state attribute `name` on `el`. */
export function setDataAttr(el: Element, name: string, value: boolean): void {
  if (value) el.setAttribute(name, "true");
  else el.removeAttribute(name);
}

/** Optional signals mirroring the attributes (for function render props). */
export interface InteractionStateSignals {
  isHovered?: Signal<boolean>;
  isFocused?: Signal<boolean>;
  isFocusVisible?: Signal<boolean>;
}

export interface InteractionStateOptions extends HoverEvents {
  /** Disables hover (RA `useHover({ isDisabled })`; not the focus events); read at event time. */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** Focus ring when a descendant has focus (RA `useFocusRing({ within })`): writes `data-focus-within` (not
   * `data-focused`); `states.isFocused` = focus within. Bind `onFocusIn` / `onFocusOut` (both delegated). */
  within?: boolean;
  /** Text input: only Tab / Escape make focus visible. */
  isTextInput?: boolean;
  /** User focus events (RA `useFocus`), called from the same handlers. */
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  /** Signals the handlers keep in sync with the attributes. */
  states?: InteractionStateSignals;
}

type HoverInstance = Parameters<typeof hoverPointerOver>[0];
type RingInstance = Parameters<typeof focusRingFocus>[0];
interface ElementState {
  hover?: HoverInstance;
  ring?: RingInstance;
  /** Remove the transient blur listener of the current focus. */
  unblur?: () => void;
}
const states = new WeakMap<Element, ElementState>();

const stateOf = (el: Element): ElementState => {
  let s = states.get(el);
  if (!s) states.set(el, (s = {}));
  return s;
};

function hoverOf(el: Element, o: InteractionStateOptions): HoverInstance {
  const s = stateOf(el);
  const hover = (s.hover ??= {
    props: o,
    state: { isHovered: false, pointerType: "", target: null, globals: [] },
    hovered: { set: (v: boolean) => (setDataAttr(el, "data-hovered", v), o.states?.isHovered?.set(v)) },
  });
  hover.props = o; // options are rebuilt per event: keep the latest callbacks
  return hover;
}

function ringOf(el: Element, o: InteractionStateOptions): RingInstance {
  const s = stateOf(el);
  let focused = false;
  // RAC: `data-focus-within` for a focus-within ring (Group), `data-focused` otherwise.
  const focusAttr = o.within ? "data-focus-within" : "data-focused";
  const ring = (s.ring ??= {
    props: { within: o.within, isTextInput: o.isTextInput },
    focused: Object.assign(() => focused, {
      set: (v: boolean) => ((focused = v), setDataAttr(el, focusAttr, v), o.states?.isFocused?.set(v)),
    }),
    visible: { set: (v: boolean) => (setDataAttr(el, "data-focus-visible", v), o.states?.isFocusVisible?.set(v)) },
    state: { isFocused: false, isFocusVisible: false, unsubscribe: null },
  });
  return ring;
}

/** pointerover (delegated; bind `onPointerOver`): an enter sets `data-hovered` (+ `onHoverStart` / `onHoverChange`);
 * the hovered element's `pointerleave` (bound while hovered) removes it (+ `onHoverEnd` / `onHoverChange`). */
export function hoverStateOver(o: InteractionStateOptions, e: PointerEvent): void {
  hoverPointerOver(hoverOf(e.currentTarget as Element, o), e);
}

/** pointerenter (a native listener per element; prefer `hoverStateOver`): `data-hovered` (+ `onHoverStart` / `onHoverChange`). */
export function hoverStateEnter(o: InteractionStateOptions, e: PointerEvent): void {
  if (e.target === e.currentTarget) hoverStateOver(o, e);
}

/** pointerleave of `hoverStateEnter` callers: ends the hover now (the transient leave listener then finds none). */
export function hoverStateLeave(o: InteractionStateOptions, e: PointerEvent): void {
  hoverPointerLeave(hoverOf(e.currentTarget as Element, o), e);
}

/** End a hover now (RA: `isDisabled` turning true while hovered). */
export function endHoverState(el: Element): void {
  const hover = states.get(el)?.hover;
  if (hover) endHover(hover);
}

/**
 * focusin (delegated; bind `onFocusIn`, not with `within`): the element's own focus (React's onFocus is focusin,
 * RA useFocus checks `target === currentTarget`) → `focusStateFocus`, and its native `blur` binds until it fires
 * (→ `focusStateBlur`). No listener per element.
 */
export function focusStateIn(o: InteractionStateOptions, e: FocusEvent): void {
  const el = e.currentTarget as Element;
  if (getEventTarget(e) !== el) return;
  bindBlur(el, o);
  focusStateFocus(o, e);
}

/** focus (or focusin with `within`): `data-focused` (`data-focus-within`), `data-focus-visible` (+ user focus events). */
export function focusStateFocus(o: InteractionStateOptions, e: FocusEvent): void {
  // `isDisabled` is the hover switch (RAC: pending buttons stop hovering but keep their focus events).
  if (!o.within && (o.onFocus || o.onFocusChange)) focusFocus({ onFocus: o.onFocus, onBlur: o.onBlur, onFocusChange: o.onFocusChange }, e);
  focusRingFocus(ringOf(e.currentTarget as Element, o), e);
}

/** The element's native `blur` while it is focused (one listener at a time per focused element). */
function bindBlur(el: Element, o: InteractionStateOptions): void {
  const s = stateOf(el);
  s.unblur?.();
  const onBlur = (event: Event) => {
    s.unblur?.();
    focusStateBlur(o, event as FocusEvent);
  };
  el.addEventListener("blur", onBlur);
  s.unblur = () => (el.removeEventListener("blur", onBlur), (s.unblur = undefined));
}

/** blur (bound by `focusStateIn`), or focusout with `within`: removes `data-focused`, `data-focus-visible` (+ user focus events). */
export function focusStateBlur(o: InteractionStateOptions, e: FocusEvent): void {
  if (!o.within && (o.onBlur || o.onFocusChange)) focusBlur({ onFocus: o.onFocus, onBlur: o.onBlur, onFocusChange: o.onFocusChange }, e);
  focusRingBlur(ringOf(e.currentTarget as Element, o), e);
}

/**
 * Handler bag for an element without its own handlers for these events: spread it
 * (`<div {...interactionStateProps(o)}>`) or `mergeProps` it. Builds the handlers as object literal
 * values (R2: resumable); all delegated (no listener per element). Components wiring explicit `onX` call the
 * `*State*` functions instead.
 */
export function interactionStateProps(o: InteractionStateOptions): Record<string, unknown> {
  const focus = o.within
    ? { onFocusIn: (e: FocusEvent) => focusStateFocus(o, e), onFocusOut: (e: FocusEvent) => focusStateBlur(o, e) }
    : { onFocusIn: (e: FocusEvent) => focusStateIn(o, e) };
  return {
    onPointerOver: (e: PointerEvent) => hoverStateOver(o, e),
    ...focus,
  };
}

/** Context DOM attributes forwarded to the element (RA useFocusable merges every FocusableContext DOM prop). */
const FORWARDED_ATTR = /^(?:aria-|data-)|^(?:id|role|title|lang|dir)$/;

/**
 * RA `useFocusable`'s `FocusableContext` merge for components that render their own focusable element (Button,
 * Link): `ctx` = `useContext(FocusableContext)` (TooltipTrigger / PreviewTrigger trigger props). Returns
 * `[props, ref, attrs]`:
 * - event handlers (`on[A-Z]…`) chain after the component's own (RA `mergeProps(focusableProps, contextProps)`);
 * - other context props fill only what the component's props leave `undefined` (its own props win);
 * - `attrs`: the context's DOM attributes (`aria-*`, `data-*`, `id`, `role`, `title`, …) the props leave
 *   `undefined`, for the element: spread `{...readAttrs(attrs)}` (accessor values allowed);
 * - a disabled element takes none (RA: `isDisabled ? {} : domProps`); the context `ref` is returned for
 *   `mergeRefValues`. An accessor `isDisabled` (live / accessor prop) is never read here: the context handlers do
 *   nothing and its attributes read `undefined` while it is true (read at event time / in the attribute binding) —
 *   a render-time read would re-create the component's enclosing region on its first change on a resumed page.
 */
export function mergeFocusableContext<P extends object>(
  props: P,
  ctx: { ref?: unknown; [key: string]: unknown } | null | undefined,
  isDisabled?: boolean | (() => boolean | undefined),
): [P, unknown, Record<string, unknown> | undefined] {
  if (!ctx) return [props, undefined, undefined];
  const { ref, ...context } = ctx;
  if (isDisabled === true) return [props, ref, undefined];
  const domProps = typeof isDisabled === "function" ? gateContext(context, isDisabled) : context;
  if (hasLive(props)) return liveFocusableMerge(props, ref, domProps);
  const out = { ...props } as Record<string, unknown>;
  let attrs: Record<string, unknown> | undefined;
  for (const key in domProps) {
    const value = domProps[key];
    const own = out[key];
    if (/^on[A-Z]/.test(key) && typeof value === "function") out[key] = typeof own === "function" ? chain2(own as never, value as never) : value;
    else if (own === undefined) {
      out[key] = value;
      if (FORWARDED_ATTR.test(key)) (attrs ??= {})[key] = value;
    }
  }
  return [out as P, ref, attrs];
}

// Accessor `isDisabled`: context handlers skip and context DOM attributes read `undefined` while it is true (RA
// re-renders with `{}`). The wrappers are returned arrows (resumable symbols; captures: the context value, the accessor).
function gateContext(context: Record<string, unknown>, isDisabled: () => boolean | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key in context) {
    const value = context[key];
    if (/^on[A-Z]/.test(key) && typeof value === "function") out[key] = gatedHandler(value as (...a: unknown[]) => unknown, isDisabled);
    else if (FORWARDED_ATTR.test(key)) out[key] = gatedAttr(value, isDisabled);
    else out[key] = value;
  }
  return out;
}

function gatedHandler(handler: (...a: unknown[]) => unknown, isDisabled: () => boolean | undefined): (...a: unknown[]) => unknown {
  return (...args: unknown[]) => (isDisabled() ? undefined : handler(...args));
}

function gatedAttr(value: unknown, isDisabled: () => boolean | undefined): () => unknown {
  return () => (isDisabled() ? undefined : typeof value === "function" ? (value as () => unknown)() : value);
}

// Live props (P5): own getters stay unread — runtime `mergeProps(context, props, handlers)`: own defined values win
// per read (context fills `undefined`), context handlers chain after the own ones at call time.
function liveFocusableMerge<P extends object>(props: P, ref: unknown, domProps: Record<string, unknown>): [P, unknown, Record<string, unknown> | undefined] {
  const own = props as Record<string, unknown>;
  const handlers: Record<string, unknown> = {};
  let attrs: Record<string, unknown> | undefined;
  for (const key in domProps) {
    const value = domProps[key];
    if (/^on[A-Z]/.test(key) && typeof value === "function") {
      if (Object.hasOwn(own, key)) handlers[key] = ownThen(own, key, value as (...a: unknown[]) => unknown);
    } else if (FORWARDED_ATTR.test(key) && own[key] === undefined) (attrs ??= {})[key] = value;
  }
  return [mergeLive(domProps, props, handlers) as P, ref, attrs];
}

/** The own handler (read at call time), then the context's (a returned arrow: a resumable symbol). */
function ownThen(own: Record<string, unknown>, key: string, then: (...a: unknown[]) => unknown): (...a: unknown[]) => unknown {
  return (...args: unknown[]) => {
    const f = own[key];
    if (typeof f === "function") f(...args);
    return then(...args);
  };
}

/** `attrs` with accessor values read (call inside the element's spread binding: `{...readAttrs(attrs)}`). */
export function readAttrs(attrs: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!attrs) return undefined;
  const out: Record<string, unknown> = {};
  for (const key in attrs) {
    const v = attrs[key];
    const value = typeof v === "function" ? (v as () => unknown)() : v;
    out[key] = value == null ? undefined : String(value);
  }
  return out;
}
