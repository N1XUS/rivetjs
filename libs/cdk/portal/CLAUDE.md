# @rivetjs/cdk/portal
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Server-rendered portals (`<Portal>`, `<Overlay>`, `PortalProvider`) = the div overlay layer of cdk components; plus Angular CDK imperative portals / outlets.

## Entry points
- `@rivetjs/cdk/portal` → `index.tsx`: `Portal` (`mount`, `class`, `onPlaced`), `portalHooks` (`place?(host, from)`: Rivet, unset by default; runs right after a host moved out of its in-place parent `from`; `@rivetjs/ui` stamps its theme scope attributes, `libs/ui/src/utils/portal-theme.ts`), `Overlay` (`portalContainer`, `disableFocusManagement`, `shouldContainFocus`, `isExiting`, `onPlaced`), `PortalProvider` (`container`), `PortalContext`, re-exports `resolveMount`, `PortalMount`
- `@rivetjs/cdk/portal-mount` → `portal-mount.ts`: `PortalMount` (selector string | Element | ref | fn), `resolveMount(mount)` (fallback `document.body`)
- `@rivetjs/cdk/portal-outlet` → `portal-outlet.ts`: `Portal<T>`, `ComponentPortal`, `TemplatePortal`, `DomPortal`, `BasePortalOutlet`, `DomPortalOutlet`, `PortalOutlet`, `PortalViewRef`, `throw*Error` helpers

## Layout
- `index.tsx` — `<Portal>` renders `<div data-rivet-portal>` in place (server HTML), a `clientEffect({when: "load"})` moves it to its mount, then calls `onPlaced` (synchronously, inside the move effect; content effects can run before the move, e.g. one re-run by a ref set in a lazy binding: measure layout only once placed, CELLSELECT-DEV 2026-10-08); owner cleanup removes it. `<Overlay>` = Portal + `ClearPressResponder` (RA: trigger press props stop at the overlay) + `FocusScope restoreFocus contain=…` (../focus/focus-scope.tsx); `isExiting` accepts an accessor, read once at mount (FocusScope `contain` is not reactive — gap)
- `portal-mount.ts` — mount resolution, browser only, kept out of the component module
- `portal-outlet.ts` — Angular CDK portals; `DomPortalOutlet` renders with the runtime's `mount`; browser only
- Tests: `tests/portal-resume.test.ts` (server + resumed page, fixture `tests/fixtures/portal-fixture.tsx`); outlets via `tests/angular-overlay.test.ts` (`DomPortal`); component use in `tests-components/overlays.test.ts`, `tests-components/dom-events-overlays.test.ts`
- Consumers: `../modal`, `../popover`, `../tooltip` (`Portal` directly), `../modal/provider.tsx` (`OverlayContainer`), `../overlay-service/overlay-ref.ts` (outlets)

## Upstream
- `@react-aria/overlays` PortalProvider.tsx (`UNSAFE_PortalProvider`), Overlay.tsx — Apache-2.0
- `@angular/cdk/portal` portal.ts, dom-portal-outlet.ts, portal-errors.ts — MIT
- `Portal` component itself is Rivet (server-visible content, moved at load); `TemplatePortal` = render fn + context (Angular TemplateRef)

## Rules / invariants
- `PortalContext` = `resumableContext(…, { id: "rv-portal" })`: a region re-created under a `PortalProvider` keeps its container when it serializes — selector string or `ref()` element ref (both covered by `tests-components/resume-context.test.ts`); a raw Element / plain function container is dropped from the region record (re-created portals fall back to `document.body`)
- `portalHooks.place` (UI-THEME-PORTAL 2026-10-20): called only on an actual move (never on an effect re-run), with the still-connected in-place parent (server HTML position on resumed pages, the trigger's subtree for browser-created overlays); headless: cdk names no attribute, a styled layer decides what to copy (cdk `modalHooks.open` pattern; cdk alone pays one property read per move)
- The overlay layer is plain divs (`data-rivet-portal` hosts at end of mount) — never native `<dialog>` / `popover` top layer (user decision)
- Content is in the server HTML (visible without JS, indexable); server markers inside the host stay balanced, so the move does not affect resumption
- Portal behind `<Show when>` works both ways: starts true (moved at load) or false (created in browser)
- Moving the host blurs focus inside: Portal re-focuses the previously focused element (`preventScroll`) after `append` (index.tsx:58-62)
- Mount must be serializable on resumed pages: use a CSS selector string or `ref()`; Elements / plain functions only for browser-rendered portals
- `PortalProvider` children: plain JSX (lazy slot, `renderSlot`) or a function (`{() => …}`); both render under the provider (index.tsx)
- `portal-outlet.ts` is browser only; for server-visible content use `<Portal>`

## Commands
- `npx vitest run --project cdk libs/cdk/tests/portal-resume.test.ts`
- `npx vitest run --project cdk-components libs/cdk/tests-components/overlays.test.ts`

## Gotchas
- `tests/portal-resume.test.ts`: follows the fixture's import graph (server via `tests/server.ts`, browser `.tsx` compiled / `.ts` stripped under `/cdk/`), so new imports in `portal/index.tsx` need no harness change.
- `PortalProvider` ignored by Popover / Modal on resumed pages (region re-creation loses context); Tooltip resolves it itself (`useContext(PortalContext)` in TooltipTrigger, ../tooltip/index.tsx:120)
- Modal Popover with in-page `portalContainer`: `ariaHideOutside` runs before the host move, so the container ends up inert

## See also
- [../CLAUDE.md](../CLAUDE.md), [../overlay/CLAUDE.md](../overlay/CLAUDE.md), [../overlay-service/CLAUDE.md](../overlay-service/CLAUDE.md), [../modal/CLAUDE.md](../modal/CLAUDE.md)
- Docs: [portal](../../../apps/cdk-docs/content/foundations/portal.md); examples `apps/cdk-docs/examples/portal-{outlet,provider,server,show}/`
