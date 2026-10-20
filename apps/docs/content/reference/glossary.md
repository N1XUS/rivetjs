---
title: Glossary
description: Short, plain definitions of the words these docs use, from action to signal.
template: reference
---

Each word below has its own link target, so other pages can point straight at a definition.

## Action

A server function that handles a form submit (a `POST` request) for a page. Actions are the `actions(…)` export of the page file.

## Adapter

The piece that connects a built app to where it runs: the Node adapter serves requests, the static adapter writes HTML files.

## Chunk

One JavaScript file made by the build. The browser downloads a chunk only when the page needs the code inside it.

## Chunk group

Components whose browser code shares one chunk: the part of the page inside `<ChunkGroup>` (from `@rivetjs/runtime/dom`) when `resume.chunks` is `"group"`. Loading one of its chunks for a click also schedules the others. Not an island.

## Computed

A value worked out from signals that updates itself when they change, for example a total from a list of prices.

## Content Security Policy

A browser rule list, sent by the server, that says which scripts and styles a page may run. It blocks injected code. Often shortened to CSP.

## Context

A way to hand a value to every component inside a part of the page without passing it through each component's props.

## Effect

Code that runs again whenever the signals it reads change, used to sync with the world outside the page, such as the document title or a timer.

## Endpoint

A route file that answers a request with data (JSON, text, a file) instead of a page: a plain `.ts` file exporting request handlers like `onGet(…)` or `onPost(…)`.

## Guard

A server function that runs before a page loads and can send the visitor elsewhere (for example to a login page) or refuse the request. It is the `guard(…)` export of a page or layout file.

## Hot reload

Updating code in the running dev page without a full reload, keeping the page's state when it can. Also called HMR (hot module replacement).

## Hydration

What most frameworks do after server rendering: run every component again in the browser to attach event handlers. Rivet resumes instead, so it skips this step.

## Island

A component from another framework (React or Preact today; Solid, Vue and Svelte are planned) used inside a Rivet page. Its HTML comes from the server; its framework code loads and starts on its own, for example only when it scrolls into view. See [React and Preact components](../guides/components/framework-components.md).

## Layout

A component that wraps every page in its folder, for shared parts like a header, a sidebar or a footer. Its file is `_layout.tsx`.

## Loader

A server function that fetches the data a page needs before it renders. It is the `load(…)` export of the page or layout file.

## Locale

A language (and sometimes a region) a page is shown in, written as a code like `en`, `de` or `pt-BR`.

## Prerender

Rendering pages to plain HTML files at build time, so any static file host can serve them.

## Preload

Asking the browser to download code before it is needed, for example when the pointer moves over a button, so the click feels instant.

## Resumability

The browser carries on from the state the server rendered instead of starting the app over. Components do not run again; only the code for what you touch loads.

## Route

A URL pattern and the page that answers it. In Rivet each file in `src/routes` is a route.

## Serializable

A value that can be written into the page as data and read back in the browser: strings, numbers, booleans, plain objects, arrays, dates and signals holding these, functions written in a component module or used there by name, and instances of a data class of a component module or of a class that rebuilds itself (`[serialize]` / `static [revive]`, `registerClass`). Package-class instances (a bson `ObjectId`, unless the class is registered with `registerClass`) and library objects are not; build them in the browser with `reconstruct(() => …)` (see [what the handler can use](../learn/resuming.md#what-the-handler-can-use)).

## Server rendering

Building a page's HTML on the server, so the visitor sees content before any JavaScript runs. Also called SSR.

## Signal

A box that holds a value. Reading it inside the page subscribes that spot; writing it updates exactly the spots that read it.

## Streaming

Sending the HTML in pieces as it becomes ready, so the top of the page shows while slow data is still loading.

## Trusted Types

A browser feature that only lets vetted values reach risky DOM APIs like `innerHTML`, blocking a common kind of injection bug.
