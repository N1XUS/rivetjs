---
title: Errors and 404 pages
description: Show your own pages for missing URLs and failures with _404.tsx and _error.tsx, and fail on purpose with notFound(), deny() and error().
template: guide
related: [guides/routing/loading-data, guides/routing/guards, best-practices/error-handling]
---

Things go wrong: a URL has a typo, a product was deleted, the database is down. Rivet shows a **404 page** for things that do not exist and an **error page** for everything else, with the right HTTP status. After reading this page you can design both pages, place them per folder, and trigger them from your code.

::example{id=not-found-page}

## Add a 404 page

Create `_404.tsx`. It receives the `url` that was not found:

```tsx title="src/routes/_404.tsx"
export default function NotFound({ url }: { url: URL }) {
  return (
    <section role="status">
      <h1>Page not found</h1>
      <p>Nothing lives at {url.pathname}.</p>
      <a href="/">Back home</a>
    </section>
  );
}
```

The router shows it, with status `404`, when:

- the URL matches no route, or
- a guard or loader throws `notFound()`.

Without a `_404.tsx`, the router shows a short "Page not found." text.

## Add an error page

Create `_error.tsx`. It receives the `error`:

```tsx title="src/routes/_error.tsx"
import { isHttpError } from "@rivetjs/router";

export default function Failure({ error }: { error: unknown }) {
  const status = isHttpError(error) ? error.status : 500;
  return (
    <section role="alert">
      <h1>Something went wrong</h1>
      <p>Error {status}. Please try again later.</p>
      <a href="/">Back home</a>
    </section>
  );
}
```

It shows for every other failure: a thrown `Error`, `deny()`, or `error(status, message)`. Without an `_error.tsx`, the router shows the message in a short `role="alert"` paragraph.

## Fail on purpose

Throw these from a guard or a loader. In guards and actions you may also return them.

| Helper | Status | Page |
| --- | --- | --- |
| `notFound(message?)` | 404 | `_404.tsx` |
| `deny()` | 403 | `_error.tsx` |
| `deny(401)` | 401 | `_error.tsx` |
| `error(status, message)` | any 400–599 | `_error.tsx` |
| `redirect(url, status?)` | 302 by default (303 from an action) | none, the browser goes to `url` |

```tsx title="src/routes/posts/[slug].tsx"
import { error, notFound, type RequestEvent } from "@rivetjs/router";
import { db } from "../../db.server.ts";

export async function serverLoad({ params }: RequestEvent<"posts/[slug]">) {
  const post = await db.posts.find(params.slug);
  if (!post) throw notFound("No such post");
  if (post.removed) throw error(410, "This post was removed");
  return post;
}
```

::api{symbol="@rivetjs/router#error"}

## What the visitor sees

The message you pass to `notFound`, `deny` or a 4xx `error` is meant for visitors. `error.message` on the `HttpError` contains it, and `error.expose` is `true`.

Unexpected errors are different. When a loader throws a plain `Error` (say, "connection refused, password=…"), the visitor must not see that text. In production the router:

1. answers with status `500`,
2. replaces the message with `Internal Server Error (digest 3f9a0c12b4)`,
3. logs the real error on the server with the same digest.

The digest is a short random id. When a user reports it, search your logs for it. With the dev server (`vite`), you see the real message to help you debug.

To send errors to your own logging, pass `onError` to the server:

```js title="serve.js"
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({
  dist: "dist",
  onError: (error, request) => myLogger.error({ error, url: request?.url }),
});
closeOnSignals(serving);
```

## Nearest page wins

You can put `_404.tsx` and `_error.tsx` in any folder. A route uses the nearest one, looking from its own folder up to `src/routes`:

```txt
src/routes/
  _404.tsx          ← for /about-us-typo and everything else
  _error.tsx
  shop/
    _404.tsx        ← for /shop/unknown and missing products
    [id].tsx
```

For URLs that match no route, the router picks the `_404.tsx` of the longest matching folder. Folders with params (such as `[id]/`) cannot have their own fallback for unmatched URLs; the parent's is used.

Error pages run no server code of their own: put loaders and guards in pages and layouts. A `_404.server.ts` or `_error.server.ts` file is a build error.

## Client navigation

Errors also happen after a link click. The router then renders the same `_404.tsx` or `_error.tsx` in place of the page, inside your layouts. The status code does not matter here, as no new HTML document loads.

:::note
When your root layout has server code (a `serverLoad`, `serverGuard` or other server export in `_layout.tsx`), error pages from a full page load render **without** the root layout, because there is no layout data. Include a link home in both pages.
:::

## Static sites

In `mode: "static"`, the build writes your root `_404.tsx` as `404.html`. Configure your host to serve it for unknown paths; see [static hosts](/guides/deploy/static-hosts.md). A page that fails while the build renders it stops the build with its status.

## Common mistakes

- **Returning `notFound()` from a loader.** In a loader, a returned value is data. `throw notFound()`.
- **Catching every error in the loader and returning `null`.** The page then renders with status 200 and an empty view. Let errors reach the router, or throw `notFound()`.
- **Showing `error.message` for every error.** For 5xx errors in production it only contains the generic text and digest. Show your own words.

## See also

- [Error handling best practice](/best-practices/error-handling.md)
- [Loading data](./loading-data.md)
- [Guards](./guards.md)
