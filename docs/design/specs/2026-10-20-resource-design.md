# `resource()` — async data as a signal (2026-10-20)

- Status: **implemented** (lane RESOURCE; compiler recipes for every `const` form: lane RESOURCE-COMPILER, `libs/compiler/rust/src/resume/resources.rs`). Code: `libs/runtime/resource.ts`, `dom-resource.ts`, `server-resource.ts`, `server-resource-slot.ts`; slots in `server-suspense.ts` (`_onBuild`) and `server-resume.ts` (`_onResource`). User docs: `apps/docs/content/guides/components/async.md` "Data as a signal: resource". Resume rule: `docs/guides/resumability.md` (table row `resource`).
- Analogues: Solid `createResource`, Qwik `useResource$`.

## 1. Problem

- `Async` renders a result in one place: a JSX child function. Data needed by several parts, by handlers or computeds, or refetched / mutated in place, had no primitive.
- Users wrote `signal` + `effect` + `fetch` by hand: no abort, stale answers win races, no Suspense / transition, nothing on the server, nothing resumed.
- Goal: one owner-bound primitive that reuses the `Async` machinery (one coordinator, one Suspense mechanism), loads once on the server, resumes the value, costs 0 B when unused.

## 2. API

```ts
import { resource } from "@rivetjs/runtime/dom"; // server builds rewrite to /server

resource<T>(fetcher: (source: true, info: ResourceInfo<T>) => T | PromiseLike<T>, options?: ResourceOptions<T>): Resource<T>;
resource<T, S>(source: ResourceSource<S>, fetcher: (source: S, info: ResourceInfo<T>) => T | PromiseLike<T>, options?: ResourceOptions<T>): Resource<T>;

type ResourceSource<S> = S | false | null | undefined | (() => S | false | null | undefined); // falsy = no fetch
interface ResourceInfo<T> extends AsyncWork { value: T | undefined; refetching: unknown } // signal, get, run
interface ResourceOptions<T> { initialValue?: T; ssr?: boolean }
interface Resource<T> {
  (): T | undefined;        // tracked; throws the error while errored
  loading(): boolean;       // pending | refreshing
  error(): unknown;         // never throws
  latest(): T | undefined;  // last resolved value; never throws
  state(): "unresolved" | "pending" | "ready" | "refreshing" | "errored";
  refetch(info?: unknown): void;
  mutate(value: T | ((previous: T | undefined) => T)): T;
}
```

- Exported from `@rivetjs/runtime/dom` (+ `/server` twin), not a new subpath: the compiler rewrites `/dom` → `/server` for the server target; a separate subpath would need export conditions. Tree-shaking keeps it pay-per-use (§6).

## 3. Semantics vs Solid `createResource`

| Aspect | Solid | Rivet | Why |
| --- | --- | --- | --- |
| Shape | tuple `[data, { mutate, refetch }]` | one callable handle, methods on it | one `const` = one compiler recipe (resumable); `user.loading()` is a call, so compiled bindings track it |
| `loading` / `error` / `latest` / `state` | properties on `data` | methods | a property read compiles to a static server value; a call becomes a `_rBind` binding |
| Start | eager at creation | lazy: first read / method / `refetch` (DOM); eager on the server | unused resources never fetch in the browser; server needs the value before HTML |
| Falsy source | `false` / `null` / `undefined` skip | same | — |
| Fetcher info | `{ value, refetching }` | `Async` work (`signal`, `get`, `run`) + `value` + `refetching` | abort + context after `await`, like `Async` |
| Source change | new fetch; old answer ignored | new fetch; old one **aborted** (`info.signal`) and dropped (generation counter) | — |
| Read while errored | throws | throws (ErrorBoundary); `error()` / `latest()` never throw | — |
| Suspense | read-site: any read under a Suspense registers | DOM: creation-site, as an `Async` created where the resource is (async-coordinator, no second mechanism); server: read-site inside Suspense content (§4) | brief: Suspense through `async-coordinator.ts` only. Ruling 2026-10-20: document it (create the resource inside the Suspense) |
| Transitions | `startTransition` keeps old value | same (coordinator held output while a value exists) | — |
| `mutate` | set value | set value; status `ready` (or `refreshing` if a load is in flight; it still lands) | — |
| `refetch` on the server | runs | no-op | one fetch per render |
| `initialValue` | starts `ready` | same | — |
| SSR opt-out | `ssrLoadFrom: "initial"` | `ssr: false` | simpler name; browser loads at resume |
| Owner | disposed with owner | same; disposal aborts the load in flight | — |

## 4. Server, resume, Suspense

