---
title: Loading code
description: How Rivet splits browser code into small chunks, when the browser fetches each one, and how you can change the timing.
template: concept
status: experimental
related: [learn/resuming, guides/performance/preloading, guides/performance/chunks, best-practices/preload-by-impact]
---

In a Rivet page, the browser does not download one big bundle. The build splits browser code into small files, and the browser fetches each file shortly before it is needed. This page explains how the split works and when each file loads.

## What it is

The build puts the browser code of each page into a :term[chunk]{id=chunk} (one JavaScript file): by default one chunk per route, plus a main chunk for code that every page shares, such as layouts. A chunk holds only the browser parts of the components: event handlers, client effects, and the code that updates the page when a signal changes. The rest of each component, the part that writes HTML, stays on the server. Code that several routes use goes into shared chunks, so a page never downloads another page's handlers.

The browser also needs a few shared files:

- **The loader**: a small inline script in the HTML (about 1.8 KB compressed). It listens for events, holds the first ones until their code is ready, and decides what to fetch. Its prefetch scheduling is a separate cached file that loads with the first intent, or after the first paint on pages that prefetch in the background.
- **The runtime**: the code that reads the saved state and updates the page. It loads together with the first chunk the page needs.
- **The router's link handling** (with file routes): loaded right after the page appears, so a link click can swap the page without a full reload.

## Why it matters

Each user pays only for what they use. A visitor who reads an article and leaves downloads no code from your components. A visitor who clicks "Like" downloads the browser parts of that page, usually a few kilobytes, and never the code that writes its HTML or the code of other pages.

## How it works

Here are two components on one page. Their handlers share the page's chunk:

::example{id=lazy-chunk-demo}

The "What loaded" line under the example shows the scripts fetched before and after the first click.

When a chunk loads depends on how the element is used. The server decides this for every page and writes the plan into the HTML. These are the default rules:

| Situation | When the chunk loads |
| --- | --- |
| A click, submit, input or key handler | **intent**: when you point at the element (after a short pause), focus it, or touch it |
| The same handler on three or more elements (list rows) | **visible**: when the elements scroll into view |
| A hover-like event | **visible** |
| `clientEffect` / `clientEvent` on `window` or `document` | **idle**: when the browser has nothing else to do |
| `clientEvent` on an element | **visible** |

A `clientEvent` with `standalone: false` only resumes when something else on the page does. On its own, the page ships no JavaScript. The router's link listeners use it in static builds (`rivetRouter({ clientRouter })`).

A `clientEvent` with `match` (a CSS selector) runs only for events inside a matching element, and its chunk loads only then. The router listens for clicks and hovers with `match: "a"`, so a first click on a plain button loads no router code.

What happens on interaction:

1. **Intent.** The pointer rests on a button. The loader asks the browser to fetch the chunk at low priority.
2. **Press.** On `pointerdown` or `keydown`, the loader makes sure the chunk is ready to run.
3. **Click.** The handler runs at once, inside the same event. So `event.preventDefault()` works as expected.

If you click before the chunk has arrived, the loader waits for it, runs the handler, and then repeats the browser's default action (for example following a link) unless the handler prevented it.

The loader also holds back while you scroll, keeps at most two background fetches in flight, and fetches only on intent when the browser reports Save-Data or a 2G connection.

## Change the timing

You can raise or lower the priority of a chunk. Stronger settings win: `eager` > `idle` > `visible` > `intent` > `interaction`.

For one element, with the `preload` attribute:

```tsx
<button type="button" preload="eager" onClick={() => open.set(true)}>
  Menu
</button>
```

For a whole component, with a module export:

```tsx title="src/components/Chat.tsx"
// Fetch the chunk that holds this component's code when the browser is idle.
export const preload = "idle";
```

- `eager`: after the first paint.
- `idle`: when the browser is idle.
- `visible`: when the element is near the viewport.
- `intent`: on hover, focus or touch (the default for clicks).
- `interaction`: only on the actual press.

[Preloading](../guides/performance/preloading.md) covers app-wide rules in `vite.config.ts`. [Preload by impact](../best-practices/preload-by-impact.md) helps you choose.

## Group code differently

By default each route is one chunk. The `resume.chunks` option in `vite.config.ts` can split them per component (`"component"`, the default until 2026-10-18) or per `<ChunkGroup>` (a part of the page you mark) instead. Fewer, larger chunks mean fewer requests but more unused code. Small shared chunks that load together are merged automatically (`resume.merge`). See [chunks](../guides/performance/chunks.md).

## What it means for your code

- **Only browser parts are sent.** A big component sends only its handlers and bindings, never its HTML code. With `chunks: "component"`, splitting interactive parts into separate components also gives you separate files.
- **Code a handler imports loads with it.** A large library used in a handler is fetched together with that handler's chunk. Load rarely used libraries with `import()` inside the handler.
- **Measure with a production build.** The dev server loads everything differently. See [measuring](../guides/performance/measuring.md).

## Related

- [Resuming](resuming.md): what the saved state contains.
- [Preloading](../guides/performance/preloading.md) and [chunks](../guides/performance/chunks.md).
