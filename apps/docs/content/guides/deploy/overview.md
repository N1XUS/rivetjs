---
title: Deploy targets
description: Pick where your Rivet app runs. One adapter option in the router plugin builds the output Vercel, Netlify, Cloudflare, Bun or Deno expects.
template: guide
status: experimental
related: [guides/deploy/node, guides/deploy/static-hosts, guides/deploy/vercel, guides/deploy/cloudflare]
---

A Rivet app builds the same way everywhere: `vite build` for the browser files, then `vite build --ssr` for the server code. The `adapter` option of the router plugin decides what the server build also writes, so the result deploys to your platform as it is.

After reading this page you can choose a target and know what it builds.

## Choose a target

| Target                          | Option                  | Output                          | Runs on                                    |
| ------------------------------- | ----------------------- | ------------------------------- | ------------------------------------------ |
| [Node](node.md)                 | none (default)          | `dist/`                         | Any Node.js 24 server, [Docker](docker.md) |
| [Static hosts](static-hosts.md) | `mode: "static"`        | `dist/client`                   | Any static host or CDN                     |
| [Vercel](vercel.md)             | `adapter: "vercel"`     | `.vercel/output/`               | Vercel Functions (Node.js or Edge)         |
| [Netlify](netlify.md)           | `adapter: "netlify"`    | `.netlify/v1/`, `dist/netlify/` | Netlify Functions or Edge Functions        |
| [Cloudflare](cloudflare.md)     | `adapter: "cloudflare"` | `dist/cloudflare/`              | Cloudflare Workers with static assets      |
| [Bun](bun.md)                   | `adapter: "bun"`        | `dist/server/bun.js`            | `bun`                                      |
| [Deno](deno.md)                 | `adapter: "deno"`       | `dist/server/deno.js`           | `deno`                                     |
| Any web-standard runtime        | `adapter: "fetch"`      | `dist/server/fetch.js`          | Your own `fetch(request)` host             |

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], adapter: "vercel" })],
});
```

The build script stays `vite build && vite build --ssr`.

## What every target does

- **Same pages.** Every target runs the same request handler: the same HTML, the strict [Content Security Policy](../security/csp.md) with a new nonce per request, form actions with the same-origin check, the data endpoint for client navigation, and your 404 and error pages.
- **Streaming.** Pages stream as they render. Nothing collects a whole page first.
- **Static files first.** Files from `dist/client` are served before your app runs. Files in `assets/` have a content hash in their name and get `Cache-Control: public, max-age=31536000, immutable`.
- **No file system at run time.** The server build is one self-contained bundle. The browser build's manifests are written into it, so build the browser files first.
- **Base path.** `rivetRouter({ base: "/app" })` moves pages, files and cache rules under `/app`.

## Prerendered pages

On Vercel, Netlify and Cloudflare, a route that exports `prerender = true` is rendered to an HTML file at build time. The platform serves the file, and your app is not called for that page:

```tsx title="src/routes/about.tsx"
import type { PageProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";

export const prerender = true;
export const loader = load(() => ({ updated: "2026-10-08" }));

export default function About({ data }: PageProps<typeof loader>) {
  return <p>Updated {data.updated}</p>;
}
```

The page gets a hash-based security policy instead of a nonce, as on [static hosts](static-hosts.md#security-policy). With `mode: "static"`, every page is prerendered and no function is deployed.

## Environment variables and platform data

Read secrets the way your platform provides them: `process.env` on Node.js, Vercel, Netlify Functions and Bun, `Deno.env.get()` on Deno and Netlify Edge Functions. On Cloudflare, bindings arrive in `event.platform.env`. Where the platform passes a context object (Netlify, Vercel Edge, Cloudflare `ctx`), it is `event.platform.ctx`. The visitor's address is always `event.platform.clientAddress`.

## Common mistakes

- **Testing only with the dev server.** Resuming, chunks and the security policy behave differently there. Run the production build locally (`npm run build`, then `npm start` or `npm run preview`) before you deploy. See [dev and production differ](../../gotchas/dev-and-production-differ.md).
- **Secrets in browser code.** Read them in `load(…)`, actions, guards or `*.server.ts` modules only. See [server-only code](../security/server-only-code.md).
- **A server build that resolves the `browser` export condition.** Packages ship server-only code behind export conditions (the cdk / ui slot probe that keeps `aria-describedby` and `aria-labelledby` pointing at parts that render). The Rivet adapters build the server bundle without `browser`; a custom edge or worker bundler config that adds it gets the browser modules, and those attributes can name elements that never render. In development the server warns once (`cdk slot probe is disabled: …`).
- **Form posts rejected with `403` behind a proxy.** The server must know its public origin: `origin` (or `trustProxy` on Node). See [Node](node.md).

## See also

- [Node](node.md)
- [Static hosts](static-hosts.md)
- [Streaming](../performance/streaming.md)