- Server load: at creation (source read untracked), unless falsy source / `ssr: false`. Owner cleanup aborts.
- Suspense waits (`server-suspense.ts` `_onBuild` slot, installed by `server-resource.ts`): Suspense content built in `createRoot(provide(BUILDS, builds, content))`. A read of a pending resource pushes its promise. If any were pushed: dispose the build, cut the resume records written since the mark (`mark` / `cut` hooks: recorder lengths + site `shows` / `adopts` / `locals` / `nested` / `rows` / `plans`), return `Async({ load: Promise.all(wait), children: rebuild })`. Sibling resources = one rebuild; dependent chains = one rebuild per level.
- Rebuild reuse: resources are matched by creation index inside a build list; a hit returns a **new function over the same state** with the updated source closure, so each build's recipe captures are its own (fixes stale captures for resources created inside the content). Nested Suspense build lists are cached in the outer list. An error thrown while reads were pending triggers a rebuild, not a failure.
- Streaming: no extra code — the rebuild is an `Async`, so a streaming render sends the fallback first and a `<template data-a>` segment with the values (`tests/resource-resume.test.ts`).
- Pending read outside Suspense / `ssr: false`: renders the loading state; marks the reading region `clientOnly(…, { when: "load" })` (re-created at load); DEV warns once.
- Encoding: a server-resume `fnSpecial` hook encodes a resource function as `{k:"bind", a:[alias, undefined, seed]}`. `alias` = stand-in function holding the resource `const`'s recipe meta (`_rFn`). Seed `{n: version signal, s: state code, v? / e?, k?: source key, x?: 1}`; a non-data value / error ships `x: 1` (browser loads on first use; DEV warns).
- Browser: the existing `bind` custom kind does `R.bind(undefined, seed)`; the first call with an object adopts the seed (takes over the version signal, so server bindings re-run on change; skips the first load for the same key). Methods survive `bind` (shared prototype). No decoder change.
- Resumable form (RESOURCE-COMPILER): any captured `const r = resource(…)` in a component, whatever its arguments — the compiler makes it an Fn recipe (`resume.rs` `fn_closure` → `resume/resources.rs` `resource_call`; `resource` imported from `@rivetjs/runtime/dom` / `/server`, aliases included): inline arrows, module functions / imports by name (`_rMod` references), local `const` fetchers (own Fn sites), `initialValue` from captured data, `ssr: false`, resources in `For` rows / `Show` branches, handler-only reads. Not resumable, compiler warning RV2016 (resume mode, render code): destructuring (`const { m } =`: methods lose their handle; `const [d] =`: not iterable), `let` / `var`, a call that is not a `const` initializer (JSX attribute, object value, argument, returned value), a `const` inside a hook (named lowercase outermost function). Rendering one resumably throws `resource is not resumable here (compiler warning RV2016)` once a site captures it. No hoisting of those forms into a synthetic `const` (rejected: changes evaluation order and creates once per render where the source wrote per use).
- DOM: `refetch` as a resumed resource's first use is a refetch load (clears the adopted skip, writes the counter); before RESOURCE-COMPILER it loaded nothing.
- Lazy rows (`RIVET_LAZY_ROWS=on`): a `For` over a resource's value inside the Suspense writes one `L` entry; items share the seed's table entry (server-tested; browser materialisation untested).

## 5. DOM

- One load = one generation: `createRoot` + `AbortController` + counter; superseded / disposed generations drop their answers.
- Source effect under the creation owner, started at first use. Sync fetcher results commit without a coordinator.
- Coordinator: `coordinator({ load, children: none, error: none }, () => value === undefined ? undefined : HELD)` → `p.load(info)`, commit via `p.swap`. No coordinator installed (no Suspense / transition imported) → plain promise.

## 6. Zero-cost

- Nothing runs at import; `sideEffects: false`. Gate `libs/runtime/tests/resource-treeshake.test.ts`: `Async` / `Suspense` / transitions bundle none of `resource.ts`, `dom-resource.ts`, `server-resource.ts`, `server-resource-slot.ts`; `resource` on `/server` bundles no server-resume; server-resume carries the hooks only when `resource` is bundled (the `_onResource` call is dead code without a reader).
- Zero-cost hashes: `/dom`, `/server` entry hashes grow (the hash bundles every export); `/server-resume`, packages, client lanes unchanged.
- Bytes (rolldown, min / br): DOM `Async` 13311 / 4659 → `Async` + `resource` 15397 / 5470 (+2086 / +811); DOM `resource` alone 9181 / 3441; server `Suspense` 3427 / 1385 → + `resource` 12474 / 4605.

## 7. Tasks (done)

1. Shared module `resource.ts` (types, prototype, state codes, `_sameKey`).
2. DOM `dom-resource.ts` + coordinator integration.
3. Server `server-resource.ts`, `_onBuild` slot, `server-resource-slot.ts` hooks, encode.
4. Tests: happy-dom + server suites, Chromium resume + streaming + clientOnly-in-rebuild + lazy rows, tree-shake.
5. Docs: async / suspense / coming-from / resumability / api.json / AGENTS starter line.
6. Compiler (RESOURCE-COMPILER): recipe for every captured resource `const`, RV2016 for the rest; tests `libs/compiler/tests/resume-resource.test.ts`, runtime `tests/resource-resume.test.ts` "forms".

## 8. Open

- Language-core quick fix for RV2016 (`const { refetch } = resource(…)` → `const r = resource(…)` + `r.refetch()`): not done; the explain entry gives the mechanical fix.
- Resources returned from hooks (`const user = useUser(id)`) resume only if the hook's call becomes a recipe (cross-function analysis): not done, RV2016 warns at the hook.
- DOM read-site Suspense (Solid parity) would need a second registration path; rejected for now.
- Derived model (`model: "derived"`) untested with `resource`.
- Lazy rows browser materialisation over resource data untested.
