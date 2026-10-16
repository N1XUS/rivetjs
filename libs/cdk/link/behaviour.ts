// Ported from react-aria `useLink` (packages/react-aria/src/link/useLink.ts), Apache-2.0, © Adobe.
// Rivet (naming convention): `useLink(props, ref)` → `linkProps(props, router)` (the attribute bag, no
// closures, so a `.ts` module); the handlers are free functions `link<Event>(event, options, …)` called from
// inline arrows (resumable) over THE press port (`../button/press.ts` → `../interactions/press.tsx`).
// `isPressed` is not returned: the press handlers write `data-pressed` on the element.
// - accessor rule: `aria-current` / `aria-label` / `aria-labelledby` may be accessors (kept as accessors in the
//   bag: read them in bindings); `isDisabled` is read once (it picks the element: `<a>` vs `<span role=link>`).
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { handleLinkClick, routerHref, type Router, type RouterOptions } from "../utils/links.tsx";
import type { AriaLabelingProps, FocusableProps, LinkDOMProps, PressEvents } from "../utils/types.ts";
import { pressClick, pressDragStart, pressKeyDown, pressMouseDown, pressPointerDown, pressPointerUp, type PressOptions } from "../button/press.ts";

export type { PressEvent, PressEvents, PressOptions, PointerType } from "../button/press.ts";

/** RA `LinkProps` (link/useLink). */
export interface AriaLinkBaseProps extends PressEvents, FocusableProps {}

/** RA `AriaLinkProps`. */
export interface AriaLinkProps extends AriaLinkBaseProps, LinkDOMProps, Omit<AriaLabelingProps, "aria-label" | "aria-labelledby"> {
  "aria-label"?: MaybeAccessor<string | undefined>;
  "aria-labelledby"?: MaybeAccessor<string | undefined>;
  /** Indicates whether this element represents the current item within a container or set of related elements. */
  "aria-current"?: MaybeAccessor<boolean | "true" | "false" | "page" | "step" | "location" | "date" | "time" | undefined>;
}

/** RA `AriaLinkOptions`. */
export interface AriaLinkOptions extends AriaLinkProps {
  /** Whether the link is disabled. */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /**
   * The HTML element used to render the link, e.g. 'a', or 'span'.
   * @default 'a'
   */
  elementType?: string;
  id?: string;
}

/** Attribute value of an `aria-current` value (`false` / nullish → no attribute). */
export const ariaCurrentAttr = (v: unknown): string | undefined => (v == null || v === false ? undefined : String(v));
// An accessor stays the SAME function (a wrapper made in this `.ts` module would not resume): read it in a binding.
const str = (v: unknown): unknown => (typeof v === "function" ? v : ariaCurrentAttr(v));

/**
 * RA `useLink` attributes (without handlers: wire `linkPointerDown` / `linkKeyDown` / `linkClick` / … as inline
 * arrows): `role="link"` + tab stop for a non-anchor, the link DOM props (`href` mapped by the router's
 * `useHref`), `aria-disabled`, `aria-current`, labelable props.
 */
export function linkProps(props: AriaLinkOptions, router?: Router): Record<string, unknown> {
  const { elementType = "a" } = props;
  const isDisabled = read(props.isDisabled);
  const out: Record<string, unknown> = {};
  if (elementType !== "a") {
    out.role = "link";
    out.tabIndex = !isDisabled ? 0 : undefined;
  }
  out.id = props.id;
  out["aria-label"] = props["aria-label"];
  out["aria-labelledby"] = props["aria-labelledby"];
  out["aria-describedby"] = props["aria-describedby"];
  out["aria-details"] = props["aria-details"];
  // RA useLinkProps: the href stays on a disabled link's <span>.
  if (props.href !== undefined) out.href = routerHref(router, props.href);
  out.hrefLang = props.hrefLang;
  out.target = props.target;
  out.rel = props.rel;
  out.download = props.download === true ? "" : props.download || undefined;
  out.ping = props.ping;
  out.referrerPolicy = props.referrerPolicy;
  if (props.autoFocus) out.autoFocus = true;
  out["aria-disabled"] = isDisabled ? "true" : undefined;
  out["aria-current"] = str(props["aria-current"]);
  return out;
}

/** click: the press click (virtual clicks, `onClick`) then RA `handleLinkClick` (client router navigation). */
export function linkClick(e: MouseEvent, o: PressOptions, router: Router | undefined, href: LinkDOMProps["href"], routerOptions?: RouterOptions): void {
  pressClick(o, e);
  if (router) handleLinkClick(e, router, href, routerOptions as RouterOptions);
}
export const linkKeyDown = (e: KeyboardEvent, o: PressOptions): void => pressKeyDown(o, e);
export const linkPointerDown = (e: PointerEvent, o: PressOptions): void => pressPointerDown(o, e);
export const linkPointerUp = (e: PointerEvent, o: PressOptions): void => pressPointerUp(o, e);
export const linkMouseDown = (e: MouseEvent, o: PressOptions): void => pressMouseDown(o, e);
export const linkDragStart = (e: DragEvent, o: PressOptions): void => pressDragStart(o, e);
