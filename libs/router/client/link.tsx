// `<Link>`: the router's navigation component. Renders a plain `<a href>` (works without JS, resumes
// without any component code); the router's delegated handlers read its data attributes.
import { useContext } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import type { LinkHref } from "../index.ts";
import { withBase } from "../shared/base.ts";
import { slashHref, TRAILING_SLASH } from "../shared/slash.ts";
import { currentOf } from "./active.ts";
import { ServerData } from "./route-context.ts";

type Anchor = JSX.IntrinsicElements["a"];

/** Props of `<Link>`. */
export interface LinkProps extends Omit<Anchor, "href" | "children" | "aria-current"> {
  /** A page of this app: `RoutePath` (from `.rivet/routes.d.ts`) with optional `?query` / `#hash`; the URL base path is added. */
  to: LinkHref;
  /**
   * View transition types added for this navigation (`data-transition`; overrides the route's own);
   * `false`: no animation. Needs `rivetRouter({ transitions })`.
   */
  transition?: string | readonly string[] | false;
  /**
   * `"intent"` (default): the client router loads data and page chunk on hover/focus. `"none"`: nothing
   * before the click. `"document"` / `"prerender"`: when the click is a document load (`reload`, or an
   * app without client routing), the browser fetches (or prerenders) the page ahead — Speculation Rules,
   * else `<link rel=prefetch>` / `fetch` on intent; links the client router handles keep `"intent"`
   * behaviour. Unset: `rivetRouter({ prefetch })`'s default, else `"intent"`; an explicit `"intent"` keeps the
   * router's prefetch only (no document prefetch from the app default).
   */
  prefetch?: "intent" | "none" | "document" | "prerender";
  /** Classes set on the link while its navigation is pending (with `data-rivet-pending`). Needs `transitions`. */
  pending?: string;
  /** Replace the current history entry instead of pushing one. */
  replace?: boolean;
  /** Full document navigation instead of client routing (`data-rivet-reload`). */
  reload?: boolean;
  /**
   * Mark the link while it points at the current page: `aria-current="page"` + `data-current`.
   * `true` / `"exact"`: same path only; `"prefix"`: also below it (`aria-current="true"`), e.g. a section link.
   * Kept current across client navigation. An explicit `aria-current` wins.
   */
  active?: boolean | "exact" | "prefix";
  "aria-current"?: "page" | "step" | "location" | "date" | "time" | "true" | "false";
  children?: Anchor["children"];
}

const attribute = (on: boolean | undefined): "" | undefined => (on ? "" : undefined);

/**
 * Compiler ABI (server target): the `href` of a bare `<Link to>` — the app path under the URL base, in the
 * `trailingSlash` form. The compiler writes a bare server `<Link>` (only `to`, a literal `class`, static text) as
 * `<a href={_linkHref(to)}>` markup in the enclosing template (same bytes as the component's bare path).
 */
export function _linkHref(to: LinkHref): string {
  return TRAILING_SLASH === "ignore" ? withBase(to) : slashHref(withBase(to), TRAILING_SLASH);
}

/**
 * Typed navigation link: `<Link to="/items/42" transition="zoom" pending="opacity-60">Item</Link>`.
 * Other `<a>` attributes and event handlers (`style`, `data-*`, `download`, `onClick`…) pass through.
 */
export function Link(props: LinkProps) {
  // Bare link (only `to`, children and a string `class`; every other prop absent or undefined — the
  // common case): `<a class href>` without the option attributes, the rest object or the key scan below.
  let bare = true;
  for (const key in props)
    if (
      key !== "to" &&
      key !== "children" &&
      (key === "class" ? props.class !== undefined && typeof props.class !== "string" : props[key as keyof LinkProps] !== undefined)
    ) {
      bare = false;
      break;
    }
  if (bare) {
    return (
      <a class={props.class as string | undefined} href={_linkHref(props.to)}>
        {props.children}
      </a>
    );
  }
  const { to, transition: types, prefetch, pending, replace, reload, active, children, ...rest } = props;
  // `rivetRouter({ trailingSlash })`: the path in its canonical form (a build-time constant; folded away by default).
  const href = TRAILING_SLASH === "ignore" ? withBase(to) : slashHref(withBase(to), TRAILING_SLASH);
  const transition = types === false ? "none" : typeof types === "string" ? types : types?.join(" ");
  const mode = active ? (active === "prefix" ? "prefix" : "exact") : undefined;
  let current = rest["aria-current"];
  if (mode && current === undefined) {
    // The request's URL on the server; the browser's while rendering on the client.
    const here = useContext(ServerData)?.url ?? (typeof location === "undefined" ? undefined : location);
    if (here) current = currentOf(new URL(href, here.href).pathname, here.pathname, mode);
  }
  const currentAttr = mode ? attribute(!!current) : undefined,
    activeAttr = rest["aria-current"] === undefined ? mode : undefined;
  // Fast path (no attributes beyond a string `class`, the common case): explicit attributes, no generic
  // spread (same markup: the spread put `class` first too; class arrays / objects keep the spread).
  let plain = rest.class === undefined || typeof rest.class === "string";
  for (const key in rest)
    if (key !== "class") {
      plain = false;
      break;
    }
  if (plain)
    return (
      <a
        class={rest.class as string | undefined}
        href={href}
        aria-current={current}
        data-current={currentAttr}
        data-rivet-active={activeAttr}
        data-transition={transition}
        data-rivet-prefetch={prefetch}
        data-rivet-pending-class={pending}
        data-rivet-replace={attribute(replace)}
        data-rivet-reload={attribute(reload)}
      >
        {children}
      </a>
    );
  return (
    <a
      {...rest}
      href={href}
      aria-current={current}
      data-current={currentAttr}
      data-rivet-active={activeAttr}
      data-transition={transition}
      data-rivet-prefetch={prefetch}
      data-rivet-pending-class={pending}
      data-rivet-replace={attribute(replace)}
      data-rivet-reload={attribute(reload)}
    >
      {children}
    </a>
  );
}
