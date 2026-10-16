---
title: Netlify
description: Deploy a server-rendered Rivet app to Netlify with adapter "netlify": a Netlify Function or Edge Function, cache headers and prerendered pages.
template: guide
status: experimental
related: [guides/deploy/overview, guides/deploy/vercel, guides/deploy/cloudflare]
---

The Netlify target uses Netlify's [Frameworks API](https://docs.netlify.com/build/frameworks/frameworks-api/): the server build writes a function into `.netlify/v1/` and the site's files into `dist/netlify`. Netlify picks both up after your build command.

After reading this page you can build for Netlify, deploy, and run pages at the edge.

## Set the adapter

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], adapter: "netlify" })],
});
```

Tell Netlify the build command and the folder to publish:

```toml title="netlify.toml"
[build]
  command = "npm run build"
  publish = "dist/netlify"
```

The build script stays `vite build && vite build --ssr`. It writes:

```txt
dist/netlify/                          dist/client without .vite/, plus prerendered pages
.netlify/v1/config.json                Cache-Control immutable for /assets/*
.netlify/v1/functions/rivet-server/    the server bundle and rivet-server.mjs
```

## Deploy

Connect the repository in Netlify, or run `npx netlify deploy --build`. Add `.netlify/` to `.gitignore`.

The function is a Netlify Function (web-standard `Request` and `Response`) for every path, with `preferStatic`: files in `dist/netlify` win, and the function renders everything else. Pages stream. Read environment variables with `process.env`; Netlify's context (`geo`, `waitUntil`, …) is `event.platform.ctx`, and its `ip` is `event.platform.clientAddress`.

## Edge Functions

```ts
rivetRouter({ adapter: { name: "netlify", edge: true } });
```

Pages then render in a Netlify Edge Function, close to the visitor. Edge Functions run before static files, so the function lists the published files and hands those requests back to Netlify; `/assets/*` never reaches it. Read environment variables with `Netlify.env.get()`.

## Prerendered pages and static sites

A route with `export const prerender = true` is written to `dist/netlify` at build time and served as a file. With `mode: "static"`, every page is, no function is written, and Netlify serves your `404.html` for missing paths.

## Common mistakes

- **`publish` not set to `dist/netlify`.** Netlify then publishes the wrong folder and the site has no files. Set it in `netlify.toml`.
- **`process.env` in an Edge Function.** With `edge: true`, read environment variables with `Netlify.env.get()`.

## See also

- [Deploy targets](overview.md)
- [Static hosts](static-hosts.md)
