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
- **Component chunks.** One per module that holds interactive components (a handler, a signal read in markup, an effect). Modules with nothing interactive are not in the browser build.
- **Lite chunks and the lite runtime.** A component whose interactive part is only its own signals, handlers and text or attribute bindings on its own elements also gets a small chunk that updates the server's HTML directly. A page where every interactive component has such a chunk loads the lite runtime and those chunks instead of the runtime and the component chunks (tutorial step 3: about 7 KB instead of 31 KB gzip). Every other page loads exactly what it did before. The lite files share no code with the other chunks, so the build holds some code twice; a page never loads both runtimes.
- **Shared chunks.** Code that several chunks import, such as DOM helpers or a component library.
- **The built-in values chunk.** It reads regular expressions, `URLSearchParams`, binary data and errors back from the page. It loads only on pages and route data that hold such a value.
- **`.vite/rivet-resume.json`.** A manifest that maps each interactive component to its chunk URL (and its lite chunk, under `lite`), with sizes and each chunk's static imports. The server uses it to write the page.

The page itself carries no application bundle. The server writes the chunks of the page's interactive components into the `<script type="rivet/boundaries">` near the end of `<body>`; the inline loader fetches them after the page loads and runs one when it is needed (see [Preloading](preloading.md)).

Grouping options (`resume.chunks`, `merge`, `cap`) and `ChunkGroup` have no effect: not yet on the derived model; tracked in plan M6.

## Lazy components and routes

`lazyComponent(() => import("./Chart.tsx"))` puts a component behind a dynamic import. Its code is a separate chunk, loaded when the component first renders in the browser.

In a file-routed app, every page is loaded this way. Code for other pages loads when the user navigates to them.

## Common mistakes

- **Components outside `src/routes` resume only through `appModules`.** It is on by default in `rivetRouter`. With `resume: { appModules: false }`, list them in `resume.modules`, or their handlers do not work in production.
- **Judging chunk sizes in dev.** The dev server serves one file per module. Build for production first.

## See also

- [Preloading](preloading.md)
- [Loading code](../../learn/loading-code.md)
- [Measuring](measuring.md)
