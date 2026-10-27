---
title: Promise child needs Async
description: Why an async component or a Promise in JSX works on the first page load but fails in the browser, and how Async fixes it.
template: gotcha
related: [guides/components/async, guides/routing/loading-data, guides/performance/streaming]
---

## What you see

You render a Promise as a child, or write an `async` component:

```tsx
async function UserName({ id }: { id: string }) {
  const response = await fetch(`https://api.example.com/users/${id}`);
  const user = await response.json();
  return <b>{user.name}</b>;
}
```

The first page load from the server looks right. But in development, or after a click on a link to this page, the browser stops with:

```txt
TypeError: Promise DOM children require an Async boundary
```

## Why

An `async` function always returns a Promise. On the server, Rivet waits for a Promise child and writes its result into the HTML. That is why the first load works.

In the browser, Rivet does not wait for bare Promises. It needs to know what to show while the data loads, what to show if loading fails, and when to cancel the request. A bare Promise says none of this, so Rivet refuses it.

The browser renders components during client navigation, and it adopts components when a resumed page is used. Dev pages resume by default too; editing a resumed component reloads the page (see [Dev and production differ](dev-and-production-differ.md)). That is where the error appears.

## Fix

Wrap the async work in `Async`. `load` returns the data (it may be async), and the child function renders it.

```tsx
import { Async } from "@rivetjs/runtime/dom";

export function UserName({ id }: { id: string }) {
  return (
    <Async
      load={async (work) => {
        const response = await fetch(`https://api.example.com/users/${id}`, { signal: work.signal });
        return (await response.json()) as { name: string };
      }}
      fallback={() => <span>Loading…</span>}
      error={() => <span>Could not load the user.</span>}
    >
      {(user: { name: string }) => <b>{user.name}</b>}
    </Async>
  );
}
```

- `fallback` shows in the browser while `load` waits. On the server, Rivet waits for `load` instead, unless the page streams.
- `error` renders when `load` throws.
- `work.signal` cancels the request when the boundary is removed, for example when the visitor leaves the page.

:::tip
For page data in file routes, prefer a `load(…)` function in the page file. The page component then gets plain data as `data` and needs no Promise at all. See [loading data](../guides/routing/loading-data.md).
:::
