// The app router, reached without importing `@rivetjs/router/client`: the generated App of an app using forms
// installs the router under `Symbol.for("rivet.router")` from its handlers (`clear` + `go`, router `_brand`) and says
// so once (`rivet:router` on the document), so forms chunks share no router code with the App and a page without a
// router ships none. Before that: ask the App (`rivet:go`; on a resumed page again when the runtime attaches its
// listeners, `rivet:attach`, booting it first) and wait for `rivet:router`, at most WAIT ms. No router on the page or
// no answer in time: document navigation — a full GET of the target (client state such as other fields is lost).
import type { FreshData } from "@rivetjs/router/client";

/** @internal What `@rivetjs/router/client` installs under `Symbol.for("rivet.router")` (router `_brand`). */
interface RouterBrand {
  /** Drop warmed route data (`_clearPrefetch`). */
  clear(): void;
  /** Navigate to `url`, or with `invalidate` re-run the shown page's loaders (`fresh`: from this data). */
  go(url: URL, invalidate?: true | FreshData): Promise<void>;
}
type Loader = { b?(): void; r?(): unknown };
// How long a submit waits for the router to boot before loading the document.
const WAIT = 10_000;

const brand = (): RouterBrand | undefined => (globalThis as Record<symbol, RouterBrand | undefined>)[Symbol.for("rivet.router")];

/** Drop the router's warmed route data (none before a router handler ran). */
export const clearPrefetch = (): void => brand()?.clear();

/** The App's `go`, or `undefined` when the page has no router serving requests (or it did not answer in time). */
function router(): Promise<RouterBrand["go"] | undefined> {
  const d = document,
    ready = () => brand()?.go,
    ask = () => d.dispatchEvent(new CustomEvent("rivet:go"));
  if (ready() || !d.querySelector("[data-rivet-go]")) return Promise.resolve(ready());
  // A listening App with its chunk loaded (client-rendered, or booted) answers at once.
  ask();
  const loader = (d as Document & { $r?: Loader }).$r;
  if (ready() || !loader) return Promise.resolve(ready());
  return new Promise((resolve) => {
    const done = () => (clearTimeout(timer), d.removeEventListener("rivet:router", done), d.removeEventListener("rivet:attach", ask), resolve(ready()));
    const timer = setTimeout(done, WAIT);
    d.addEventListener("rivet:router", done);
    d.addEventListener("rivet:attach", ask);
    if (!loader.r?.()) loader.b?.();
  });
}

const never = () => new Promise<void>(() => {});

/**
 * Navigate like a link click (router `navigate()`); another origin, no router or no answer in time: a document load
 * (never settles). Non-HTTP(S) URLs reject.
 */
export async function navigate(url: URL): Promise<void> {
  if (!/^https?:$/.test(url.protocol)) throw new TypeError("Cannot follow a non-HTTP(S) redirect: " + url.protocol);
  const go = url.origin === location.origin ? await router() : undefined;
  if (go) return go(url);
  location.assign(url.href);
  return never();
}

/** Fresh route data for the shown page (router `invalidate()`); no router: a document reload (never settles). */
export async function invalidate(fresh?: FreshData): Promise<void> {
  const go = await router();
  if (go) return go(new URL(location.href), fresh?.data ? fresh : true);
  location.reload();
  return never();
}
