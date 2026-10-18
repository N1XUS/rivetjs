---
title: Preloading
description: Learn when Rivet downloads the code for your event handlers, and how to change it per element, per component or for the whole app.
template: guide
status: experimental
related: [guides/performance/chunks, best-practices/preload-by-impact, learn/loading-code, guides/performance/measuring]
---

A Rivet page arrives as finished HTML. The JavaScript for a button is not needed until someone uses the button. Rivet decides for each piece of code when to download it: right after the page shows, when the browser is idle, when an element scrolls into view, or when the user is about to interact. This is called :term[preloading]{id=preload}.

The automatic choice works for most pages. This page explains what Rivet does by default and how to change it when you know better.

## What happens by default

Before the first interaction, a page with only event handlers loads no JavaScript modules at all. A small inline loader script (about 1.8 KB compressed) watches for user intent.

For each [chunk](chunks.md), the server picks a strategy from how the code is used:

| Code | Default strategy |
| --- | --- |
| `onClick`, `onSubmit`, `onInput`, `onChange`, key handlers | `intent` |
| The same handler on 3 or more rows of one `For` list, hover-like and scroll events | `visible` (only for chunks up to 8 KB; larger ones stay `intent`) |
| `clientEvent` on `window` or `document` | `idle` |
| `clientEvent` on an element | `visible` |
| `clientEvent` with `passive: false` | `eager` |

When a chunk is used in several ways, the strongest strategy wins: `eager`, then `idle`, then `visible`, then `intent`, then `interaction`.

## What the strategies mean

| Strategy | When the browser downloads the code |
| --- | --- |
| `eager` | Right after the first paint |
| `idle` | When the browser has nothing else to do |
| `visible` | When the element comes close to the screen (one screen height away). Within the page's background budget also in the background once the browser is idle, so a widget further down is ready when you scroll to it |
| `intent` | When the user shows intent: the pointer rests on the element for 60 ms, the element gets focus, or a touch starts |
| `interaction` | Only on the real interaction (`pointerdown` or `keydown`) |

Downloaded code is also run in an idle moment, so when the click comes, the handler runs at once.

The loader also protects the page:

- At most two scheduled downloads run at the same time, at low priority. Intent downloads skip the queue.
- Nothing starts within 150 ms of a scroll.
- With Save-Data on, or on a 2G connection, only `intent` downloads happen.

## Background budget

`visible` code below the fold is also downloaded once the browser is idle, until the page's budget is spent: 1 MB of minified code per page by default, counting each chunk with the code it imports that the page does not load anyway. Code past the budget waits for its element to come close to the screen. Set the budget in bytes, or `0` to turn background downloads off, for the whole app in the router plugin:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ preload: { background: 256 * 1024 } })],
});
```

or per server, which wins over the plugin setting:

```ts
import { start } from "@rivetjs/router/node";

await start({ dist: "dist", preload: { background: 256 * 1024 } });
```

`background` can also be a function of the request URL that returns a number, or `undefined` for the default, for pages that embed many small documents (the docs sites pass `0` for their example frames). The same `preload` option works on `createFetch`, the Vercel handler and `prerenderBuild` for static sites. The dev server always waits for the element: dev builds do not know chunk sizes.

## Code a handler imports

Each chunk imports other chunks (shared components, the libraries it uses). Next to every chunk, the production build writes a small file that lists everything the chunk imports. When the user shows intent and the loader requests a chunk, it also requests that list, then all the imported code at once, instead of one level of imports after another. Nothing extra is requested before intent. This applies to the first interaction on a page that has not loaded its interactive code yet, and only over HTTP/2 or HTTP/3: once that code is running, or over HTTP/1.1, the extra requests would compete with the code itself.

How many files a chunk imports depends on the build: small shared chunks that load together are merged, so a preloaded component of a component library arrives in a few dozen files instead of a hundred. See [Fewer shared chunks](chunks.md#fewer-shared-chunks).

## Lean pages

`preload: { lean: true }` downloads nothing before the first interaction: no `eager`, `idle`, `visible` or background downloads (as with Save-Data on) and, with lazy routes, no fetch-ahead of the router's chunks. Handlers load when they are needed: `intent` code on hover or focus, the rest on the event itself, which then replays. Use it for landing pages whose score counts every byte before the visitor acts. Like `background`, it can be a function of the request URL (`true`, or `undefined` for the default):

```ts
import { start } from "@rivetjs/router/node";

await start({ dist: "dist", preload: { lean: (url) => url.pathname === "/" || undefined } });
```

## Change it for one element

Add a `preload` attribute to the element with the handler:

```tsx
<button preload="idle" onClick={() => open.set(true)}>
  Open menu
</button>
```

The value must be a string literal: `eager`, `idle`, `visible`, `intent` or `interaction`. Your editor completes it, and other values are build errors. `<audio>` and `<video>` do not accept it, because `preload` is a real attribute there.

## Change it for a component

Export `preload` from the component's module. It applies to every handler in the module. Code downloads per chunk: with the default `chunks: "route"`, the module shares its route's chunk, so the export decides when that whole chunk loads.

```tsx title="src/components/SearchBox.tsx"
import { signal } from "@rivetjs/reactivity";

export const preload = "visible";

export default function SearchBox() {
  const query = signal("");
  return <input value={query()} onInput={(e) => query.set((e.target as HTMLInputElement).value)} />;
}
```

Or wrap part of the page in a `ChunkGroup` with a `preload` prop:

```tsx
import { ChunkGroup } from "@rivetjs/runtime/dom";

<ChunkGroup name="comments" preload="idle">
  <Comments />
</ChunkGroup>;
```

## Change it for the whole app

Add rules in the Vite config. A string matches the start of a symbol id (`<file>#<Component>`); a regular expression matches anywhere. The first matching rule wins.

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [
    rivetRouter({
      resume: {
        preload: {
          rules: [
            { match: "src/components/Checkout.tsx", strategy: "eager" },
            { match: /Footer/, strategy: "interaction" },
          ],
        },
      },
    }),
  ],
});
```

## Which setting wins

From strongest to weakest:

1. The `preload` attribute on the element.
2. The component level: `export const preload` or `<ChunkGroup preload>`.
3. App rules in the Vite config.
4. The automatic choice.

## Order of downloads

When several chunks wait for the same moment, the most important ones go first. Clicks and form submits count most, then input and change, then everything else. Handlers on links and forms get extra weight. Among equal chunks, smaller ones go first.

## Code that loads later

Code that a chunk loads with `import()`, such as lazy components or other routes, is fetched at idle once that chunk is scheduled. File-routed apps set `resume.lazy: "intent"`, so route code for other pages loads only when the user shows intent to navigate, for example by hovering a link.

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

- **Everything `eager`.** This brings back the cost of a large bundle. Use `eager` only for code that must run before the user acts.
- **Judging in the dev server.** Dev pages resume, but code is served per module, and `preload` exports, app rules and chunk grouping apply only in builds. Check a production build; see [Measuring](measuring.md).
- **`preload` from a variable.** The value must be written as a literal string, so the compiler can read it.

## See also

- [Chunks](chunks.md)
- [Preload by impact](../../best-practices/preload-by-impact.md)
- [Loading code](../../learn/loading-code.md)
- [Images](../assets/images.md) for preloading the main image
