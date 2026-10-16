// Wire contract between the server handler and the client router.

/** Query flag marking a client-navigation data request. */
export const DATA_PARAM = "_rivet";
/** Data requests: comma-separated ids of the layouts whose data the client still has (loaders skipped). */
export const KEEP_PARAM = "_rivet_keep";
/** `_rivet_keep` entry naming the page's own loader (`invalidate(key)` of layout keys only: same URL). */
export const KEEP_PAGE = ".";
/**
 * `search` (`?a&b=c d`) without the router's own params (`_rivet`, `_rivet_keep`), every other byte
 * as sent: loaders see the page URL's query exactly, so their keys match on HTML and data requests.
 */
export function withoutRivet(search: string): string {
  if (!search.includes(DATA_PARAM)) return search;
  let out = "";
  for (const part of search.slice(1).split("&")) {
    const name = part.split("=", 1)[0];
    if (name !== DATA_PARAM && name !== KEEP_PARAM) out += (out ? "&" : "?") + part;
  }
  return out;
}
/** Dependency keys (`event.depends()`) per loader, route data order; undefined: none. Omitted when no loader called it. */
export type LoaderDeps = readonly (readonly string[] | undefined)[];
/**
 * Document head a route (or a component, with `@rivetjs/kit`) contributes. Merged by rank: inner
 * route levels win; within a level components win over the route's `head` export.
 */
export interface Head {
  title?: string;
  /** `"%s · Shop"`: applied once to the merged title; innermost wins. */
  titleTemplate?: string;
  /** `<html>` attributes (needs the kit head hold; merged per attribute). */
  html?: { lang?: string; dir?: "ltr" | "rtl" | "auto"; class?: string };
  body?: { class?: string };
  base?: { href: string; target?: string };
  meta?: readonly HeadMeta[];
  /** `<link>` tags; keyed per rel (one `canonical`; alternates by hreflang/type; others by href). */
  links?: readonly HeadLink[];
  scripts?: readonly HeadScript[];
  /** Inline `<style>` blocks (trusted CSS, request nonce; deduped by `key`, else by text). Never managed: client navigation keeps them. */
  styles?: readonly HeadStyle[];
}
/** An inline head `<style>` (component CSS such as `@rivetjs/motion` entrance rules). */
export interface HeadStyle {
  /** Trusted CSS text (a `</style` sequence is escaped). */
  css: string;
  /** Dedupe key (default: the CSS text). */
  key?: string;
  media?: string;
}
/** A head `<meta>`. */
export interface HeadMeta {
  name?: string;
  property?: string;
  httpEquiv?: string;
  itemprop?: string;
  content: string;
  /** e.g. `theme-color` per color scheme; part of the dedupe key. */
  media?: string;
  /** Explicit dedupe key. */
  key?: string;
}
/** A head `<link>`. */
export interface HeadLink {
  rel: string;
  href: string;
  type?: string;
  hreflang?: string;
  media?: string;
  sizes?: string;
  as?: string;
  crossorigin?: "anonymous" | "use-credentials";
  imagesrcset?: string;
  imagesizes?: string;
  fetchpriority?: "high" | "low" | "auto";
  title?: string;
  color?: string;
  integrity?: string;
  referrerpolicy?: string;
  key?: string;
}
/** When a script runs: in the head while parsing (`blocking`, `eager` = async, `defer`) or later from a tiny bootstrap. */
export type ScriptStrategy = "blocking" | "eager" | "defer" | "load" | "idle" | "interaction";
/** Static inline script code (see `inlineScript`); plain strings are refused. */
export interface InlineScript {
  readonly code: string;
}
/** A head script: external (`src`), inline code, or a JSON-LD data block. */
export type HeadScript =
  | {
      src: string;
      type?: "module" | "classic";
      /** Default `defer`. */
      strategy?: ScriptStrategy;
      id?: string;
      integrity?: string;
      crossorigin?: "anonymous" | "use-credentials";
      referrerpolicy?: string;
      key?: string;
    }
  | {
      inline: InlineScript;
      /** Position in the head (inline scripts always run while parsing). Default `defer`. */
      strategy?: "blocking" | "eager" | "defer";
      /** JSON the script reads from `document.currentScript.previousElementSibling`. */
      data?: unknown;
      id?: string;
      key?: string;
    }
  | { jsonLd: object; id?: string; key?: string };
/** Request collector of component head entries (`@rivetjs/kit`), provided through `ServerData`. */
export interface HeadSink {
  /** Record `head` for route level `level`; after the hold, returns the markup body-valid entries write in place. */
  push(level: number, head: Head, component?: string): string | undefined;
  /** CSP nonce of the response (inline scripts carry it). */
  readonly nonce: string | undefined;
}
/** An action's outcome (form POST `?/name`): its return value, or the data and status of `fail()`. */
export interface ActionResult {
  readonly name: string;
  readonly result: unknown;
  /** Set when the action failed (`fail(status, data)`): the response status; `result` is the data. */
  readonly status?: number;
}
/** The `error` member of a JSON answer: a request that failed (guard, action, loader, 404/405/413…). */
export interface AnswerError {
  readonly status: number;
  readonly message: string;
}
/**
 * The handler's JSON answer to an enhanced action POST (`?/name` with `accept: application/json`),
 * resume-format encoded (`encodeData`); `@rivetjs/forms` decodes it. Exactly one of `action`,
 * `redirect` or `error` is set.
 */
export interface ActionAnswer {
  /** The action ran: its return value, or the data and status of `fail()`. */
  readonly action?: ActionResult;
  /** Single flight (`x-rivet-revalidate` request header, status < 400): the page's re-run loader data, layouts outermost first. */
  readonly data?: readonly unknown[];
  /** Single flight: the route head for the fresh data (when the app has a `head` hook). */
  readonly head?: Head;
  /** Single flight: the loaders' `event.depends()` keys (absent when none called it). */
  readonly deps?: LoaderDeps;
  /** A redirect (guard, `redirect()` in the action, a request handler's 3xx) the client follows; `status` is its 3xx. */
  readonly redirect?: string;
  readonly status?: number;
  readonly error?: AnswerError;
}
/** The handler's JSON answer to a client-navigation data request (`?_rivet=data`), resume-format encoded. */
export interface DataAnswer {
  /** Loader results, layouts outermost first (`undefined` for the `keep` indices). */
  readonly data?: readonly unknown[];
  readonly status?: number;
  readonly head?: Head;
  /** Indices into `data` of kept layouts the server skipped (`_rivet_keep`). */
  readonly keep?: readonly number[];
  /** Indices of layouts whose loader read the URL. */
  readonly byURL?: readonly number[];
  readonly deps?: LoaderDeps;
  readonly redirect?: string;
  /** A guard or request handler answered with a non-redirect Response: load the document instead. */
  readonly reload?: true;
  readonly error?: AnswerError;
}
/** Loader results for one URL: layouts outermost first, then the page. */
export interface RoutePayload {
  readonly data: readonly unknown[];
  readonly head?: Head;
  /** Data requests: indices into `data` of layouts the server skipped (the client keeps their data). */
  readonly kept?: readonly number[];
  /** Data requests: indices of layouts whose loader read the URL (reloaded on every URL change). */
  readonly byURL?: readonly number[];
  /** Keys the loaders that ran passed to `event.depends()` (absent: none did). */
  readonly deps?: LoaderDeps;
}
