# libs/cdk/overlay
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

React Aria overlay primitives (imperative, browser-side): overlay stack, positioning, trigger ARIA, scroll lock, aria-hide-outside, modal overlay, DismissButton.

## Entry points
- `@rivetjs/cdk/overlay` → `index.ts`: `overlay(element, AriaOverlayProps)`, `interactOutside`, `topOverlay`, types `AriaOverlayProps`, `InteractOutsideProps`, `Placement`
- `@rivetjs/cdk/position` → `position.ts`: `calculatePosition`, `calculatePositionInternal`, `overlayPosition(AriaPositionProps)` → `PositionAria`, `getRect`, `onCloseMap`, deprecated `compute` / `position()` (cdk 0.x geometry), types `Placement`, `PositionOpts`, `PositionResult`, `ElementSource`
- `@rivetjs/cdk/overlay-trigger` → `overlay-trigger.tsx`: `overlayTrigger(props, state)` (trigger/overlay attr bags), `registerTrigger(trigger, state)`
- `@rivetjs/cdk/overlay-trigger-state` → `overlay-trigger-state.ts`: re-exports `../state/overlays.ts` (`createOverlayTriggerState`, `setOpen`, `openOverlay`, `closeOverlay`, `toggleOverlay`, `setPoint`)
- `@rivetjs/cdk/close-on-scroll` → `close-on-scroll.ts`: `onCloseMap` (WeakMap trigger → close)
- `@rivetjs/cdk/prevent-scroll` → `prevent-scroll.ts`: `preventScroll()`, `isScrollPrevented`, `setStyle`, `isScrollable`, `getScrollParent(s)`
- `@rivetjs/cdk/aria-hide-outside` → `aria-hide-outside.ts`: `ariaHideOutside(targets, options)`, `keepVisible`, `_resetAriaHideOutside` (tests)
- `@rivetjs/cdk/modal-overlay` → `modal-overlay.ts`: `modalOverlay(element, props, state)`, `modalUnderlayPointerDown`
- `@rivetjs/cdk/dismiss-button` → `dismiss-button.tsx`: `DismissButton`
- `@rivetjs/cdk/overlay-strings` → `overlay-strings.ts`: `dismissStrings` (34 locales), `dismissLabel(locale)`
- `@rivetjs/cdk/overlay-contexts` → `contexts.ts`: `OverlayTriggerStateContext`, `PopoverContext` (`PopoverContextValue`: `clearContexts`, `idRef`), `OverlayArrowContext` (`placement`, `ref`, `offset`), `ArrowOffset`
- `@rivetjs/cdk/hover-trigger` → `hover-trigger.tsx`: `hoverTriggerProps(props, state)`, `hoverTriggerOpen` / `CheckClose`, trigger + overlay handlers, `attachHoverTrigger` (safe area while open), `OverlayTriggerMode`; DialogTrigger `trigger="hover" | "focus"`; `delay` / `closeDelay` may be accessors (live; `delayOf`, untracked at event time)
- `@rivetjs/cdk/safe-area` → `safe-area.ts`: `safeArea(options)` → release, `isPointInSafeArea` (RA useSafeArea)
- `prevent-scroll-ios.ts`: no subpath; lazy-loaded by `preventScroll` on iOS Safari / `overrideFocus`

## Layout
- Queued-scroll correction (Scheduler docs, 2026-10-23): `overlayPosition` snapshots the actual trigger viewport position and window scrollX/Y at open. A previously queued ancestor/document/window scroll with unchanged trigger coordinates and document offsets does not dismiss a newly focused overlay; real trigger movement or changed document offsets still close it (including fixed/sticky triggers whose viewport rect stays stable). Input/textarea, adjacent scroll and visual-viewport resize exceptions remain. `overlay-position.test.ts` covers stable notifications followed by real movement and fixed-trigger document scrolling on both axes; close-case fixtures explicitly move their mocked rectangles.
- `index.ts` — visible-overlay stack (top-most closes only), Escape, interact outside (pointerdown then click, capture), close on blur
- `position.ts` — calculatePosition + overlayPosition (resize / visual viewport / size observers, close on trigger scroll-parent scroll); CSSOM writes; `data-placement` on overlay + arrow; default `zIndex` 100000
- `overlay-trigger.tsx`, `overlay-trigger-state.ts`, `close-on-scroll.ts`, `prevent-scroll.ts`, `prevent-scroll-ios.ts`, `aria-hide-outside.ts`, `modal-overlay.ts`, `dismiss-button.tsx`, `overlay-strings.ts`, `contexts.ts` (RAC overlay contexts), `hover-trigger.tsx` (hover / focus trigger modes), `safe-area.ts` (RA useSafeArea)
- State: `../state/overlays.ts` (`OverlayTriggerState`: `isOpen` signal, optional `point`)
- Tests: `tests/overlay.test.ts` (useOverlay, trigger state, overlayTrigger + overlayPosition), `tests/calculate-position.test.ts`, `tests/modal.test.ts` (modalOverlay, preventScroll, DismissButton), `tests/aria-hide-outside.test.ts`
- Consumers: `../popover/use-popover.ts`, `../modal/index.tsx`, `../tooltip/behaviour.tsx`, select / combobox / date-picker

