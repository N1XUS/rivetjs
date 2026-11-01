---
title: Live updates
description: Push values from the server to the page with Server-Sent Events, an eventStream endpoint and a liveSource value that a clientEffect opens and closes.
template: recipe
related: [guides/routing/endpoints, guides/state/effects, guides/routing/loading-data, guides/deploy/node]
---

## What you will build

A "visitors right now" number that the server updates every two seconds. The server pushes each new value; the page does not ask again and again.

It uses **Server-Sent Events** (SSE): one long HTTP response that the server keeps writing to. The browser reads it with the built-in `EventSource`, wrapped by `liveSource`. SSE goes one way, server to browser, which is all you need for live numbers, notifications or progress.

The example needs a server, so it is shown as code. Copy it into the server starter to watch the number change.

::example{id=live-updates}

## How it works

### 1. The first value comes with the HTML

```tsx title="src/routes/index.tsx"
import { load } from "@rivetjs/router";
export const loader = load(() => ({ visitors: currentVisitors() }));
```

The page passes `data.visitors` to `liveSource` as its first value. The server renders the number, so the page is never empty, even before the connection opens.

### 2. An endpoint streams the events

`src/routes/events.ts` is a plain `.ts` file (not `.tsx`) that exports a request handler, so it is an **endpoint**: a URL (`/events`) that answers with any `Response`. `eventStream` from `@rivetjs/router/sse` builds the streaming response:

```ts
import { eventStream } from "@rivetjs/router/sse";

export const GET = onGet((event: RequestEvent) =>
  eventStream(event, (send) => {
    send({ visitors: currentVisitors() });
    const timer = setInterval(() => send({ visitors: currentVisitors() }), 2000);
    return () => clearInterval(timer);
  }),
);
```

`send(value)` writes one event (JSON for objects). The function you return is the cleanup: it runs once, when the visitor leaves (the request's `signal` aborts) or the stream is closed. Without it, the server would keep a timer running for every closed tab.

`eventStream` also sets the headers (`text/event-stream`, `no-cache`), sends a comment every 15 seconds so proxies keep the idle connection open (`heartbeat`), and can tell the browser how long to wait before it reconnects (`retry`). Rivet's Node server sends each event at once and does not compress event streams.

### 3. The page follows the stream

```tsx
import { clientEffect } from "@rivetjs/runtime/dom";
import { liveSource } from "@rivetjs/router/live-source";

const visitors = liveSource("/events", { initial: data.visitors, parse: (text) => JSON.parse(text).visitors });
clientEffect(visitors.open);
```

- `liveSource` returns a value you read like a signal: `visitors()`. It starts at `initial` (the loader value, rendered by the server) and each event's data, read by `parse`, replaces it. `visitors.status()` is `connecting`, `open` or `closed`.
- `visitors.open` connects with the browser's `EventSource`. `clientEffect` runs only in the browser, so this is the right place. By default the effect starts when the browser is idle, after the page has loaded. Pass `{ when: "visible" }` to wake the component when its first element nears the viewport; this option takes no ref.
- `open` returns the close function, so the effect closes the connection when the page (or the component) goes away.
- `EventSource` reconnects by itself after a network error (status `connecting` again) and sends the last event `id` back as `Last-Event-ID`.
- The page stays resumable: the server renders the first value, and the browser picks it up from the loader data without re-rendering.

## Variations

- **Named events.** Send `send(price, { event: "price" })` and read them with `liveSource(url, { event: "price" })` (or `source.addEventListener("price", …)` on your own `EventSource`) to have several streams in one connection.
- **Resume after a drop.** Pass `{ id }` to `send`. When the browser reconnects, `event.request.headers.get("last-event-id")` tells the endpoint where to continue.
- **Per-user data.** The endpoint receives the request's `cookies` and `locals` like any route. Put it in a guarded folder (see [protected pages](./protected-pages.md)) to send private data.
- **Two-way traffic.** For chat-like apps where the browser also sends often, use a WebSocket server next to Rivet. For occasional browser-to-server messages, a form action or `fetch` is enough.

## Watch out

- **Proxies may buffer.** Some reverse proxies hold streamed responses. In nginx, turn off `proxy_buffering` for the events URL.
- **Connection limits.** Over HTTP/1.1 a browser opens only about six connections per site, and each open `EventSource` uses one. Serve over HTTP/2 or keep one stream per page.
- **Static hosts cannot stream.** Server-Sent Events need a running server.
- **Fast producers.** `send` returns `false` while the client is behind. Await `ready()` (the producer's third argument) before you send more, or skip values that are already stale.
