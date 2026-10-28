---
title: Rendering modes
description: The three ways a Rivet app can render pages, per request on a server, once at build time, or in the browser only, and how to choose.
template: concept
status: experimental
related: [learn/server-first, guides/deploy/node, guides/deploy/static-hosts, guides/performance/streaming]
---

A Rivet app renders its pages in one of three modes. You choose the mode with one option in `vite.config.ts`. Your pages and components stay the same; what changes is when the HTML is made and what needs a server.

## What it is

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ mode: "static" })], // "server" (default) | "static" | "csr"
});
```

| Mode | HTML is made | Needs a server at runtime | Resumes | Starter |
| --- | --- | --- | --- | --- |
| `server` (default) | for each request | yes (a supported server adapter) | yes | `starter-server` |
| `static` | once, at build time | no (any static host) | yes | `starter-static` |
| `csr` | in the browser | no | no | — |

## Server mode

Each request runs the page on the server. `load(…)` and `guard(…)` run per request, so pages can show fresh or per-user data. Forms post to `actions(…)`. Responses can set headers and cookies.

The build makes `dist/client` (browser files) and `dist/server` (server code). You run it with the Node adapter:

```js title="serve.js"
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({ dist: "dist", port: 3000 });
closeOnSignals(serving);
```

The Node adapter buffers HTML by default. Enable `start({ stream: {} })` to stream pending `Async` boundaries; an optional `deadline` hands unfinished work to the browser. Fetch adapters return the renderer's stream. See [streaming](../guides/performance/streaming.md).

Use it for: apps with logins, per-user pages, forms that save data, content that changes often.

## Static mode

The build runs every page once and saves the HTML as files. This is also called :term[prerendering]{id=prerender}.

```bash
vite build && vite build --ssr && node prerender.js
```

`prerender.js` calls `prerenderBuild({ dist: "dist" })` from `@rivetjs/router/static`. It writes `index.html` and a `_data.json` file per page into `dist/client`, plus `404.html`. Upload that folder to any static host.

A page with nothing to resume (no client behavior that needs code) ships no JavaScript, and its links load documents. When no page resumes, there are no `_data.json` files either. See [pages without JavaScript](../guides/deploy/static-hosts.md#pages-without-javascript).

Server code still works, but it runs at build time:

- `load(…)` runs once per page during the build. Its result is saved into the page.
- A page with a parameter, such as `src/routes/books/[id].tsx`, needs an `entries(…)` export. It returns the list of parameter values to build:

```tsx title="src/routes/books/[id].tsx"
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { books } from "../../books.ts";
import { entries, load } from "@rivetjs/router";

// Build one page per book: /books/1, /books/2, …
export const paths = entries(() => books.map((book) => ({ id: String(book.id) })));

export const loader = load(({ params }: RequestEvent<"books/[id]">) => books.find((book) => book.id === Number(params.id))!);

export default function Book({ data }: PageProps<typeof loader>) {
  return <h1>{data.title}</h1>;
}
```

There is no server after the build, so nothing runs per request: no actions, no cookies, no per-user data. The build stops with an error if a page has `load(…)` or `guard(…)` but cannot be prerendered.

Pages still resume in the browser exactly as in server mode. Use it for: documentation, blogs, marketing pages, anything that is the same for every visitor.

## Browser-only mode (`csr`)

`csr` means client-side rendering. The build writes an `index.html` shell, and the browser runs the components to build the page. There is no server rendering, so there is nothing to resume: this mode works like a classic single-page app.

- Server code is not allowed: no `.server.ts` route files and no server exports in route files. The build stops with an error that lists them.
- Pages render without loader data.
- The `index.html` shell has no page head: the browser applies each route's `head` (the title) when it renders the route.

Use it for: an app behind a login where search engines and the first paint do not matter.

## How to choose

1. Is every page the same for every visitor, and known at build time? Use **static**.
2. Do you need per-request data, logins or forms that save? Use **server**.
3. Must it run without any server rendering at all? Use **csr**, and accept that the browser runs all components.

You can start with `static` and switch to `server` later. Your pages and components do not change; only the build script and the hosting do.

## What it means for your code

- In `static` mode, `load(…)` runs on your build machine. Do not read request-only things like cookies there.
- In `server` mode, a module-level variable in server code (a route file or a `.server.ts` module) is shared by all requests. Keep per-user data out of it.
- The dev server (`npm run dev`) resumes pages like production by default. Editing a resumed component reloads the page with the new code. Judge speed with a production build. See [dev and production differ](../gotchas/dev-and-production-differ.md).

## Related

- [Server first](server-first.md)
- [Deploy to Node.js](../guides/deploy/node.md) and [static hosts](../guides/deploy/static-hosts.md)
- [Loading data](../guides/routing/loading-data.md)
