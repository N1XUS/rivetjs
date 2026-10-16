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
- **Server code in route files.** `serverLoad`, `serverGuard`, `serverActions` and request handlers (`onGet`, `onPost`, …) next to the page in the same file; the compiler removes them from browser builds. Experimental. See [server code in routes](../guides/routing/server-code-in-routes.md).
- **Forms.** `@rivetjs/forms`: validation, server pipeline, nested fields, arrays, wizards, autosave and CSRF protection. Experimental. See [forms](../guides/forms/forms.md).
- **Vite integration** with hot reload that keeps component state in dev. See [Vite](../guides/tooling/vite.md).
- **Images.** Build-time optimisation with `?image` imports and `Picture`. See [images](../guides/assets/images.md).
- **Kit.** `@rivetjs/kit`: title, meta, links, scripts with load strategies, JSON-LD, SEO builders, fonts and image preloads from any component, under a strict CSP. Experimental. See [kit](../ui/kit.md).
- **Scoped styles.** `css` blocks in the component file and CSS module files, with class names unique to the file, shipped as per-route stylesheets. Experimental. See [scoped styles](../guides/styling/scoped-styles.md).
- **Translations.** Compile-time i18n with ICU messages, locale URLs and no message runtime in the browser for static text. See [translating text](../guides/i18n/translating-text.md).
- **Security.** Strict Content Security Policy with nonces (hashes for static pages) and optional Trusted Types. See [CSP](../guides/security/csp.md).

### Tools

- **DevTools** on the dev server: component tree, live signals, update highlights, hot reload and error logs.
- **Language service.** Rivet compiler errors in your editor through a TypeScript plugin, a `rivet-check` command and a VS Code extension shell. Experimental. See [language service](../guides/tooling/language-service.md).
- **Benchmarks** against ASP.NET Razor, Solid, Qwik and React. See [benchmarks](benchmarks.md).

## In progress

This has a written design. It is not available yet; names in the design may change.

| Feature | What it adds | Design |
| --- | --- | --- |
| CDK and accessible components | `@rivetjs/cdk`: utilities (focus, overlays, collections, ids) and unstyled, accessible components. | [spec](https://github.com/rivetjs/rivet/blob/main/docs/design/specs/2026-10-03-cdk-and-aria-design.md) |

See [UI overview](../ui/overview.md).

## Goals that are not met yet

- **Server speed.** The goal is to beat ASP.NET Razor on CPU per page, response time, time to first byte and memory. Static pages meet it in the latest measurements except one case: on a page of short text fields at concurrency 10, CPU per page is level and Razor's median response is faster. Interactive (resumable) pages still use more CPU than plain hydratable Solid 1.9 at 1,000 rows and more memory than Solid. See [benchmarks](benchmarks.md).
- **Large pages in the browser.** Mounting very large pages and their memory use are known costs.
- **npm packages.** Nothing is published yet.
