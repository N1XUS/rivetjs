// Server render input handed to routes through context, and the form action result read from it.
import { createContext, useContext, type Context } from "@rivetjs/reactivity";
import type { ActionResult, HeadSink, RoutePayload } from "../shared/data.ts";
import type { ActionName, ActionResultOf, RouteActions } from "../index.ts";

/** Server render input handed to routes through context (never serialized: no id). */
export interface ServerRoutePayload extends RoutePayload {
  readonly url: URL;
  /** Set when the handler failed the request (rendered by the route's error view). */
  readonly error?: { readonly status: number; readonly message: string };
  /** The form action the request performed (no-JS POST). */
  readonly action?: ActionResult;
  /** Server render with `@rivetjs/kit`: the request's component head collector. */
  readonly headSink?: HeadSink;
  /** Layouts whose loader read the URL: never kept by client navigation (unknown: none kept). */
  readonly byURL?: readonly number[];
  /** i18n: the request's locale (`locals.locale`); `locale()` from `@rivetjs/i18n` reads it on the server. */
  readonly locale?: string;
}
/** Context with the route data the server already loaded for this render. */
export const ServerData: Context<ServerRoutePayload | null> = createContext<ServerRoutePayload | null>(null);

/**
 * @internal The request locale of the server render (`locals.locale` of an i18n app, `createApp({ i18n })`), read in
 * component setup; undefined outside a server render. `locale()` from `@rivetjs/i18n` (server target) is built on it.
 */
export const _requestLocale = (): string | undefined => useContext(ServerData)?.locale;

let actionsRead: WeakMap<ServerRoutePayload, Set<string>> | undefined;
/**
 * The result of the form action this page was rendered after (a no-JS POST to `?/name`), when
 * `name` matches (any action when omitted). Call during component setup (server render; dev client
 * mount). In the browser each action result answers once, so later client renders start clean.
 */
export function actionResult(name?: string): ActionResult | undefined;
/**
 * Typed: `actionResult<"items/[id]">("save")` (route id, generated `RouteActions`) or
 * `actionResult<typeof forms>()` (`forms = actions(…)`). Pass the name as the second type argument to narrow the
 * result to that action (`actionResult<"items/[id]", "save">("save")`).
 */
export function actionResult<A extends (keyof RouteActions & string) | Record<string, unknown>, N extends ActionName<A> = ActionName<A>>(name?: N): ActionResultOf<A, N> | undefined;
export function actionResult(name?: string): ActionResult | undefined {
  const server = useContext(ServerData);
  const action = server?.action;
  if (!server || !action || (name !== undefined && action.name !== name)) return undefined;
  if (typeof document !== "undefined") {
    actionsRead ??= new WeakMap();
    let read = actionsRead.get(server);
    if (!read) actionsRead.set(server, (read = new Set()));
    if (read.has(action.name)) return undefined;
    read.add(action.name);
  }
  return action;
}
