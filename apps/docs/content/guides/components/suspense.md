---
title: Suspense and transitions
description: Show one loading state for several Async parts and reveal them together, and keep the old content on screen while new data loads.
template: guide
status: experimental
related: [guides/components/async, guides/performance/streaming, guides/routing/transitions]
---

A page part that loads several things at once can show many spinners that disappear one by one. `Suspense` groups them: it shows one fallback and reveals everything together. `startTransition` solves the opposite problem: when a click loads new data, it keeps the old content on screen until the new content is ready. After reading this page you can use both.

:::note
Both are experimental.
:::

## Reveal parts together

Wrap the `Async` parts in `Suspense`:

```tsx
import { Async, Suspense } from "@rivetjs/runtime/dom";

export function Profile({ id }: { id: string }) {
  return (
    <Suspense fallback={() => <p>Loading profile…</p>}>
      <Async load={(work) => fetchUser(id, work.signal)}>{(user) => <h2>{user.name}</h2>}</Async>
      <Async load={(work) => fetchPosts(id, work.signal)}>{(posts) => <PostList posts={posts} />}</Async>
    </Suspense>
  );
}
```

While any `Async` inside is loading, `Suspense` shows its fallback. When the last one is done, both parts appear at the same moment.

- The compiler passes the children as a function, so the `Async` parts are created inside the boundary. Writing the function yourself (`{() => <>…</>}`) works the same.
- The parts inside are already built while the fallback shows. Their state stays when they are hidden again.
- When a part inside loads again later (its `load` reads a signal that changed), the fallback shows again. Use a transition to avoid that.
- A `Suspense` inside another one handles its own parts.
- A [`resource`](./async.md#data-as-a-signal-resource) created inside counts as a part: while it loads, the fallback shows. On the server, the `Suspense` also waits for a resource created outside it when a part inside reads it.
- When a part fails, the nearest [error boundary](/guides/routing/errors-and-404.md) handles it as usual. Inside the `Suspense`, the error shows in place once the other parts are ready.

:::warning
Children built elsewhere and passed in as a value (`const parts = <A />; <Suspense>{parts}</Suspense>`) exist before the boundary, so they are not grouped.
:::

::api{symbol="@rivetjs/runtime/dom#Suspense"}

## Keep the old content while new data loads

Read the changing signal inside `load`, so the same `Async` loads again in place. Then change the signal inside `startTransition`:

```tsx
import { signal } from "@rivetjs/reactivity";
import { Async, startTransition } from "@rivetjs/runtime/dom";

export function Pager() {
  const page = signal(1);
  const pending = signal(false);
  return (
    <div class={pending() ? "opacity-60" : ""}>
      <Async load={(work) => fetchPage(page(), work.signal)} fallback={() => <p>Loading…</p>}>
        {(items) => <List items={items} />}
      </Async>
      <button onClick={() => startTransition(() => page.set(page() + 1), pending)}>Next page</button>
    </div>
  );
}
```

- The old list stays on screen and keeps working. No fallback shows, and a `Suspense` around it does not fall back.
- When every `Async` the change reloaded is ready, they all switch to the new content at once.
- `pending` (optional) is `true` until then. It is a signal, so it works on resumed pages.
- `startTransition` returns a promise that resolves after the switch.
- A transition started while another is pending joins it.

`useTransition()` returns `[pending, start]` for the same thing.

::api{symbol="@rivetjs/runtime/dom#startTransition"}
::api{symbol="@rivetjs/runtime/dom#useTransition"}

## Page navigation

Following a link is already handled this way by the router: the old page stays until the new one is ready. Use [`useNavigation()`](/guides/routing/transitions.md#show-loading-state) for page-level loading state, and `startTransition` for changes inside a page.

## On the server

- Normal rendering waits for every `Async` inside and sends the finished content. The fallback is not sent.
- On the derived resume model, `Suspense` content is awaited in place even when [streaming](/guides/performance/streaming.md) is enabled. Its fallback is a client loading state, not a streamed group. Use `Async` with a fallback outside `Suspense` to stream a part.
- Settled, supported resource values resume without another fetch. A pending or unsupported value loads in the browser; if it suspends during adoption, the containing boundary renders again in the browser.

## Limits

- A transition keeps the old content only for an `Async` that loads again in place. A part that is created anew (for example `{card(id())}`, or a new `Show` branch) shows its fallback.
- An adopted `Async` uses its saved result without rerunning `load`, so signal reads inside that skipped load are not subscribed. Re-create the `Async` from an outer reactive expression when it must reload, or use a `resource` with a reactive source. See [Async](./async.md#load-again-when-a-signal-changes).

## See also

- [Async](./async.md)
- [Streaming](/guides/performance/streaming.md)
- [Route transitions](/guides/routing/transitions.md)
