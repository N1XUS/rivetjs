---
title: Overlay service
description: Angular CDK's Overlay service in @rivetjs/cdk; panes in an overlay container, global and flexible connected position strategies, scroll strategies, backdrops.
template: guide
status: experimental
related: [foundations/overlays, foundations/portal]
---

A port of `@angular/cdk/overlay`: `overlayService().create(config)` makes an `OverlayRef`, a floating **pane** (`.cdk-overlay-pane`) inside a host in the shared **overlay container** (`<div class="cdk-overlay-container">` at the end of body). Content is attached as a [portal](portal.md#portals-and-outlets-angular-cdk); a **position strategy** places the pane and a **scroll strategy** decides what scrolling does. Imperative and browser only: create overlays from event handlers. The React Aria based components do not use it; it is for Angular-style code (Material ports, custom pickers) and sits beside the [div overlay layer](overlays.md).

Import the structural styles once: `@import "@rivetjs/cdk/overlay.css";` (container, pane, backdrop, scroll block; customizable values in `@layer cdk-overlay`). No style injection, CSP-safe.

::example{id=overlay-service-global}

## Connected position

::example{id=overlay-service-connected}

`flexibleConnectedTo(origin)` tries the preferred positions in order; the first that fits the viewport wins, else the best flexible fit (the pane shrinks into the space left), else the fallback pushed on-screen. `positionChanges` emits the applied pair. A `DomPortal` moves an element of the page into the pane and back on detach.

## Overlay

`@rivetjs/cdk/overlay-service`:

| Export | Description |
| --- | --- |
| `overlayService()` | The shared `Overlay` (created on first use; Angular injects it). |
| `new Overlay(options?)` | A service with its own `container`, `document`, `keyboardDispatcher`, `outsideClickDispatcher`, `defaultUsePopover`. |
| `overlay.create(config?)` | A new `OverlayRef` (browser only). |
| `overlay.position()` | `OverlayPositionBuilder`: `global()`, `flexibleConnectedTo(origin)`. |
| `overlay.scrollStrategies` | `noop()`, `close({ threshold? })`, `block()`, `reposition({ scrollThrottle?, autoClose? })`. |

`@rivetjs/cdk/overlay-ref` also exports `createOverlayRef(config?, options?)` (the same without the service), `OverlayConfig`, `BackdropRef` and `attachedOverlays()` (a signal of every attached overlay, in order).

### OverlayConfig

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `positionStrategy` | `PositionStrategy` | none | `global()` or `flexibleConnectedTo(…)`. |
| `scrollStrategy` | `ScrollStrategy` | noop | |
| `hasBackdrop` | `boolean` | `false` | A `.cdk-overlay-backdrop` before the host; clicks go to `backdropClick()`. |
| `backdropClass` | `string \| string[]` | `cdk-overlay-dark-backdrop` | `cdk-overlay-transparent-backdrop` for an invisible one. |
| `panelClass` | `string \| string[]` | `""` | Classes of the pane while attached. |
| `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight` | `number \| string` | none | Pane size (numbers are px). |
| `direction` | `"ltr" \| "rtl"` or `{ value }` | `<html dir>` | `dir` of the host. |
| `disposeOnNavigation` | `boolean \| "url-change" \| "pop-state"` | `false` | Dispose on back / forward (`true`, `"pop-state"`) or any URL change. |
| `disableAnimations` | `boolean` | `false` | Backdrop without transition (`cdk-overlay-backdrop-noop-animation`). |
| `eventPredicate` | `(event) => boolean` | none | Whether this overlay takes a dispatched event (else the next in the stack does). |

### OverlayRef

| Member | Description |
| --- | --- |
| `attach(portal)` | Attach content; creates the backdrop, applies size, direction, panel class and position (again next frame), enables the scroll strategy. Returns the portal's result. |
| `detach()` | Detach content; backdrop fades out, host leaves the DOM once the pane is empty. |
| `dispose()` | Remove everything; streams complete. |
| `hasAttached()` | |
| `overlayElement`, `hostElement`, `backdropElement` | The pane, its host, the backdrop. |
| `attachments()`, `detachments()` | Streams (`subscribe(fn)` returns `{ unsubscribe() }`). |
| `backdropClick()` | Clicks on the backdrop. |
| `keydownEvents()` | Keydowns for the top-most overlay that subscribes, wherever focus is. |
| `outsidePointerEvents()` | Clicks (and auxclick, contextmenu) outside every overlay above; a drag that started inside does not count. |
| `updatePosition()`, `updatePositionStrategy(s)`, `updateScrollStrategy(s)` | |
| `updateSize(config)`, `setDirection(dir)`, `addPanelClass(c)`, `removePanelClass(c)`, `getDirection()`, `getConfig()` | |
| `detachBackdrop()` | |

## Position strategies

### Global

`overlay.position().global()` (or `createGlobalPositionStrategy()` from `@rivetjs/cdk/global-position`): the host becomes a full-viewport flex wrapper (`.cdk-global-overlay-wrapper`) and the pane is aligned with margins.

| Method | Description |
| --- | --- |
| `top(v)`, `bottom(v)` | Offset from the top / bottom (clears the other). |
| `left(v)`, `right(v)`, `start(v)`, `end(v)` | Horizontal offset; `start` / `end` follow the direction. |
| `centerHorizontally(offset?)`, `centerVertically(offset?)` | Center, with an optional offset. |
| `width(v)`, `height(v)` | Deprecated (Angular): use the config. |

### Flexible connected

`overlay.position().flexibleConnectedTo(origin)` (or `createFlexibleConnectedPositionStrategy` from `@rivetjs/cdk/connected-position`). `origin` is an element or a point `{ x, y, width?, height? }`.

| Method | Description |
| --- | --- |
| `withPositions(positions)` | Preferred `ConnectedPosition[]`: `{ originX, originY, overlayX, overlayY, offsetX?, offsetY?, panelClass?, weight? }` with `start` / `center` / `end` and `top` / `center` / `bottom`. |
| `withViewportMargin(margin)` | Distance from the viewport edges (number or `{ top, bottom, start, end }`). |
| `withFlexibleDimensions(on?)` | Let the pane shrink into the space left (default on). |
| `withGrowAfterOpen(on?)` | Let it grow again after opening. |
| `withPush(on?)` | Push the fallback on-screen (default on). |
| `withLockedPosition(on?)` | Keep the first applied position. |
| `withDefaultOffsetX(n)`, `withDefaultOffsetY(n)` | Offsets for positions without their own. |
| `withTransformOriginOn(selector)` | `transform-origin` matching the position on matching elements. |
| `withScrollableContainers(elements)` | Containers for the `positionChanges` clipping info. |
| `setOrigin(origin)`, `reapplyLastPosition()`, `positions` | |
| `positionChanges` | Stream of `ConnectedOverlayPositionChange` (`connectionPair`, `scrollableViewProperties`); computed only while subscribed. |

Also exported: `ConnectionPositionPair`, `ScrollingVisibility`, `STANDARD_DROPDOWN_BELOW_POSITIONS`, `STANDARD_DROPDOWN_ADJACENT_POSITIONS`, `validateVerticalPosition`, `validateHorizontalPosition`.

## Scroll strategies

`@rivetjs/cdk/scroll-strategies`:

| Strategy | Description |
| --- | --- |
| `noop()` / `NoopScrollStrategy` | Nothing. |
| `close({ threshold? })` / `CloseScrollStrategy` | Detach when something outside scrolls (after `threshold` px of page scroll, repositioning until then). |
| `block()` / `BlockScrollStrategy` | Fix `<html>` at the current offset (`.cdk-global-scrollblock`) while attached; restores the position. No-op when the page does not scroll. |
| `reposition({ scrollThrottle?, autoClose? })` / `RepositionScrollStrategy` | Re-apply the position on scroll; `autoClose` detaches once scrolled out of the viewport. |

A strategy instance belongs to one overlay; attaching it to a second throws.

## Container, dispatchers, viewport

| Export | Module | Description |
| --- | --- | --- |
| `overlayContainer()`, `OverlayContainer` | `@rivetjs/cdk/overlay-container` | The shared container, created on first use. |
| `FullscreenOverlayContainer`, `provideOverlayContainer(c)` | same | A container that follows the fullscreen element; replace the shared one (Angular's DI override). |
| `overlayKeyboardDispatcher()`, `overlayOutsideClickDispatcher()` | `@rivetjs/cdk/overlay-dispatchers` | Document listeners while overlays are attached. |
| `viewportRuler()`, `scrollDispatcher()` | `@rivetjs/cdk/overlay-viewport` | Viewport size / scroll (cached until resize), scroll events (`scrolled`, `ancestorScrolled`, `register`). |
| `EventStream`, `audit`, `filter` | same | The minimal stream type used instead of RxJS. |
| `PositionStrategy`, `ScrollStrategy`, `OverlayReference` | `@rivetjs/cdk/overlay-strategy` | Interfaces for your own strategies. |

## What does not work yet

- The cdk's own browser spec port (`libs/cdk/tests/angular-overlay.test.ts`) currently fails: its fixture creates a `DomPortal` of an element that is not in the document, which `DomPortalOutlet` rejects ("DOM portal content must be attached to a parent node", as Angular does). The examples above attach a `TemplatePortal` and an in-page `DomPortal` and pass.
- `RepositionScrollStrategy` with `autoClose` checks the viewport only (Angular also checks the origin's scroll containers).
- Not ported: the `CdkConnectedOverlay` / `CdkOverlayOrigin` directives, `Overlay` injection tokens.

## Upstream

- `@angular/cdk/overlay` (`Overlay`, `OverlayRef`, `OverlayConfig`, `OverlayContainer`, `FullscreenOverlayContainer`, dispatchers, `GlobalPositionStrategy`, `FlexibleConnectedPositionStrategy`, scroll strategies), MIT.
- Deviations: a lazily created singleton instead of DI; no native top layer (Angular 20+ `usePopover`, `withPopoverLocation` are not ported): every host goes into the one div overlay layer; streams instead of RxJS observables; origins are elements, not `ElementRef`; styles ship as `overlay.css`.
