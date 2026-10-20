import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import type { HttpError as HttpErrorType } from "./shared/errors.ts";
import type { ActionFailure } from "./shared/actions.ts";
import type { SERVER_EXPORT } from "./shared/server-exports.ts";

// Route-module API: server export wrappers, control-flow helpers and types for guards, loaders and actions.
export { load, guard, actions, entries, headers, onRequest, onGet, onPost, onPut, onPatch, onDelete, onOptions } from "./shared/server-exports.ts";
export type { ServerExport, ServerKind } from "./shared/server-exports.ts";
export { HttpError, redirect, deny, notFound, error, isHttpError, type RedirectOptions } from "./shared/errors.ts";
export { safeRedirect } from "./shared/redirect.ts";
export { parseCookies } from "./shared/cookie.ts";
export { slashPath, TRAILING_SLASH, type TrailingSlash } from "./shared/slash.ts";
export { BASE, withBase } from "./shared/base.ts";
export { ActionFailure, fail, isActionFailure } from "./shared/actions.ts";
export type { RequestEvent, ServerModule, Cookies, CookieOptions, ActionResult, Platform } from "./server/handler.ts";
export type { Head, HeadLink, HeadMeta, HeadScript, HeadSink, HeadStyle, InlineScript, ScriptStrategy } from "./shared/data.ts";
export type { ActionAnswer, AnswerError, DataAnswer } from "./shared/data.ts";

/** Route id → params. Augmented by the generated `.rivet/routes.d.ts`. */
export interface RouteParams {}
/** Route id → loader data (routes with a loader). Augmented by the generated `.rivet/routes.d.ts`. */
export interface RouteData {}
/** Route id → its `actions(…)` object type (routes with server code). Augmented by `.rivet/routes.d.ts`. */
export interface RouteActions {}
/** Layout id (`_layout`, `items/_layout`) → the params it receives. Augmented by `.rivet/routes.d.ts`. */
export interface LayoutParams {}
/** Layout id → loader data (layouts with a loader). Augmented by `.rivet/routes.d.ts`. */
export interface LayoutData {}
/** Ids of the app's file routes (e.g. `blog/[slug]`). */
export type RouteId = keyof RouteParams & string;
/** Ids of the app's `_layout` modules: the file path without extension (`_layout`, `(shop)/_layout`). */
export type LayoutId = keyof LayoutParams & string;
/** Augmented by the generated `.rivet/routes.d.ts`: `path` is the union of the app's page URL shapes. */
export interface RouteRegistry {}
/**
 * URL paths of the app's pages: params and splats are `${string}` (`"/" | \`/items/${string}\``).
 * Plain `string` until codegen ran (no `.rivet/routes.d.ts` in the program).
 */
export type RoutePath = RouteRegistry extends { path: infer P extends string } ? P : string;
/** A page path with optional query and hash: `<Link to>`. */
export type LinkHref = RoutePath | `${RoutePath}?${string}` | `${RoutePath}#${string}`;

declare const unchecked: unique symbol;
/** `PageProps<Unchecked<typeof loader>>`: loader data without the serializability check. */
export interface Unchecked<T> {
  readonly [unchecked]: T;
}
/** Loader data the page receives must survive the resume encoder: no functions, symbols or class instances. */
export interface NotSerializable<T> {
  "rivet: loader data must be serializable (plain objects, arrays, primitives, Date, URL, URLSearchParams, RegExp, Map, Set, typed arrays, ArrayBuffer, DataView, Error — no functions, symbols or class instances); opt out with PageProps<Unchecked<typeof loader>>": T;
}
// Mirrors the resume encoder (runtime/resume-format.ts `createEncoder`): leaves it writes directly. Kept in
// sync by tests/data-of.test.ts (each sample's type verdict = the encoder's verdict).
// Binary views (typed arrays, DataView) are leaves too: the encoder writes their bytes (`{b}`).
type Leaf = string | number | boolean | bigint | null | undefined | Date | URL | URLSearchParams | RegExp | ArrayBuffer | ArrayBufferView;
type Depth = [never, 0, 1, 2, 3, 4, 5, 6, 7];
// Error instances (the encoder's `{E}`) are structurally `{ name, message, stack? }`: the `stack` key tells
// them apart from plain `{ name, message }` data, which is checked key by key.
type IsError<T> = T extends Error ? ("stack" extends keyof T ? true : false) : false;
type Serializable<T, D extends number = 8> = [D] extends [never]
  ? true
  : T extends Leaf
    ? true
    : T extends symbol | ((...args: never[]) => unknown)
      ? false
      : IsError<T> extends true
        ? true
        : T extends ReadonlyMap<infer K, infer V>
          ? Serializable<K, Depth[D]> extends true
            ? Serializable<V, Depth[D]>
            : false
          : T extends ReadonlySet<infer V>
            ? Serializable<V, Depth[D]>
            : T extends readonly (infer E)[]
              ? Serializable<E, Depth[D]>
              : T extends object
                ? false extends { [K in keyof T]-?: Serializable<T[K], Depth[D]> }[keyof T]
                  ? false
                  : true
                : true;
