// Ported from angular/components src/cdk/layout (MIT, © Google LLC): `Breakpoints`, `MediaMatcher`,
// `BreakpointObserver`, `BreakpointState`.
//
// Rivet: prefer CSS media / container queries — they need no JavaScript and no resume state. Use
// this module when a handler or a client effect must branch on a breakpoint. Services become
// factories (`createMediaMatcher`, `createBreakpointObserver`; `breakpointObserver()` is the shared
// one); RxJS `Observable<BreakpointState>` becomes a minimal observable with the same emission
// semantics (current state on subscribe, then debounced changes, completion on `destroy()`), and
// `breakpointState(value, …)` gives a signal for bindings. Server: no `matchMedia` → the noop
// matcher (only `all` / "" match), like Angular's non-browser platform; pass `initial` to choose the
// server-rendered state (mobile-first default: nothing matches).
import { signal, type Signal } from "@rivetjs/reactivity";
import { coerceArray } from "../coercion/index.ts";
import { getPlatform } from "../platform/index.ts";
import { getNonce } from "../utils/dom.ts";

/** Material Design breakpoints (media queries). PascalCase: used like an enum. */
export const Breakpoints = {
  XSmall: "(max-width: 599.98px)",
  Small: "(min-width: 600px) and (max-width: 959.98px)",
  Medium: "(min-width: 960px) and (max-width: 1279.98px)",
  Large: "(min-width: 1280px) and (max-width: 1919.98px)",
  XLarge: "(min-width: 1920px)",

  Handset: "(max-width: 599.98px) and (orientation: portrait), " + "(max-width: 959.98px) and (orientation: landscape)",
  Tablet:
    "(min-width: 600px) and (max-width: 839.98px) and (orientation: portrait), " + "(min-width: 960px) and (max-width: 1279.98px) and (orientation: landscape)",
  Web: "(min-width: 840px) and (orientation: portrait), " + "(min-width: 1280px) and (orientation: landscape)",

  HandsetPortrait: "(max-width: 599.98px) and (orientation: portrait)",
  TabletPortrait: "(min-width: 600px) and (max-width: 839.98px) and (orientation: portrait)",
  WebPortrait: "(min-width: 840px) and (orientation: portrait)",

  HandsetLandscape: "(max-width: 959.98px) and (orientation: landscape)",
  TabletLandscape: "(min-width: 960px) and (max-width: 1279.98px) and (orientation: landscape)",
  WebLandscape: "(min-width: 1280px) and (orientation: landscape)",
} as const;

/** The `MediaQueryList` surface the observer uses (`addListener` for older / fake lists). */
export interface MediaQueryListLike {
  readonly matches: boolean;
  readonly media: string;
  addListener?(listener: (event: { matches: boolean }) => void): void;
  removeListener?(listener: (event: { matches: boolean }) => void): void;
  addEventListener?(type: "change", listener: (event: { matches: boolean }) => void): void;
  removeEventListener?(type: "change", listener: (event: { matches: boolean }) => void): void;
}

/** Angular `MediaMatcher`: `matchMedia(query)`. */
export interface MediaMatcher {
  matchMedia(query: string): MediaQueryListLike;
}

// Global registry of injected empty `@media` rules (WebKit / Blink workaround).
const mediaQueriesForWebkitCompatibility = new Set<string>();
let mediaQueryStyleNode: HTMLStyleElement | undefined;

/**
 * An empty `@media` rule per query: WebKit only fires `matchMedia` listeners for queries with a rule;
 * Blink may stop firing when no rule matches an element (one rule targets `body`).
 */
function createEmptyStyleRule(query: string, nonce: string | undefined | null): void {
  if (mediaQueriesForWebkitCompatibility.has(query)) return;
  try {
    if (!mediaQueryStyleNode) {
      mediaQueryStyleNode = document.createElement("style");
      if (nonce) mediaQueryStyleNode.setAttribute("nonce", nonce);
      mediaQueryStyleNode.setAttribute("type", "text/css");
      document.head!.appendChild(mediaQueryStyleNode);
    }
    if (mediaQueryStyleNode.sheet) {
      // Curly braces dropped against injection: they are not valid media query syntax.
      mediaQueryStyleNode.sheet.insertRule(`@media ${query.replace(/[{}]/g, "")} {body{ }}`, 0);
      mediaQueriesForWebkitCompatibility.add(query);
    }
  } catch (e) {
    console.error(e);
  }
}

/** No-op `matchMedia` for non-browser platforms: only `all` and "" match. */
function noopMatchMedia(query: string): MediaQueryListLike {
  return { matches: query === "all" || query === "", media: query, addListener: () => {}, removeListener: () => {} };
}

/** A `MediaMatcher` (Angular service). `nonce`: CSP nonce for the workaround `<style>` (default: `getNonce()`). */
export function createMediaMatcher(options: { nonce?: string | null } = {}): MediaMatcher {
  const platform = getPlatform();
  const native = platform.isBrowser && typeof window !== "undefined" && window.matchMedia ? window.matchMedia.bind(window) : noopMatchMedia;
  return {
    matchMedia(query: string): MediaQueryListLike {
      if (platform.WEBKIT || platform.BLINK) createEmptyStyleRule(query, options.nonce === undefined ? getNonce() : options.nonce);
      return native(query);
    },
  };
}

/** The current state of a layout breakpoint. */
export interface BreakpointState {
  /** Whether any of the queries matches. */
  matches: boolean;
  /** Each query given to `observe`, with its current matched state. */
  breakpoints: { [key: string]: boolean };
}

