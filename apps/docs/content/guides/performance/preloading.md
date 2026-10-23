---
title: Preloading
description: Learn when Rivet downloads the code of your interactive components, and how to turn the downloads before the first interaction off.
template: guide
status: experimental
related: [guides/performance/chunks, learn/loading-code, guides/performance/measuring]
---

A Rivet page arrives as finished HTML. The JavaScript of a button is not needed until someone uses the button, but waiting for the network on the first click would make it slow. Rivet downloads that code ahead of time without running it. This is called :term[preloading]{id=preload}.

## What happens by default

1. The page loads. The inline loader starts; no component code runs.
2. After the load, the loader asks the browser to fetch the runtime and the chunks of the page's interactive components (with their static imports) at low priority. Nothing of it runs yet.
3. When the pointer rests on an element, or it gets focus, the loader fetches that component's chunk right away if it has not arrived.
4. On the event, the runtime runs the component and the components around it that have not run yet (with file routes: up to the router's root), then the handler. An event that comes before its code is held and replayed.

With Save-Data on, or on a 2G connection, step 2 is skipped: code loads on intent.

## Lean pages

`preload: { lean: true }` downloads nothing before the first interaction: no fetch-ahead after load. Code loads on intent or on the event itself, which then replays. Use it for landing pages whose score counts every byte before the visitor acts. It can be a function of the request URL (`true`, or `undefined` for the default):

```ts
import { start } from "@rivetjs/router/node";

await start({ dist: "dist", preload: { lean: (url) => url.pathname === "/" || undefined } });
```

## Per component

Preload strategies per element (`preload="…"`), per component (`export const preload`) and per app (`resume.preload.rules`) have no effect: not yet on the derived model; tracked in plan M6.

## Code that loads later

Code that a component loads with `import()`, such as lazy components or other routes, is fetched when it is needed.

To keep analytics or other heavy code out of the first seconds, load it inside a `clientEffect` with `when: "idle"`:

```tsx
import { clientEffect } from "@rivetjs/runtime/dom";

// At module scope, so the analytics code stays its own chunk.
const loadAnalytics = () => import("./analytics.ts");

export function PageViews() {
  clientEffect(async () => {
    const { pageView } = await loadAnalytics();
    pageView(location.pathname);
  }, { when: "idle" });
  return null;
}
```

## Common mistakes

- **Judging in the dev server.** Dev pages resume, but code is served per module. Check a production build; see [Measuring](measuring.md).

## See also

- [Chunks](chunks.md)
- [Loading code](../../learn/loading-code.md)
- [Images](../assets/images.md) for preloading the main image
