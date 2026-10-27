---
title: Async
description: Load data in a component with Async or resource, show a fallback and an error, cancel stale work, and load components on demand with lazyComponent.
template: guide
related: [guides/routing/loading-data, guides/performance/streaming, gotchas/promise-child-needs-async]
---

Some parts of a page need data that takes time to arrive. The `Async` component wraps such a part: it starts the work, shows a fallback while it waits, shows an error if it fails, and renders the result. After reading this page you can use `Async`, reload it when a signal changes, keep loaded data in a `resource`, and load components only when they are needed.

:::tip
For the main data of a page, use a route [loader](/guides/routing/loading-data.md). It runs on the server before the page renders. Use `Async` for parts of a page that load on their own. A [deferred loader](/guides/routing/loading-data.md#deferred-loaders) is both: a server loader whose data an `Async` streams in.
:::

::example{id=async-data}

## Load data

Import `Async` from `@rivetjs/runtime/dom`. Give it a `load` function and a child function that renders the result:

```tsx
import { Async } from "@rivetjs/runtime/dom";

export function Weather({ city }: { city: string }) {
  return (
    <Async
      load={(work) => fetch(`/api/weather?city=${encodeURIComponent(city)}`, { signal: work.signal }).then((res) => res.json())}
      fallback={() => <p>Loading the weather…</p>}
      error={() => <p>Could not load the weather.</p>}
    >
      {(weather: { summary: string }) => <p>{weather.summary}</p>}
    </Async>
  );
}
```

| Prop | What it does |
| --- | --- |
| `load(work)` | Starts the work. Returns a value or a promise. |
| children | `(value) => JSX`: renders the result. |
| `fallback` | Optional. `() => JSX` shown while the promise is pending. |
| `error` | Optional. `(error) => JSX` shown when `load` throws or the promise rejects. |

::api{symbol="@rivetjs/runtime/dom#Async"}

You cannot put a promise directly into JSX. `{fetchUser()}` fails. Wrap it in `Async`. See [a promise child needs Async](/gotchas/promise-child-needs-async.md).

## The work object

`load` gets a `work` object:

- `work.signal`: an `AbortSignal`. Rivet aborts it when the result is no longer needed (the boundary is replaced or removed). Pass it to `fetch` so stale requests stop.
- `work.get(context)`: reads a [context](./context.md) value, also after an `await`.
- `work.run(fn)`: runs `fn` in the boundary's place in the tree, also after an `await`.

## On the server

During server rendering, Rivet waits for `load` and writes the finished result into the HTML. The fallback is not shown.

With streaming turned on, the server can send the page first with the fallback, and send the result later in the same response. See [streaming](/guides/performance/streaming.md).

## Load again when a signal changes

To load new data when a signal changes, render the `Async` from a JSX expression that reads the signal. When the signal changes, Rivet renders the expression again. The new boundary starts a new load, and the old one is aborted:

```tsx
import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/dom";

export default function Person() {
  const id = signal(0);
  const card = (current: number) => (
    <Async load={(work) => fetchPerson(current, work.signal)} fallback={() => <span>Loading…</span>}>
      {(person) => <span>{person.name}</span>}
    </Async>
  );
  return (
    <div>
      <button type="button" onClick={() => id.update((n) => n + 1)}>
        Next person
      </button>
      <p>{card(id())}</p>
    </div>
  );
}
```

:::note
Reading the signal inside `load` works too, on client-rendered and server-rendered pages: `load={(work) => fetchPerson(id(), work.signal)}`. Read it before the first `await`; reads after an `await` are not tracked.
:::

## Data as a signal: resource

`Async` renders its result in one place. When several parts of a component need the same data, or code needs it (a handler, a computed value), use `resource`. It loads data and gives it back as a signal:

```tsx
import { signal } from "@rivetjs/reactivity";
import { resource, Suspense } from "@rivetjs/runtime/dom";

function User(props: { id: number }) {
  const user = resource(
    () => props.id,
    (id, info) => fetch(`/api/users/${id}`, { signal: info.signal }).then((res) => res.json()),
  );
  return (
    <div>
      <h2>{user()?.name}</h2>
      <p>{user.loading() ? "Refreshing…" : ""}</p>
      <button type="button" onClick={() => user.refetch()}>
        Reload
      </button>
    </div>
  );
}

export function Profile() {
  const id = signal(1);
  return (
    <section>
      <button type="button" onClick={() => id.set(id() + 1)}>
        Next user
      </button>
      <Suspense fallback={() => <p>Loading…</p>}>
        <User id={id()} />
      </Suspense>
    </section>
  );
}
```

- The first argument is the source: a signal read or a value. Each time it changes, the fetcher runs again. The previous load is aborted and a late answer from it is dropped. A source that is `false`, `null` or `undefined` loads nothing. Without a source (`resource((_, info) => …)`), the fetcher gets `true`.
- The fetcher gets the source value and `info`: the `work` object of `Async` (`signal`, `get`, `run`) plus `info.value` (the previous value) and `info.refetching` (`false` for a source change, the `refetch` argument otherwise).
- `user()` is the value: `undefined` until the first load is done. It throws the error when the last load failed, so an [error boundary](./error-boundaries.md) catches it.
- Nothing loads until the resource is first read. It stops with the component that created it.

| Method | What it does |
| --- | --- |
| `loading()` | `true` while a load is running. |
| `error()` | The error of the last load, or `undefined`. Never throws. |
| `latest()` | The last loaded value, also while a new one loads or after an error. Never throws. |
| `state()` | `"unresolved"`, `"pending"`, `"ready"`, `"refreshing"` or `"errored"`. |
| `refetch(info?)` | Loads again with the current source. `info` reaches the fetcher as `info.refetching`. |
| `mutate(value)` | Sets the value now, without a load (for optimistic updates). Takes a value or `(previous) => next`. |

Options, as the last argument: `initialValue` (the value before the first load) and `ssr: false` (see below).

::api{symbol="@rivetjs/runtime/dom#resource"}

A resource created inside a [`Suspense`](./suspense.md) (in a component rendered there, as `User` above) shows its fallback while it loads, as an `Async` there would. A change made inside `startTransition` keeps the old value on screen until the new one is ready. A resource created outside the `Suspense` does not show its fallback in the browser: check `loading()` instead.

On the server, the fetcher runs once, when the resource is created. A `Suspense` around the parts that read it waits for the load and sends the finished HTML (with streaming: the fallback first, the content later). The browser gets the value with the page and does not load it again; it loads when the source changes or on `refetch`. Read a resource inside a `Suspense`: outside one, the server cannot wait, sends the loading state, and the part reading it loads in the browser after the page starts. With `ssr: false` the server never runs the fetcher, and the browser loads it when the page starts.

:::note
Create the resource in the component as the whole value of one `const`, and call its methods on it: `user.refetch()`. The arguments can be anything: arrow functions, functions passed by name (`resource(loadUser)`), `initialValue`, `ssr: false`. A resource inside a `For` row or a `Show` branch works too. These forms work in the browser, but the server cannot hand them to the browser: a destructured resource (`const { refetch } = resource(…)`), a `let`, a resource put straight into JSX or an object, and one created in a helper such as `useUser()`. The compiler warns about them ([RV2016](../../errors/RV2016.md)).
:::

## Load a component on demand

`lazyComponent` keeps a component's code out of the code a page needs before its first interaction; the component runs when it is first rendered. Use it for big parts that many visitors never see:

```tsx
import { lazyComponent } from "@rivetjs/runtime/dom";

const Chart = lazyComponent(() => import("../components/Chart.tsx"), undefined, {
  fallback: () => <p>Loading chart…</p>,
});

// Later, in JSX:
<Chart data={points} />;
```

- The first argument imports a module with a `default` export.
- The second argument picks a named export instead: `(module) => module.Chart`. Pass `undefined` for the default export.
- Options: `fallback` and `error`.
- On a resumed page the browser fetches the lazy components in the page's code at idle, after the rest of its code (not under Save-Data); a first render after that does not wait for the network. Only an importer written inline counts (`lazyComponent(() => import("…"))`); see [Preloading](../performance/preloading.md).

::api{symbol="@rivetjs/runtime/dom#lazyComponent"}

For code that must only run in the browser, use [clientOnly](./browser-only.md#a-component-that-only-runs-in-the-browser) instead.

## Several parts, one loading state

To show one fallback for several `Async` parts and reveal them together, or to keep old content while new data loads, see [Suspense and transitions](./suspense.md).

## Common mistakes

- **Ignoring `work.signal`.** Old requests keep running and waste bandwidth.
- **Using `useContext` after `await`.** It returns the default. Use `work.get(token)`. See [context gone after await](/gotchas/context-gone-after-await.md).
- **Loading the page's main data with `Async` or `resource`.** A loader is simpler and runs before rendering.
- **Reading a resource outside `Suspense` on the server.** The server sends the loading state; wrap the reading part in `Suspense` so the server waits.

## See also

- [Loading data](/guides/routing/loading-data.md)
- [Streaming](/guides/performance/streaming.md)
- [Browser-only code](./browser-only.md)
