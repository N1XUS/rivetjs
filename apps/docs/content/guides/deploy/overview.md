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
- **Streaming.** The fetch targets return a response stream. The Node adapter can buffer a small, immediately completed page into one response. Pending `Async` parts need the [streaming](../performance/streaming.md) option (deferred route loaders enable it themselves).
- **Static files first.** Files from `dist/client` are served before your app runs. Files in `assets/` have a content hash in their name and get `Cache-Control: public, max-age=31536000, immutable`.
- **Manifests in fetch targets.** The generated fetch and platform entries embed the browser manifests, so build the browser files first. The default Node adapter reads manifests from `dist/client`; Bun and Deno also read static files from disk.
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

Read secrets the way your platform provides them: `process.env` on Node.js, Vercel, Netlify Functions and Bun, `Deno.env.get()` on Deno and `Netlify.env.get()` on Netlify Edge Functions. On Cloudflare, bindings arrive in `event.platform.env`. Where the platform passes a context object (Netlify, Vercel Edge, Cloudflare `ctx`), it is `event.platform.ctx`. The visitor's address is always `event.platform.clientAddress`.

## Cache builds in CI

Builds keep their results in one cache folder outside the project: compiled modules (`compile/`), build-time evaluated calls (`comptime/`), optimized `?image` / `?svg` files (`images/`) and the stylesheet sizes the router measures. The folder is `RIVET_CACHE_DIR` when it is set, else `rivet-cache` in the OS temp directory. Every entry is keyed by everything it depends on (source, options, compiler version), so a restored cache never gives a stale result, and several projects can share one folder. It stays outside the project on purpose: Tailwind's source detection scans the app folder and would read cached text as class names.

A CI runner starts with an empty temp directory, so point the variable at a path your CI caches and restore it between runs:

```yaml title=".github/workflows/build.yml"
env:
  RIVET_CACHE_DIR: ${{ runner.temp }}/rivet-cache
steps:
  - uses: actions/checkout@v4
  - uses: actions/cache@v4
    with:
      path: ${{ runner.temp }}/rivet-cache
      key: rivet-${{ runner.os }}-${{ github.sha }}
      restore-keys: rivet-${{ runner.os }}-
  - run: npm ci
  - run: npm run build
```

Build scripts can read the same path with `rivetCacheDir()` from `@rivetjs/compiler`. `compileCache: false` in the Vite config, or `RIVET_COMPILE_CACHE=0`, turns the compiler cache off; it is limited to 512 MB, least recently used entries first (`RIVET_COMPILE_CACHE_MB`). Downloaded Google fonts are the one cache inside the project (`node_modules/.rivet/fonts`, see [Kit](../../ui/kit.md)): keep that folder too when the build must run without network. All variables are listed in the [command line reference](../../reference/cli.md#environment-variables).

## Common mistakes

- **Testing only with the dev server.** Resuming, chunks and the security policy behave differently there. Run the production build locally (`npm run build`, then `npm start` or `npm run preview`) before you deploy. See [dev and production differ](../../gotchas/dev-and-production-differ.md).
- **Secrets in browser code.** Read them in `load(…)`, actions, guards or `*.server.ts` modules only. See [server-only code](../security/server-only-code.md).
- **A server build that resolves the `browser` export condition.** Packages ship server-only code behind export conditions (the cdk / ui slot probe that keeps `aria-describedby` and `aria-labelledby` pointing at parts that render). The Rivet adapters build the server bundle without `browser`; a custom edge or worker bundler config that adds it gets the browser modules, and those attributes can name elements that never render. In development the server warns once (`cdk slot probe is disabled: …`).
- **Form posts rejected with `403` behind a proxy.** The server must know its public origin: `origin` (or `trustProxy` on Node). See [Node](node.md).

## See also

- [Node](node.md)
- [Static hosts](static-hosts.md)
- [Streaming](../performance/streaming.md)
