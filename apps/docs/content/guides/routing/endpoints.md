---
title: Endpoints
description: Answer requests with JSON, text or files instead of a page by exporting onGet(…), onPost(…) and other request handler calls from a plain .ts route file.
template: guide
related: [guides/routing/file-routes, guides/routing/guards, guides/routing/headers-and-caching]
---

Sometimes a URL should not return a page: a JSON API for a mobile app, a webhook, an RSS feed, a health check. For these you write an **endpoint**: a plain `.ts` file (not `.tsx`) in `src/routes` that exports request handlers. After reading this page you can answer `GET` and `POST` requests with any `Response`.

::example{id=json-endpoint}

## Write an endpoint

Export a request handler named after the HTTP method. It receives the same event as a loader and must return a standard `Response`:

```ts title="src/routes/api/items.ts"
import type { RequestEvent } from "@rivetjs/router";
import { db } from "../../db.server.ts";
import { onGet } from "@rivetjs/router";

export const GET = onGet(async ({ signal }: RequestEvent) => {
  const items = await db.items.list({ signal });
  return Response.json(items, { headers: { "cache-control": "no-store" } });
});
```

This file answers `GET /api/items`. Because there is no `api/items.tsx`, the router treats it as an endpoint, not a page.

Handler names: `onGet(…)`, `onPost(…)`, `onPut(…)`, `onPatch(…)`, `onDelete(…)` and `onOptions(…)`. A `HEAD` request runs `onGet(…)`. `onRequest(…)` runs for every method before the method's handler; return nothing from it to continue, or a `Response` to answer. A `.ts` file without request handlers stays a helper module and adds no route. See [server code in route files](./server-code-in-routes.md#endpoints-in-plain-ts-files).

## Use params

Endpoints use the same file names as pages, so params work the same way:

```ts title="src/routes/api/items/[id].ts"
import { notFound, type RequestEvent, onGet } from "@rivetjs/router";
import { db } from "../../../db.server.ts";

export const GET = onGet(async ({ params, signal }: RequestEvent<"api/items/[id]">) => {
  const item = await db.items.find(params.id, { signal });
  if (!item) throw notFound();
  return Response.json(item);
});
```

A thrown `notFound()`, `deny()` or `error()` becomes a response with that status. For endpoints you usually want a JSON body instead of the HTML error page, so return your own response:

```ts
if (!item) return Response.json({ error: "not found" }, { status: 404 });
```

## Accept a body

Read the request body with the standard `Request` methods:

```ts title="src/routes/api/notes.ts"
import type { RequestEvent } from "@rivetjs/router";
import { db } from "../../db.server.ts";
import { onPost } from "@rivetjs/router";

export const POST = onPost(async ({ request }: RequestEvent) => {
  const body = (await request.json()) as { text?: unknown };
  if (typeof body.text !== "string" || body.text.length > 500) return Response.json({ error: "invalid text" }, { status: 400 });
  const note = await db.notes.add(body.text);
  return Response.json(note, { status: 201 });
});
```

