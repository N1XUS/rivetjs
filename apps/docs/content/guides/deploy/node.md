---
title: Node
description: Build a server-rendered Rivet app and run it in production with the Node adapter, start() and closeOnSignals.
template: guide
status: experimental
related: [guides/deploy/docker, guides/deploy/static-hosts, guides/performance/streaming, guides/security/csp]
---

A server app renders each page when a request comes in. That lets it read cookies, check logins and run form [actions](../routing/actions-and-forms.md). The Node :term[adapter]{id=adapter} in `@rivetjs/router/node` runs the built app on a plain Node.js HTTP server.

After reading this page you can build the app, start the production server, shut it down cleanly and tune it.

::starter{template=starter-server}

## Build

A server app has two builds: the browser files and the server code.

```json title="package.json"
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && vite build --ssr",
    "start": "node serve.js"
  }
}
```

`npm run build` creates:

```txt
dist/
  client/   browser files: chunks, CSS, images, manifests in .vite/
  server/   entry.server.js and its imports
```

You need Node.js 24 or newer.

## Start the server

```js title="serve.js"
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({
  dist: "dist",
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "127.0.0.1",
});
closeOnSignals(serving);
console.log(`Listening on ${serving.url}`);
```

`start()` loads the server build, connects it to the browser build's manifests, and listens. It resolves once the server is listening. `serving.url` is the address it listens on.

The default host `127.0.0.1` accepts only local connections. In a container or on a server that receives traffic directly, set `HOST=0.0.0.0`.

## What the server does for you

