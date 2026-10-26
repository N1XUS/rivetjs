// Ported from react-aria-components `Link` (packages/react-aria-components/src/Link.tsx), Apache-2.0, © Adobe.
// A link to another page or resource: `<a href>`, or `<span role="link">` without `href` / when disabled; THE
// usePress port (press.ts), hover / focus ring (`../utils/data-attrs.tsx`), client routing through
// `RouterProvider` (re-exported from `./router.ts` = `../utils/links.tsx`, one router for `@rivetjs/cdk/link`
// and `@rivetjs/cdk/links`).
// Rivet:
// - render props are accessors (`class={({ isPressed }) => (isPressed() ? "on" : "")}`); the interaction states
//   are signals only when a `class` / `style` / `children` function asks for them. `data-hovered` /
//   `data-pressed` / `data-focused` / `data-focus-visible` are written by the handlers on the element (zero
//   cost before interaction; a plain link loads no JS until it is hovered, focused or pressed).
// - accessor rule: `aria-current`, `aria-label`, `aria-labelledby` may be accessors (read in bindings);
//   an accessor `isDisabled` re-creates the link when it flips (it picks `<a>` vs `<span>`, like RAC re-render).
// - `class` = RAC `className` (default `rv-Link`).
// `render` (RAC DOMRenderProps): given, the attributes object goes to `render(attrs, LinkRenderProps)` instead of the default `<a>` / `<span role="link">`.
import { createContext, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { dataBool, mergeFocusableContext, readAttrs, focusStateIn, hoverStateOver, type InteractionStateOptions } from "../utils/data-attrs.tsx";
// A user `onKeyDown` / `onKeyUp` alone = `keyboardKeyDown({ onKeyDown }, e)` (useKeyboard without shortcuts): the
// propagation wrapper only, so the element never reaches `../interactions/keyboard.tsx` + `../keys` (BUTTONDIET).
import { createEventHandler, read, type MaybeAccessor } from "../interactions/utils.ts";
import {
  contextProps,
  mergeRefValues,
  renderProps as resolveRenderProps,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
} from "../slots/index.tsx";
import type { HoverEvents } from "../utils/types.ts";
import { FocusableContext } from "../interactions/focus.tsx";
import { useRouter } from "./router.ts";
import {
  linkClick,
  linkKeyDown,
  linkMouseDown,
  linkPointerDown,
  linkPointerUp,
  linkProps as ariaLinkProps,
  ariaCurrentAttr,
  type AriaLinkOptions,
  type PressOptions,
} from "./behaviour.ts";
import { hasLive, liveOptions } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";

export {
  createRouter,
  openLink,
  routerHref,
  RouterContext,
  RouterProvider,
  shouldClientNavigate,
  useRouter,
  type Href,
  type LinkDOMProps,
  type Router,
  type RouterOptions,
  type RouterProviderProps,
} from "./router.ts";
export type { PressEvent } from "./behaviour.ts";

/** Global DOM events / props the link handles itself (`onClick` is a press option, called by usePress). */
const OWNED = ["onClick", "onPointerDown", "onPointerUp", "onMouseDown", "onPointerEnter", "onPointerLeave", "onPointerOver", "style"] as const;

export interface LinkRenderProps {
  /** Whether the link is the current item within a list. `[data-current]` */
  isCurrent: () => boolean;
  /** Whether the link is currently hovered with a mouse. `[data-hovered]` */
  isHovered: () => boolean;
  /** Whether the link is currently in a pressed state. `[data-pressed]` */
  isPressed: () => boolean;
  /** Whether the link is focused, either via a mouse or keyboard. `[data-focused]` */
  isFocused: () => boolean;
  /** Whether the link is keyboard focused. `[data-focus-visible]` */
  isFocusVisible: () => boolean;
  /** Whether the link is disabled. `[data-disabled]` */
  isDisabled: () => boolean;
}

export interface LinkProps
  extends
    Omit<AriaLinkOptions, "elementType">,
    HoverEvents,
    RenderProps<LinkRenderProps>,
    DOMRenderProps<"a", LinkRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLAnchorElement>, "onClick" | "style"> {
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
  ref?: RefValue<HTMLAnchorElement | HTMLSpanElement>;
}

/** RAC `LinkContext` (Breadcrumb gives its Link `aria-current` / `isDisabled`). */
export const LinkContext = createContext<ContextValue<LinkProps, HTMLAnchorElement>>(null);

const isFn = (v: unknown): boolean => typeof v === "function";
const isCurrentValue = (v: unknown): boolean => !!v && v !== "false";

/** A link to another page or resource (RAC `Link`). */
export function Link(inProps: LinkProps) {
  // Live props (P5): `isDisabled` becomes an accessor (the element switch below), class / style / children from a live
  // view; the rest of the body is read once (untracked).
  return untrack(() => link(inProps));
}

function link(inProps: LinkProps) {
  let [props, ref] = contextProps(inProps, inProps.ref, LinkContext) as [LinkProps, RefValue<HTMLAnchorElement> | undefined];
  if (hasLive(props)) props = liveOptions(props, ["isDisabled"]);
  // RA useLink → useFocusable: FocusableContext (TooltipTrigger) props / handlers / ref reach the link element.
  const [focusableMerged, focusableRef, focusAttrs] = mergeFocusableContext(props, useContext(FocusableContext), !!read(props.isDisabled));
  props = focusableMerged;
  ref = mergeRefValues(ref, focusableRef as RefValue<HTMLAnchorElement> | undefined);
  const isDisabled = props.isDisabled;
  // An accessor `isDisabled` switches the element: re-create the link when it flips (RAC re-renders).
  if (isFn(isDisabled)) return <>{() => relink(props, ref, focusAttrs, isDisabled as () => boolean | undefined)}</>;
  return renderLink(props, ref, focusAttrs, !!isDisabled);
}

// Tracks only the accessor; the link itself renders untracked (a component body).
function relink(
  props: LinkProps,
  ref: RefValue<HTMLAnchorElement> | undefined,
  focusAttrs: Record<string, unknown> | undefined,
  isDisabled: () => boolean | undefined,
) {
  const disabled = !!isDisabled();
  return untrack(() => renderLink(props, ref, focusAttrs, disabled));
}

function renderLink(props: LinkProps, ref: RefValue<HTMLAnchorElement> | undefined, focusAttrs: Record<string, unknown> | undefined, isDisabled: boolean) {
  const router = useRouter();
  const isAnchor = !!props.href && !isDisabled;
  const { onPointerDown, onPointerUp, onMouseDown, onKeyDown, onKeyUp, onPointerEnter, onPointerLeave, onPointerOver, href, routerOptions } = props;
  const wantsStates = isFn(props.class) || isFn(props.style) || isFn(props.children);
  const hovered: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const pressed: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focused: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focusVisible: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const userPressChange = props.onPressChange;
  // An object literal of this module (R2): its arrow resumes; the press callbacks are the caller's.
  // Locals first: a closure / literal capturing `props` would serialize the whole props object (children included).
  const { onPress, onPressStart, onPressEnd, onPressUp, onClick } = props;
  const press: PressOptions = {
    onPress,
    onPressStart,
    onPressEnd,
    onPressUp,
    onClick,
    isDisabled,
    onPressChange: (isPressed: boolean) => {
      pressed?.set(isPressed);
      userPressChange?.(isPressed);
    },
  };
  const interaction: InteractionStateOptions = {
    isDisabled,
    onHoverStart: props.onHoverStart,
    onHoverEnd: props.onHoverEnd,
    onHoverChange: props.onHoverChange,
    onFocus: props.onFocus as InteractionStateOptions["onFocus"],
    onBlur: props.onBlur as InteractionStateOptions["onBlur"],
    onFocusChange: props.onFocusChange,
    states: wantsStates ? { isHovered: hovered, isFocused: focused, isFocusVisible: focusVisible } : undefined,
  };
  const current = props["aria-current"];
  const values: LinkRenderProps = {
    isCurrent: () => isCurrentValue(read(current)),
    isDisabled: () => isDisabled,
    isPressed: () => !!pressed?.(),
    isHovered: () => !!hovered?.(),
    isFocused: () => !!focused?.(),
    isFocusVisible: () => !!focusVisible?.(),
  };
  const rp = resolveRenderProps(
    { class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-Link" },
    hasLive(props) ? (liveRenderProps(props) as never) : undefined,
  );
  const aria = ariaLinkProps({ ...props, isDisabled, elementType: isAnchor ? "a" : "span" }, router);
  const slot = props.slot || undefined;
  const label = aria["aria-label"] as MaybeAccessor<string | undefined>;
  const labelledBy = aria["aria-labelledby"] as MaybeAccessor<string | undefined>;
  const ariaCurrent = aria["aria-current"] as MaybeAccessor<string | undefined>;
  // Read every prop up front: an element with a spread resumes as one binding over all its attributes.
  const dom = globalDOMProps(props, OWNED);
  for (const key of ["href", "hrefLang", "target", "rel", "download", "ping", "referrerPolicy", "autoFocus"])
    if (aria[key] !== undefined) dom[key.toLowerCase()] = aria[key];
  const handlers = {
    onPointerDown: (event: PointerEvent) => {
      linkPointerDown(event, press);
      onPointerDown?.(event as never);
    },
    onPointerUp: (event: PointerEvent) => {
      linkPointerUp(event, press);
      onPointerUp?.(event as never);
    },
    onMouseDown: (event: MouseEvent) => {
      linkMouseDown(event, press);
      onMouseDown?.(event as never);
    },
    onKeyDown: (event: KeyboardEvent) => {
      linkKeyDown(event, press);
      if (onKeyDown) createEventHandler(onKeyDown)!(event);
    },
    onKeyUp: (event: KeyboardEvent) => (onKeyUp ? createEventHandler(onKeyUp)!(event) : undefined),
    onClick: (event: MouseEvent) => linkClick(event, press, router, href, routerOptions),
    onPointerOver: (event: PointerEvent) => {
      // The user's pointerover first: React Aria starts the hover on pointerenter, after it.
      onPointerOver?.(event as never);
      hoverStateOver(interaction, event);
    },
    // A user enter / leave binds natively (conditional object literals: resumable inline arrows).
    ...(onPointerEnter ? { onPointerEnter: (event: PointerEvent) => onPointerEnter(event as never) } : {}),
    ...(onPointerLeave ? { onPointerLeave: (event: PointerEvent) => onPointerLeave(event as never) } : {}),
    onFocusIn: (event: FocusEvent) => focusStateIn(interaction, event),
  };
  if (props.render) {
    // Reactive attributes are accessors: the spread reads them inside its one effect.
    const common = {
      ...dom,
      ...focusAttrs,
      ...handlers,
      ref: ref as never,
      id: aria.id as string | undefined,
      slot,
      class: () => rp.class(),
      style: () => rp.style(),
      "aria-label": () => read(label),
      "aria-labelledby": () => read(labelledBy),
      "aria-describedby": aria["aria-describedby"] as string | undefined,
      "aria-details": aria["aria-details"] as string | undefined,
      "aria-current": () => ariaCurrentAttr(read(ariaCurrent)),
      "data-current": () => dataBool(values.isCurrent()),
      children: () => rp.children(),
    };
    const attrs = isAnchor
      ? common
      : {
          ...common,
          role: "link",
          tabindex: aria.tabIndex as number | undefined,
          "aria-disabled": aria["aria-disabled"] as string | undefined,
          "data-disabled": dataBool(isDisabled),
        };
    return props.render(attrs as never, values);
  }
  return isAnchor ? (
    <a
      {...dom}
      {...readAttrs(focusAttrs)}
      {...handlers}
      ref={ref as never}
      id={aria.id as string | undefined}
      slot={slot}
      class={rp.class()}
      style={rp.style()}
      aria-label={read(label)}
      aria-labelledby={read(labelledBy)}
      aria-describedby={aria["aria-describedby"] as string | undefined}
      aria-details={aria["aria-details"] as string | undefined}
      aria-current={ariaCurrentAttr(read(ariaCurrent)) as never}
      data-current={dataBool(values.isCurrent())}
    >
      {rp.children()}
    </a>
  ) : (
    <span
      {...dom}
      {...readAttrs(focusAttrs)}
      {...handlers}
      ref={ref as never}
      id={aria.id as string | undefined}
      role="link"
      tabIndex={aria.tabIndex as number | undefined}
      slot={slot}
      class={rp.class()}
      style={rp.style()}
      aria-label={read(label)}
      aria-labelledby={read(labelledBy)}
      aria-describedby={aria["aria-describedby"] as string | undefined}
      aria-details={aria["aria-details"] as string | undefined}
      aria-disabled={aria["aria-disabled"] as string | undefined}
      aria-current={ariaCurrentAttr(read(ariaCurrent)) as never}
      data-current={dataBool(values.isCurrent())}
      data-disabled={dataBool(isDisabled)}
    >
      {rp.children()}
    </span>
  );
}
