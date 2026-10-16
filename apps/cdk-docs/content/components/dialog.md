---
title: Dialog
description: DialogTrigger, ModalOverlay, Modal and Dialog from @rivetjs/cdk; modal dialogs in the div overlay layer, focus trap, Escape and outside dismissal.
template: guide
status: experimental
related: [components/popover, components/tooltip, foundations/overlays, foundations/portal, foundations/focus]
---

A dialog is an overlay that interrupts the page: while it is open the page behind is inert and does not scroll, :kbd[Tab] stays inside, :kbd[Escape] closes it and focus returns to the element that opened it. RAC composition: `DialogTrigger` wraps a `Button` and an overlay (`Modal`, `ModalOverlay` or `Popover`) holding a `Dialog`; the `Dialog` is labelled by a `Heading slot="title"`. A closed dialog renders nothing.

::example{id=dialog-trigger}

## Anatomy

```tsx
<DialogTrigger>
  <Button>Edit profile</Button>
  <ModalOverlay>
    <Modal>
      <Dialog>
        <Heading slot="title">Edit profile</Heading>
        <Text slot="description">…</Text>
        <Button slot="close">Cancel</Button>
      </Dialog>
    </Modal>
  </ModalOverlay>
</DialogTrigger>
```

Open, at the end of `<body>` (a portal with a focus scope):

