---
title: Modal
description: ModalOverlay and Modal from @rivetjs/cdk; an overlay that blocks interaction outside it, in the div overlay layer, with enter / exit animations.
template: guide
status: experimental
related: [components/dialog, components/popover, components/menu, foundations/overlays, foundations/portal, foundations/focus]
---

A modal is an overlay element which blocks interaction with elements outside it. Put a `Modal` holding a `Dialog` in a `DialogTrigger` next to a `Button`, or open it standalone with `isOpen`. While it is open the page behind is `inert` and does not scroll, :kbd[Tab] stays inside, :kbd[Escape] closes it and focus returns to the element that opened it. `ModalOverlay` is the underlay (the backdrop); a `Modal` without one wraps itself in a `ModalOverlay`. A closed modal renders nothing.

::example{id=modal-basic}

## Anatomy

```tsx
<DialogTrigger>
  <Button />
  <ModalOverlay>
    <Modal>
      <Dialog>
        <Heading slot="title" />
        <Text slot="description" />
        <Button slot="close" />
      </Dialog>
    </Modal>
  </ModalOverlay>
</DialogTrigger>
```

Open, at the end of `<body>` (a portal with a focus scope):

```html
<div data-rivet-portal="">
  <div data-rv-focus-scope="rvc0" data-rv-contain="" style="display: contents">
    <div class="rv-ModalOverlay" style="position: fixed; inset: 0; z-index: 100; --visual-viewport-width: …; --visual-viewport-height: …; --page-width: …; --page-height: …">
      <div class="rv-Modal" data-rv-overlay="">
        <section id="signup" class="rv-Dialog" role="dialog" tabindex="-1" aria-labelledby="…">
          <h2 id="…" class="rv-Heading">Subscribe to our newsletter</h2>
          …
        </section>
      </div>
    </div>
  </div>
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| Trigger | your `Button` (or a `Pressable` child) | `rv-Button` | `DialogTrigger` adds `aria-expanded`, `aria-controls` (while open) and press handling. |
| Anchor | `span[data-rv-overlay-anchor]` | none | `display: contents`, in place: the presence binding (a resumed page re-creates only the overlay). |
| `ModalOverlay` | `<div>` | `rv-ModalOverlay` | Inline `position: fixed; inset: 0; z-index: 100`; `--visual-viewport-width` / `-height`, `--page-width` / `-height` once measured; `data-entering`, `data-exiting`. |
| `Modal` | `<div data-rv-overlay>` | `rv-Modal` | The modal box; `data-entering`, `data-exiting`. With `isDismissable`, a visually hidden "Dismiss" button first. |
| `Dialog` | `<section role="dialog">` | `rv-Dialog` | See [Dialog](dialog.md): title, description and close slots, `close` render prop. |

## Import

```tsx
import { DialogTrigger, Dialog } from "@rivetjs/cdk/dialog";
import { Modal, ModalOverlay, ModalContext } from "@rivetjs/cdk/modal";
import { Heading } from "@rivetjs/cdk/heading";
import { Button } from "@rivetjs/cdk/button";
```

## Props

### Modal and ModalOverlay

Both take the same props. Inside a `ModalOverlay`, the state and dismiss props belong on the `ModalOverlay` (a development warning names the ones given to the inner `Modal`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content, or `(renderProps) => content` | none | The `Dialog` (in a `ModalOverlay`: the `Modal`). |
| `isOpen` | `boolean \| Signal<boolean>` | from the trigger | Controlled open state; a signal is written two-way (the modal writes `false` when it closes itself). |
| `defaultOpen` | `boolean` | none | Initial open state (uncontrolled, standalone). |
| `onOpenChange` | `(isOpen: boolean) => void` | none | Open state changes the modal makes. |
| `isDismissable` | `boolean` | `false` | A press outside the modal closes it; adds a visually hidden dismiss button. |
| `isKeyboardDismissDisabled` | `boolean` | `false` | :kbd[Escape] does not close it. |
| `shouldCloseOnInteractOutside` | `(element: Element) => boolean` | none | `false` keeps the modal open for that outside element. |
| `isEntering`, `isExiting` | `boolean` or accessor | from the animation | Force the enter / exit state (custom animations). |
| `onEnter`, `onExit` | `(element: HTMLElement) => void \| Promise<void>` | none | Called when the modal starts entering / exiting; a returned promise holds the state until it settles (JS animations); the modal's CSS animations keep their end state meanwhile; a rejected promise ends the animation and reports the error. |
| `UNSTABLE_deferUntilEntered` | `boolean` | `false` | Hide the outside content and move focus only once the entry animation finished. |
| `UNSTABLE_overrideFocus` | `boolean` | `false` | Focus without scrolling the page (React Aria `UNSTABLE_overrideFocus`). |
| `class`, `style` | value or `(renderProps) => value` | `rv-ModalOverlay` / `rv-Modal` | A `class` replaces the default class. Behaviour styles of the underlay stay inline. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ModalOverlay` / `Modal`; see [Render](#render). |
| `id`, `slot`, `ref` | | | `ModalContext` slots; `ref` receives the element. |
| global DOM props | `GlobalDOMAttributes` | none | Forwarded to the element (`ModalOverlay`: its `onPointerDown` runs after the component's own). |

`ModalRenderProps`: `isEntering()`, `isExiting()`, `state` (the `OverlayTriggerState`).

`DialogTrigger` props (`isOpen`, `defaultOpen`, `onOpenChange`, `trigger`, `delay`, `closeDelay`, `longPressAccessibilityDescription`): see [Dialog](dialog.md#props).

### Events

| Event | Payload | When |
| --- | --- | --- |
| `onOpenChange` | `isOpen: boolean` | :kbd[Escape], an outside press (`isDismissable`), `Button slot="close"`, the `close` render prop. |
| `onEnter`, `onExit` | the element | Enter / exit animation starts. |
| global DOM events | DOM event | On the `ModalOverlay` and `Modal` elements. |

## Controlled

Use `isOpen` to open a modal from code, or to mount it elsewhere in the tree than its opener (e.g. outside a menu).

::example{id=modal-controlled}

## Custom trigger

`DialogTrigger` works with any pressable cdk component (`Button`, `Link`, …). Wrap other elements in `Pressable` (`@rivetjs/cdk/interactions/pressable`), a render-function child that spreads the press, focus and trigger props:

::example{id=modal-custom-trigger}

:::note
A `Pressable` child needs an interactive ARIA role (`role="button"`) or a semantic element, so screen readers announce the trigger.
:::

## Dismissing

::example{id=dialog-dismiss}

- Default: :kbd[Escape] closes, a press on the underlay does nothing.
- `isDismissable`: a press outside the modal closes it, and a visually hidden "Dismiss" button is rendered in the modal.
- `isKeyboardDismissDisabled`: :kbd[Escape] is ignored; give the user a button.

## DOM events and attributes

::example{id=dialog-events}

| Element | Takes | Owned events (component first, then yours) |
| --- | --- | --- |
| trigger `Button` | its own props | press events, `onClick`, `onPointerDown` / `Up`, `onMouseDown`, `onPointerEnter` / `Leave` |
| underlay | the `ModalOverlay`'s global DOM props | `onPointerDown` (outside press) |
| modal element | the `Modal`'s global DOM props | none |

`on…Capture` handlers do not resume yet.

## Styling

| Selector | Matches |
| --- | --- |
| `.rv-ModalOverlay` | the underlay (backdrop) |
| `.rv-Modal` | the modal box |
| `[data-entering]`, `[data-exiting]` | enter / exit, on both elements (Tailwind `entering:`, `exiting:`) |
| `var(--visual-viewport-height)`, `var(--page-height)` | space above the software keyboard; the height of `<body>` (size a backdrop over the whole page) |

Position, inset and z-index of the underlay are inline; centering, the backdrop colour and the modal's look are yours. The overlay unmounts once its exit CSS animations or transitions finish. Both kinds work on enter too: `[data-entering]` is computed with the elements already in the portal mount, so a backdrop `transition: opacity` with `[data-entering] { opacity: 0 }` fades in (keyframes and transitions, first open on a resumed page included).

### Tailwind

::example{id=dialog-tailwind}

### Plain CSS

::example{id=dialog-css}

`@rivetjs/cdk/theme.css` gives `.rv-ModalOverlay` a backdrop that centres the modal, pads the `.rv-Dialog` inside, and fades the underlay in and out.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ModalOverlay` (`<div>`), `Modal` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<ModalOverlay render={(props) => <div {...(props as {})} />}>…</ModalOverlay>
```

## Accessibility

- The `Dialog` inside is the `role="dialog"` (or `alertdialog`), named by its title.
- On open focus moves to the dialog's `[autofocus]` element, else the dialog. :kbd[Tab] is contained; on close focus returns to the element focused before.
- Outside the modal everything is `inert` and the document does not scroll.
- With `isDismissable`, the hidden dismiss button lets screen reader users close it without a visible control.

| Key | Action |
| --- | --- |
| :kbd[Enter], :kbd[Space] on the trigger | Open; focus moves in. |
| :kbd[Tab], :kbd[Shift]+:kbd[Tab] | Cycle through the modal's controls. |
| :kbd[Escape] | Close (unless `isKeyboardDismissDisabled`); focus returns. |

## Resumability

- Before interaction: the trigger and an empty anchor. The overlay code loads on the first press; the overlay region is re-created on open.
- Content holding components and handlers in a closed modal: a render-function child (`{({ close }) => …}` on the `Dialog`).
- A standalone `Modal` with an `isOpen` signal opens and closes on a resumed page.
- Known limitation: a modal opened from a `MenuItem` action on a resumed page does not close on :kbd[Escape] or an outside press (its close button works).
- An open modal (`defaultOpen`) is server-rendered; React Aria renders no modal on the server.

## Testing

`new User().createTester("Dialog", { root: trigger, overlayType: "modal" })` from `@rivetjs/testing/user` opens it, returns the dialog and closes it.

## Upstream

- React Aria Components `ModalOverlay`, `Modal`, `ModalContext`, `DialogTrigger`, `Pressable`; React Aria `useModalOverlay` (`modalOverlay` in `@rivetjs/cdk/modal-overlay`), `DismissButton`, `ModalProvider` / `OverlayProvider` / `OverlayContainer` / `useModal` (`modal()`, `modalProps()`; also exported from `@rivetjs/cdk/modal/provider`).
- Deviations: div overlay layer, never `<dialog>` or the top layer; an open modal renders on the server; no `UNSTABLE_portalContainer` (use `PortalProvider`); the keyboard-deferred reveal happens on the first client effect.
- Not yet supported: RAC `Sheet`.
