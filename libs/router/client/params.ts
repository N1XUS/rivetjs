// Route params and search params accessors for components under file routes. Both are signals, so a
// resumed binding that reads them revives without running component code:
// - params: each page render provides `signal(match.params)` (the page re-renders on every
//   navigation, so the signal of a mounted page never changes; its value resumes with the page);
//   persisted nested layouts get their App-level params signal (updated in place);
// - search: an identified context (the server provides the request's, resumed regions revive to
//   the browser signal that route commits update), also live in the root layout.
import { createContext, signal, useContext, type Context, type Signal } from "@rivetjs/reactivity";
import type { RouteId, RouteParams } from "../index.ts";
import { SearchParams } from "./search.ts";

const none: Signal<Readonly<Record<string, string>>> = signal(Object.freeze({}));
/** @internal Route params of the rendered route (generated apps provide it per route render). */
export const RouteParamsContext: Context<() => Readonly<Record<string, string>>> = createContext<() => Readonly<Record<string, string>>>(none);

/**
 * The current route's params: `const params = useParams<"items/[id]">(); params().id`. Call during
 * component setup. Pages re-render per navigation, so their value is that page's; nested layouts
 * stay mounted and see the current route's params; the root layout (outside the routes) sees `{}`.
 */
export function useParams<R extends RouteId = never>(): () => Readonly<[R] extends [never] ? Record<string, string> : RouteParams[R]> {
  return useContext(RouteParamsContext) as () => Readonly<[R] extends [never] ? Record<string, string> : RouteParams[R]>;
}

/**
 * The current URL's search params, updated when a navigation commits (also in the root layout and
 * resumed regions): `const search = useSearchParams(); search().get("q")`. Call during component setup.
 * Treat the value as read-only; change it with `setSearchParams`.
 */
export function useSearchParams(): () => URLSearchParams {
  return useContext(SearchParams);
}
