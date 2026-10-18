---
title: Vercel
description: Deploy a server-rendered Rivet app to Vercel with adapter "vercel": Build Output API files, Node.js or Edge functions, prerendered pages and ISR.
template: guide
status: experimental
related: [guides/deploy/overview, guides/deploy/netlify, guides/deploy/cloudflare, guides/performance/streaming]
---

The Vercel target writes the [Build Output API](https://vercel.com/docs/build-output-api/v3) folder `.vercel/output`, which Vercel deploys as it is. Pages render in one Vercel Function; files come from Vercel's CDN.

After reading this page you can build for Vercel, deploy, and choose between the Node.js and Edge runtimes.

## Set the adapter

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], adapter: "vercel" })],
});
```

Keep the build script `vite build && vite build --ssr`. The server build then writes:

```txt
.vercel/output/
  config.json                    routes: immutable assets/, files first, then the function
  static/                        dist/client without .vite/, plus prerendered pages
  functions/_render.func/        the server bundle, .vc-config.json, package.json
```

## Deploy

- **Git integration.** Set the project's framework preset to "Other" and the build command to `npm run build`. When the build leaves a `.vercel/output` folder, Vercel deploys it.
- **CLI.** Build locally, then upload the result: `npm run build && npx vercel deploy --prebuilt`.

Add `.vercel/` to `.gitignore`.

## Node.js or Edge

The default is a Node.js function (`nodejs24.x`). It uses the same response path as the [Node adapter](node.md): page bytes go straight from the renderer to the socket, compressed with zstd, Brotli or gzip, and stream as they render.

```ts
rivetRouter({ adapter: { name: "vercel", runtime: "edge", regions: ["iad1"] } });
```

`runtime: "edge"` runs the web-standard handler in Vercel's Edge Runtime instead. Vercel recommends Node.js for new projects.

| Option                                          | Default          | Meaning                                                   |
| ----------------------------------------------- | ---------------- | --------------------------------------------------------- |
| `runtime`                                       | `"nodejs"`       | `"nodejs"` or `"edge"`                                    |
| `nodeVersion`                                   | `24`             | Node.js major version (`20`, `22`, `24`)                  |
| `regions`                                       | Vercel's default | Function regions                                          |
| `maxDuration`, `memory`                         | Vercel's default | Node.js function limits (seconds, MB)                     |
| `compress`                                      | `true`           | zstd / Brotli / gzip in the Node.js function (`{ zstd: false }`: Brotli / gzip only) |
| `isr`                                           | off              | `{ expiration }`: regenerate prerendered pages, see below |
| `origin`, `maxBody`, `stream`, `headers`, `csp` |                  | Same as the [Node adapter](node.md#options)               |

The function trusts Vercel's `X-Forwarded-Proto`, `X-Forwarded-Host` and `X-Forwarded-For` headers, so form posts pass the same-origin check and `event.platform.clientAddress` is the visitor's address. Read environment variables with `process.env`.

## Prerendered pages and ISR

A route with `export const prerender = true` is rendered at build time into `static/`, and Vercel serves it from the CDN at its clean URL (`/about`).

With `isr: { expiration: 60 }`, those pages become prerender functions instead: Vercel caches each page and renders it again in the background once it is older than 60 seconds (`false`: never). Only the Node.js runtime supports it.

:::warning
A cached page is the same for every visitor, including its security policy nonce. Use ISR only for pages without per-visitor content.
:::

## Static sites

With `mode: "static"`, every page is prerendered into `static/`, no function is deployed, and missing paths answer with your `404.html`.

## Common mistakes

- **ISR on pages with per-visitor content.** A regenerated page is shared by every visitor, including its CSP nonce and anything read from cookies.
- **ISR with `runtime: "edge"`.** Only the Node.js runtime supports `isr`.

## See also

- [Deploy targets](overview.md)
- [Streaming](../performance/streaming.md)
- [Content Security Policy](../security/csp.md)
