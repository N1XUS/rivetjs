---
title: Portal
description: Portal and PortalProvider from @rivetjs/cdk/portal render content elsewhere, server-rendered in place and moved at load; plus Angular CDK portals and outlets.
template: guide
status: experimental
related: [foundations/overlays, foundations/overlay-service, components/tooltip, components/popover]
---

`<Portal>` renders its children in an owned `<div data-rivet-portal>` somewhere else in the document: at the end of `<body>`, or in a container you name. Content in a portal escapes the `overflow: hidden`, `transform` and stacking context of the component that renders it. On the server it renders **in place** (visible without JavaScript, indexable) and is moved to its mount at `load`; in the browser it is moved right after mounting. Every cdk overlay renders through it.

::example{id=portal-show}

## Import

```tsx
import { Portal, PortalProvider, Overlay, PortalContext, resolveMount, type PortalMount } from "@rivetjs/cdk/portal";
```

## Portal

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `mount` | `PortalMount` | nearest `PortalProvider`, else `document.body` | Where to render. |
| `class` | `string` | none | Class of the host `<div data-rivet-portal>`. |
| `onPlaced` | `() => void` | none | Called once the host is in its mount. The move runs in a client effect, after the content's own effects may have run, so content that measures its layout waits for it. |
| `children` | content | none | Rendered inside the host, reactive as anywhere else. |

`PortalMount` is a CSS selector (resolved in the browser; serializable, so it works on resumed pages), an element, a `ref()`, or a function returning an element (elements and plain functions only for portals rendered in the browser). A missing element falls back to `document.body`.

- The host is appended to the mount; nothing stays in place after the move.
- When its owner goes away (a `<Show>` turning false, a re-created region, a client navigation), the host is removed.
- Moving a node blurs focus inside it; the portal puts focus back on the element that had it.
- Server markers inside the host stay balanced, so the page resumes normally after the move.

## Server-rendered portals

::example{id=portal-server}

A portal that is open on the server (`<Show when>` starting true, or no `<Show>` at all) is in the HTML where it is rendered, and moved at `load`. The example also passes `mount` as a selector and `class` for the host.

## PortalProvider

::example{id=portal-provider}

`PortalProvider` (React Aria `UNSAFE_PortalProvider`) sets the default mount of every `Portal`, `Overlay`, `OverlayContainer` and overlay component (Modal, Popover, Tooltip) below it. Plain children (a lazy slot) and function children both render under the provider.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `container` | `PortalMount` | none | Default mount below the provider. |
| `children` | content or `() => content` | none | |

`PortalContext` is the context token; `resolveMount(mount)` resolves a mount to an element in the browser.

Known limitation: popovers created on a resumed page do not see the provider and render in `body` (tooltips resolve it when they render; `Modal` resolves it in its outer component). Overlay components have no per-overlay container prop (React Aria `UNSTABLE_portalContainer` is not ported): `PortalProvider` is the only way to move them. A modal popover or dialog mounted into an element of the page makes that element inert while open.

## Overlay

`<Overlay>` is a `Portal` with a focus scope (React Aria `Overlay`): see [Overlays](overlays.md#your-own-modal).

## Portals and outlets (Angular CDK)

::example{id=portal-outlet}

`@rivetjs/cdk/portal-outlet` ports Angular CDK's imperative portals, browser only: a **portal** is content, an **outlet** is a place it can be attached to. The [overlay service](overlay-service.md) attaches them to its panes.

| Export | Description |
| --- | --- |
| `new ComponentPortal(component, props?, owner?)` | A Rivet component and its props. `owner` (from `getOwner()`) keeps the caller's contexts. |
| `new TemplatePortal(render, context?, owner?)` | A render function with a context (Angular `TemplateRef`); `attach(host, context?)` can swap the context. |
| `new DomPortal(element)` | An element already in the document, moved into the outlet and back to its place (a comment anchor) on detach. It must have a parent. |
| `portal.attach(outlet)`, `portal.detach()`, `portal.isAttached` | Attach through the portal. |
| `new DomPortalOutlet(element)` | Renders into `element` (the runtime's `mount`). `attach(portal)` returns a `PortalViewRef` (`rootNodes`, `context`, `destroy()`, `onDestroy(fn)`, `destroyed`) for component and template portals, the element for a DOM portal. |
| `outlet.detach()`, `outlet.dispose()`, `outlet.hasAttached()` | `dispose()` also removes the outlet element. |
| `BasePortalOutlet`, `PortalOutlet`, `Portal` | Base class and interfaces for your own outlets. |
| `throw…Error` helpers | The Angular error messages (already attached, disposed, null portal, …). |

- One portal per outlet: detach before attaching the next.
- JSX for a template portal goes in a component or module function, not inline in an event handler.

## Accessibility

- Screen readers and :kbd[Tab] reach portal content at the end of the document, far from what opened it. For interactive content move focus in and back (as the overlays do), or use a dialog.
- A `role="status"` region is read without moving focus.

## Common mistakes

- **A hand-made portal for a popover or a menu.** Use [Popover](../components/popover.md) or [Menu](../components/menu.md): they portal, move focus in and back, and dismiss.
- **A `mount` element that does not exist at load.** The portal falls back to `document.body`. Render the container before the portal, or use a selector of an element that is always there.
- **Plain children for `PortalProvider`.** They are built before the provider runs and do not see it; pass `{() => …}`.
- **A `DomPortal` of a detached element.** It throws "DOM portal content must be attached to a parent node."

## Upstream

- `Portal` (Rivet), `PortalProvider` and `Overlay` from React Aria (`UNSAFE_PortalProvider`, `Overlay`).
- `@rivetjs/cdk/portal-outlet` from Angular CDK `@angular/cdk/portal` (`ComponentPortal`, `TemplatePortal`, `DomPortal`, `DomPortalOutlet`, `BasePortalOutlet`). Deviations: no `ViewContainerRef` / injector; a `ComponentPortal` is a function component plus props; the outlet mounts with Rivet's renderer.
- Not yet supported: Angular's `CdkPortal` / `CdkPortalOutlet` directives (`cdkPortalOutlet`), `PortalHostDirective`.
- `@rivetjs/runtime/dom` has its own `Portal` (browser only, no server HTML); the cdk one is the server-rendering version.
