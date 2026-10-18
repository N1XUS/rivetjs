---
title: Headers and caching
description: Set response headers from routes, control Cache-Control for pages and data, and know which headers Rivet sends by default.
template: guide
related: [guides/routing/endpoints, guides/security/csp, guides/deploy/node]
---

Every response carries HTTP headers: how long it may be cached, which scripts may run, which cookies to store. Rivet sets safe defaults. After reading this page you can add your own headers from a route, change caching, and know what the defaults are.

## Set headers for a route

Export `serverHeaders` from a page or layout file. Return an object (or any `HeadersInit`). Like other `server…` exports, it runs only on the server:

```tsx title="src/routes/pricing.tsx"
export const serverHeaders = () => ({
  "cache-control": "public, max-age=300",
});

export default function Pricing() {
  return <h1>Pricing</h1>;
}
```

`serverHeaders` gets the request event, so it can depend on the URL or on `locals`:

```tsx title="src/routes/_layout.tsx"
import type { RequestEvent } from "@rivetjs/router";

export const serverHeaders = ({ locals }: RequestEvent) =>
  locals.user ? { "cache-control": "private, no-store" } : undefined;
```

The `serverHeaders` exports of all layouts and the page run after the guards, outermost first. If two set the same header, the inner one wins. They apply to the HTML page, to the data the browser fetches on client navigation, to action responses and to [endpoints](./endpoints.md).

## Set a header from a loader or action

`setHeader(name, value)` on the event sets one header. Use it when the value comes from the data you load:

```tsx title="src/routes/posts/[slug].tsx"
import { notFound, type RequestEvent } from "@rivetjs/router";
import { db } from "../../db.server.ts";

export async function serverLoad({ params, setHeader }: RequestEvent<"posts/[slug]">) {
  const post = await db.posts.find(params.slug);
  if (!post) throw notFound();
  setHeader("last-modified", post.updatedAt.toUTCString());
  return post;
}
```

## Defaults for pages and data

| Response | `Cache-Control` default |
| --- | --- |
| HTML page | `no-cache` (caches must check with the server before reuse) |
| Route data for client navigation | `private, no-store` |
| Endpoint | Whatever your `Response` sets |

Your own `cache-control`, from `serverHeaders` or `setHeader`, replaces the default.

A response that sets or deletes a cookie with `event.cookies` is always `private`: Rivet adds `private` and removes `public` and `s-maxage`, and keeps the rest (for example `max-age=60`). A shared cache would otherwise send that cookie to every visitor.

:::warning
Do not mark a page `public` if it shows anything per visitor (a name, a cart, a CSRF-sensitive form). A shared cache would show one person's page to the next. When in doubt, keep the default.
:::

## Security headers

**Content Security Policy.** HTML pages get a strict policy by default: only scripts that carry the response's random nonce may run. A `content-security-policy` header from your `serverHeaders` export replaces it. See [Content Security Policy](/guides/security/csp.md) before you change it.

**Node server headers.** The Node adapter (`start` / `serve` from `@rivetjs/router/node`) adds `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` to every response. Add your own with the `headers` option:

```js title="serve.js"
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({
  dist: "dist",
  headers: { "strict-transport-security": "max-age=31536000; includeSubDomains" },
});
closeOnSignals(serving);
```

These headers are added to every response, also to files and errors. Names compare without letter case: a `headers` entry replaces the default of the same name, and a response that sets the header itself (an endpoint, the route data) keeps its own value. A header is never sent twice.

## Route rules and page caching

