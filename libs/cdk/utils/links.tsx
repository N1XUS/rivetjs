// Links: open a link programmatically with modifier keys, synthetic links (`data-href` on non-anchor
// elements such as menu items / rows), and client-side routing integration.
// Ported from react-spectrum packages/react-aria/src/utils/openLink.tsx (Apache-2.0, © Adobe):
// `openLink`, `shouldClientNavigate`, `RouterProvider`, `useRouter`, `getSyntheticLinkProps`,
// `useSyntheticLinkProps`, `useLinkProps`, `handleLinkClick`.
//
// Rivet: `@rivetjs/router` intercepts same-origin link clicks at the document, so the default
// ("native") router already navigates client-side when `openLink` dispatches its click — no
// provider needed. `RouterProvider` is for other routers (or to map hrefs with `useHref`).
// This is THE router module: `@rivetjs/cdk/link` re-exports it, `interactions/utils.ts` reads
// `linkState` from here (usePress / focus-visible ignore the synthetic click `openLink` dispatches),
// `selection/*` and `_adapters/*` call `openLink` / `isOpeningLink` from here.
import type { Content, Slot } from "@rivetjs/runtime/jsx-runtime";
import { createContext, provide, useContext } from "@rivetjs/reactivity";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { isIPad, isMac, isWebKit } from "../platform/index.ts";
import { renderSlot } from "@rivetjs/runtime/slot";

export type Href = string;
/** Options passed through to the router's `navigate` (react-aria `RouterOptions`). */
export type RouterOptions = Record<string, unknown> | undefined;