```html
<div data-rivet-portal="">
  <div data-rv-focus-scope="rvc0" data-rv-contain="" style="display: contents">
    <div class="rv-ModalOverlay" style="position: fixed; inset: 0; z-index: 100">
      <div class="rv-Modal">
        <section id="profile" class="rv-Dialog" role="dialog" tabindex="-1" aria-labelledby="…">
          <h2 id="…" class="rv-Heading">Edit profile</h2>
          …children…
        </section>
      </div>
    </div>
  </div>
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| Trigger | your `<Button>` | `rv-Button` | Gets `aria-expanded`, `aria-controls` (while open) and press handling from `DialogTrigger`. No `aria-haspopup` (React Aria `useOverlayTrigger` with `type: "dialog"`). |
| Underlay | `ModalOverlay` `<div>` | `rv-ModalOverlay` | Inline `position: fixed; inset: 0; z-index: 100`; `--visual-viewport-height`, `--page-height` vars. A `Modal` alone wraps itself in one. |
| Modal | `Modal` `<div>` | `rv-Modal` | The modal box. With `isDismissable` it holds a visually hidden Dismiss button. |
| Dialog | `<section role="dialog">` | `rv-Dialog` | `tabindex="-1"`; labelled by the title slot, else the trigger. |
| Title | `Heading slot="title"` | `rv-Heading` | `<h2>`, names the dialog. |
| Description | `Text slot="description"` | `rv-Text` | Describes the dialog (`aria-describedby`). |
| Close | `Button slot="close"` | `rv-Button` | Closes the enclosing overlay. |

## Import

```tsx
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Modal, ModalOverlay } from "@rivetjs/cdk/modal";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
```

## Props

### DialogTrigger

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `isOpen` | `Signal<boolean>` | none | Controlled open state, two-way. |
| `defaultOpen` | `boolean` | `false` | Uncontrolled initial state. |
| `onOpenChange` | `(isOpen: boolean) => void` | none | Called when the overlay opens or closes itself, not when you set `isOpen`. |
| `trigger` | `"press" \| "longPress" \| "hover" \| "focus"` | `"press"` | Rivet extension: how the trigger opens the overlay. |
| `delay`, `closeDelay` | `number` | hover defaults | `hover` / `focus` modes. |
| `longPressAccessibilityDescription` | `string` | none | `longPress` mode: describes the gesture to screen readers. |

### Modal / ModalOverlay

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `isOpen`, `defaultOpen`, `onOpenChange` | | | Standalone use, without a `DialogTrigger`. |
| `isDismissable` | `boolean` | `false` | Close on a press outside the modal; renders the hidden dismiss button. |
| `isKeyboardDismissDisabled` | `boolean` | `false` | :kbd[Escape] does not close. |
| `shouldCloseOnInteractOutside` | `(element: Element) => boolean` | none | Return `true` when an outside interaction with `element` should close. |
| `isEntering`, `isExiting` | `boolean` or accessor | from animations | Force the animation states. |
| `onEnter`, `onExit` | `(element) => void \| Promise<void>` | none | Run around the CSS enter / exit animation; a returned promise holds the state until it settles (a rejection ends it and reports the error). |
| `class`, `style` | value or `(renderProps) => value` | `rv-ModalOverlay` / `rv-Modal` | Render props: `isEntering()`, `isExiting()`, `state`. |
| global DOM props | `GlobalDOMAttributes` | none | Forwarded to the element. |

### Dialog

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `role` | `"dialog" \| "alertdialog"` | `"dialog"` | |
| `aria-label`, `aria-labelledby` | `string` | title slot / trigger | Name without a title. A title `Heading` with its own `id` keeps it and the dialog's `aria-labelledby` follows it (React Aria `mergeIds`), in the server HTML too. |
| `id`, `class`, `style` | | generated, `rv-Dialog` | `class` / `style` may be functions of the render props. |
| `children` | content or `({ close }) => content` | none | `close` closes the enclosing overlay. Plain text children stay reactive. |

## Content and the close render prop

A render function child receives `{ close }`: use it for content with handlers, as in the form above (submit, update a signal, `close()`), or put a `Button slot="close"` in the dialog.

::example{id=dialog-alert}

## Alert dialogs

`role="alertdialog"` with a `Text slot="description"`: screen readers read the description with the title. Leave `isDismissable` off so a stray click cannot dismiss it; :kbd[Escape] still closes it, as in React Aria. Without an `[autofocus]` element the dialog itself takes focus.

## Dismissing

::example{id=dialog-dismiss}

- Default: :kbd[Escape] closes, a press on the underlay does nothing.
- `isDismissable`: a press outside the modal closes it, and a visually hidden "Dismiss" button is rendered in the modal.
- `isKeyboardDismissDisabled`: :kbd[Escape] is ignored; give the user a button.
- `shouldCloseOnInteractOutside={(element) => …}`: `false` keeps the dialog open. Pass an inline arrow.

## Controlled and standalone

::example{id=dialog-controlled}

- `isOpen={signal}` is two-way: the overlay writes it when it closes itself, you write it to open or close.
- A `Modal` without a trigger: give it `isOpen`; name its `Dialog` with a title or `aria-label`.
- `onOpenChange` reports the changes the overlay makes, not your own `set`.

## Nested dialogs

::example{id=dialog-nested}

A `DialogTrigger` inside a dialog opens a second modal above the first. Only the top-most overlay reacts to :kbd[Escape] and outside presses. Closing the inner dialog returns focus to its trigger.

## Dialog inside a popover

Put the `Dialog` in a `Popover` inside the `DialogTrigger`; `close` closes the popover. See [Popover](popover.md).

## DOM events and attributes

::example{id=dialog-events}

Each part takes its own global DOM props: the `Button`, the `ModalOverlay` (its `onPointerDown` runs after the component's own) and the `Modal`.

- Global events: mouse, pointer, touch, scroll, wheel, animation and transition events (`libs/cdk/utils/dom-props.ts`).
- `on…Capture` handlers do not resume yet: they work on dialogs rendered in the browser only.

## Styling

| Selector | Matches |
| --- | --- |
| `.rv-ModalOverlay` | the underlay |
| `.rv-Modal` | the modal box |
| `.rv-Dialog` | the dialog element |
| `[data-entering]`, `[data-exiting]` | enter / exit, on the overlay and the modal (Tailwind `entering:`, `exiting:`) |

Position, inset and z-index of the underlay are inline; centering, backdrop colour and the dialog's look are yours. The overlay unmounts once its exit CSS animations / transitions finish.

### Tailwind

::example{id=dialog-tailwind}

Utilities on each part; `entering:` / `exiting:` variants come from `@rivetjs/cdk/tailwind.css`.

### Plain CSS

::example{id=dialog-css}

Target the default class names and `[data-entering]` / `[data-exiting]`. For a ready look, import `@rivetjs/cdk/theme.css`.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Dialog` (`<section>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<Dialog render={(props) => <section {...(props as {})} />}>…</Dialog>
```

## Accessibility

- `role="dialog"` or `alertdialog`, named by the title slot (or `aria-label`, else the trigger), described by the description slot.
- On open the dialog focuses its `[autofocus]` element, else itself. Tab is contained; on close focus returns to the element focused before.
- Outside the modal everything is `inert`, and the document does not scroll.
- With `isDismissable`, the hidden dismiss button lets screen reader users close it without a visible control.

| Key | Action |
| --- | --- |
| :kbd[Enter], :kbd[Space] on the trigger | Open; focus moves in. |
| :kbd[Tab], :kbd[Shift]+:kbd[Tab] | Cycle through the dialog's controls. |
| :kbd[Escape] | Close (unless `isKeyboardDismissDisabled`); focus returns. |

## Resumability

- Before interaction: the trigger button with a delegated handler. The overlay code loads on the first press; the overlay region is re-created on open.
- Callbacks (`onOpenChange`, `shouldCloseOnInteractOutside`, DOM events) must be inline arrows or local functions of the component.
- An open dialog (`defaultOpen`) is server-rendered (React Aria renders none on the server).

## Testing

`@rivetjs/testing/user` ports React Aria's test utils: `new User().createTester("Dialog", { root: trigger, overlayType: "modal" })` gives `open({ interactionType })`, `close()`, `getTrigger()` and `getDialog()`.

## Upstream

- React Aria Components `DialogTrigger`, `ModalOverlay`, `Modal`, `Dialog`, `Heading`, `Text`; React Aria `useOverlayTrigger`, `useModalOverlay`, `useDialog`, `DismissButton`.
- Deviations: `trigger` modes on `DialogTrigger` (Rivet extension); an open dialog renders on the server; no `UNSTABLE_portalContainer` (use `PortalProvider`); overlays are divs in the overlay layer, never `<dialog>`.
