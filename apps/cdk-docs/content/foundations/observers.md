---
title: Observers
description: Content and resize observers from @rivetjs/cdk/observers - observeContent, the shared ContentObserver and SharedResizeObserver, and useResizeObserver.
template: guide
status: experimental
related: [foundations/utilities, foundations/layout, foundations/virtualizer]
---

`@rivetjs/cdk/observers` watches elements: content changes through a shared `MutationObserver` (Angular CDK `ContentObserver`, `cdkObserveContent`) and size changes through shared `ResizeObserver`s (Angular CDK `SharedResizeObserver`, React Aria `useResizeObserver`). Nothing runs at import time or on the server: call the functions from a client effect and return their cleanup.

::example{id=observers-content}

## Import

```ts
import { observeContent, contentObserver, createContentObserver, sharedResizeObserver, createSharedResizeObserver, useResizeObserver } from "@rivetjs/cdk/observers";
```

## Content

| Export | Does |
| --- | --- |
| `observeContent(element, onChange, options?)` | `cdkObserveContent`: calls `onChange(records)` when text or children of `element` change (subtree). Returns the cleanup. `element` is an element or a ref accessor. |
| `contentObserver()` | The shared `ContentObserver`, created on first use. |
| `createContentObserver(factory?)` | A new `ContentObserver`: one `MutationObserver` per element, shared and reference counted. `factory` is the `MutationObserverFactory` test seam. |
| `ContentObserver.observe(element)` | An observable of `MutationRecord[]`, comment-only changes dropped. |
| `ContentObserver.destroy()` | Disconnects every observer and completes every stream. |
| `defaultMutationObserverFactory` | `{ create(callback) }`: a `MutationObserver`, or `null` where unavailable. |

`observeContent` options:

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `debounce` | `number \| string` | `0` | Milliseconds (coerced like the Angular input). One call per quiet period, with the last records. |
| `observer` | `ContentObserver` | `contentObserver()` | Observer to use. |

Comment nodes added or removed, and comment text changes, are ignored: Rivet's range markers and other framework anchors do not count as content changes. To disable the directive, do not call it, or call the cleanup.

## Size

| Export | Does |
| --- | --- |
| `useResizeObserver({ ref, box?, onResize })` | React Aria: calls `onResize()` when the element resizes (`ResizeObserver`, or window `resize` where unsupported). Returns the cleanup. |
| `sharedResizeObserver()` | The shared `SharedResizeObserver`, created on first use. |
| `createSharedResizeObserver()` | One `ResizeObserver` per box type for the whole app. |
| `SharedResizeObserver.observe(target, { box? })` | The same observable for the same element and box while it has subscribers; a new subscriber gets the last entries at once. `box` defaults to `content-box`. |
| `SharedResizeObserver.destroy()` | Disconnects every observer. |

The shared observer logs a clearer console error for "ResizeObserver loop limit exceeded".

::example{id=observers-resize}

## Observables

The observables are the RxJS subset the CDK needs: `subscribe(fn)` or `subscribe({ next, complete })` returns `{ unsubscribe() }`. `Observable`, `ObserverLike`, `Unsubscribable` are exported as types; `_Subject` is the internal hot stream.

## Resumability

Call the functions inside `clientEffect(() => …)` from `@rivetjs/runtime/dom` and return the cleanup. Capture only elements (refs), signals and plain values in the effect. Do not keep the observers or subscriptions in component state.

## Upstream

- Angular CDK `cdk/observers`: `MutationObserverFactory`, `ContentObserver`, `CdkObserveContent` (→ `observeContent`), `SharedResizeObserver` (private upstream). Services become factories with shared instances; observables are minimal.
- React Aria `utils/useResizeObserver` (→ `useResizeObserver`, a function returning its cleanup).
- Not ported: the `ObserversModule` NgModule, `cdkObserveContentDisabled` (skip the call instead).

## Common mistakes

- **Observing in the component body.** On the server there is no DOM, and on a resumed page the body does not run. Use a client effect.
- **Counting comment changes.** They are filtered out by design.
- **Reading layout in `onChange`.** A content change does not mean a size change; use the resize observers for sizes.
