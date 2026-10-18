---
title: Bun
description: Run a server-rendered Rivet app on Bun with adapter "bun": one generated bun.js entry that serves files and pages with Bun.serve.
template: guide
status: experimental
related: [guides/deploy/overview, guides/deploy/node, guides/deploy/deno]
---

The Bun target writes `dist/server/bun.js`, a server for [`Bun.serve`](https://bun.com/docs/api/http) that serves your built files and renders pages.

After reading this page you can build and start the app on Bun.

## Set the adapter

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], adapter: "bun" })],
});
```

## Build and start

```bash
npm run build
PORT=3000 bun dist/server/bun.js
```

The build still runs on Node.js with Vite; only the server runs on Bun. The server listens on `$PORT` (default 3000) and `$HOST` (default `0.0.0.0`), and stops cleanly on `SIGTERM` and `SIGINT`.

## What the server does

- **Files.** `dist/client` is served first: `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`, other files with `no-cache` and an `ETag`. A `.zst`, `.br` or `.gz` file next to a file is sent when the browser accepts it (zstd first). Prerendered pages answer at their clean URL.
- **Pages.** Everything else renders and streams. `Bun.serve` does not compress, so put a CDN or proxy in front for compressed HTML.
- **Platform data.** `event.platform.clientAddress` is the visitor's address; `event.platform.ctx` is Bun's server. Read environment variables with `process.env` or `Bun.env`.

## Your own server

Importing `bun.js` does not start it. Call `start()` with options:

```js title="server.js"
import { start } from "./dist/server/bun.js";

start({ port: 8080, onError: (error) => console.error(error) });
```

## Common mistakes

- **Only `vite build` in the build script.** The server file comes from the second build. Keep `vite build && vite build --ssr`.
- **Every form post answers `403` behind a proxy.** A proxy that ends TLS hands Bun an `http://` URL with an internal host, so the same-origin check fails. Start the server yourself with the public origin: `start({ origin: "https://shop.example" })`.
- **Uncompressed HTML.** `Bun.serve` does not compress pages. Put a CDN or proxy in front.

## See also

- [Deploy targets](overview.md)
- [Deno](deno.md)