export interface Modifiers {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/**
 * The router in scope (react-aria `Router`). Rivet: plain data so handlers can capture it — the
 * native router is `{ isNative: true }`; a `RouterProvider` router carries the user's `navigate` /
 * `useHref` (resumable arrows). react-aria's `router.open(…)` / `router.useHref(…)` methods are the
 * free functions `routerOpen(router, …)` / `routerHref(router, …)`.
 */
export interface Router {
  /** True for the default router (plain browser / document-level router navigation). */
  readonly isNative: boolean;
  /** Custom navigation (`RouterProvider`); absent for the native router. */
  readonly navigate?: (href: Href, routerOptions: RouterOptions) => void;
  /** Maps a router href to a DOM href (`RouterProvider` `useHref`). */
  readonly useHref?: (href: Href) => string;
}

export interface LinkDOMProps {
  href?: Href;
  hrefLang?: string;
  target?: string;
  rel?: string;
  download?: boolean | string;
  ping?: string;
  referrerPolicy?: string;
  routerOptions?: RouterOptions;
}

/** Whether a click on `link` with `modifiers` should navigate in-document (same origin, `_self`, no download, no modifier). */
export function shouldClientNavigate(link: HTMLAnchorElement, modifiers: Modifiers): boolean {
  // getAttribute: Firefox defaults link.target to "_parent" inside an iframe.
  const target = link.getAttribute("target");
  return (
    (!target || target === "_self") &&
    link.origin === link.ownerDocument.defaultView?.location.origin &&
    !link.hasAttribute("download") &&
    !modifiers.metaKey && // new tab (mac)
    !modifiers.ctrlKey && // new tab (windows)
    !modifiers.altKey && // download
    !modifiers.shiftKey
  );
}

/** Set while `openLink` dispatches its event (react-aria's `openLink.isOpening`); read by usePress / focus-visible / collections. */
export const linkState = { isOpening: false };

/** Whether `openLink` is dispatching its synthetic click (item click handlers let it through). */
export const isOpeningLink = (): boolean => linkState.isOpening;

/**
 * Open `target` as if clicked with `modifiers` (new tab / window / download follow the browser's
 * rules for them). Focuses the link without scrolling, then dispatches a click (WebKit on macOS:
 * a keydown Enter, as WebKit ignores modifiers on synthetic clicks).
 */
export function openLink(target: HTMLAnchorElement, modifiers: Modifiers, setOpening = true): void {
  const { metaKey, ctrlKey, altKey, shiftKey } = modifiers;
  const view = target.ownerDocument.defaultView!;
  const event =
    isWebKit() && isMac() && !isIPad()
      ? new view.KeyboardEvent("keydown", { keyIdentifier: "Enter", metaKey, ctrlKey, altKey, shiftKey } as KeyboardEventInit)
      : new view.MouseEvent("click", { metaKey, ctrlKey, altKey, shiftKey, detail: 1, bubbles: true, cancelable: true });
  linkState.isOpening = setOpening;
  target.focus({ preventScroll: true });
  target.dispatchEvent(event);
  linkState.isOpening = false;
}

function getSyntheticLink(target: Element, open: (link: HTMLAnchorElement) => void): void {
  if (target instanceof target.ownerDocument.defaultView!.HTMLAnchorElement) open(target as HTMLAnchorElement);
  else if (target.hasAttribute("data-href")) {
    const link = target.ownerDocument.createElement("a");
    link.href = target.getAttribute("data-href")!;
    if (target.hasAttribute("data-target")) link.target = target.getAttribute("data-target")!;
    if (target.hasAttribute("data-rel")) link.rel = target.getAttribute("data-rel")!;
    if (target.hasAttribute("data-download")) link.download = target.getAttribute("data-download")!;
    if (target.hasAttribute("data-ping")) link.ping = target.getAttribute("data-ping")!;
    if (target.hasAttribute("data-referrer-policy")) link.referrerPolicy = target.getAttribute("data-referrer-policy")!;
    target.appendChild(link);
    open(link);
    target.removeChild(link);
  }
}

/** Default router's `open`: a synthetic link for `target` (an `<a>`, or an element with `data-href`), opened natively. */
export function openSyntheticLink(target: Element, modifiers: Modifiers): void {
  getSyntheticLink(target, (link) => openLink(link, modifiers));
}

const nativeRouter: Router = { isNative: true };

/** Context `RouterProvider` sets; default: the native router. */
export const RouterContext = resumableContext(createContext<Router>(nativeRouter, { id: "rv-router" }));

/** The router links should use (closest `RouterProvider`, else native). Call while rendering; capture the result in handlers. */
export function useRouter(): Router {
  return useContext(RouterContext);
}

/** Build a client-side router for `RouterProvider` / `RouterContext` from a `navigate` function. */
export function createRouter(navigate: (path: Href, routerOptions: RouterOptions) => void, useHref?: (href: Href) => string): Router {
  return { isNative: false, navigate, useHref };
}

/** react-aria `router.useHref(href)`: the DOM href (`undefined` stays `undefined`; no router = native). */
export function routerHref(router: Router | undefined, href: Href | undefined): string | undefined {
  return href == null ? undefined : router?.useHref ? router.useHref(href) : href;
}

/**
 * react-aria `router.open(target, modifiers, href, routerOptions)`: navigate `target` (an anchor, or
 * an element with `data-href`) — through `navigate` when the click should stay in-document, else
 * natively with the modifiers honoured. No router = native.
 */
export function routerOpen(router: Router | undefined, target: Element, modifiers: Modifiers, href: Href, routerOptions?: RouterOptions): void {
  const navigate = router?.isNative === false ? router.navigate : undefined;
  if (!navigate) return openSyntheticLink(target, modifiers);
  getSyntheticLink(target, (link) => {
    if (shouldClientNavigate(link, modifiers)) navigate(href, routerOptions);
    else openLink(link, modifiers);
  });
}

export interface RouterProviderProps {
  /** The client router's navigate function (an inline arrow or local function: it resumes). */
  navigate: (path: Href, routerOptions: RouterOptions) => void;
  /** Maps a router href to a native `href` (base paths). */
  useHref?: (href: Href) => string;
  /** The subtree: plain children (a lazy compiler slot rendered under the provider) or `{() => <App />}`. */
  children?: Slot | Content;
}

/** Routes every link / link item in its subtree through `navigate` (react-aria `RouterProvider`). */
export function RouterProvider(props: RouterProviderProps) {
  const router = createRouter(props.navigate, props.useHref);
  const children = props.children;
  return provide(RouterContext, router, () => renderSlot(children));
}

/** Deprecated react-aria helper: `data-*` attributes describing a synthetic link (no `useHref` mapping). */
export function getSyntheticLinkProps(props: LinkDOMProps): Record<string, unknown> {
  return {
    "data-href": props.href,
    "data-target": props.target,
    "data-rel": props.rel,
    "data-download": props.download,
    "data-ping": props.ping,
    "data-referrer-policy": props.referrerPolicy,
  };
}

/** `data-*` attributes describing a synthetic link, `href` mapped by the router's `useHref`. */
export function useSyntheticLinkProps(props: LinkDOMProps): Record<string, unknown> {
  return syntheticLinkAttrs(props, useRouter());
}

/** `useSyntheticLinkProps` for a router captured earlier (handlers / behaviour code; `download: true` renders `""`). */
export function syntheticLinkAttrs(props: LinkDOMProps, router?: Router): Record<string, string | undefined> {
  return {
    "data-href": routerHref(router, props.href),
    "data-target": props.target,
    "data-rel": props.rel,
    "data-download": props.download === true ? "" : props.download || undefined,
    "data-ping": props.ping,
    "data-referrer-policy": props.referrerPolicy,
  };
}

/** Link attributes present in `props` (`href` mapped by the router's `useHref`). */
export function useLinkProps(props?: LinkDOMProps): LinkDOMProps {
  const router = useRouter();
  const linkProps: Record<string, unknown> = {};
  if (props)
    for (const key of ["href", "target", "rel", "download", "ping", "referrerPolicy"] as const)
      if (key in props && props[key] !== undefined) linkProps[key] = key === "href" ? routerHref(router, props.href) : props[key];
  return linkProps as LinkDOMProps;
}

/**
 * Click handler body for links rendered by a component: with a non-native router, prevent the
 * default and let the router open the link when it should navigate in-document.
 */
export function handleLinkClick(event: MouseEvent, router: Router, href: Href | undefined, routerOptions: RouterOptions): void {
  const link = event.currentTarget as HTMLAnchorElement | null;
  if (
    !router.isNative &&
    link &&
    link instanceof link.ownerDocument.defaultView!.HTMLAnchorElement &&
    link.href &&
    // A router Link component may already have prevented the default.
    !event.defaultPrevented &&
    shouldClientNavigate(link, event) &&
    href
  ) {
    event.preventDefault();
    routerOpen(router, link, event, href, routerOptions);
  }
}