:::warning
Endpoints get the same cross-site check as [actions](./actions-and-forms.md#cross-site-protection): a `POST`, `PUT`, `PATCH` or `DELETE` from another site's page is rejected with `403` before your handler runs. Requests from non-browser clients (no `Origin`, no `Sec-Fetch-Site`, JSON body) pass, so a public API still checks its token. A webhook that other sites post to opts out with `export const csrf = false` in its file; then verify the sender yourself, for example with a signature.
:::

Request bodies of `POST`, `PUT`, `PATCH` and `DELETE` are limited to 1 MiB (multipart form data: 10 MiB); a larger body gets `413 Payload Too Large`. Change the limit with the adapter's `maxBody` option: a number of bytes, or `{ default, multipart }` (see [Node](../deploy/node.md#options)).

## Requests from other sites (CORS)

A page on another origin that calls your endpoint with `fetch` needs CORS headers, and its non-`GET` requests need the cross-site check turned off for that file. The browser first sends an `OPTIONS` request (the preflight). `OPTIONS` requests are never cross-site checked and skip guards and loaders; they reach `onRequest(…)`, then `onOptions(…)`, so answer the preflight in `onOptions(…)`:

```ts title="src/routes/api/public/items.ts"
import type { RequestEvent } from "@rivetjs/router";
import { onOptions, onGet, onPost } from "@rivetjs/router";

const ALLOWED = new Set(["https://partner.example"]);
// Another site's pages send POST here: the cross-site check would reject them.
export const csrf = false;

const cors = (event: RequestEvent): Record<string, string> => {
  const origin = event.request.headers.get("origin");
  return origin && ALLOWED.has(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {};
};

export const OPTIONS = onOptions((event: RequestEvent) =>
  new Response(null, {
    status: 204,
    headers: { ...cors(event), "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type, authorization" },
  }));

export const GET = onGet((event: RequestEvent) => Response.json(["a", "b"], { headers: cors(event) }));

export const POST = onPost(async (event: RequestEvent) => {
  // csrf = false: authenticate every request yourself (a token, not cookies).
  if (event.request.headers.get("authorization") !== `Bearer ${process.env.API_TOKEN}`) return new Response(null, { status: 401, headers: cors(event) });
  return Response.json(await event.request.json(), { status: 201, headers: cors(event) });
});
```

- Without an `onOptions(…)` (or `onRequest(…)`) answer, an `OPTIONS` request gets `204` with an `Allow` header and no CORS headers, so the browser blocks the call.
- Allow a fixed list of origins. Do not echo any `Origin` back together with `access-control-allow-credentials: true`: every site could then call the endpoint with your visitors' cookies.
- `csrf = false` applies to that file only. Keep endpoints that use cookies for login on your own origin, with the check on.

## Guards and headers apply

Before your handler runs:

1. the `onRequest(…)` and `on<Method>` handlers of the enclosing layouts, and the endpoint's own `onRequest(…)`, run, outermost first;
2. every `guard(…)` of the enclosing layouts and of the endpoint file runs, outermost first;
3. every `headers(…)` export of those files adds its headers.

So an endpoint inside `(private)/` or `admin/` is protected by the `guard(…)` in the folder's `_layout.tsx`, like the pages there. A guard redirect returns a `302`, which is often not what an API client expects; check for an API path in the guard and `deny(401)` instead if needed.

## Methods you did not export

A request with a method the file has no handler for gets `405 Method Not Allowed` (after `onRequest(…)` ran), with an `Allow` header that lists the methods you did handle (`onGet(…)` always brings `HEAD`). On a page route, `Allow` lists `GET, HEAD`, `POST` only when the page has `actions(…)` or `onPost(…)`, and `PUT` / `PATCH` / `DELETE` when it has their handlers.

## Pages and endpoints at the same URL

A URL is either a page or an endpoint. If `feed.tsx` exists, its request handlers are middleware for the page: returning nothing renders the page. Pick another URL for the endpoint, for example `feed.xml.ts` → `/feed.xml`.

```ts title="src/routes/feed.xml.ts"
import { db } from "../db.server.ts";
import { onGet } from "@rivetjs/router";

export const GET = onGet(async () => {
  const posts = await db.posts.latest(20);
  const items = posts.map((post) => `<item><title>${escapeXml(post.title)}</title></item>`).join("");
  return new Response(`<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
});

const escapeXml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
```

## Endpoints need a server

Static sites (`mode: "static"`) do not build endpoints: the build only writes pages. Client-only apps (`mode: "csr"`) have no server code at all. Use the default server mode for endpoints.

## Common mistakes

- **Returning a plain object.** Return a `Response`. Use `Response.json(value)` for JSON.
- **Exporting a plain function.** `export const GET = () => …` is not a handler. Wrap it: `export const GET = onGet(() => …)`, with `onGet` imported from `@rivetjs/router`.
- **Throwing `notFound()` in a JSON API.** The client gets the HTML 404 page. Return `Response.json({ error }, { status: 404 })`.
- **A webhook from another service gets `403`.** Browsers' cross-site posts are rejected by default. Export `csrf = false` in that file and verify the sender's signature.
- **Calling your own endpoint from a loader.** The loader already runs on the server. Call the database or service directly; it saves a network round trip.

## See also

- [Headers and caching](./headers-and-caching.md)
- [Guards](./guards.md)
- [Server-only code](/guides/security/server-only-code.md)
