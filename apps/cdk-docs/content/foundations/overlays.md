---
title: Overlays
description: The div overlay layer of @rivetjs/cdk; Overlay, overlay(), modalOverlay(), popoverProps(), overlayPosition(), scroll lock and inert helpers.
template: guide
status: experimental
related: [foundations/portal, foundations/overlay-service, foundations/focus, components/dialog, components/popover, components/tooltip]
---

Every cdk overlay (Dialog, Modal, Popover, Tooltip, menus, selects, comboboxes) is an ordinary `<div>` in a portal at the end of `<body>`: the **div overlay layer**. None uses the native top layer (`<dialog>`, `popover`), so stacking, transitions and resumability work the same everywhere. The behaviour is React Aria's hooks as plain functions: call them when an overlay opens, call the returned cleanup when it closes. Nothing runs at import time.

| Layer | What it does | Module |
| --- | --- | --- |
| Portal + focus scope | Render at the end of body, contain Tab, restore focus | `Overlay` from `@rivetjs/cdk/portal` |
| Dismissal | :kbd[Escape], outside press, blur; the overlay stack | `overlay()` from `@rivetjs/cdk/overlay` |
| Modality | Scroll lock, `inert` outside | `modalOverlay()`, `preventScroll()`, `ariaHideOutside()` |
| Position | Placement, flip, offsets, arrow, max height | `overlayPosition()` from `@rivetjs/cdk/position` |
| State | Open signal, `onOpenChange` | `createOverlayTriggerState()` from `@rivetjs/cdk/state/overlays` |

The Angular CDK overlay service (panes, position strategies, scroll strategies) is a separate API with its own container: see [Overlay service](overlay-service.md).

## Your own modal

::example{id=overlay-layer}

The parts of `Modal`, assembled by hand: an overlay trigger state, `<Show>` to create the content on open, `<Overlay shouldContainFocus>` for the portal and focus scope, `modalOverlay()` from a client effect, `modalUnderlayPointerDown` on the backdrop and a `DismissButton`.

## A panel in place

::example{id=overlay-custom}

No portal: the panel stays in the page, `hidden` while closed. On open it places the panel, registers :kbd[Escape] and outside press and moves focus in; on close it undoes all three. The trigger is excluded from "outside" so its own click can toggle.

## Positioning

::example{id=overlay-position}

`overlayPosition()` places `overlay` against `target` now and keeps it there (window and visual viewport resizes, size changes of either element, the iOS keyboard) until `dispose()`. It writes `position: absolute`, `top`/`left` (or `bottom`/`right`), `max-height`, `z-index` and the custom properties `--trigger-width` (also `--rv-trigger-width`), `--rv-available-height` and `--trigger-anchor-point` through CSSOM (safe under a strict CSP), and `data-placement` on the overlay and the arrow. A scroll of the target's scroll parent calls `onClose` (`null`: never).

## API

### `@rivetjs/cdk/portal`: Overlay

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `portalContainer` | `PortalMount` | nearest `PortalProvider`, else `document.body` | Where to render. |
| `shouldContainFocus` | `boolean` | `false` | Keep Tab inside (React Aria turns it on for modals). |
| `disableFocusManagement` | `boolean` | `false` | No focus scope at all. |
| `isExiting` | `boolean` | `false` | Exit animation running: focus may leave. |
| `onPlaced` | `() => void` | none | The `Portal` `onPlaced` callback: called once the overlay is in its container (Popover positions only then). |
| `children` | content | none | |

A `<Portal>` (see [Portal](portal.md)) with a `FocusScope restoreFocus contain={…}` inside.

### `@rivetjs/cdk/overlay`

| Export | Description |
| --- | --- |
| `overlay(element, props)` | React Aria `useOverlay`. Pushes `element` on the stack of visible overlays (only the top-most closes). :kbd[Escape] inside calls `onClose`; with `isDismissable`, so does a pointerdown + click outside; with `shouldCloseOnBlur`, focus moving to an element outside. Returns the cleanup. |
| `AriaOverlayProps` | `isOpen?` (default `true`), `onClose?`, `isDismissable?`, `shouldCloseOnBlur?`, `isKeyboardDismissDisabled?`, `shouldCloseOnInteractOutside?(element)`. |
| `interactOutside(element, { onInteractOutside?, onInteractOutsideStart?, isDisabled? })` | React Aria `useInteractOutside` (capture phase; pointerdown starts, click completes). Returns the remover. Elements in `[data-rv-top-layer]` never count as outside. |
| `topOverlay()` | The top-most open overlay, or `undefined`. |

### `@rivetjs/cdk/modal-overlay`

| Export | Description |
| --- | --- |
| `modalOverlay(element, props, state)` | React Aria `useModalOverlay`: `overlay()` + `preventScroll()` + `ariaHideOutside([element], { shouldUseInert: true })`. Props: `isDismissable`, `isKeyboardDismissDisabled`, `shouldCloseOnInteractOutside`, `isEntering` (hide outside only once the entry animation ends), `overrideFocus`. Returns the release. |
| `modalUnderlayPointerDown(event)` | The underlay's `onPointerDown`: a press on the underlay itself does not move focus. |

### `@rivetjs/cdk/popover/use-popover`

| Export | Description |
| --- | --- |
| `popoverProps(props, state)` | React Aria `usePopover` (also re-exported by `@rivetjs/cdk/popover`): `overlay()` (close on blur, dismissable unless non-modal), `overlayPosition()`, scroll lock and `inert` outside (modal) or `keepVisible` (non-modal), focus-within events. Call it when the popover is open and rendered. Props: `triggerRef`, `popoverRef`, `arrowRef`, `groupRef` (element, `ref()` or accessor), `isNonModal`, `isKeyboardDismissDisabled`, `shouldCloseOnInteractOutside`, `trigger` (`"SubmenuTrigger"` for submenus), `onFocusWithin` / `onBlurWithin` / `onFocusWithinChange` and every position prop. Returns `{ placement, triggerAnchorPoint, position, updatePosition(), underlayProps, dispose() }`. |

