---
title: Breakpoints
description: Media query state from @rivetjs/cdk/layout - Material Breakpoints, MediaMatcher, the Angular CDK BreakpointObserver and a breakpointState signal for bindings.
template: guide
status: experimental
related: [foundations/utilities, foundations/observers, foundations/platform]
---

Prefer CSS media and container queries: they need no JavaScript and no resume state. Use `@rivetjs/cdk/layout` when a handler or a client effect must branch on a breakpoint, such as switching a popover to a tray on phones. It exposes breakpoint queries through observables and signals.

::example{id=layout-breakpoints}

## Import

```ts
import { Breakpoints, breakpointObserver, createBreakpointObserver, breakpointState, createMediaMatcher } from "@rivetjs/cdk/layout";
```

## API

| Export | Does |
| --- | --- |
| `Breakpoints` | Material Design media queries: `XSmall`, `Small`, `Medium`, `Large`, `XLarge`, `Handset`, `Tablet`, `Web`, and the `…Portrait` / `…Landscape` variants. |
| `createMediaMatcher(options?)` | Angular `MediaMatcher`: `matchMedia(query)`. On WebKit and Blink it also inserts an empty `@media` rule per query (those engines fire listeners only for queries with a rule). `options.nonce`: CSP nonce for that `<style>` (default `getNonce()`). Off the browser: a no-op matcher where only `all` and `""` match. |
| `createBreakpointObserver(matcher?)` | A new `BreakpointObserver` over `matcher` (default `createMediaMatcher()`). |
| `breakpointObserver()` | The shared observer (Angular root service), created on first use. |
| `breakpointState(value, options?)` | `{ state: Signal<BreakpointState>, connect(): () => void }` for bindings: `state` starts from `options.initial`; `connect()` reads the real state and follows changes. |

`BreakpointObserver`:

| Member | Does |
| --- | --- |
| `isMatched(value)` | Whether any of the queries matches now. Comma-separated queries count separately. |
| `observe(value)` | An observable of `BreakpointState`: the current state on subscribe, then one emission per batch of changes (debounced to a macrotask, `debounceTime(0)`). `subscribe(fn \| { next, complete })` returns `{ unsubscribe() }`. |
| `destroy()` | Completes every subscription and removes the media query listeners. |

`BreakpointState` is `{ matches: boolean; breakpoints: Record<string, boolean> }`: `matches` when any query matches, and each query given to `observe` with its own result.

`breakpointState` options:

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `initial` | `boolean \| Record<string, boolean>` | `false` | State on the server and before connecting: one value for every query, or per query. `false` is mobile-first markup. |
| `observer` | `() => BreakpointObserver` | `breakpointObserver` | Observer to connect to. |

## Observing changes

Subscribe in a client effect and return the cleanup:

::example{id=layout-observe}

## Resumability

- `breakpointState(…).state` is a plain signal: bindings that read it resume.
- Server-rendered HTML uses `initial`. Pick the value that matches most visitors, or design so both states render sensibly.

## Upstream

Angular CDK `cdk/layout`: `Breakpoints`, `MediaMatcher`, `BreakpointObserver`, `BreakpointState`, the WebKit / Blink empty-rule workaround. Services become factories (`createMediaMatcher`, `createBreakpointObserver`, shared `breakpointObserver()`); `observe()` returns a minimal observable instead of RxJS. Rivet adds `breakpointState`. Not ported: the `LayoutModule` NgModule.

## Common mistakes

- **Branching markup on a breakpoint.** The server does not know the viewport. Use CSS for layout; use this module for behaviour.
- **Forgetting to unsubscribe.** Return the cleanup from the client effect.
- **Expecting one emission per query.** Changes of several queries in one tick arrive as one emission.