- **Static files.** Files in `dist/client` are served before any page. Files under `/assets/` have hashed names, so they get `Cache-Control: public, max-age=31536000, immutable`. Other files get `no-cache` and an `ETag`.
- **Compression.** Responses are compressed by the `Accept-Encoding` header: zstd when the browser accepts it (Chrome, Edge, Firefox), else Brotli, else gzip. Pages and other dynamic responses use fast levels (zstd 3, or 1 for bodies of 256 KB and more; Brotli 4; gzip 6), so compressing costs a fraction of the render. Hashed files under `/assets/` are compressed once at the best quality (zstd 19, Brotli 11, gzip 9) on their first request and written next to the file as `.zst`, `.br` or `.gz`, so the next start serves them from disk; a file that already has such a sibling (from your build) is served as it is. Other files of 1 KB or more are compressed once and kept in memory. `compress: { zstd: false }` keeps Brotli and gzip only; `compress: { precompress: false }` writes nothing to disk; `compress: false` turns compression off.
- **Streaming.** A page that is complete right away goes out in one piece. A large page sends its first part (the document head) as soon as the status and headers are final, and the rest when it is rendered. A page that still waits for data streams, and each piece is sent at once. See [Streaming](../performance/streaming.md).
- **Security headers.** Every response gets `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`. HTML pages get a strict [Content Security Policy](../security/csp.md) with a new nonce per request.
- **Health checks.** `/healthz` always answers `ok`. `/readyz` answers `ready`, or `503 draining` while the server shuts down.
- **Timeouts.** Requests time out after 30 seconds, headers after 15 seconds; idle keep-alive connections close after 5 seconds.
- **Client disconnects.** When a visitor leaves, the request's `AbortSignal` fires and rendering stops.
- **Memory after traffic spikes.** When the server goes quiet after a spike, it lets V8 give the grown heap back to the OS within about 15 seconds. See [Memory when idle](#memory-when-idle).

## Shut down cleanly

`closeOnSignals(serving)` listens for `SIGTERM` and `SIGINT` (the signal Docker and most hosts send to stop a process, and :kbd[Ctrl]+:kbd[C]). Then it:

1. stops accepting new connections, and `/readyz` reports `draining`,
2. waits for running requests to finish, up to the `grace` time (default 10 seconds),
3. closes the remaining connections and exits the process.

You can also call `await serving.close()` yourself, for example in tests.

## Use every core

One Node.js process renders on one CPU core. On a machine with more cores, start several worker processes:

```js title="serve.js"
const serving = await start({ dist: "dist", port: 3000, workers: "auto" });
closeOnSignals(serving);
```

- `workers: "auto"` starts one worker per core (`os.availableParallelism()`); a number starts that many. The default `1` serves from the process itself.
- The first process becomes the primary. It runs the same script again in each worker (Node's `cluster` module), renders nothing itself, and resolves `start()` once every worker listens. Call `start()` at the top level of the script, not behind a condition that only the first process meets.
- The primary hands out connections in turn (round robin; on Windows the operating system picks the worker). With `reusePort: true`, each worker binds its own socket and the kernel spreads the connections: Linux and FreeBSD, Node 22.12 or newer. On other systems `start()` throws, since the kernel would not balance.
- A worker that crashes is replaced. If workers keep crashing (more than 5 in 10 seconds), the primary stops replacing them and logs an error; once no worker is left it exits with code 1, so your process manager restarts the server. A worker that fails before it listens (a broken build, a port in use) makes `start()` reject and stops the others.
- `closeOnSignals(serving)` in the primary drains every worker within `grace`, then exits.
- In the primary, `serving.server` is `undefined` and `serving.workers` is the worker count; in each worker (and without `workers`), `serving.server` is the HTTP server. TypeScript narrows on either field.
- Each worker has its own memory: the [route cache](../routing/headers-and-caching.md#route-rules-and-page-caching) and render cache are per worker, so a page is rendered once per worker before every worker serves it from memory. `revalidate()` in one worker drops the page in all of them: the primary passes it on, a moment later.

In a container with a CPU limit, set `workers` to that limit: `"auto"` may count the host's cores. Many hosts run one process per container and scale with more containers instead: then keep the default.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `dist` | `"dist"` | Build folder with `client/` and `server/` |
| `port` | `3000` | Port; `0` picks a free port |
| `host` | `"127.0.0.1"` | Address to listen on |
| `stream` | off | `{ deadline?: number }` turns on [streaming](../performance/streaming.md) |
| `compress` | `true` | zstd / Brotli / gzip compression; `{ zstd?: boolean, precompress?: boolean }` for brotli-only or no on-disk copies of assets |
| `grace` | `10000` | Milliseconds to finish running requests on close |
| `headers` | | Extra headers on every response. Replaces a default of the same name (any letter case); a response's own header wins |
| `immutable` | `/assets/` | `(pathname) => boolean`: which files are cached forever |
| `onError` | `console.error` | Called for unexpected errors |
| `locales` | | i18n: one browser build per language, see [Translating text](../i18n/translating-text.md#build-one-app-per-language) |
| `origin` | | Fixed public origin, such as `"https://shop.example"`. Set it behind a proxy (see below) |
| `trustProxy` | `false` | `true` (one proxy), a number of proxies, or `(address, hop) => boolean`: take the origin from `X-Forwarded-Proto` / `X-Forwarded-Host` and the client address from `X-Forwarded-For`, at the outermost trusted proxy |
| `idleMemory` | `true` | Return heap memory to the OS when the server is idle after traffic. `false` turns it off. See [Memory when idle](#memory-when-idle) |
| `preload` | `{ background: 1 MiB }` | `{ background }`: bytes of below-the-fold code each page downloads when the browser is idle; `0` turns it off, a function gets the request URL. See [Preloading](../performance/preloading.md#background-budget) |
| `maxBody` | 1 MiB, multipart 10 MiB | Request body limit for `POST`/`PUT`/`PATCH`/`DELETE`: bytes, or `{ default, multipart }`. Larger bodies get `413` |
| `earlyHints` | off | `true` or `{ runtime, links }`: `103 Early Hints` for pages. See [Early hints](../routing/headers-and-caching.md#early-hints) |
| `routeRules` | from the build | Headers and page caching per path. See [Route rules and page caching](../routing/headers-and-caching.md#route-rules-and-page-caching) |
| `routeCache` | 32 MiB, 5,000 pages | `{ maxBytes, maxEntries, origin }`: bounds of the page cache |
| `workers` | `1` | Worker processes, or `"auto"` for one per CPU core. See [Use every core](#use-every-core) |
| `reusePort` | `false` | With `workers`: each worker binds its own socket and the kernel balances connections (Linux, FreeBSD; elsewhere `start()` throws). Needs a fixed `port` |

Errors that reach `onError` answer with `500 Internal Server Error`. Server errors on pages render your `_error` page, as described in [Errors and 404](../routing/errors-and-404.md).

::api{symbol="@rivetjs/router/node#start"}

## Memory when idle

A traffic spike grows the JavaScript heap. V8 has a *memory reducer* that shrinks the heap again once a process stops allocating. In current Node.js versions it does not start in a typical server: it only counts a process as idle when Node's internal C++ objects (the `cppgc` heap) also see a small allocation rate, and a server that never creates such objects has a rate of exactly zero, which V8 treats as busy. The heap then stays at its peak size until a fallback GC about 100 seconds later. If traffic comes back before that, it never shrinks.

The Node adapter works around this. One second after the last request ends, if the heap grew well above the size it had settled at (by V8's own rule: 10% or 10 MiB), it creates one empty `vm.Script`, a 56-byte object in that C++ heap. V8 then sees a small, non-zero rate, and its memory reducer runs within the next two 8-second checks. The adapter checks again after 17 seconds and stops once memory went down, a request arrives, or after 5 tries.

- It does nothing per request except count it, and uses at most one timer, which never keeps the process alive.
- It never calls `gc()` and needs no V8 flags. Health checks (`/healthz`, `/readyz`) do not count as traffic.
- It runs on Node only. Under Bun and Deno it is off.

Measured with the SSR benchmark's 5000-row page in Docker (Node 24): after a 10-second burst, the server's memory dropped from about 125–160 MiB to 56–70 MiB after 15 seconds of idle. Without the workaround it took 110 seconds.

Turn it off with `idleMemory: false`, for example when you tune V8's GC with your own flags.

## Your own server

`serve()` runs any web-standard handler, `(request, context) => Response`, with the same file serving, compression and shutdown:

```js
import { closeOnSignals, serve } from "@rivetjs/router/node";

const serving = await serve({
  client: "public",
  handler: async (request) => new Response("Hello", { headers: { "content-type": "text/plain" } }),
});
closeOnSignals(serving);
```

`createListener(options)` returns the raw Node request listener, if you want to mount it in your own `http.createServer`.

## Behind a proxy

Most hosts put a proxy or load balancer in front of Node:

- **Set the public origin.** Behind a proxy that ends TLS, Node sees `http://` and an internal host, so the [cross-site check](../routing/actions-and-forms.md#cross-site-protection) rejects every form post with `403`. Pass `origin: "https://shop.example"`, or `trustProxy: true` if the proxy sets `X-Forwarded-Proto` and `X-Forwarded-Host`. Turn on `trustProxy` only behind a proxy that sets these headers: otherwise clients can fake them.
- **Client address.** Loaders, actions, guards and handlers read the visitor's IP address as `event.platform.clientAddress`: the socket address, or with `trustProxy` the `X-Forwarded-For` entry that the outermost trusted proxy appended. Entries to the left of it come from the client and are never used. Behind two proxies (a CDN, then a load balancer) pass `trustProxy: 2`. Use it for rate limits or logs.

- Point health checks at `/readyz`, so traffic stops before the process exits.
- If the proxy compresses too, turn one of them off (`compress: false`).
- If the proxy buffers responses, streamed pages arrive all at once. Turn off response buffering for HTML.

## Common mistakes

- **The server is not reachable from outside.** The default host is `127.0.0.1`. Set `HOST=0.0.0.0`.
- **`does not export createApp`.** The server build is missing or stale. Run `vite build --ssr` again.
- **Buttons do nothing in production.** Only with `resume: { appModules: false }`: the component outside `src/routes` is not in `resume.modules`. See [Vite](../tooling/vite.md#resume-options).

## See also

- [Docker](docker.md)
- [Static hosts](static-hosts.md)
- [Streaming](../performance/streaming.md)