`routeRules` in `rivetRouter()` set headers and caching by URL pattern, without touching the route files. Most pages of a blog or a docs site are the same for every visitor: a rule renders such a page once and serves the stored copy until it expires.

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [
    rivetRouter({
      routeRules: {
        "/**": { headers: { "x-frame-options": "DENY" } },
        "/blog/**": { swr: 60 },
        "/about": { isr: true },
        "/search": { cache: { maxAge: 30, query: ["q"] } },
        "/account/**": { cache: false },
      },
    }),
  ],
});
```

Patterns match the URL path below the [base path](../../reference/config.md): `/about` is one path (with or without a trailing slash), `*` is one segment (`/blog/*`), and a trailing `/**` is the path and everything below it. Every rule that matches applies, the less specific first: `headers` merge by name, and the most specific `cache` wins (`cache: false` turns it off again).

| Rule | Meaning |
| --- | --- |
| `headers` | Headers set on every response of the path: pages, data, endpoints, `304`s. |
| `cache: { maxAge }` | Store rendered pages for `maxAge` seconds. Then the next request renders again. |
| `cache: { maxAge, swr }` | After `maxAge`, serve the stored page for `swr` more seconds (`true`: without limit) while one render in the background replaces it. |
| `swr: n` | Short for `cache: { maxAge: n, swr: true }`. |
| `isr: n` / `isr: true` | Same as `swr: n`; `isr: true` keeps the page until you call `revalidate()`. Needs a fixed origin (see Host below). CDNs are told `s-maxage=0, must-revalidate`. |
| `cdn: { maxAge, swr }` | What CDNs are told (`s-maxage`, `stale-while-revalidate`), instead of the cache's own times. |
| `cache.tags` | Names to drop pages by, with `revalidate({ tag })`. |
| `cache.varies` | Request headers that get their own copy, for example `["accept-language"]`; sent as `Vary`. Not `cookie` or `authorization`. |
| `cache.query` | `true` (default): one copy per query string. `false`: ignore the query. A list: only those parameters count. |
| `cache.cookies` | `true`: serve the stored page to requests with cookies too. The page then renders without the visitor's cookies. |

What the cache stores and serves:

- **Pages only.** `GET` and `HEAD` requests for HTML pages that answer `200`. Route data for client navigation, actions, endpoints and other methods are never stored.
- **Not personal pages.** Requests with a `Cookie` or `Authorization` header skip the cache (unless `cookies: true`). Responses that set a cookie, or whose `cache-control` says `private` or `no-store`, are not stored.
- **No server code on a hit.** A stored page is sent without running guards, loaders or `serverHeaders`. Cache only pages that are the same for everyone.
- **Error pages are not stored.** A page that answers anything but `200`, or that rendered an error fallback (a part of it failed and `onError` was called), is sent to that visitor only.
- **Headers.** Responses get `ETag`, `Last-Modified`, `Age` and `x-rivet-cache: HIT`, `MISS` or `STALE`. `Cache-Control` becomes `public, max-age=0, s-maxage=<maxAge>, stale-while-revalidate=<swr>`: browsers check back and get a `304` when the page did not change, and CDNs (Vercel, Netlify, Cloudflare) cache it as the rule says. `isr` rules tell CDNs `s-maxage=0, must-revalidate` unless the rule has `cdn`.
- **Vary.** A response whose `Vary` names other request headers (the i18n guard sends `Vary: cookie, accept-language`) is stored once per value of those headers, and the stored page answers with the same `Vary`. A page that varies by `cookie` or `authorization` is stored only when the rule lists `varies` (for example `["accept-language"]`); without it every visitor gets a fresh render.
- **A miss is buffered.** The render that fills the cache is read to the end before the first byte is sent: that visitor gets no streamed head start. If the render fails part-way, the miss answers `500`.
- **Visitor-chosen keys** are stored on their second request: a new query string, a new value of a header the page varies by (`Accept-Language`, …), and, without a fixed origin (`routeCache: { origin }` / `start({ origin })`), any `Host`. Random query strings, header values or forged hosts cannot push real pages out.
- **One render per page.** Requests that arrive while a page renders wait for that render.
- **Memory.** The store holds at most 32 MiB of pages (with their compressed copies) and 5000 entries per server process, and drops the least recently used. Change it with the server's `routeCache: { maxBytes, maxEntries }` option.
- **Encoded paths.** Rules match the decoded path, as routes do (`/%61dmin` is `/admin`). A path spelled with needless escapes is rendered every time and never stored.
- **Dev** applies `headers` only, so your edits show up.

The Node adapter sends a stored page before it builds a request object, like a static file, compressed once per page. In the editorial benchmark (1,000 articles, Node 26) a stored article costs about 0.02 ms of CPU per request, less than the shared static file server needs for the static build of that article (about 0.1 ms).

### Drop stored pages

Call `revalidate` after the data changed, for example in the action that publishes a post:

```ts title="src/routes/admin/posts/[id].tsx"
import { revalidate } from "@rivetjs/router/route-cache";
import { db } from "../../../db.server.ts";

export const serverActions = {
  async publish({ params }) {
    const post = await db.posts.publish(params.id);
    revalidate({ path: `/blog/${post.slug}` });
    revalidate({ tag: "blog-index" });
  },
};
```

`path` takes a path with or without the base path; `/blog/**` drops everything below `/blog`. A render that started before the call does not store its page. The store lives in the server's memory. With the Node adapter's [`workers`](../deploy/node.md#use-every-core), each worker has its own store and `revalidate()` reaches all of them. Other servers and CDNs keep their copy until it expires. `revalidate()` cannot purge a CDN, which is why `isr` pages tell CDNs to check back every time.

If a background refresh answers `404` or `410`, a redirect (`3xx`), or sets a cookie, the stored page is dropped. If it fails (`5xx`, a thrown error), visitors keep getting the stored page and the next refresh waits longer each time (1 s, 2 s, 4 s … up to 5 minutes).

### Cookies, sessions and `cookies: true`

:::warning
A stored page is sent to everyone. With `cookies: true`, requests that carry cookies get the stored page, and the page renders **without** the request's `Cookie` and `Authorization` headers, so a loader that reads the session sees no session. Never use `cookies: true` on pages that show anything about the signed-in visitor (their name, cart, account links): those parts would be missing, or, if you read the session some other way, one visitor's page would be stored for everyone.
:::

Use it for pages where cookies are only consent or analytics cookies. Pages that depend on the session belong under `cache: false`. A page that answers `Vary: cookie` (the i18n guard does when a locale cookie can choose the language) is never stored under `cookies: true`, even with `varies`; visitors with cookies then get a render of their own request.

The render that fills the cache also leaves out what identifies the visitor behind a proxy or CDN: the client address and the `Forwarded`, `X-Forwarded-*`, `X-Real-IP`, `True-Client-IP`, `CF-*` and `Fastly-Client-IP` headers (unless the rule lists one in `varies`, like `["cf-ipcountry"]`). A loader on a cached page sees none of them.

### Host and origin

Pages are stored per origin. Without a fixed origin the origin comes from the request's `Host` header (or trusted forwarded headers), which a client can choose: a forged `Host` renders and, on its second request, stores a copy of its own, which other hosts never get. Every page is then stored on its second request. Set the public origin when you can: `start({ origin })` / the fetch adapter's `origin`, or `createApp({ routeCache: { origin } })`. Then requests for other hosts skip the cache. `isr` rules require it.

### Content Security Policy of stored pages

A stored page is sent to many visitors, so it cannot carry one visitor's nonce. When you keep the default policy (or pass `csp: { trustedTypes, directives }`), Rivet stores the page without nonces and sends a policy that lists the SHA-256 hashes of the scripts that carried the render's nonce — the ones Rivet and your `head` wrote — plus `'self'` and the origins of nonce'd script files. Markup that ended up in the page some other way (HTML from your content, a raw HTML prop) is never added, so an injected script stays blocked on a stored page as on a fresh one.

The stored policy has no `'strict-dynamic'` (Chromium and Firefox do not pass a hash's trust on to `import()`, which the resume loader uses): scripts that a third-party script inserts at run time need their origin in `csp.directives`. `'self'` also lets a same-origin `<script src>` in the markup run on a stored page, which the nonce policy of a fresh render would block: keep user content free of script tags.

A page is not stored when its nonce appears anywhere else in the HTML, or when its policy trusts the nonce but cannot be converted (a `csp` function, a policy a route set itself): one nonce would be shared by every visitor. The server logs a warning once per path for the first case.

### Override on the server

`start()` from `@rivetjs/router/node`, the fetch adapter's `create()` and `createApp()` take `routeRules` too; they replace the rules from `vite.config.ts`. There the rules may be built at run time.

```js title="serve.js"
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({ dist: "dist", routeRules: { "/**": { swr: Number(process.env.PAGE_TTL ?? 60) } } });
closeOnSignals(serving);
```

For parts of a page instead of whole pages, see the render cache option `renderCache` of `createApp()` and `start()`: it takes `createRenderCache()` from `@rivetjs/runtime/server-cache`, and components wrapped in `cached()` then render once across requests.

## Early hints

A page whose loaders wait on a database sends nothing while they run. With early hints the server tells the browser which files the page will need before that, in a `103 Early Hints` response, and the browser starts loading them while the server still works:

```js title="serve.js"
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({ dist: "dist", earlyHints: true });
closeOnSignals(serving);
```

- **What is hinted.** The page's linked stylesheets from the build, and the build font preloads its head had on the last render of that route. With `earlyHints: { runtime: true }` also the resume runtime, and `links` adds your own `Link` values (`"<https://api.example.com>; rel=preconnect"`). Preconnects and other links in a page's head are not hinted: they may come from one visitor's data, and the hints go to every visitor of the route. Put the origins every page connects to in `links`. Only build files below `/assets/` are preloaded: their names change with their content, so the browser can reuse the early copy. A file the browser must revalidate (from `public/`) would load twice, so it is left out.
- **When it is sent.** For page `GET` and `HEAD` requests, before guards and loaders run. Data requests, actions and endpoints get none. A page served from the [page cache](#route-rules-and-page-caching) carries its stored `Link` header but gets no `103`, because nothing renders: early hints help uncached pages.
- **The `Link` header.** Every page response also carries the same `Link` header. Cloudflare and Fastly turn it into a `103` for later requests, which is how the fetch adapter's `create({ earlyHints })` gets hints out.
- **HTTP/2 only.** Browsers act on `103` over HTTP/2 or HTTP/3. Node serves HTTP/1.1, so the hints reach the browser through a proxy or CDN that forwards them (nginx `early_hints`, Cloudflare, Fastly).
- **When it helps.** Only when the server is slow to answer. In a benchmark (Chromium, 100 ms round trip, a 200 ms loader) the first paint came 100 ms earlier, 420 → 320 ms; with a 50 ms round trip, 324 → 276 ms. When the page answers at once there is no gain: the `103` arrives together with the page.

Default off. `createApp({ earlyHints })` takes the same option for custom servers.

## Static files

The Node adapter serves the built files in `dist/client` before it asks the router:

| Path | `Cache-Control` |
| --- | --- |
| `/assets/…` (file names contain a content hash) | `public, max-age=31536000, immutable` |
| Other files | `no-cache`, with an `ETag` so the browser can revalidate cheaply |

Files are compressed with zstd, Brotli or gzip when the browser accepts it; hashed files are compressed once at the best quality and the copy is written next to the file. Change which paths count as hashed with the `immutable` option.

::api{symbol="@rivetjs/router/node#start"}

## Cookies

Cookies are headers too, but use `event.cookies.set()` rather than `setHeader("set-cookie", …)`: it handles encoding, adds several cookies correctly and applies safe defaults. See [cookies in guards](./guards.md#cookies).

## Static sites

A static site has no server to set headers per request. The build writes HTML files, and your host decides the headers. Each prerendered page contains a `<meta>` Content Security Policy that allows exactly its own inline scripts. Set caching rules in your host's configuration; see [static hosts](/guides/deploy/static-hosts.md).

## Common mistakes

- **Setting headers in the page component.** The component renders HTML; it has no access to the response. Use `serverHeaders` or `setHeader` in the server code.
- **Expecting `serverHeaders` on a guard redirect.** A guard that stops the request answers before the `serverHeaders` exports run.
- **Long caching for HTML.** Pages link to hashed asset files. A cached old page can point to files that a new deploy removed. Keep HTML on `no-cache` or short `max-age`. Route rules keep browsers on `max-age=0` for this reason; a server restart (a deploy) starts with an empty store.
- **Caching a personal page with a route rule.** A stored page skips guards and loaders. Put pages that differ per visitor under `cache: false`, or keep them out of the pattern.

## See also

- [Endpoints](./endpoints.md)
- [Content Security Policy](/guides/security/csp.md)
- [Deploy to Node](/guides/deploy/node.md)
