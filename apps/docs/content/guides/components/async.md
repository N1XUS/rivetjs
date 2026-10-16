---
title: Async
description: Load data inside a component with the Async boundary, show a fallback and an error, cancel stale work, and load components on demand with lazyComponent.
template: guide
related: [guides/routing/loading-data, guides/performance/streaming, gotchas/promise-child-needs-async]
---

Some parts of a page need data that takes time to arrive. The `Async` component wraps such a part: it starts the work, shows a fallback while it waits, shows an error if it fails, and renders the result. After reading this page you can use `Async`, reload it when a signal changes, and load components only when they are needed.

:::tip
For the main data of a page, use a route [loader](/guides/routing/loading-data.md). It runs on the server before the page renders. Use `Async` for parts of a page that load on their own.
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

## Load a component on demand

`lazyComponent` loads a component's code only when it is first rendered. Use it for big parts that many visitors never see:

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
- Options: `fallback`, `error`, and `warm`. On a resumed page Rivet loads declared lazy components when the browser is idle, so they are ready when needed. `warm: false` turns that off.

::api{symbol="@rivetjs/runtime/dom#lazyComponent"}

For code that must only run in the browser, use [clientOnly](./browser-only.md#a-component-that-only-runs-in-the-browser) instead.

## Several parts, one loading state

To show one fallback for several `Async` parts and reveal them together, or to keep old content while new data loads, see [Suspense and transitions](./suspense.md).

## Common mistakes

- **Ignoring `work.signal`.** Old requests keep running and waste bandwidth.
- **Using `useContext` after `await`.** It returns the default. Use `work.get(token)`. See [context gone after await](/gotchas/context-gone-after-await.md).
- **Loading the page's main data with `Async`.** A loader is simpler and runs before rendering.

## See also

- [Loading data](/guides/routing/loading-data.md)
- [Streaming](/guides/performance/streaming.md)
- [Browser-only code](./browser-only.md)
