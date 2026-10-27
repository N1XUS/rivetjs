---
title: PreviewTrigger
description: PreviewTrigger from @rivetjs/cdk shows a non-modal Popover preview of a link on hover, keyboard focus or long press, with a safe area and shared warmup.
template: guide
status: experimental
related: [components/tooltip, components/popover, components/link, foundations/overlays]
---

A `PreviewTrigger` displays a non-modal preview of content on hover, keyboard focus or touch long press. It wraps a trigger (a [Link](link.md), a [Button](button.md), or any element in `<Focusable>`) and a [Popover](popover.md) holding the preview. Unlike a [Tooltip](tooltip.md), the preview may contain interactive content: :kbd[Tab] from the trigger moves into it. Closed, it renders nothing but the trigger, on the server too.

::example{id=preview-trigger-basic}

## Anatomy

```tsx
<PreviewTrigger>
  <Link /> {/* or <Button />, or <Focusable> */}
  <Popover />
</PreviewTrigger>
```

Closed (server HTML): the trigger announces a dialog popup; two empty binding sites follow it (the `Popover`'s and the `PreviewTrigger`'s own):

```html
<a href="#" class="rv-Link" id="maya-link" aria-haspopup="dialog" aria-expanded="false">@mayachen</a>
<span data-rv-overlay-anchor="" style="display:contents"></span>
<span data-rv-overlay-anchor="" style="display:contents"></span>
```

Open, the Popover in the overlay layer at the end of `<body>`:

