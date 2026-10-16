// Route transitions + pending UI, loaded on the first navigation intent of apps built with
// `rivetRouter({ transitions })`. Wraps each route commit in a same-document View Transition when
// supported and enabled; drives the navigation signal and the pending attributes. No inline styles:
// transition names are CSSOM assignments, which a strict `style-src` does not block.
import { _afterSwap, _current, _transitions, settle, type NavigationInfo } from "./index.ts";
import { IDLE, navigation } from "./navigation.ts";
import { indicator, namedElements, sharedNames, transitionTypes } from "./transition-helpers.ts";
export { indicator, namedElements, sharedNames, transitionTypes, type RouteTransition } from "./transition-helpers.ts";

/** Options of route transitions: view transitions, reduced motion and the pending indicator. */
export interface TransitionOptions {
  /** `false`: pending UI only, instant swaps (default true). */
  viewTransitions?: boolean;
  /** `"skip"` (default): no view transition under `prefers-reduced-motion: reduce`; `"allow"`: CSS decides. */
  reducedMotion?: "skip" | "allow";
  /** Indicator timing (ms): `html[data-rivet-pending]` / `useNavigation().shown` after `delay`, kept ≥ `minDuration`. */
  pending?: { delay?: number; minDuration?: number };
}
/** `rivet:before-swap` detail: the navigation, whether it animates, and `defer(promise)` (awaited ≤ 500 ms). */
export interface BeforeSwapDetail extends NavigationInfo {
  readonly animate: boolean;
  defer(promise: PromiseLike<unknown>): void;
}

type ViewTransition = { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void>; skipTransition(): void };
type TransitionDocument = Document & { startViewTransition?(update: (() => void) | { update: () => void; types: string[] }): ViewTransition };

const ROUTES = "[data-rivet-routes]";
const PENDING = "data-rivet-pending";
let installed = false;
/** Install the hooks (idempotent); generated apps call it when this module loads. */
export function install(options: TransitionOptions = {}): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const doc = document as TransitionDocument, html = doc.documentElement;
  let anchor: HTMLAnchorElement | undefined, nav: NavigationInfo | null = null, running: ViewTransition | null = null;
  const state = (shown: boolean) =>
    nav ? { state: "loading" as const, location: nav.to, from: nav.from, type: nav.type, shown } : { ...IDLE };
  const timing = indicator(
    options.pending?.delay ?? 200,
    options.pending?.minDuration ?? 300,
    () => {
      html.setAttribute(PENDING, "");
      navigation.set(state(true));
    },
    () => {
      html.removeAttribute(PENDING);
      if (!nav) navigation.set(IDLE);
    },
  );
  // Clicked link: `data-rivet-pending` (+ `<Link pending>` classes) until the commit.
  const mark = (next: HTMLAnchorElement | undefined) => {
    if (anchor === next) return;
    if (anchor) {
      anchor.removeAttribute(PENDING);
      anchor.classList.remove(...classes(anchor));
    }
    anchor = next;
    if (anchor) {
      anchor.setAttribute(PENDING, "");
      anchor.classList.add(...classes(anchor));
    }
  };
  const start = (next: NavigationInfo) => {
    nav = next;
    running?.skipTransition();
    doc.querySelector(ROUTES)?.setAttribute("aria-busy", "true");
    mark(next.anchor);
    navigation.set(state(html.hasAttribute(PENDING)));
    timing.start();
  };
  const finish = () => {
    nav = null;
    doc.querySelector(ROUTES)?.removeAttribute("aria-busy");
    mark(undefined);
    timing.finish();
    // Held indicator: the state stays loading (shown) until it hides.
    if (!html.hasAttribute(PENDING)) navigation.set(IDLE);
  };
  const event = (type: string, detail: unknown, cancelable = false) => doc.dispatchEvent(new CustomEvent(type, { detail, cancelable }));

  _transitions.start = start;
  _transitions.swap = (apply, next, info) => {
    const types = transitionTypes(info);
    const reduced = options.reducedMotion !== "allow" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate =
      !!types && options.viewTransitions !== false && typeof doc.startViewTransition === "function" && !reduced && doc.visibilityState === "visible" && !info.visual;
    // Superseded (a newer navigation started): `apply` discards; leave that navigation's state alone.
    const current = () => nav === info || nav === null;
    const host = doc.querySelector<HTMLElement>(ROUTES);
    const named: HTMLElement[] = [];
    const name = (element: HTMLElement | null | undefined, value: string) => {
      if (!element) return;
      element.style.viewTransitionName = value;
      const group = element.getAttribute("data-vt-class");
      if (group && "viewTransitionClass" in element.style) (element.style as unknown as { viewTransitionClass: string }).viewTransitionClass = group;
      named.push(element);
    };
    let shared: string[] = [], incoming = new Map<string, HTMLElement | null>(), transition: ViewTransition | null = null;
    const update = () => {
      if (!current()) return apply();
      try {
        apply();
      } finally {
        for (const value of shared) name(incoming.get(value), value);
        settle(new URL(location.href));
        finish();
        _afterSwap();
        event("rivet:after-swap", info);
      }
    };
    const done = () => {
      if (running === transition) running = null;
      for (const element of named) {
        element.style.viewTransitionName = "";
        if ("viewTransitionClass" in element.style) (element.style as unknown as { viewTransitionClass: string }).viewTransitionClass = "";
      }
      if (host) host.style.viewTransitionName = "";
      html.removeAttribute("data-rivet-transition");
      if (current()) event("rivet:navigated", info);
    };
    const run = () => {
      if (!animate || !current()) {
        update();
        return done();
      }
      // Shared elements: names present once on both sides, assigned on the old DOM before the
      // snapshot and on the new DOM inside `update`. The routes region animates as `rivet-page`.
      incoming = namedElements(next);
      const outgoing = namedElements(host);
      shared = sharedNames(outgoing, incoming);
      for (const value of shared) name(outgoing.get(value), value);
      if (host) host.style.viewTransitionName = "rivet-page";
      html.setAttribute("data-rivet-transition", types!.join(" "));
      running?.skipTransition();
      try {
        transition = doc.startViewTransition!({ update, types: types! });
      } catch {
        // Before `types` (Chrome < 125): callback form; CSS keys off html[data-rivet-transition].
        transition = doc.startViewTransition!(update);
      }
      running = transition;
      // Skipped before it animates (a newer navigation started): `ready` rejects, nothing to report.
      transition.ready.catch(() => {});
      transition.updateCallbackDone.catch((error: unknown) =>
        queueMicrotask(() => {
          throw error;
        }),
      );
      transition.finished.then(done, done);
    };
    const deferred: PromiseLike<unknown>[] = [];
    event("rivet:before-swap", { ...info, animate, defer: (promise: PromiseLike<unknown>) => void deferred.push(promise) } satisfies BeforeSwapDetail);
    if (!deferred.length) return run();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    void Promise.race([Promise.allSettled(deferred), new Promise((resolve) => (timeout = setTimeout(resolve, 500)))]).then(() => {
      clearTimeout(timeout);
      run();
    });
  };
  // A navigation already in flight when this module arrived (first click before any intent).
  const pending = _current();
  if (pending) start(pending);
}

function classes(anchor: HTMLAnchorElement): string[] {
  return (anchor.getAttribute("data-rivet-pending-class") ?? "").split(/\s+/).filter(Boolean);
}
