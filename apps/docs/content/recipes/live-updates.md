---
title: Live updates
description: Push values from the server to the page with Server-Sent Events, an endpoint route and a clientEffect that opens and closes the connection.
template: recipe
related: [guides/routing/endpoints, guides/state/effects, guides/routing/loading-data, guides/deploy/node]
---

## What you will build

A "visitors right now" number that the server updates every two seconds. The server pushes each new value; the page does not ask again and again.

It uses **Server-Sent Events** (SSE): one long HTTP response that the server keeps writing to. The browser reads it with the built-in `EventSource`. SSE goes one way, server to browser, which is all you need for live numbers, notifications or progress.

The example needs a server, so it is shown as code. Copy it into the server starter to watch the number change.

::example{id=live-updates}

## How it works

### 1. The first value comes with the HTML

```tsx title="src/routes/index.tsx"
import { load } from "@rivetjs/router";
export const loader = load(() => ({ visitors: currentVisitors() }));
```

The page starts with `signal(data.visitors)`. The server renders the number, so the page is never empty, even before the connection opens.

### 2. An endpoint streams the events

`src/routes/events.ts` is a plain `.ts` file (not `.tsx`) that exports a request handler, so it is an **endpoint**: a URL (`/events`) that answers with any `Response` you build. Its `onGet(…)` function returns a stream:

```ts
return new Response(body, {
  headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
});
```

Each event is a line `data: …` followed by an empty line. The example sends JSON every two seconds.

When the visitor leaves, the request's `signal` is aborted. The endpoint listens for that, stops the timer and closes the stream. Without this, the server would keep a timer running for every closed tab.

Rivet's Node server sends each piece of a streamed response at once, also when it compresses responses, so events are not held back.

### 3. The page connects in a `clientEffect`

```tsx
import { clientEffect } from "@rivetjs/runtime/dom";

clientEffect(() => {
  const source = new EventSource("/events");
  source.onopen = () => status.set("live");
  source.onmessage = (event) => visitors.set((JSON.parse(event.data) as { visitors: number }).visitors);
  source.onerror = () => status.set("reconnecting");
  return () => source.close();
});
```

- `EventSource` exists only in the browser. `clientEffect` runs only in the browser, so this is the right place.
- By default the effect starts when the browser is idle, after the page has loaded. Pass `{ when: "visible" }` with a `ref` to wait until an element scrolls into view.
- The returned function closes the connection when the page (or the component) goes away.
- `EventSource` reconnects by itself after a network error. The status text shows that.

## Variations

- **Named events.** Send `event: price` before `data:`, and listen with `source.addEventListener("price", …)` to have several streams in one connection.
- **Per-user data.** The endpoint receives the request's `cookies` and `locals` like any route. Put it in a guarded folder (see [protected pages](./protected-pages.md)) to send private data.
- **Two-way traffic.** For chat-like apps where the browser also sends often, use a WebSocket server next to Rivet. For occasional browser-to-server messages, a form action or `fetch` is enough.

## Watch out

- **Proxies may buffer.** Some reverse proxies hold streamed responses. In nginx, turn off `proxy_buffering` for the events URL.
- **Connection limits.** Over HTTP/1.1 a browser opens only about six connections per site, and each open `EventSource` uses one. Serve over HTTP/2 or keep one stream per page.
- **Static hosts cannot stream.** Server-Sent Events need a running server.
