---
title: Roadmap
description: What Rivet can do today, what is being designed or built next, and where to read the plans.
template: page
related: [about/benchmarks, start/what-is-rivet]
---

Rivet is experimental. The first npm release, `0.1.0-alpha.0`, is available on the `latest` tag. APIs can still change. "Done" means built and tested, not stable.

## Done

### Core

- **Compiler.** JSX/TSX compiler written in Rust and compiled to WebAssembly. Separate output for the server and the browser. Reports errors with file and line. See [JSX](../reference/jsx.md).
- **Signals.** `signal`, `computed`, `effect`, `batch`, context and cleanup in `@rivetjs/reactivity`. See [signals](../guides/state/signals.md).
- **Server rendering.** Escaped, streaming HTML output with ordered async data, and Node writers.
- **Browser rendering.** Fine-grained DOM updates, keyed lists (`For`), `Async` boundaries, lazy components and browser-only components (`clientOnly`).
- **Resuming.** The browser carries on from the server's state without running components again. Handler code loads on demand, with a preload planner and a small loader. Streaming of pending `Async` parts. See [resuming](../learn/resuming.md).

### App building

- **File router.** Routes from `src/routes`, layouts, guards, loaders, actions, endpoints, headers, typed routes, errors and 404 pages. Node, static and single-page adapters. See [file routes](../guides/routing/file-routes.md).
- **Links and transitions.** `<Link>`, view transitions between pages and pending UI. Experimental. See [transitions](../guides/routing/transitions.md).
- **Slots.** Default, named and scoped slots with `<slot>` and `r:slot`. Slot content renders only when used, and resumes. Experimental. See [slots](../guides/components/slots.md).
- **Server code in route files.** `load(…)`, `guard(…)`, `actions(…)` and request handlers (`onGet(…)`, `onPost(…)`, …) next to the page in the same file; the compiler removes them from browser builds. Experimental. See [server code in routes](../guides/routing/server-code-in-routes.md).
- **Forms.** `@rivetjs/forms`: validation, server pipeline, nested fields, arrays, wizards, autosave and CSRF protection. Experimental. See [forms](../guides/forms/forms.md).
- **Vite integration** with hot reload that keeps component state in dev. See [Vite](../guides/tooling/vite.md).
- **Images.** Build-time optimisation with `?image` imports and `Picture`. See [images](../guides/assets/images.md).
- **Kit.** `@rivetjs/kit`: title, meta, links, scripts with load strategies, JSON-LD, SEO builders, fonts and image preloads from any component, under a strict CSP. Experimental. See [kit](../ui/kit.md).
- **Scoped styles.** `css` blocks in the component file and CSS module files, with class names unique to the file, shipped as per-route stylesheets. Experimental. See [scoped styles](../guides/styling/scoped-styles.md).
- **Translations.** Compile-time i18n with ICU messages, locale URLs and no message runtime in the browser for static text. See [translating text](../guides/i18n/translating-text.md).
- **Security.** Strict Content Security Policy with nonces (hashes for static pages) and optional Trusted Types. See [CSP](../guides/security/csp.md).
- **Motion.** `@rivetjs/motion`: the Motion (motion.dev) API on Rivet signals, with entrances in CSS, exit and layout animations and scroll values. Experimental. See [motion](../guides/motion/index.md).
- **React and Preact components.** `@rivetjs/bridge-react` and `@rivetjs/bridge-preact` render components of those frameworks as islands: server-rendered into the stream, hydrated by a `client` policy, with live props, callbacks and Rivet content in their slots. Experimental. See [React and Preact components](../guides/components/framework-components.md).

### Components

- **CDK.** `@rivetjs/cdk`: focus, overlays, collections, drag and drop, dates and unstyled, accessible components. See the [cdk docs](site:cdk/foundations/overview/).
- **UI.** `@rivetjs/ui`: styled, resumable compound components with themes and a theme builder. Alpha. See the [UI docs](site:ui/).

### Tools

- **DevTools** on the dev server: component tree, live signals, update highlights, hot reload and error logs.
- **Language service.** Rivet compiler errors in your editor through a TypeScript plugin, a `rivet-check` command and a VS Code extension shell. Experimental. See [language service](../guides/tooling/language-service.md).
- **Starters and Nx.** `npm create rivet@latest` with four starters, and the `@rivetjs/nx` plugin. See [quick start](../start/quick-start.md) and [Nx](../guides/tooling/nx.md).
- **Testing.** `@rivetjs/testing`: component tests in happy-dom or a browser, user events, and resume tests. See [testing](../guides/tooling/testing.md).
- **AI assistants.** An MCP server with docs search and code checks, and agent skills. See [AI assistants](../guides/tooling/ai.md).
- **Benchmarks** against ASP.NET Razor, Solid, Qwik and React. See [benchmarks](benchmarks.md).

## In progress

These have a written design. They are not available yet; names in the design may change.

| Feature | What it adds | Design |
| --- | --- | --- |
| Lazy list rows | A resumable keyed `<For>` sends each row as its key and the items once; the browser rebuilds a row when it is first used. Available today as an experimental opt-in, off by default: see [large data in resume state](../learn/resuming.md#lazy-rows-experimental). | [spec](https://github.com/N1XUS/rivetjs/blob/main/docs/design/specs/2026-10-19-lazy-collection-rows-design.md) |
| Resumable components (derived model) | The page carries the state values of its interactive components only, and the browser runs a component's compiled code over the server markup on first use. Available today as an experimental opt-in, off by default: see [derived model](../learn/resuming.md#derived-model-experimental). | [spec](https://github.com/N1XUS/rivetjs/blob/main/docs/design/specs/2026-10-18-structural-resume-design.md) |
| Data from the page | Text that list rows already show is read back from the page instead of being sent twice. Available today as an experimental opt-in, off by default: see [data from the page](../learn/resuming.md#data-from-the-page-experimental). | [spec](https://github.com/N1XUS/rivetjs/blob/main/docs/design/specs/2026-10-20-dom-backed-loader-data-design.md) |
| Cached page shells | A route rule `shell: true` stores the rendered page up to its deferred parts and sends it first; the parts that differ per visitor (`load(fn, { defer: true })`) render per request and stream in. | [spec](https://github.com/N1XUS/rivetjs/blob/main/docs/design/specs/2026-10-20-ppr-shell-design.md) |
| Solid, Vue and Svelte components | Bridges for three more frameworks, and keeping an island alive across client navigation (`persist`). | [spec](https://github.com/N1XUS/rivetjs/blob/main/docs/design/specs/2026-10-11-framework-bridges-design.md) |

## Goals that are not met yet

- **Server speed.** The goal is to beat ASP.NET Razor on CPU per page, response time, time to first byte and memory. Static pages meet it in the latest measurements at 1,000 and 5,000 rows, the page of short text fields included (measured one request at a time); the smallest page is level. Interactive (resumable) pages still use more CPU than plain hydratable Solid 1.9 on a 100-row page under ten concurrent requests, more server memory than Solid on small pages, and download more JavaScript before the first input than Solid. See [benchmarks](benchmarks.md).
- **Large pages in the browser.** Mounting 5,000 rows is slower than Solid 1.9 in the browser benchmark. The gap was traced to when V8 finishes garbage collection after the benchmark's forced collection, not to the per-row work; a protocol change is proposed. See [benchmarks](benchmarks.md#building-the-page-in-the-browser).
- **Stable APIs.** Packages are on npm as an alpha. Names and behaviour still change between releases.
