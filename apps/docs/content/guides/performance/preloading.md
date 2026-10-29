---
title: Preloading
description: Learn when Rivet downloads the code of your interactive components, and how to move or turn off the downloads before the first interaction.
template: guide
status: experimental
related: [guides/performance/chunks, guides/performance/zero-js, learn/loading-code, guides/performance/measuring]
---

A Rivet page arrives as finished HTML. The JavaScript of a button is not needed until someone uses the button, but waiting for the network on the first click would make it slow. Rivet downloads that code ahead of time and gets it ready, without running any component. This is called :term[preloading]{id=preload}.

## What happens by default

1. The page loads. The inline loader starts; no component code runs.
2. When the browser is idle after the load, the loader asks it to fetch the runtime and the chunks of the page's interactive components (with their static imports) at low priority. As they arrive, the runtime starts and loads those modules (their top-level code runs), so the first event needs no further loading step. With file routes, the list also holds the page module of the shown route, which the router's root needs before it can run, so that step is done at idle too. No component runs yet.
3. When the pointer moves onto a component that reacts to hover, rests on an element (80 ms), it gets focus, a key is pressed, or a finger or the pointer goes down, the loader fetches every file of that list that has not arrived, at high priority and all at once.
4. On the event, in the same task, the runtime runs the component and the components around it that have not run yet (with file routes: up to the router's root, unless the build proved the component reads nothing they provide), then the handler. An event that comes before its code is held and replayed.

After step 2 (or after the list that intent fetched in step 3), once all of it has arrived, the browser fetches the page's lazy components at low priority, at the next idle moment: the chunks of the `lazyComponent(() => import("…"))` calls in that code, with their static imports. Nothing of them runs until a component renders them, so opening one later costs no extra round trip.

With Save-Data on, or on a 2G connection, step 2 and the lazy components are skipped: code loads on intent.

A page whose only interactive part is its links (client navigation, nothing else reacts to events) also skips step 2 unless you set `ahead`: the runtime and the router load when the pointer rests on a link, or on the first click.

Until the code has run, hover, pressed and keyboard-focus styles come from CSS (`:hover`, `:active`, `:focus-visible`): Rivet UI pairs its `data-hovered`, `data-pressed` and `data-focus-visible` styles with the pseudo-class, so the page looks the same before and after. Do the same in your own styles for headless components, and measure the first click when adding pressed transforms, scales or opacity. See [measuring](measuring.md).

## Change the timing

`preload: { ahead }` on the server (`start`, `createApp` or the adapters) sets step 2 for every page:

| `ahead` | Before the first interaction |
| --- | --- |
| `"idle"` (default) | The page's code, at low priority, when the browser is idle after the load |
| `"load"` | The same, right after the load |
| `"intent"` | Nothing, and a pointer that only passes over the page loads nothing. The code loads on intent, which can make the first click wait for the network on a slow connection |

```ts
import { start } from "@rivetjs/router/node";

await start({ dist: "dist", preload: { ahead: "load" } });
```

## Lean pages

`preload: { lean: true }` downloads nothing before the first interaction, like `ahead: "intent"`, for chosen pages. Code loads on intent or on the event itself, which then replays. Use it for landing pages whose score counts every byte before the visitor acts. It can be a function of the request URL (`true`, or `undefined` for the default):

```ts
import { start } from "@rivetjs/router/node";

await start({ dist: "dist", preload: { lean: (url) => url.pathname === "/" || undefined } });
```

## Per component

Per-element `preload="…"` and component `export const preload` settings do not select derived boundary fetch timing. `resume.preload.rules` is a removed configuration option. Use the server-side `preload: { ahead, lean }` settings above.

## Code that loads later

Lazy components (`lazyComponent(() => import("./Chart.tsx"))`, the importer written inline) in the page's code are fetched after the rest of the page's code, at idle (see above), and run when they first render. Other code loaded with `import()`, such as other routes, a `clientOnly` component or an importer passed in from elsewhere, is fetched when it is needed.

To defer analytics until the browser is idle after load, import it inside a `clientEffect` with `when: "idle"`. Idle can occur soon after load; it is not a fixed delay:

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
