---
title: Deno
description: Run a server-rendered Rivet app on Deno with adapter "deno": one generated deno.js entry that serves files and pages with Deno.serve.
template: guide
status: experimental
related: [guides/deploy/overview, guides/deploy/bun, guides/deploy/node]
---

The Deno target writes `dist/server/deno.js`, a server for [`Deno.serve`](https://docs.deno.com/runtime/fundamentals/http_server/) that serves your built files and renders pages. The bundle imports nothing but Node built-ins, so it needs no `deno.json`.

After reading this page you can build and start the app on Deno.

## Set the adapter

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], adapter: "deno" })],
});
```

## Build and start

```bash
npm run build
PORT=3000 deno run --allow-net --allow-read --allow-env dist/server/deno.js
```

The build runs on Node.js with Vite; only the server runs on Deno. It listens on `$PORT` (default 3000) and `$HOST` (default `0.0.0.0`), and shuts down cleanly on `SIGTERM` and `SIGINT`.

## What the server does

- **Files.** `dist/client` is served first: `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`, other files with `no-cache` and an `ETag`; `.zst` / `.br` / `.gz` siblings when the browser accepts them (zstd first). Prerendered pages answer at their clean URL.
- **Pages.** Everything else renders and streams. Deno compresses responses itself.
- **Platform data.** `event.platform.clientAddress` is the visitor's address; `event.platform.ctx` is Deno's connection info. Read environment variables with `Deno.env.get()`.

Importing `deno.js` does not start it: call its `start({ port, onError, … })` from your own module.

## Common mistakes

- **Missing permissions.** The server needs `--allow-net`, `--allow-read` (for `dist/client`) and `--allow-env` (for `PORT` and `HOST`).
- **Every form post answers `403` behind a proxy.** A proxy that ends TLS hands Deno an `http://` URL with an internal host. Call `start({ origin: "https://shop.example" })` from your own module.

## See also

- [Deploy targets](overview.md)
- [Bun](bun.md)
