---
title: Loading data
description: Fetch data for a page on the server with a load(…) export, use it in the page, and know when it runs in server and static apps.
template: guide
related: [guides/routing/params, guides/routing/layouts, guides/routing/errors-and-404, best-practices/pass-data-not-services]
---

A page often needs data from a database or an API. In Rivet you fetch it in a `load(…)` function that runs **on the server**, and the page receives the result as its `data` prop. After reading this page you can write loaders, use their data, and know when they run.

::example{id=loader-data}

## Write a loader

Export `load(…)` from the page file. The page gets its return value as the `data` prop:

```tsx title="src/routes/index.tsx"
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { db } from "../db.server.ts"; // used only by the loader: removed from the browser build
import { load } from "@rivetjs/router";

export const loader = load(async ({ signal }: RequestEvent) => {
  const books = await db.books.list({ signal });
  return { books };
});

export default function Books({ data }: PageProps<typeof loader>) {
  return (
    <ul>
      {data.books.map((book) => (
        <li>{book.title}</li>
      ))}
    </ul>
  );
}
```

`load(…)` runs only on the server. The compiler removes it, and the imports only it uses, from the browser build, so you can import database clients and read secrets through it. Keep those in `*.server.ts` modules like `db.server.ts`: the build refuses to put such a module into browser code. See [server code in route files](./server-code-in-routes.md).

## Use the data in the page

