---
title: Cloudflare
description: Deploy a server-rendered Rivet app to Cloudflare Workers with static assets using adapter "cloudflare" and a generated Wrangler configuration.
template: guide
status: experimental
related: [guides/deploy/overview, guides/deploy/vercel, guides/deploy/netlify]
---

The Cloudflare target builds a Worker with [static assets](https://developers.cloudflare.com/workers/static-assets/). Cloudflare serves your files directly; the Worker renders pages. The build writes the Wrangler configuration for you, so `wrangler deploy` needs no setup.

After reading this page you can build, run the Worker locally, deploy, and add bindings.

## Set the adapter

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], adapter: "cloudflare" })],
});
```

The build script stays `vite build && vite build --ssr`. It writes:

```txt
dist/server/worker.js            the Worker (with entry.server.js and assets/ chunks)
dist/cloudflare/wrangler.json    generated Wrangler configuration
dist/cloudflare/static/          dist/client without .vite/, prerendered pages, _headers
.wrangler/deploy/config.json     points Wrangler at the generated configuration
```

`_headers` gives `/assets/*` `Cache-Control: public, max-age=31536000, immutable`.

## Run and deploy

```bash
npm run build
npx wrangler dev      # local Worker on http://localhost:8787
npx wrangler deploy
```

Install Wrangler as a dev dependency (`npm i -D wrangler`). Add `.wrangler/` to `.gitignore`.

## Bindings and settings

Keep your own settings in `wrangler.jsonc` (or `wrangler.json`) in the project root: KV namespaces, D1 databases, `vars`, routes. The build merges it into the generated file and sets `main`, the assets folder and the module rules itself. `wrangler.toml` is not merged; use JSON, or pass the settings in the adapter:

```ts
import { rivetRouter } from "@rivetjs/router/vite";

rivetRouter({ adapter: { name: "cloudflare", wrangler: { kv_namespaces: [{ binding: "CACHE", id: "<id>" }] } } });
```

Bindings arrive in loaders and actions as `event.platform.env`, the execution context (`waitUntil`) as `event.platform.ctx`, and `CF-Connecting-IP` as `event.platform.clientAddress`.

## Node.js compatibility

The Worker needs only `AsyncLocalStorage` from Node.js. The generated configuration enables just that (`nodejs_als`) and turns off the full Node.js layer, which is on by default for new compatibility dates.

Adding `nodejs_compat` to `compatibility_flags` (in your own `wrangler.json`) is supported when your loaders need more Node.js APIs; the renderer works with either setting.

## Prerendered pages and static sites

A route with `export const prerender = true` is written into the assets folder at build time and served by Cloudflare at its canonical URL (`/about`; `/about/` redirects). With `mode: "static"`, every page is, no Worker is deployed, and missing paths get your `404.html`.

## Common mistakes

- **Settings in `wrangler.toml`.** The build merges only `wrangler.jsonc` / `wrangler.json` from the project root. Move the settings to JSON, or pass them as the adapter's `wrangler` option.
- **Reading bindings from `process.env`.** Workers have no `process.env` by default. Read bindings and `vars` from `event.platform.env`.
- **Work after the response without `waitUntil`.** A Worker may stop once the response is sent. Pass the promise to `event.platform.ctx.waitUntil(…)`.

## See also

- [Deploy targets](overview.md)
- [Static hosts](static-hosts.md)
