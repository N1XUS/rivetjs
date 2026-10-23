// Search params state (`useSearchParams()`), in its own module so apps that never read search params
// ship none of it: the router client syncs the signal only through the `_searchSync` hook set below.
import { createContext, signal, type Context, type Signal } from "@rivetjs/reactivity";
import { _searchSync } from "./navigation.ts";

// The shown page's search (`_searchSync.shown`, set per route commit): this module may load mid-navigation.
let shown = _searchSync.shown ?? (typeof location === "undefined" ? "" : location.search);
/** Browser search params of the shown page (route commits update it; a fresh object per change). */
export const searchParams: Signal<URLSearchParams> = signal(new URLSearchParams(shown));
/** Search params context (`useSearchParams()`): the server entry provides the request's; in the browser its default is `searchParams`. */
export const SearchParams: Context<() => URLSearchParams> = createContext<() => URLSearchParams>(searchParams);
_searchSync.search = () => {
  if (_searchSync.shown !== shown) searchParams.set(new URLSearchParams((shown = _searchSync.shown!)));
};