### `@rivetjs/cdk/position`

| Export | Description |
| --- | --- |
| `Placement` | `bottom`, `top`, `left`, `right`, `start`, `end`, optionally followed by a cross side (`bottom start`, `top end`, `left top`, `end bottom`, …). |
| `overlayPosition(props)` | React Aria `useOverlayPosition`. Returns `{ placement, triggerAnchorPoint, position, updatePosition(), dispose() }` (the first three are signals). |
| props | `target`, `overlay` (elements or accessors, `ref()` works), `placement` (`"bottom"`), `offset` (`0`), `crossOffset` (`0`), `containerPadding` (`12`), `shouldFlip` (`true`), `boundaryElement` (`document.body`), `maxHeight`, `arrow`, `arrowSize`, `arrowBoundaryOffset` (`0`), `scroll`, `getTargetRect(target)`, `direction`, `zIndex` (`100000`; `null` writes none), `isOpen`, `shouldUpdatePosition` (`true`), `onClose`. |
| `calculatePosition(opts)` | The pure geometry: `{ position, placement, maxHeight, arrowOffsetLeft, arrowOffsetTop, triggerAnchorPoint }`. |
| `getRect(node, ignoreScale)` | Offset rectangle used by the engine. |
| `compute(…)`, `position(floating, anchor, placement?)` | Deprecated (cdk 0.x). |

### Scroll lock and hiding

| Export | Module | Description |
| --- | --- | --- |
| `preventScroll({ isDisabled?, overrideFocus? })` | `@rivetjs/cdk/prevent-scroll` | React Aria `usePreventScroll`: `overflow: hidden` on the root with a stable scrollbar gutter (iOS: touch handling, loaded lazily). Reference counted. Returns the release. |
| `isScrollPrevented()` | same | Whether a lock is active. |
| `isScrollable(node)`, `getScrollParent(node)`, `getScrollParents(node)` | same | React Aria scroll helpers. |
| `ariaHideOutside(targets, { root?, shouldUseInert? })` | `@rivetjs/cdk/aria-hide-outside` | `aria-hidden` (or `inert`) on the outermost elements containing no target; elements added later are hidden too; announcers and `[data-rv-top-layer]` stay visible. Returns the restore. |
| `keepVisible(element)` | same | Keep `element` visible in the active hiding (a nested overlay while it enters). |

### Triggers and dismiss buttons

| Export | Module | Description |
| --- | --- | --- |
| `createOverlayTriggerState({ isOpen?, defaultOpen?, onOpenChange? })` | `@rivetjs/cdk/state/overlays` (also `overlay-trigger-state`) | React Stately `useOverlayTriggerState`: `{ isOpen, point, onOpenChange }`, serializable. |
| `setOpen`, `openOverlay`, `closeOverlay`, `toggleOverlay`, `setPoint` | same | Free functions on the state (resumable handlers). |
| `overlayTrigger({ type, id? }, state)` | `@rivetjs/cdk/overlay-trigger` | React Aria `useOverlayTrigger`: `triggerProps` (`aria-haspopup` for menus and listboxes only, `aria-expanded`, `aria-controls` while open, `onClick`) and `overlayProps` (`id`). |
| `registerTrigger(trigger, state)` | same | Share `closeOverlay(state)` with `overlayPosition` (close on scroll) through `onCloseMap` (`@rivetjs/cdk/close-on-scroll`). |
| `DismissButton` | `@rivetjs/cdk/dismiss-button` | Visually hidden `<button tabindex="-1">`; props `onDismiss`, `aria-label`, `aria-labelledby`, `id`, `locale`. |
| `dismissLabel(locale?)`, `dismissStrings` | `@rivetjs/cdk/overlay-strings` | Localized "Dismiss" (34 locales). |

### Modal providers

`@rivetjs/cdk/modal` (also `modal/provider`) exports `ModalProvider`, `OverlayProvider`, `OverlayContainer`, `modal(element)` and `modalProps()`: while a modal of a nested provider is open, the providers around it are `aria-hidden`. Providers are linked at render time through `data-rv-modal-parent`, so the chain survives the portal move. The cdk components use `inert` outside instead; these helpers support provider-based modal isolation.

## Common mistakes

- **No cleanup on close.** `overlay()`, `modalOverlay()` and `overlayPosition()` keep listeners and observers until you call the cleanup or `dispose()`. A forgotten cleanup leaves the overlay on the stack, so :kbd[Escape] stops reaching the one below.
- **The trigger counted as outside.** Exclude it with `shouldCloseOnInteractOutside: (element) => !trigger.contains(element)`, or its click closes and reopens.
- **Measuring a hidden panel.** Remove `hidden` before `overlayPosition()`.
- **A bare `document` in a component module.** Use `element.ownerDocument`.
- **JSX inside an event handler.** The compiler rejects it; render with `<Show>` or put the JSX in a component or module function.

## Upstream

- React Aria `useOverlay`, `useInteractOutside`, `useModalOverlay`, `usePopover`, `useOverlayPosition`, `calculatePosition`, `usePreventScroll`, `ariaHideOutside`, `useOverlayTrigger`, `DismissButton`, `Overlay`, `ModalProvider` / `OverlayProvider` / `OverlayContainer` / `useModal`; React Stately `useOverlayTriggerState`.
- Deviations: hooks are functions called on open that return a cleanup; elements are passed directly or as accessors; state is a signal with free functions.
