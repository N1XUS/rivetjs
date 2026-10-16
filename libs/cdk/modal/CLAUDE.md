# @rivetjs/cdk/modal
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ModalOverlay` + `Modal` (separate elements, RAC DOM) on the div overlay layer, plus React Aria modal providers.

## Entry points
- `@rivetjs/cdk/modal` → `index.tsx`: `ModalOverlay`, `Modal`, `ModalContext` (props context, id `rv-modal-props`), `InternalModalContext` (id `rv-modal-internal`), `setOpen`, types `ModalOverlayProps`, `ModalProps`, `ModalRenderProps` (`isEntering` / `isExiting` accessors, `state`), `OverlayTriggerState`; re-exports `./provider.tsx`
- `@rivetjs/cdk/modal/provider` → `provider.tsx`: `ModalProvider`, `OverlayProvider`, `OverlayContainer`, `ModalProviderContext` (id `rv-modal`), `modalProviderProps`, `modalProps` (`data-ismodal`), `modal(element, options)` (useModal), types `ProviderChildren`, `AriaModalOptions`
- `@rivetjs/cdk/modal/behaviour` deleted (legacy `attachModal` / `closeEnclosing` / `overlayCloseEvent`)

## Layout
- `ModalOverlay` → `div.rv-ModalOverlay` (inline `position: fixed; inset: 0; z-index: 100`, `--visual-viewport-*` / `--page-*` vars) inside `<Overlay>` (portal + focus scope) → `Modal` `div.rv-Modal` → user `<Dialog>`. `<Modal>` alone wraps itself in a ModalOverlay
- Nested `@rivetjs/motion` exits (motion T10, fix round 1): `overlayPresence.create?.(isOpen)` from `@rivetjs/kit/transition` — filled by Motion's `element.tsx` at evaluation, so cdk alone ships only the optional call. Set: the branch renders through `presence.wrap(inner)` (Motion's transition scope over the open state: `rendered: false` + `appear: false`, entrances play, nested kit `<Transition>` defaults stay) and `onOverlayExit` waits `presence.take()` with the user `onExit` (a microtask, only when a Motion `exit` element registered). Test `libs/motion/tests/presence.browser.test.tsx`
- Motion token (motion spec D17): `modalHooks.open?(overlay, modal)` (exported with `applyMotionToken`): when set, a client effect calls it once per open, a microtask after mount (after the portal move); `@rivetjs/ui` overlays register `applyMotionToken` on both elements (`libs/ui/src/utils/overlay-motion.ts`). `--rv-motion-spring: <visualDuration s> <bounce>` inherited by the overlay → inline spring `linear()` `animation-` / `transition-timing-function` + settling `-duration`; unset or reduced motion = nothing written. Unset hook (cdk alone) = no effect, no token code. `@rivetjs/ui/theme` `motion: { overlays: "spring" }` sets the token. Test `tests/animation.browser.test.tsx` "motion token"
- Presence: `<Show when={isOpen || isExiting}>` inside own anchor `span[data-rv-overlay-anchor]` (resumed page re-creates only the overlay)
- Exit states created in `ModalOverlayPresence` (`createExitAnimationState(isOpen)` ×2), passed as `exits` to `ModalOverlayInner`, which calls `watchExitAnimation` on both elements (no idle `fx` while closed, UI-COLD 2026-10-08)
- Enter / exit: `../utils/animation.tsx` → `data-entering` / `data-exiting` on both elements; `onEnter` / `onExit` promises; `isEntering` / `isExiting` accept accessors. The enter animation effects are created before `<Overlay>`, so they run before the Portal's host move: the enter start is deferred a microtask (animation.tsx) so `[data-entering]` transitions (HeroUI drawer / sheet / sidebar backdrops) start in the final position (BACKDROP-FIX 2026-10-08; `tests/animation.browser.test.tsx` "portaled ModalOverlay")
- `modalOverlay(...)` (`../overlay/modal-overlay.ts`, useModalOverlay) from a client effect while open: Escape (`isKeyboardDismissDisabled`), outside interaction (`isDismissable`, `shouldCloseOnInteractOutside`), scroll lock, `inert` outside; `isDismissable` renders visually hidden DismissButton
- Provides `[PressResponderContext, {register}]` (RA ClearPressResponder); ModalContent resets `InternalModalContext` to null (nested DialogTrigger's Modal opens its own overlay)
- Tests: `tests/modal.test.ts` (useModal, modalOverlay, preventScroll, DismissButton; server.ts), `tests/modal.browser.test.tsx` (RAC Modal.browser), `tests/dialog.browser.test.tsx` (modal cases), `tests/animation.browser.test.tsx`; stories `/modal`, `/modal-open`, `/dom-events-overlays` (`tests-components/overlays.test.ts` incl. resumed first-open animation, `dom-events-overlays.test.ts`)

## Upstream
- RAC Modal.tsx; RA useModalOverlay, Overlay, DismissButton, useModal.tsx (providers) — Apache-2.0
- Deviations: `UNSTABLE_portalContainer` deleted (PortalProvider only); `render` prop on ModalOverlay and Modal (inline stacking + `data-rv-overlay` stay); keyboard-deferred reveal on first client effect; ModalContent clears InternalModalContext

## Rules / invariants
- Div overlay layer only — never native `<dialog>` / top layer (user decision)
- Capture `rp.style`, not `rp` (rp captures the children slot); animation callbacks in object literals (R2)
- PortalProvider container resolved in the outer component, passed to `<Overlay>` (re-created overlays have no provider chain)
- Provider children must be functions to see context (provider.tsx)
- live props (P5): `ModalOverlay` / standalone `Modal` make `isOpen` (controlled, accessor via `controllable`) and `isDismissable` / `isKeyboardDismissDisabled` / `isEntering` / `isExiting` live (`liveOptions`; standalone Modal splits the overlay keys unread when live, `liveOmit` for the modal element); `overlay()` reads accessor dismiss flags at interaction / key time; a live `isDismissable` shows the DismissButton through a `Show`; overlay / modal class / style / children from a live view. Read once: `defaultOpen`, `onOpenChange`, `shouldCloseOnInteractOutside`, `UNSTABLE_*`. Tests `tests/live-props.browser.test.tsx`, story `tests-components/live-props.test.ts`
- `modalOverlay` (ariaHideOutside / inert outside) waits for the portal move (`placed` signal set by `Overlay` `onPlaced`, CDK-PINS 2026-10-12): on a client render the portal moves in an effect after the content's own, so hiding ran with the modal still at its in-place anchor (page siblings of the anchor inert instead of the page around the body-level portal; RA createPortal places first). Resumed and client renders now hide the same elements (`/modal-open`, ui `/drawer-open` / `/sheet-open`).
- Reveal flag (`isOpen` of ModalOverlayInner, RA runAfterKeyboard) starts `true` on the server (CDK-PINS 2026-10-12): a server-rendered overlay is already revealed, so a resumed page never runs `createEnterAnimation`'s not-ready hide (its effect could run before the flag's at load: the open overlay flashed hidden and kept an empty `style=""` on the overlay / modal elements; resume fuzz `/modal-open`, ui `/drawer-open`, `/sheet-open`). Client renders keep RA's false-then-true.

## Commands
- `npx vitest run --project cdk libs/cdk/tests/modal.test.ts`
- `npx vitest run --project cdk-browser libs/cdk/tests/modal.browser.test.tsx libs/cdk/tests/animation.browser.test.tsx`
- `STORIES_DIST=dist-c1a npx vitest run --project cdk-components libs/cdk/tests-components/overlays.test.ts libs/cdk/tests-components/dom-events-overlays.test.ts`

## Gotchas
- Standalone `<Modal isOpen onOpenChange>` on a resumed page: state created inside the component; verify before relying on it
- `/dom-events-overlays` currently 500s on the server: `Select$28 capture #10 function is not serializable` (select lane), so that suite fails as a whole
- Standalone `<Modal isDismissable isOpen={signal}>` from a `MenuItem onAction` (D3-3): Escape + outside press close it — locked by `tests-components/overlays.test.ts` (route `/modal` `#menu-modal`) and docs `modal-controlled`
- Sheet (RAC Sheet.tsx) not ported: WIP draft parked outside the repo (frozen scope)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../dialog/CLAUDE.md](../dialog/CLAUDE.md), [../overlay/CLAUDE.md](../overlay/CLAUDE.md), [../utils/CLAUDE.md](../utils/CLAUDE.md)
