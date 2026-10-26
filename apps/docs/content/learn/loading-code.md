---
title: Loading code
description: How Rivet splits browser code into small files, when the browser fetches each one, and when it runs it.
template: concept
status: experimental
related: [learn/resuming, guides/performance/preloading, guides/performance/chunks]
---

In a Rivet page, the browser does not download one big bundle. The build writes the code of interactive components into small files, and the browser runs a file only when you use one of its components. This page explains what is in those files and when each one loads.

## What it is

The build writes one :term[chunk]{id=chunk} (one JavaScript file) per module that holds interactive components: components with a handler, a signal read in their markup, or an effect. Components with nothing interactive in their subtree never reach the browser. Code that several modules import goes into shared chunks, so a page never downloads another page's components.

The browser also needs a few shared files:

- **The loader**: a small inline script in the HTML (about 1.1 KB compressed). It listens for events on the whole document, holds the first ones until their code is ready, and replays them.
- **The runtime**: the code that runs a component over the server's HTML. It loads with the first component the page needs.
- **The router** (with file routes): the page's root component, which handles link clicks. It spans the page, so it wakes up on the first link you point at or click, and on the first event inside any interactive component.

## Why it matters

Each user pays only for what they use. A visitor who reads an article and leaves runs no code from your components. A visitor who clicks "Like" runs the code of that button's component and of the components around it (with file routes: the router's root, the layouts and the page, with the components that run together with them), never the code of other pages or of independent components nobody used.

## How it works

Here are two components on one page, each in its own file:

::example{id=lazy-chunk-demo}

The "What loaded" line under the example shows the scripts fetched before and after the first click.

What happens:

1. **Load.** The page appears and the loader starts. Your component code does not run.
2. **Fetch ahead.** When the browser is idle after the page has loaded, the loader asks it to fetch the runtime and the files of the page's interactive components at low priority, without running them.
3. **Intent.** The pointer rests on a button, it gets focus, or a key or the pointer goes down. The loader fetches every file it has not got yet, at high priority and all at once.
4. **Click.** The runtime runs the component, and the components around it that have not run yet, over their server HTML, then the click reaches the handler. So `event.preventDefault()` works as expected.

If you click before the file has arrived, the loader holds the event, waits for the code, runs the handler, and then repeats the browser's default action (for example following a link) unless the handler prevented it.

A `clientEvent` without `when` wakes its component when the browser is idle: a listener on `document` or `window` hears events that start outside the component, so no click inside it can wake it. With `standalone: false` it only resumes when something else on the page does. On its own, the page ships no JavaScript. The router's link listeners always use it. `rivetRouter({ clientRouter: true })` keeps every page resumable through the router's own component, which runs on the first link click.

The loader fetches ahead only when the browser reports neither Save-Data nor a 2G connection, and not on [lean pages](../guides/performance/preloading.md#lean-pages) or with `preload: { ahead: "intent" }` ([change the timing](../guides/performance/preloading.md#change-the-timing)); then it fetches on intent.

A `clientEffect` or `clientOnly` part with `when: "load" | "idle" | "visible"` wakes its component at that moment instead of on first use.

## Change the timing

Per-component preload settings (`export const preload`, the element `preload="…"` attribute, `ChunkGroup`) have no effect: not yet on the derived model; tracked in plan M6. See [preloading](../guides/performance/preloading.md).

## What it means for your code

- **Only interactive components are sent.** A component with nothing interactive in its subtree never loads in the browser; splitting interactive parts into their own components keeps the code that runs small.
- **Code a component imports loads with it.** A large library used in a handler is fetched together with that component's file. Load rarely used libraries with `import()` inside the handler.
- **Measure with a production build.** The dev server loads everything differently. See [measuring](../guides/performance/measuring.md).

## Related

- [Resuming](resuming.md): what the page carries and how a component wakes up.
- [Preloading](../guides/performance/preloading.md) and [chunks](../guides/performance/chunks.md).