```html
<a href="#" class="rv-Link" id="maya-link" aria-haspopup="dialog" aria-expanded="true"
   aria-controls="maya-preview" aria-describedby="maya-preview">@mayachen</a>
…
<div data-rivet-portal="">
  <div id="maya-preview" role="dialog" class="rv-Popover" data-trigger="PreviewTrigger" data-placement="bottom"
       style="position: absolute; z-index: 100000; --trigger-anchor-point: …">…</div>
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `PreviewTrigger` | none | none | Provides the state (`OverlayTriggerStateContext`) and `PopoverContext` (`trigger: "PreviewTrigger"`, `isNonModal`); passes the trigger props to its focusable child. |
| Trigger | your `Link` / `Button` / `<Focusable>` child | yours | `aria-haspopup="dialog"` (server-rendered), `aria-expanded`; while open `aria-controls` and `aria-describedby` = the popover id. |
| `Popover` | `div[role=dialog]` | `rv-Popover` | `data-trigger="PreviewTrigger"`, `data-placement`, `data-entering`, `data-exiting`; its own `id` replaces the generated one. Non-modal: no underlay, nothing goes inert, focus does not move into it on open. |
| `OverlayArrow` | `div` | `rv-OverlayArrow` | Optional, inside the `Popover` ([Tooltip](tooltip.md#overlayarrow)). |

## Import

```tsx
import { PreviewTrigger } from "@rivetjs/cdk/preview-trigger";
import { Popover } from "@rivetjs/cdk/popover";
import { Link } from "@rivetjs/cdk/link";
```

## Props

### PreviewTrigger

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | content | none | The trigger (e.g. a `Link`) and its `<Popover>`. |
| `delay` | `number` | `600` | ms of hover or keyboard focus before the preview opens. Ignored while warm. |
| `closeDelay` | `number` | `200` | ms after the pointer leaves (or focus moves away) before it closes. |
| `isDisabled` | `boolean` | `false` | Hover and long press never open the preview. Keyboard focus still opens it (see [Resumability](#resumability)). |
| `isOpen` | `boolean \| Signal<boolean>` | none | Controlled open state; a signal is written two-way. |
| `defaultOpen` | `boolean` | `false` | Initial open state (uncontrolled). |
| `onOpenChange` | `(isOpen: boolean) => void` | none | |

::api{symbol="@rivetjs/cdk/preview-trigger#PreviewTrigger"}

The `Popover` takes its usual props ([Popover](popover.md#props)): `placement` (default `bottom`), `offset` (default `8`), `crossOffset`, `containerPadding`, `shouldFlip`, `class`, `style`, `id`, global DOM props. `PreviewTrigger` sets its `triggerRef`, `isNonModal`, `trigger` and `shouldSkipAnimation`.

### Events

| Event | Payload | When |
| --- | --- | --- |
| `onOpenChange` | `isOpen: boolean` | Opened by hover, keyboard focus or long press; closed by leaving (pointer or focus), or :kbd[Escape]. Not called when you write a controlled `isOpen` signal yourself. |
| Popover DOM events | DOM event | On the popover element. Trigger events go on the trigger. |

## Interactions

Previews appear after a warmup `delay` when hovering with a pointer or receiving keyboard focus (not immediately like a tooltip, so tabbing through a page does not open every preview). The warmup and cooldown are shared with tooltips: once a preview is shown, other previews (and tooltips) show immediately; after the cooldown the warmup restarts. On touch, a long press opens the preview.

While a preview is open, :kbd[Tab] moves focus into it so its content can be used; focus inside keeps it open. :kbd[Escape] closes it and returns focus to the trigger, without reopening it.

::example{id=preview-trigger-interactions}

A safe area between the trigger and the popover keeps the preview open while the pointer travels diagonally from the link into the popover (`@rivetjs/cdk/safe-area`).

## Custom trigger

`PreviewTrigger` works with any focusable cdk component (`Link`, `Button`, …). Wrap any other element in `<Focusable>`: it receives the merged trigger props as a function child; spread them on the element and pass the `ref`. `Focusable` adds `tabIndex={0}`.

::example{id=preview-trigger-custom-trigger}

:::warning
A `<Focusable>` child needs an interactive ARIA role (`role="link"`, `role="button"`) or a semantic element so screen readers can announce the preview.
:::

## Controlled

`isOpen={signal}`: hover, focus and :kbd[Escape] write it; setting it opens or closes the preview.

::example{id=preview-trigger-controlled}

## DOM events and attributes

| Props | Element | Owned events |
| --- | --- | --- |
| `Popover` global DOM props, `data-*` | the popover element | focus within / blur within (keep it open while focus is inside) |
| your trigger's props | your trigger | `onPointerEnter`, `onPointerLeave`, `onFocus`, `onBlur`, `onKeyDown` (:kbd[Tab] into the preview) come from `PreviewTrigger` through `FocusableProvider`, merged with the trigger's own; `aria-haspopup`, `aria-expanded`, `aria-controls`, `aria-describedby` too |

`on…Capture` handlers do not resume yet.

## Styling

| Selector | Matches |
| --- | --- |
| `.rv-Popover[data-trigger="PreviewTrigger"]` | the preview popover |
| `[data-placement="bottom"]` … | side used, on the popover and the arrow (Tailwind `placement-bottom:` …) |
| `[data-entering]`, `[data-exiting]` | entry / exit (Tailwind `entering:`, `exiting:`); skipped while moving between warm previews |
| `var(--trigger-anchor-point)` | position of the trigger relative to the popover, for `transform-origin` |

`@rivetjs/cdk/theme.css` styles `.rv-Popover` (surface, entering / exiting fades). The hero example is styled with Tailwind utilities.

### Plain CSS

::example{id=preview-trigger-css}

## Accessibility

- The trigger has `aria-haspopup="dialog"` and `aria-expanded`; while open it controls and is described by the popover (`role="dialog"`).
- The preview is non-modal: the page stays interactive and focus never moves on open; :kbd[Tab] enters it on purpose.
- Previews open on long press on touch, so (unlike a tooltip) touch users reach them; still keep the trigger's destination usable without the preview.

| Key | Action |
| --- | --- |
| :kbd[Tab] onto the trigger | Opens after `delay` (at once while warm). |
| :kbd[Tab] while open | Moves focus into the preview. |
| :kbd[Escape] | Closes; focus returns to the trigger. |
| :kbd[Tab] / :kbd[Shift]+:kbd[Tab] out of trigger and preview | Closes after `closeDelay`. |

## Resumability

- Before interaction: the trigger's server HTML (with `aria-haspopup` / `aria-expanded`) and two empty binding sites; no preview or popover code loads before the first hover, focus or touch.
- The long press and focus-restore listeners are installed on the trigger at its first pointer enter or focus.
- Popover content with components or callbacks: a render function `{() => …}`. Callbacks: inline arrows or local consts.
- Known limitations: `isDisabled` does not stop keyboard focus from opening the preview; the long press accessibility description ("Long press to open preview") is not set.

## Behaviour hooks

`@rivetjs/cdk/preview-trigger/behaviour` provides helpers for building your own trigger: `previewTriggerProps(options, state)` returns the trigger handlers and ARIA; `attachPreviewTrigger(state, options)` runs the open-state effects (safe area, focus after long press). The state is `createTooltipTriggerState` from `@rivetjs/cdk/tooltip`.

::api{symbol="@rivetjs/cdk/preview-trigger/behaviour#previewTriggerProps"}

## Upstream

- React Aria Components `PreviewTrigger`; React Aria `usePreviewTrigger`; React Stately `useTooltipTriggerState`.
- Rivet: the trigger props reach the child through `FocusableProvider` (as upstream); the effects run from a client effect only while open.
- Not yet supported: the long press accessibility description.