type Returned<L> = L extends (...args: never[]) => infer R ? Awaited<R> : L;
/**
 * Data type of a loader (`DataOf<typeof loader>`, `loader = load(…)`), checked to be serializable; plain data types
 * pass through unchanged (`DataOf<Item[]>` is `Item[]`).
 */
export type DataOf<T> =
  T extends Unchecked<infer L>
    ? Returned<L>
    : T extends (...args: never[]) => unknown
      ? Serializable<Returned<T>> extends true
        ? Returned<T>
        : NotSerializable<Returned<T>>
      : T;
/** The export of module type `M` tagged as server export kind `K` (by tag, any name); `never` without. */
type Tagged<M, K> = { [N in keyof M]: M[N] extends { readonly [SERVER_EXPORT]: K } ? M[N] : never }[keyof M];
/** Loader data of a route module (`typeof import("./page")`): its `load(…)` export, any name; `unknown` without. */
export type ModuleData<M> = [Tagged<M, "load">] extends [never] ? unknown : DataOf<Tagged<M, "load">>;
/** Form actions of a route module: its `actions(…)` export, any name; `{}` without. */
export type ModuleActions<M> = [Tagged<M, "actions">] extends [never] ? {} : Tagged<M, "actions">;

/** A string that is not an id of `RouteParams` / `LayoutParams`: `data` and `params` are unusable. */
export interface UnknownRoute<Id> {
  "rivet: not a route or layout id of this app (see .rivet/routes.d.ts)": Id;
}
// Literal strings select a generated route; other types are the data type or loader (`DataOf`).
type IsLiteral<D> = D extends string ? (string extends D ? false : true) : false;
type PageData<D> = D extends RouteId ? (D extends keyof RouteData ? RouteData[D] : undefined) : IsLiteral<D> extends true ? UnknownRoute<D> : DataOf<D>;
type PageParams<D, P> = D extends RouteId ? RouteParams[D] : IsLiteral<D> extends true ? UnknownRoute<D> : P;
type LayoutDataOf<D> = D extends LayoutId ? (D extends keyof LayoutData ? LayoutData[D] : undefined) : IsLiteral<D> extends true ? UnknownRoute<D> : DataOf<D>;
type LayoutParamsOf<D, P> = D extends LayoutId ? LayoutParams[D] : IsLiteral<D> extends true ? UnknownRoute<D> : P;

/**
 * Props every page component receives (layouts: `LayoutProps`). `D` is a route id (generated
 * types: `PageProps<"items/[id]">` types data, params), the loader (`PageProps<typeof loader>`
 * infers the data) or the data type.
 */
export interface PageProps<D = unknown, P extends Record<string, string> = Record<string, string>> {
  data: PageData<D>;
  params: Readonly<PageParams<D, P>>;
  url: URL;
}
/**
 * Props of a live page (`export const live = true`): `data` is an accessor. Same-URL revalidation (an
 * enhanced form submit, `invalidate()`) updates it in place — the page is not re-rendered, so its
 * local state (an open drawer, typed input, focus) survives. `D` as in `PageProps`.
 */
export interface LivePageProps<D = unknown, P extends Record<string, string> = Record<string, string>> {
  data: () => PageData<D>;
  params: Readonly<PageParams<D, P>>;
  url: URL;
}
/**
 * Props of a `_layout.tsx` component. Accessors: the root layout stays mounted across navigations.
 * `D` is a layout id (`LayoutProps<"items/_layout">`), the loader or the data type.
 */
export interface LayoutProps<D = unknown, P = {}> {
  data: () => LayoutDataOf<D>;
  params: () => Readonly<LayoutParamsOf<D, P>>;
  url: () => URL;
  children?: JSX.Element;
}

type Outcome<R> = R extends HttpErrorType | Response
  ? never
  : R extends ActionFailure<infer F>
    ? { readonly result: F; readonly status: number }
    : { readonly result: R; readonly status?: undefined };
type ActionsOf<A> = A extends RouteId ? (A extends keyof RouteActions ? RouteActions[A] : {}) : A;
/** Action names of a route id (`RouteActions`) or an actions object type (`typeof forms`, `forms = actions(…)`). */
export type ActionName<A> = keyof ActionsOf<A> & string;
/**
 * Typed `actionResult()`: per action name its return value (`redirect()`/`Response` excluded), or
 * the data and status of `fail()`. `A` is a route id or `typeof forms` (`forms = actions(…)`).
 */
export type ActionResultOf<A, N extends ActionName<A> = ActionName<A>> = {
  [K in N]: { readonly name: K } & Outcome<Awaited<ActionsOf<A>[K] extends (...args: never[]) => infer R ? R : never>>;
}[N];
