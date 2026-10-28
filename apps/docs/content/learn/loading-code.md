---
title: Loading code
description: How Rivet splits browser code into small files, when the browser fetches each one, and when it runs it.
template: concept
status: experimental
related: [learn/resuming, guides/performance/preloading, guides/performance/chunks]
---

In a Rivet page, the browser does not download one big bundle. The build writes the code of interactive components into small files, and the browser runs a file only when you use one of its components. This page explains what is in those files and when each one loads.

## What it is

The build writes one :term[chunk]{id=chunk} (one JavaScript file) per module that holds interactive components: components with a handler, a signal read in their markup, or an effect. Static-only pages can omit component code. Static helpers and other exports in an interactive module can still travel with that module. Code that several modules import goes into shared chunks.

The browser also needs a few shared files:

- **The loader**: a small inline script in the HTML. Its size depends on the page's triggers and loading features. It listens for events on the whole document, holds the first ones until their code is ready, and replays them.
- **The runtime**: the code that runs a component over the server's HTML. It loads with the first component the page needs.
- **The router** (with file routes): the page's root component, which handles link clicks. It listens for link navigation. A component proven to need no ancestor context can adopt without waking the router; other interactions may need its parent chain too.

## Why it matters

On a page without startup triggers, component execution waits until needed. A visitor can read a static article without running its components. A visitor who clicks "Like" wakes the button's boundary. If it needs context or non-data props from its parents, those parents run too. A boundary proven independent of ancestor context can adopt on its own. Modules may also contain other components, so component placement affects download size.

## How it works

Here are two components on one page, each in its own file:

::example{id=lazy-chunk-demo}

The "What loaded" line under the example shows the scripts fetched before and after the first click.

What happens:

1. **Load.** The page appears and the loader starts. Components without startup triggers wait until needed.
2. **Fetch ahead.** When the browser is idle after the page has loaded, the loader asks it to fetch the runtime and the files of the page's interactive components at low priority, without running them.
3. **Intent.** The pointer rests on a button, it gets focus, or a key or the pointer goes down. The loader fetches every file it has not got yet, at high priority and all at once.
4. **Click.** The runtime adopts the listening boundary and any ancestors it needs over their server HTML, then the click reaches the handler. So `event.preventDefault()` works as expected.

If you click before the file has arrived, the loader holds the event, waits for the code, runs the handler, and then repeats the browser's default action (for example following a link) unless the handler prevented it.

A `clientEvent` without `when` wakes its component when the browser is idle: a listener on `document` or `window` hears events that start outside the component, so no click inside it can wake it. With `standalone: false` it only resumes when something else on the page does. On its own, the page ships no JavaScript. The router's link listeners always use it. `rivetRouter({ clientRouter: true })` keeps every page resumable through the router's own component, which runs on the first link click.

The loader fetches ahead only when the browser reports neither Save-Data nor a 2G connection, and not on [lean pages](../guides/performance/preloading.md#lean-pages) or with `preload: { ahead: "intent" }` ([change the timing](../guides/performance/preloading.md#change-the-timing)); then it fetches on intent.

`clientOnly` supports `when: "load" | "idle" | "visible"`. `clientEffect` can wake at idle or near the viewport; its `"load"` value also schedules idle startup. See [effect timing](../guides/state/effects.md#choose-when-it-starts).

## Change the timing

Per-component preload settings (`export const preload`, the element `preload="…"` attribute, `ChunkGroup`) have no effect: not yet on the derived model; tracked in plan M6. See [preloading](../guides/performance/preloading.md).

## What it means for your code

- **Modules determine what is fetched.** A static page can omit component code. Put interactive parts and heavy dependencies in separate modules when they should load independently.
- **Code a component imports loads with it.** A large library used in a handler is fetched together with that component's file. Load rarely used libraries with `import()` inside the handler.
- **Measure with a production build.** The dev server loads everything differently. See [measuring](../guides/performance/measuring.md).

## Related

- [Resuming](resuming.md): what the page carries and how a component wakes up.
- [Preloading](../guides/performance/preloading.md) and [chunks](../guides/performance/chunks.md).
