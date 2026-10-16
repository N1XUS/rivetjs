# @rivetjs/cdk/overlay-service
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Angular CDK overlay port: imperative `Overlay` service, `OverlayRef` panes in one `.cdk-overlay-container` div, position + scroll strategies, keyboard / outside-click dispatchers. Browser only.

## Entry points
- `@rivetjs/cdk/overlay-service` → `index.ts`: `Overlay` (`create(config)`, `position()`, `scrollStrategies`), `overlayService()` singleton
- `@rivetjs/cdk/overlay-ref` → `overlay-ref.ts`: `createOverlayRef(config, options)`, `OverlayRef`, `OverlayConfig`, `BackdropRef`, `attachedOverlays()` (signal), `isElement`, types `OverlayDisposeOnNavigation`, `DirectionSource`, `OverlaySizeConfig`, `CreateOverlayOptions`
- `@rivetjs/cdk/overlay-container` → `overlay-container.ts`: `OverlayContainer`, `FullscreenOverlayContainer`, `overlayContainer()`, `provideOverlayContainer(container)`
- `@rivetjs/cdk/overlay-dispatchers` → `overlay-dispatchers.ts`: `OverlayKeyboardDispatcher`, `OverlayOutsideClickDispatcher`, `BaseOverlayDispatcher`, `overlayKeyboardDispatcher()`, `overlayOutsideClickDispatcher()`
- `@rivetjs/cdk/overlay-strategy` → `overlay-strategy.ts`: types `PositionStrategy`, `ScrollStrategy`, `OverlayReference`, `OverlayStrategyConfig`; `getMatScrollStrategyAlreadyAttachedError`
- `@rivetjs/cdk/overlay-viewport` → `overlay-viewport.ts`: `EventStream`, `Subscribable`, `audit`, `filter`, `ViewportRuler` / `viewportRuler()`, `ScrollDispatcher` / `scrollDispatcher()`, `coerceCssPixelValue`, `coerceArray`, `isElementScrolledOutsideView`, `isElementClippedByScrolling`
- `@rivetjs/cdk/overlay-position-builder` → `overlay-position-builder.ts`: `OverlayPositionBuilder` (`global()`, `flexibleConnectedTo(origin)`)
- `@rivetjs/cdk/global-position` → `global-position.ts`: `GlobalPositionStrategy`, `createGlobalPositionStrategy`
- `@rivetjs/cdk/connected-position` → `connected-position.ts`: `FlexibleConnectedPositionStrategy`, `createFlexibleConnectedPositionStrategy`, `ConnectionPositionPair`, `ConnectedOverlayPositionChange`, `ScrollingVisibility`, `STANDARD_DROPDOWN_BELOW_POSITIONS`, `STANDARD_DROPDOWN_ADJACENT_POSITIONS`, validators
- `@rivetjs/cdk/scroll-strategies` → `scroll-strategies.ts`: `Noop` / `Close` / `Block` / `RepositionScrollStrategy` + `create*` factories, `ScrollStrategyOptions` (`noop` / `close` / `block` / `reposition`)
- `@rivetjs/cdk/overlay.css` → `overlay.css`: structural styles (`.cdk-overlay-container`, `-pane`, `-backdrop`, `.cdk-global-overlay-wrapper`, `.cdk-global-scrollblock`, `.cdk-overlay-popover`); customizable values in `@layer cdk-overlay`

## Layout
- `index.ts` service; `overlay-ref.ts` OverlayRef / config / backdrop; `overlay-container.ts`; `overlay-dispatchers.ts`; `overlay-strategy.ts` contracts (types); `overlay-viewport.ts` Rx-subset streams + ViewportRuler / ScrollDispatcher; `overlay-position-builder.ts`; `global-position.ts`; `connected-position.ts`; `scroll-strategies.ts`; `overlay.css`
- Content attaches as portals from `../portal/portal-outlet.ts` (`ComponentPortal`, `TemplatePortal`, `DomPortal`; `OverlayRef implements PortalOutlet`)
- Tests: `tests/angular-overlay.test.ts` (Overlay, OverlayContainer, dispatchers, scroll strategies, GlobalPositionStrategy, FlexibleConnectedPositionStrategy; Chromium); `tests/a11y-live-announcer.test.ts` touches `.cdk-overlay-container`

## Upstream
- `@angular/cdk/overlay`: overlay.ts, overlay-ref.ts, overlay-config.ts, backdrop-ref.ts, overlay-container.ts, fullscreen-overlay-container.ts, dispatchers/*.ts, position/{position-strategy,overlay-position-builder,global-position-strategy,flexible-connected-position-strategy,connected-position}.ts, scroll/*.ts, _index.scss
- `@angular/cdk/scrolling`: viewport-ruler.ts, scroll-dispatcher.ts (local adapters in overlay-viewport.ts; scrolling module may own them later)
- Deviations (headers): lazily created singletons (`overlayService()`, `overlayContainer()`, dispatchers) instead of DI; `new Overlay(options)` for custom container / dispatchers; Observables → `Subscribable` streams; Angular `signal` → reactivity signal; no `ElementRef` (origin = Element or point); scroll containers are elements, no `cdkScrollable` registration (one capture listener); styles shipped as a stylesheet, no style injection (CSP-safe)
- Modification: Angular v20+ native top layer (`usePopover`, `OVERLAY_DEFAULT_CONFIG.usePopover`, `withPopoverLocation`) removed: hosts always go into the div overlay layer

## Rules / invariants
- cdk overlays use one div overlay layer, never the native top layer: hosts go into `.cdk-overlay-container` (end of body, created on first use); no `usePopover` path (top layer never mixes with container stacking)
- Nothing at import time; dispatchers hold global listeners only while overlays are attached
- Keyboard dispatcher: keydown to top-most overlay with `keydownEvents()` subscribers (even with focus on a trigger); outside-click: origin = pointerdown target (drag inside to outside is not outside)
- Import `@rivetjs/cdk/overlay.css` once; no inline structural styles in JS for these classes

## Commands
- `npx vitest run --project cdk libs/cdk/tests/angular-overlay.test.ts`

## Gotchas
- angular-overlay.test.ts: green (61 + 1 skipped). Positions are applied in the `afterNextRender` pass (next animation frame after `attach`): specs `await t.render()` where upstream runs change detection (`detectChanges` / `tick`); a sync read right after `attach` sees no position styles. Right-edge push with a viewport margin pushes by the full margin-narrowed overflow (upstream `_pushOverlayOnScreen` compares against the narrowed width without its offset) — faithful, upstream only tests the left edge.
- Not ported: `CdkConnectedOverlay` / `CdkOverlayOrigin` directives
- Name clash: `OverlayContainer` class here vs `OverlayContainer` component in `../modal/provider.tsx` (React Aria) — different subpaths
- React Aria equivalent of `block` scroll strategy: `preventScroll()` (../overlay/prevent-scroll.ts)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../portal/CLAUDE.md](../portal/CLAUDE.md), [../overlay/CLAUDE.md](../overlay/CLAUDE.md)
- Docs: [overlay-service](../../../apps/cdk-docs/content/foundations/overlay-service.md); examples `apps/cdk-docs/examples/overlay-service-{connected,global}/`
