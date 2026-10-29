---
title: Chunks
description: See which JavaScript files a Rivet build makes for resumed pages and how to check them.
template: guide
status: experimental
related: [guides/performance/preloading, learn/loading-code, guides/performance/measuring]
---

A :term[chunk]{id=chunk} is one JavaScript file that the browser downloads. Rivet does not send one big bundle: the build writes the code of interactive components into files of their own, and the browser runs a file only when one of its components is used.

After reading this page you know which chunks a build makes and how to check the result.

## What the build makes

A production client build of resumed pages contains:

- **The runtime.** The code that runs a component over the server's HTML. It loads with the first component the page needs.
- **Component chunks.** One per module that holds interactive components (a handler, a signal read in markup, an effect). Static helpers and imports used by an interactive module can be included in its chunk; static-only pages can omit component code.
- **Lite chunks and the lite runtime.** A component whose interactive part is only its own signals, computed values, handlers, two-way `model:` bindings, keyed `For` lists of plain elements and text or attribute bindings on its own elements also gets a small chunk that updates the server's HTML directly. A page where every interactive component has such a chunk loads the lite runtime and those chunks instead of the runtime and the component chunks. With file routes and client navigation, a page also loads the lite runtime when every component that reacts to events has a lite chunk and reads nothing the router or a layout provides; the runtime and the router load when the pointer rests on a link or on the first navigation. Every other page loads exactly what it did before. The lite files share no code with the other chunks, so the build holds some code twice; a page starts with the selected runtime. A lite adoption miss or client navigation on a mixed page can load the full runtime later. The lite runtime brings its own small signal core, so such a page does not load `@rivetjs/reactivity` either. When the app has only one module with a lite chunk, the build puts the lite runtime and that chunk into one file (`lite-….js`), so such a page fetches a single script (two when that component is a default export: a small `lite-runtime-….js` points at the same file).
- **Shared chunks.** Code that several chunks import, such as DOM helpers or a component library.
- **The built-in values chunk.** It reads regular expressions, `URLSearchParams`, binary data and errors back from the page. It loads only on pages and route data that hold such a value.
- **`.vite/rivet-resume.json`.** A manifest that maps each interactive component to its chunk URL (and its lite chunk, under `lite`), with sizes and each chunk's static imports. The server uses it to write the page.

The page itself carries no application bundle. The server writes the chunks of the page's interactive components into the `<script type="rivet/boundaries">` near the end of `<body>`; the inline loader fetches and loads them after the page loads and runs a component when it is needed (see [Preloading](preloading.md)).

`resume.chunks` (including `"route"`), `merge` and `cap` are removed options. Current resume builds emit boundary modules and shared dependencies; `ChunkGroup` does not regroup them. For static sites, the optional [two-pass build](../deploy/static-hosts.md#fewer-script-files) can combine shared chunks that the same pages always load together.

## Lazy components and routes

`lazyComponent(() => import("./Chart.tsx"))` puts a component behind a dynamic import. Its code is a separate chunk: on a resumed page the browser fetches it at idle after the page's other code (without running it), and runs it when the component first renders. See [Preloading](preloading.md).

In a file-routed app, every page is loaded this way. Code for other pages loads when the user navigates to them.

To defer a function rather than a component, use [`lazyFunction`](../../reference/utilities.md#lazy-functions-lazyfunction).

## Common mistakes

- **Components outside `src/routes` resume only through `appModules`.** It is on by default in `rivetRouter`. With `resume: { appModules: false }`, list them in `resume.modules`, or their handlers do not work in production.
- **Judging chunk sizes in dev.** The dev server serves one file per module. Build for production first.

## See also

- [Preloading](preloading.md)
- [Loading code](../../learn/loading-code.md)
- [Measuring](measuring.md)