## Upstream
- `@react-aria/overlays`: useOverlay.ts, calculatePosition.ts, useOverlayPosition.ts, useCloseOnScroll.ts, useOverlayTrigger.ts, usePreventScroll.ts, ariaHideOutside.ts, useModalOverlay.ts, DismissButton.tsx, intl/overlays/*.json
- `@react-aria/interactions` useInteractOutside.ts; `@react-aria/utils` isScrollable.ts, getScrollParent.ts, keyboard.tsx, runAfterKeyboard.ts, getNonce.ts
- `@react-stately/overlays` useOverlayTriggerState (in `../state/overlays.ts`)
- Deviations (headers): hooks → imperative functions called on open, returning a release fn; global listeners attach on open / detach on close, nothing at import; iOS keyboard tracking starts on first use (React Aria: at import); `Placement` also accepts logical `side start|end` forms; trigger state = serializable signal + free functions

## Rules / invariants
- Overlays are plain divs in the overlay layer (`<Overlay>`, ../portal/index.tsx) — never native top layer (`popover`, `<dialog>`). User decision; do not add native dialog/popover paths
- Callers (components) invoke `overlay` / `overlayPosition` / `modalOverlay` from a `clientEffect` while open; release on close and on unmount
- `ariaHideOutside` always leaves visible: `[data-rv-announcer]`, `[data-rv-announcers]`, `[data-live-announcer]`, `[data-rv-top-layer]`, `[data-react-aria-top-layer]` (aria-hide-outside.ts:17); reference counted; nested calls stack (newest observer active)
- Top-layer content (`[data-rv-top-layer]`, toasts) never counts as outside (index.ts `isValidEvent`)
- `preventScroll` reference counted; standard browsers: `overflow: hidden` + `scrollbar-gutter: stable`; CSP: injected `<style>` uses `getNonce()` (`<meta property="csp-nonce">`)
- Positioning writes styles through CSSOM only (CSP-safe)
- `registerTrigger` / `onCloseMap` share `state.close` with `overlayPosition` (close on scroll without passing `onClose`)
- live props (P5): `overlay()` / `modalOverlay()` accept `isDismissable` / `isKeyboardDismissDisabled` as accessors, read at interaction / key time (a non-dismissable-now overlay still records the top-most overlay at pointerdown)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/overlay.test.ts libs/cdk/tests/calculate-position.test.ts libs/cdk/tests/modal.test.ts libs/cdk/tests/aria-hide-outside.test.ts`
- Typecheck: `NX_DAEMON=false npx nx run cdk:typecheck --output-style=static --skip-nx-cache`

## Gotchas
- `overlay(groupElement, { keyTarget })` (Rivet): Escape keydown listens on `keyTarget` (default = the overlay element); `usePopover` passes its own popover element (RA puts `onKeyDown` in the popover's `overlayProps`). A submenu shares its root's group container: a native group listener ran before the submenu's delegated (DOM v2) `submenuKeyDown` and closed the root menu (V2-FIX R4, `tests/overlay.test.ts` keyTarget case)
- `hover-trigger.tsx`: RA usePreviewTrigger `react-aria-focus-scope-restore` → listener for `rv-focus-scope-restore` on the trigger (installed lazily from pointerenter / focus, WeakSet); `hoverTriggerFocusScopeRestore` preventDefaults, sets `ignoreFocus` (only when trigger not already active) and focuses the trigger, so `hoverTriggerFocus` does not reopen after Escape (D3-2)
- `interactOutside` (index.ts) is the imperative form of `../interactions/interact-outside.tsx` `useInteractOutside` and shares its `isValidOutsideEvent` (one outside-ness rule: `[data-rv-top-layer]` only)
- `overlayPosition` handles native popover UA insets (position.ts:794: unset sides `auto`); cdk components never render native popovers, keep it that way
- `compute` / `position()` (position.ts:951, 986) deprecated 0.x geometry, kept for callers / tests
- `overlayPosition` `arrowStyle: false`: arrow gets ARIA only; caller applies `position().arrowOffsetLeft/Top` (OverlayArrow, user style wins)
- Tests: `tests/overlay-position.test.ts` (RA useOverlayPosition + usePopover scroll ports, 14), `tests/hover-trigger.test.ts` (safe area + hover trigger, 13)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../portal/CLAUDE.md](../portal/CLAUDE.md), [../overlay-service/CLAUDE.md](../overlay-service/CLAUDE.md), [../popover/CLAUDE.md](../popover/CLAUDE.md), [../modal/CLAUDE.md](../modal/CLAUDE.md)
- Docs: [overlays](../../../apps/cdk-docs/content/foundations/overlays.md); examples `apps/cdk-docs/examples/overlay-{custom,layer,position}/`

- ID-RESUME (2026-10-27): Generated overlayTrigger aria-controls targets use the shared `resumedId()` keyed-signal helper. The resume record retains the server id when parts adopt independently. Existing explicit-id fallback and ARIA behaviour are unchanged.
