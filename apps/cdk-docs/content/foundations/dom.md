---
title: DOM helpers
description: Shadow-DOM-safe DOM helpers from @rivetjs/cdk/dom - owner document and window, containment, scroll parents, scrollIntoView, viewport size, CSP nonce.
template: guide
status: experimental
related: [foundations/utilities, foundations/platform, foundations/props-and-values]
---

`@rivetjs/cdk/dom` provides DOM traversal, focus and scrolling helpers. The shadow-DOM-aware variants are always on (React Aria gates them behind a feature flag); in the light DOM they behave like the plain versions. Owner document and window are server-safe; everything else is for handlers and client effects.

::example{id=dom-scroll}

## Import

```ts
import { getOwnerDocument, nodeContains, getActiveElement, getScrollParents, scrollIntoView, scrollIntoViewport, getViewportSize, viewportSize, getNonce } from "@rivetjs/cdk/dom";
```

## Documents and events

| Export | Does |
| --- | --- |
| `isNode(value)`, `isDocument(value)`, `isShadowRoot(value)` | Type guards. |
| `getOwnerDocument(target?)` | The target's document (a window's document, a node's `ownerDocument`), else the global `document`. |
| `getOwnerWindow(target?)` | The target's window, else the global `window`. |
| `addEvent(target, type, handler, options?)` | `addEventListener` returning the remove function. |
| `setStyle(target, property, value, priority?)` | Sets an inline style on one element or several; returns a function that restores the previous value and priority. |
| `nodeContains(node, other)` | `contains` across shadow roots (slotted light DOM included). |
| `getActiveElement(doc?)` | The focused element through open shadow roots. |
| `getEventTarget(event)` | The first `composedPath()` entry. |
| `getPropagationTargets(from, to?)` | The ancestors an event passes from `from` up to `to` (crossing shadow roots). |
| `isFocusWithin(node)` | Whether focus is inside `node`, shadow DOM included. |

## Scrolling

| Export | Does |
| --- | --- |
| `isScrollable(node, checkForOverflow?)` | Whether `node` scrolls (`overflow` auto / scroll; with `checkForOverflow`, only when content overflows). |
| `getScrollParent(node, checkForOverflow?)` | The nearest scrollable ancestor, else the scrolling element. |
| `getScrollParents(node, checkForOverflow?)` | Every scrollable ancestor. |
| `scrollIntoView(scrollView, element, opts?)` | Scrolls only `scrollView` so `element` is visible, by the least distance (`{ block, inline }`: `"nearest"` default, `"start"`, `"center"`, `"end"`). Never scrolls the page. |
| `scrollRectIntoView(scrollView, element, rect, opts?)` | The same for a target rectangle. |
| `scrollIntoViewport(element, { containingElement? })` | Scrolls every scroll parent so `element` is in the viewport; with `containingElement`, keeps that container visible too. |

## Viewport and CSP

| Export | Does |
| --- | --- |
| `getViewportSize(win?)` | `{ width, height }` without the scrollbar, unaffected by pinch zoom (visual viewport where available). `0 × 0` on the server. |
| `viewportSize(win?)` | React Aria `useViewportSize`: `{ size: Signal<ViewportSize>, dispose }`, updated on resize, ignoring updates while pinch-zoomed. Call from a client effect and return `dispose`. |
| `getMetaValue(key, doc?)` | Content of `<meta name\|property="key">`; for `csp-nonce` also its `nonce`, then `__webpack_nonce__`. |
| `getNonce(doc?)` | The CSP nonce for injected `<style>` elements, cached per document. `resetNonceCache()` for tests. |

## Resumability

Reach the document through an element (`event.currentTarget.ownerDocument`, `getOwnerDocument(el)`) in component modules: the compiler rejects a bare `document` it cannot prove runs only in the browser. Call the scrolling and viewport helpers from handlers and client effects; keep only plain results in signals.

## Upstream

React Aria `utils/domHelpers`, `getScrollParent`, `getScrollParents`, `isScrollable`, `scrollIntoView`, `useViewportSize` (→ `viewportSize`), `getMetaValue`, `getNonce` and `shadowdom/DOMFunctions` (`nodeContains`, `getActiveElement`, `getEventTarget`). Deviation: the shadow DOM variants are always on.
