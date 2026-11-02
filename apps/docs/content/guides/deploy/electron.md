---
title: Electron
description: Run a server-rendered Rivet app inside Electron with adapter "electron": pages and files answer a custom scheme in the main process, with no port.
template: guide
status: experimental
related: [guides/deploy/overview, guides/deploy/node, guides/deploy/bun]
---

The Electron target writes `dist/server/electron.js`. It answers the app's own `https://` origin in the main process through [`protocol.handle`](https://www.electronjs.org/docs/latest/api/protocol#protocolhandlescheme-handler), so the app opens no port.

After reading this page you can build the app and open it in a window.

## Set the adapter

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], adapter: "electron" })],
});
```

Build with `vite build && vite build --ssr`, as for every server target.

## Open a window

```js title="main.js"
import { app, BrowserWindow, session } from "electron";
import { start } from "./dist/server/electron.js";

app.whenReady().then(() => {
  const { url } = start({ session: session.defaultSession });
  return new BrowserWindow().loadURL(url);
});
```

The main file is an ES module: set `"type": "module"` in `package.json` (Electron 28 or later).

The app lives at `https://rivet.invalid/`. Pass `origin` to `start` to change it. The `.invalid` domain never reaches the network.

## What the adapter does

- **Files.** `dist/client` is served first: `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`, other files with `no-cache` and an `ETag`.
- **Pages.** Everything else renders and streams, with the same CSP, CSRF check and body limit as any other target.
- **Other hosts.** Requests to any other `https://` host in that session go to the network unchanged.
- **Cookies.** Electron gives a protocol handler no cookies, so the adapter reads and writes them through `session.cookies`. Cookies persist with the session.
- **Main process.** Loaders, actions and endpoints run in the main process, so they can call Node.js and Electron APIs directly.
- **Stop.** `start()` returns `close()`, which sends `https` back to the network.

## Security

Electron does not tell the handler the `Origin` of a `fetch`, so the adapter trusts one only when the request's referrer is on the app's origin. Any other unsafe request is rejected as cross-site. A page of yours with `Referrer-Policy: no-referrer` therefore gets `403` from its own `fetch` posts.

Requests to other hosts in the app's session also pass through this handler. To keep the app's cookies and storage apart from remote pages, give the app its own session:

```js title="main.js"
const { url } = start({ session: session.fromPartition("persist:app") });
new BrowserWindow({ webPreferences: { partition: "persist:app" } }).loadURL(url);
```

Rendered pages run in the renderer. Keep the Electron defaults (`contextIsolation` on, `nodeIntegration` off) and call privileged APIs from loaders and actions.

## Common mistakes

- **`await app.whenReady()` at the top level of the main file.** The `ready` event waits for the main module to finish loading, so the app hangs. Use `.then()`.
- **Seeking in large media files.** Files have no `Range` support here, so a `<video>` cannot seek. Serve large media another way.
- **WebSockets to the app.** A protocol handler answers HTTP requests only. Use [Server-Sent Events](../routing/endpoints.md) or IPC.

## See also

- [Deploy targets](overview.md)
- [Node.js](node.md)
