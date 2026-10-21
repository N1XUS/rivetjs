---
title: Measuring
description: Check what a Rivet page really loads with the browser's developer tools, on a production build, before and after the first interaction.
template: guide
status: experimental
related: [guides/performance/preloading, guides/performance/chunks, guides/performance/streaming, gotchas/dev-and-production-differ]
---

You cannot improve what you do not measure. This page shows how to check a Rivet page in the browser's developer tools: how big the HTML is, which JavaScript loads and when, and whether an interaction waits for the network.

Rivet does not ship its own measuring tool for production pages. The browser's network and performance panels are enough. The steps below use Chrome DevTools; Firefox and Safari have the same panels with similar names.

## Measure a production build

The dev server serves code unbundled (one module per file, one chunk per component) and unminified, and pages render in the browser after the first edit. Numbers from `npm run dev` say nothing about production. See [Dev and production differ](../../gotchas/dev-and-production-differ.md).

Build and serve the app the way you deploy it:

```bash
npm run build
npm start          # server starter
npm run preview    # static starter
```

Open the page in a private window, so browser extensions do not add requests.

## Check the first load

1. Open DevTools (:kbd[F12]) and go to the **Network** panel.
2. Turn on **Disable cache**. Optional: pick a slower connection in the throttling menu, and in the **Performance** panel, slow down the CPU. Real phones are slower than your laptop.
3. Reload the page.

What to look at:

| What | Where | What you want |
| --- | --- | --- |
| HTML size | The document request, **Size** column (compressed) and **Response** tab | Small. The page state is part of it. |
| JavaScript before any interaction | Filter **JS** | Little. The resume loader is inline in the HTML. File-routed apps load the runtime and the router's app chunk after the first paint, so links can navigate inside the page. |
| CSS | Filter **CSS** | One or a few stylesheets. |
| Images | Filter **Img** | The main image loads early; images below the fold load later. |
| Compression | Document request, **Headers**, `content-encoding` | `br` or `gzip` |

### Read the page state

In the **Elements** panel, find `<script type="rivet/state">` near the end of `<body>`. It holds the values the browser needs to continue where the server stopped (signals, captured values, the list of chunks). If it is large, look for big data captured by handlers. Pass only what the handler needs; see [Serializable captures](../../best-practices/serializable-captures.md). In development the server names the largest captures for you, and long lists have their own options: see [large data in resume state](../../learn/resuming.md#large-data-in-resume-state). A page built with the experimental [derived model](../../learn/resuming.md#derived-model-experimental) has a `<script type="rivet/boundaries">` instead, with the state values of its interactive components only.

The `data-preload` attribute on the same script lists the chunks the loader will fetch without waiting for the user, with their strategy: `"e"` (eager), `"i"` (idle) or `"v"` (visible). Chunks with the `intent` strategy are not listed; they load when the user is about to interact. See [Preloading](preloading.md).

If the page has client effects or client events, `data-boot` is set, and the runtime loads at idle.

## Check the first interaction

Keep the Network panel open, with the JS filter, after the page has loaded.

1. Note which scripts are already in the list.
2. Move the pointer over a button and rest there. Intent prefetch starts: new JS requests appear with low priority.
3. Click. The handler should run at once.

What to look for:

- **Requests during the click.** If a JS request starts only after `pointerdown`, the user waited for the network. Consider a stronger strategy (`visible` or `idle`) for that element.
- **Code that loaded but never ran.** Open the **Coverage** panel (Command menu, "Show Coverage"), reload, use the page, and look at unused bytes per file. Code loaded early but unused is a candidate for a weaker strategy.
- **Chunk count.** Many small requests for one click can mean the grouping does not fit; try another [chunk grouping](chunks.md).

## Check timing

In the **Performance** panel, record a reload and then a click:

- **First paint and Largest Contentful Paint (LCP).** For server-rendered pages, these depend mostly on the HTML and the main image. Use `priority` and `ImagePreload` for the main image; see [Images](../assets/images.md).
- **The click task.** Find the click event in the main thread. A short task means the handler ran without waiting. A gap followed by script evaluation means the code was not ready.

The **Lighthouse** panel gives a quick summary, including layout shift. Images from `Picture` always have `width` and `height`, so they do not shift the layout.

## Check streaming

For a page with [streaming](streaming.md), click the document request and open **Timing**. "Content Download" takes until the last streamed part arrives, while the first paint happens much earlier. If the first paint waits for the whole download, a proxy probably buffers the response.

## Compare fairly

- Measure several times and compare the middle value, not the best one.
- Change one thing at a time: a preload rule, a chunk grouping, an image size.
- Write down the build, the browser, the throttling and the device with every number.

## See also

- [Preloading](preloading.md)
- [Chunks](chunks.md)
- [DevTools](../tooling/devtools.md) for components and signals during development
- [Benchmarks](../../about/benchmarks.md)
