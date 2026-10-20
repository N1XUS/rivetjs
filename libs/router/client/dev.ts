// Development façade of `@rivetjs/router/client` (`development` export condition: Vite dev, never a
// production build). Same exports; with a devtools hook installed it names the router's contexts and
// reports a `lib.router` describer: the shown route (pattern, params, loader data per layout), the
// layout chain, the navigation in flight and recent navigations. Generated apps import `routeData`,
// `_layouts` and `_landed` from this entry, so the wrappers below see every route load.
import { untrack } from "@rivetjs/reactivity";
import { devtoolsHook } from "@rivetjs/reactivity/debug";
import * as client from "./index.ts";
import type { LayoutTable, Layouts, RoutePayload } from "./index.ts";
export * from "./index.ts";

/** What the DevTools Router pane shows (plain data; values are previewed by the agent). */
export interface RouterSnapshot {
  route: { pattern: string; url: string; params: Readonly<Record<string, string>> } | null;
  /** Loader data along the chain: layout ids, then `page`. */
  data: { id: string; value: unknown }[];
  layouts: string[];
  pending: { to: string; type: string; trigger: string; ms: number; state: string } | null;
  last: RouterNavigation | null;
  history: RouterNavigation[];
  loadMs: number | null;
  error: string | null;
}
export interface RouterNavigation {
  from: string | null;
  to: string;
  type: string;
  trigger: string;
  /** Start to commit (ms). */
  ms: number | null;
  at: number;
}

// A failed client navigation (`_recover`, index.ts) loads its document after Vite's error overlay showed the error: once
// the overlay closes, or at once when none opens within 1.5 s (overlay off, error not reported).
client._recover.defer = (load) => {
  const open = () => document.querySelector("vite-error-overlay");
  const until = Date.now() + 1500;
  const wait = (): void => {
    if (open()) {
      const watch = new MutationObserver(() => open() || (watch.disconnect(), load()));
      watch.observe(document.documentElement, { childList: true, subtree: true });
    } else if (Date.now() > until) load();
    else setTimeout(wait, 100);
  };
  wait();
};

const hook = devtoolsHook();
let table: LayoutTable | null = null;
let shown: { pattern: string; url: string; params: Readonly<Record<string, string>>; data: readonly unknown[]; ms: number; error: string | null } | null = null;
let pending: (RouterNavigation & { start: number }) | null = null;
const history: RouterNavigation[] = [];
const changed = () => hook?.emit("lib.changed", { lib: "router" });
const now = () => performance.now();

function snapshot(): RouterSnapshot {
  const layouts = shown && table ? (table.routes.find(([pattern]) => pattern === shown!.pattern)?.[1] ?? []).map((i) => table!.ids[i]!) : [];
  const data = shown ? shown.data.map((value, i) => ({ id: i < layouts.length ? layouts[i]! : i === shown!.data.length - 1 ? "page" : "#" + i, value })) : [];
  const state = untrack(client.navigation);
  return {
    route: shown ? { pattern: shown.pattern, url: shown.url, params: shown.params } : null,
    data,
    layouts,
    pending: pending ? { to: pending.to, type: pending.type, trigger: pending.trigger, ms: now() - pending.start, state: state.state } : state.state !== "idle" && state.location ? { to: state.location.href, type: state.type ?? "push", trigger: "api", ms: 0, state: state.state } : null,
    last: history.at(-1) ?? null,
    history: history.slice(-10).reverse(),
    loadMs: shown?.ms ?? null,
    error: shown?.error ?? null,
  };
}

if (hook !== undefined) {
  for (const [token, name] of [
    [client.Navigation, "Navigation"],
    [client.SearchParams, "SearchParams"],
    [client.RouteParamsContext, "RouteParams"],
    [client.ServerData, "ServerData"],
  ] as const)
    hook.emit("name", { value: token, name });
  hook.emit("lib.register", { lib: "router", describe: snapshot });
  client.onNavigate((nav) => {
    pending = { from: nav.from?.href ?? null, to: nav.to.href, type: nav.type, trigger: nav.trigger, ms: null, at: Date.now(), start: now() };
    changed();
    return () => {
      if (!pending) return;
      const { start, ...done } = pending;
      history.push({ ...done, ms: now() - start });
      if (history.length > 50) history.shift();
      pending = null;
      changed();
    };
  });
}

/** `routeData`, recording the loaded route (pattern, params, loader data, time) for DevTools. */
export function routeData(...args: Parameters<typeof client.routeData>): Promise<RoutePayload> {
  const loaded = client.routeData(...args);
  if (hook === undefined) return loaded;
  const [, match] = args, start = now();
  const route = match as { url: URL; params?: Readonly<Record<string, string>>; route?: { path?: string } };
  const record = (data: readonly unknown[], error: string | null) => {
    shown = { pattern: route.route?.path ?? route.url.pathname, url: route.url.href, params: route.params ?? {}, data, ms: now() - start, error };
    changed();
  };
  loaded.then(
    (result) => record(result.data, null),
    (error: unknown) => record([], error instanceof Error ? error.message : String(error)),
  );
  return loaded;
}
/** `_layouts`, keeping the generated layout table (layout ids for the chain). */
export function _layouts(...args: Parameters<typeof client._layouts>): Layouts {
  table = args[2];
  return client._layouts(...args);
}