`PageProps<typeof loader>` types the props: `data` (taken from the loader's return type, you do not write it by hand), `params` and `url`. A page that also reads [params](./params.md) can use the generated form `PageProps<"items/[id]">` instead; see [typed routes](./typed-routes.md).

:::note
A separate `index.server.ts` next to the page works too, with the same `load(…)` export. See [sibling files](./server-code-in-routes.md#sibling-server-ts-files).
:::

::api{symbol="@rivetjs/router#PageProps"}

## What a loader receives

`load(…)` gets one event object (`RequestEvent`):

| Field | What it is |
| --- | --- |
| `params` | The [route params](./params.md), for example `{ id: "42" }`. |
| `url` | The request URL. Read the query with `url.searchParams`. |
| `request` | The standard `Request` (headers, method). |
| `cookies` | `get`, `set` and `delete` cookies. |
| `locals` | An object seeded by the handler's caller, then shared by guards, loaders and actions of one request. A guard can put the user here. See [render with data from another server](../../recipes/render-with-data-from-another-server.md). |
| `signal` | An `AbortSignal` that fires when the request is cancelled. Pass it to `fetch` and database calls. |
| `setHeader(name, value)` | Set a response header. See [headers and caching](./headers-and-caching.md). |
| `setHeaders(headers)` | Set several headers at once (`set-cookie` is refused: use `cookies`). |
| `depends(...keys)` | Name what this data depends on, for `invalidate(key)`. See [reload data after a change](#reload-data-after-a-change). |
| `route.id` | The matched route, for example `"blog/[slug]"`. |
| `isDataRequest` | `true` for a client navigation's data request, `false` for a full page load. |
| `platform` | What the adapter knows, such as `clientAddress`. See [the visitor's IP address](./guards.md#the-visitors-ip-address). |

## What a loader can return

The data is written into the page, so the browser can use it without asking again. It must be a value Rivet can write down as data: objects, arrays, strings, numbers, booleans, `null`, `undefined`, `Date`, `Map`, `Set` and `BigInt` all work. Functions and class instances (a database row object with methods) do not. Return plain objects instead.

Return only what the page shows. Everything you return is visible in the page source, so never return password hashes, tokens or internal fields.

## When loaders run

In a server app (the default `mode: "server"`):

1. **First visit:** the server runs all guards, then the loaders of every layout and of the page, at the same time. Then it renders the HTML. [Deferred loaders](#deferred-loaders) start at the same time, but the HTML does not wait for them.
2. **Client navigation:** when the user clicks a link, the browser asks the server for the next page's data. The server runs the same guards and loaders and answers with data instead of HTML. Guards always run on the server, also here.
3. **Hover or focus on a link:** the router starts fetching the data early and reuses it if the click follows within 5 seconds.

Layout loaders whose data the browser already has are skipped when you navigate between pages under the same layout. See [layouts](./layouts.md).

## Deferred loaders

By default the server waits for every loader before it sends the first byte, so the slowest loader decides when the page starts to arrive. Mark a loader whose data can come later with `{ defer: true }`. The server starts it with the others but does not wait for it: the page streams at once, and the part that needs the data follows in the same response.

```tsx title="src/routes/_layout.tsx"
import { load, type LayoutProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";
import { sessions } from "../sessions.server.ts";

export const loader = load(async ({ cookies }) => sessions.user(cookies.get("sid")), { defer: true });

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  return (
    <>
      <header>
        <a href="/">Home</a>
        <Async load={() => data()} fallback={() => <span>…</span>}>
          {(user) => (user ? <a href="/account">{user.name}</a> : <a href="/login">Sign in</a>)}
        </Async>
      </header>
      {children}
    </>
  );
}
```

The `data` of a deferred loader is a `Deferred<T>` (`PageProps<typeof loader>` and `LayoutProps<typeof loader>` type it), not the value. In a layout `data` is an accessor as usual, so `data()` is the handle. Return it from a boundary's `load`, or from a [`resource`](/guides/components/async.md#data-as-a-signal-resource) fetcher: `<Async load={() => data}>`, `resource(() => data)`. The boundary gets the value.

What the response looks like for the layout above and a page with a normal loader:

1. Guards and the normal loaders run; the deferred loader starts.
2. The server sends the document: head, header with `…`, the page, the resume state. The deferred loader has not finished.
3. The loader finishes. The server sends the header part (the user link and its resume state) at the end of the same response, and the browser puts it in place of `…`.

Several deferred parts arrive in the order their loaders finish. A page with a deferred loader streams this way even when [streaming](/guides/performance/streaming.md) is off for the app. A `resource` read inside `Suspense` waits in place instead: the page streams up to it, then waits.

- **Client navigation:** the data request waits for deferred loaders and answers with their values. The page then gets the value itself in `data`, and `<Async load={() => data}>` renders it at once.
- **Errors:** the status line is already sent, so a deferred loader that throws `notFound()` or an error does not change the response. Its boundary shows its `error` view, or the page reports a render error. A `redirect()` moves the browser: the document ends with a script that goes to the target.
- **Headers and cookies:** a deferred loader can read cookies and headers, but `setHeader`, `setHeaders`, `cookies.set` and `cookies.delete` throw a `TypeError`. Set them in a normal loader or a guard.
- **`head` exports** get the `Deferred` handle too: take titles and meta tags from a normal loader.
- **Head components** (`@rivetjs/kit`) inside a deferred part render after `<head>` was sent: `<HeadLink>` and `<Script>` render in place, `<Title>` and `<Meta>` are ignored with a warning ([kit](/ui/kit.md)).
- **Reading the value directly** (`data.title`) is a bug. In development it throws a `DeferredDataError` that names the field.
- **Static sites:** the build waits for every loader. Use deferred loaders in server apps.
- **Shell cache:** with a [`shell` route rule](./headers-and-caching.md#partial-prerendering-shell-cache) the rest of the page is stored and only the deferred parts render per request.

## Reload data after a change

When something changes on the server outside a form (a cart updated by another widget, a websocket message), ask the router to load the current page's data again with `invalidate` from `@rivetjs/router/client`. It reruns the loaders and updates the page in place: no new history entry, no scroll or focus move.

```tsx
import { invalidate } from "@rivetjs/router/client";

await invalidate(); // every loader of the current page
```

Most changes affect only some data. Let a loader name what its data depends on with `event.depends(key)`, then invalidate that key: only the loaders that depend on it run again, in one request.

```tsx title="src/routes/_layout.tsx"
import type { RequestEvent } from "@rivetjs/router";
import { cart } from "../cart.server.ts";
import { load } from "@rivetjs/router";

export const loader = load(async (event: RequestEvent) => {
  event.depends("cart");
  return { items: await cart.count(event.cookies) };
});
```

```tsx
await invalidate("cart"); // only loaders that called depends("cart")
await invalidate(["cart", "user"]); // loaders that depend on any of them
await invalidate((key) => key.startsWith("/api/")); // keys your function accepts
```

- Keys are strings you choose. URL-like keys such as `"/api/cart"` work too; a `URL` counts as its full address.
- When only layout loaders match, those layouts update and the page stays as it is. When the page's own loader matches, the page renders again with its new data, unless it is a live page (`export const live = true`): then its `data()` updates in place and the page keeps its state. See [forms in drawers and dialogs](../forms/forms-in-overlays.md).
- When no loader depends on the key, nothing is requested.
- Every `invalidate` call also drops data the router warmed on hover.
- Forms you submit with `@rivetjs/forms` reload the page's data for you. See [actions and forms](./actions-and-forms.md).

## Fail from a loader

Throw one of the router's helpers to stop and answer with an HTTP status:

```tsx title="src/routes/items/[id].tsx"
import { notFound, redirect, type RequestEvent, load } from "@rivetjs/router";
import { db } from "../../db.server.ts";

export const loader = load(async ({ params, signal }: RequestEvent<"items/[id]">) => {
  const item = await db.items.find(params.id, { signal });
  if (!item) throw notFound(); // renders the nearest _404.tsx with status 404
  if (item.movedTo) throw redirect("/items/" + item.movedTo, 301);
  return item;
});
```

Always `throw` these in a loader. A returned `notFound()` would be treated as data. Any other error becomes a 500 response that renders the nearest `_error.tsx`. See [errors and 404 pages](./errors-and-404.md).

## Static sites: load at build time

With `rivetRouter({ mode: "static" })`, there is no server at request time. Loaders run once, **when you build**, and their data is saved next to each HTML file (`_data.json`) for client navigation. A site whose pages resume nothing gets no `_data.json` files: its links load documents.

- A route without params is built automatically.
- A route with params needs a `entries(…)` export that lists the param values to build. See [prerendering pages with params](./params.md#prerendering-pages-with-params).
- `cookies`, `request` headers and guards have no visitor to look at during the build. Use a server app for per-visitor data.

The live example on this page is a static app: its `load(…)` ran when the docs were built.

## Common mistakes

- **Fetching in the page component.** The component runs once, on the server, during rendering. Fetch in `load(…)` and pass the result through `data`. For data that changes while the page is open, see [async data](/guides/components/async.md).
- **Returning a class instance or a function.** The page fails to render with a "not serializable" error. Return plain objects. See [function is not serializable](/gotchas/function-is-not-serializable.md).
- **Ignoring `signal`.** Without it, a cancelled navigation keeps the database busy. Pass `signal` on.
- **Importing a service into the page to call it from a handler.** Services hold functions and connections that cannot travel to the browser. Load data on the server; send changes through an [action](./actions-and-forms.md) or an [endpoint](./endpoints.md). See [pass data, not services](/best-practices/pass-data-not-services.md).

## See also

- [Route params](./params.md)
- [Layouts](./layouts.md): layout loaders
- [Guards](./guards.md)
- [Rendering modes](/learn/rendering-modes.md)