/** Minimal observable (the RxJS subset `observe()` returns). */
export interface BreakpointObservable {
  subscribe(observer?: ((state: BreakpointState) => void) | { next?: (state: BreakpointState) => void; complete?: () => void }): { unsubscribe(): void };
}

/** Angular `BreakpointObserver`. */
export interface BreakpointObserver {
  /** Whether one or more media queries match now (comma-separated queries count separately). */
  isMatched(value: string | readonly string[]): boolean;
  /**
   * Results for `value` (one or more queries): the current state on subscribe, then one emission per
   * batch of changes (debounced to a macrotask, as `debounceTime(0)`).
   */
  observe(value: string | readonly string[]): BreakpointObservable;
  /** `ngOnDestroy`: completes every subscription and removes the media query listeners. */
  destroy(): void;
}

interface Query {
  mql: MediaQueryListLike;
  listeners: Set<() => void>;
  handler: (event: { matches: boolean }) => void;
}

/** Split comma-separated queries into separate queries (each gets its own `MediaQueryList`). */
function splitQueries(queries: readonly string[]): string[] {
  return queries.flatMap((query) => query.split(",")).map((query) => query.trim());
}

function listen(mql: MediaQueryListLike, handler: (event: { matches: boolean }) => void): void {
  if (mql.addEventListener) mql.addEventListener("change", handler);
  else mql.addListener?.(handler);
}
function unlisten(mql: MediaQueryListLike, handler: (event: { matches: boolean }) => void): void {
  if (mql.removeEventListener) mql.removeEventListener("change", handler);
  else mql.removeListener?.(handler);
}

/** A `BreakpointObserver` over `matcher` (default: a new `createMediaMatcher()`). */
export function createBreakpointObserver(matcher: MediaMatcher = createMediaMatcher()): BreakpointObserver {
  const queries = new Map<string, Query>();
  const completions = new Set<() => void>();
  let destroyed = false;

  const register = (query: string): Query => {
    let entry = queries.get(query);
    if (entry) return entry;
    const mql = matcher.matchMedia(query);
    const listeners = new Set<() => void>();
    const handler = () => {
      for (const listener of [...listeners]) listener();
    };
    queries.set(query, (entry = { mql, listeners, handler }));
    return entry;
  };

  return {
    isMatched(value) {
      return splitQueries(coerceArray(value)).some((query) => register(query).mql.matches);
    },
    observe(value) {
      const list = splitQueries(coerceArray(value));
      const entries = list.map(register);
      const state = (): BreakpointState => {
        const response: BreakpointState = { matches: false, breakpoints: {} };
        list.forEach((query, i) => {
          const matches = entries[i]!.mql.matches;
          response.matches = response.matches || matches;
          response.breakpoints[query] = matches;
        });
        return response;
      };
      return {
        subscribe(observer) {
          const next = typeof observer === "function" ? observer : observer?.next;
          const complete = typeof observer === "function" ? undefined : observer?.complete;
          if (destroyed) {
            complete?.();
            return { unsubscribe() {} };
          }
          let timer: ReturnType<typeof setTimeout> | undefined;
          let closed = false;
          const onChange = () => {
            if (closed || timer !== undefined) return;
            timer = setTimeout(() => {
              timer = undefined;
              if (!closed) next?.(state());
            }, 0);
          };
          for (const entry of entries) {
            if (!entry.listeners.size) listen(entry.mql, entry.handler);
            entry.listeners.add(onChange);
          }
          const unsubscribe = () => {
            if (closed) return;
            closed = true;
            clearTimeout(timer);
            completions.delete(finish);
            for (const entry of entries) {
              entry.listeners.delete(onChange);
              if (!entry.listeners.size) unlisten(entry.mql, entry.handler);
            }
          };
          const finish = () => {
            unsubscribe();
            complete?.();
          };
          completions.add(finish);
          next?.(state());
          return { unsubscribe };
        },
      };
    },
    destroy() {
      destroyed = true;
      for (const finish of [...completions]) finish();
    },
  };
}

let shared: BreakpointObserver | undefined;

/** The shared `BreakpointObserver` (Angular root service), created on first use. */
export function breakpointObserver(): BreakpointObserver {
  return (shared ??= createBreakpointObserver());
}

/**
 * Signal of the `BreakpointState` for `value`, for bindings. Server and before `connect()`: built from
 * `initial` (a boolean for every query, or per query; default false — mobile-first markup). Call
 * `connect()` in a client effect (`clientEffect(() => bp.connect())`): it reads the real state and
 * follows changes; it returns the disconnect function.
 */
export function breakpointState(
  value: string | readonly string[],
  options: { initial?: boolean | Record<string, boolean>; observer?: () => BreakpointObserver } = {},
): { state: Signal<BreakpointState>; connect(): () => void } {
  const list = splitQueries(coerceArray(value));
  const initial = options.initial ?? false;
  const breakpoints: Record<string, boolean> = {};
  for (const query of list) breakpoints[query] = typeof initial === "boolean" ? initial : !!initial[query];
  const state = signal<BreakpointState>({ matches: Object.values(breakpoints).some(Boolean), breakpoints });
  return {
    state,
    connect() {
      const subscription = (options.observer ?? breakpointObserver)()
        .observe(list)
        .subscribe((next) => state.set(next));
      return () => subscription.unsubscribe();
    },
  };
}
