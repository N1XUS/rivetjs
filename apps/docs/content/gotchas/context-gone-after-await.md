---
title: Context gone after await
description: Why useContext returns the default value after an await in an Async load, and how to read context with work.get.
template: gotcha
related: [guides/components/context, guides/components/async]
---

## What you see

Inside an async function, `useContext` returns the right value before the first `await` and the default value after it. There is no error. Your code just gets the wrong value, for example the default API address or an empty user.

```tsx
import { createContext, useContext } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/dom";

const Api = createContext("https://api.example.com");

export function Profile() {
  return (
    <Async
      load={async (work) => {
        const before = useContext(Api); // the provided value
        await Promise.resolve();
        const after = useContext(Api); // the default value
        return before + " / " + after;
      }}
    >
      {(text: string) => <p>{text}</p>}
    </Async>
  );
}
```

## Why

`useContext` looks for the nearest `Provider` of the code that is running right now. Rivet tracks this "current component" only while code runs synchronously.

An `await` pauses your function. Other code runs in between. When your function continues, Rivet no longer knows which component it belongs to, so `useContext` finds no provider and returns the default value. Rivet does this on purpose: no context stays active across an `await`, so one request can never read another request's values.

## Fix

Read context through `work`, the object `Async` passes to `load`. `work.get(token)` reads from the boundary's place in the tree, also after `await`.

```tsx
import { createContext } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/dom";

const Api = createContext("https://api.example.com");

export function Profile() {
  return (
    <Async
      load={async (work) => {
        const response = await fetch(work.get(Api) + "/me", { signal: work.signal });
        const user = await response.json();
        return { name: String(user.name), api: work.get(Api) }; // [!code highlight]
      }}
    >
      {(user: { name: string; api: string }) => (
        <p>
          {user.name} from {user.api}
        </p>
      )}
    </Async>
  );
}
```

- Read what you need before the first `await`, or use `work.get(token)` anywhere in `load`.
- `work.signal` is an `AbortSignal`. Pass it to `fetch` so Rivet can cancel the request when the boundary goes away.
- After the boundary is removed, `work.get` throws instead of returning a stale value.

For async code outside `Async`, `captureAsyncContext()` from `@rivetjs/runtime/async` gives you the same `get` and `run` methods. Call it before the first `await`.

:::tip
In file routes, load page data in the page's `serverLoad` function. It receives the request directly and needs no context. See [loading data](../guides/routing/loading-data.md).
:::
