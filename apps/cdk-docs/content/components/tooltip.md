---
title: Tooltip
description: TooltipTrigger, Tooltip and OverlayArrow from @rivetjs/cdk describe an element on hover or keyboard focus, with React Aria delays, warmup and placement.
template: guide
status: experimental
related: [components/preview-trigger, components/popover, components/button, foundations/overlays, foundations/portal]
---

A tooltip displays a description of an element on hover or focus. `TooltipTrigger` wraps a focusable trigger (a [Button](button.md), a [Link](link.md), or any element in `<Focusable>`) and its `Tooltip`; an `OverlayArrow` inside the tooltip points at the trigger. The tooltip opens on hover after `delay` and at once on keyboard focus; it closes on pointer leave (after `closeDelay`), blur, a press, :kbd[Escape] or a scroll. One tooltip shows at a time. It is not modal: focus never moves, nothing goes inert. Closed, it renders nothing, on the server too.

::example{id=tooltip-basic}

## Anatomy

```tsx
<TooltipTrigger>
  <Button />
  <Tooltip>
    <OverlayArrow />
  </Tooltip>
</TooltipTrigger>
```

Closed: `TooltipTrigger` renders no element. The trigger is your element; the `Tooltip` leaves an empty binding site where it is written:

```html
<button type="button" id="tip-edit-button" class="rv-Button" aria-label="Edit">…</button>
<span data-rv-overlay-anchor="" style="display:contents"></span>
```

Open, in the overlay layer at the end of `<body>` (no focus scope):

```html
<button type="button" id="tip-edit-button" class="rv-Button" aria-label="Edit" aria-describedby="tip-edit">…</button>
…
<div data-rivet-portal="">
  <div id="tip-edit" role="tooltip" class="rv-Tooltip" data-placement="top"
       style="position: absolute; z-index: 100000; --trigger-anchor-point: 30px 32px; …">
    <div class="rv-OverlayArrow" data-placement="top" aria-hidden="true" role="presentation"
         style="position: absolute; transform: translateX(-50%); top: 100%; left: 30px"><span class="tip"></span></div>
    Edit
  </div>
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `TooltipTrigger` | none | none | Provides the state (`TooltipTriggerStateContext`) and `{ id, triggerRef }` (`TooltipContext`); passes the trigger handlers to its focusable child (`FocusableProvider`). |
| Trigger | your `Button` / `Link` / `<Focusable>` child | yours | `aria-describedby="<tooltip id>"` while open (added to its own ids). |
| `Tooltip` | `div[role=tooltip]` | `rv-Tooltip` | `id` (generated unless set), `data-placement`, `data-entering`, `data-exiting`; `aria-label` / `aria-labelledby` / `aria-describedby` if given. |
| `OverlayArrow` | `div` | `rv-OverlayArrow` | `data-placement`; `aria-hidden="true"` and `role="presentation"` set by the positioning. Shape it with CSS (a `<span class="tip" />` with a `clip-path` triangle). |
| Binding site | `span[data-rv-overlay-anchor]` | none | `display: contents`, where the `Tooltip` is written: a resumed page re-creates only the tooltip, never the trigger. |

## Import

```tsx
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Focusable } from "@rivetjs/cdk/focusable";
```

## Props

### TooltipTrigger

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | content | none | The trigger (a cdk `Button` / `Link`, or a custom element in `<Focusable>`) and its `<Tooltip>`. |
| `delay` | `number` | `1500` | ms of hover before it opens. Ignored for keyboard focus and while warm. |
| `closeDelay` | `number` | `500` | ms after the pointer leaves before it closes. |
| `trigger` | `"hover" \| "focus"` | `"hover"` | By default opens for both hover and focus; `"focus"`: keyboard focus only. |
| `isDisabled` | `boolean` | `false` | The tooltip never opens, independent from the trigger. |
| `shouldCloseOnPress` | `boolean` | `true` | A pointer or key press on the trigger closes the tooltip. |
| `isOpen` | `boolean \| Signal<boolean>` | none | Controlled open state; a signal is written two-way. |
| `defaultOpen` | `boolean` | `false` | Initial open state (uncontrolled). |
| `onOpenChange` | `(isOpen: boolean) => void` | none | |

### Tooltip

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | content, or `(props: TooltipRenderProps) => content` | none | Rendered only while open. |
| `placement` | `Placement` | `"top"` | `top`, `bottom`, `left`, `right`, `start`, `end`, and `<side> start` / `<side> end` / `<side> top` / `<side> bottom`. |
| `offset` | `number` | `0` | Additional offset along the main axis. |
| `crossOffset` | `number` | `0` | Additional offset along the cross axis. |
| `containerPadding` | `number` | `12` | Padding between the tooltip and its boundary. |
| `shouldFlip` | `boolean` | `true` | Flip to the other side when there is no room. |
| `arrowBoundaryOffset` | `number` | `0` | Minimum distance of the arrow's edge from the tooltip's edge. |
| `triggerRef` | `Ref<Element> \| () => Element \| null \| undefined` | set by `TooltipTrigger` | The element the tooltip is positioned against. Only needed standalone. |
| `isOpen` | `boolean \| Signal<boolean>` | from `TooltipTrigger` | Given (or `defaultOpen`, or no `TooltipTrigger`): the tooltip has its own state. |
| `defaultOpen` | `boolean` | none | |
| `onOpenChange` | `(isOpen: boolean) => void` | none | With its own state. |
| `trigger` | `"hover" \| "focus"` | `"hover"` | `"focus"`: hovering the tooltip does not keep it open. |
| `isEntering`, `isExiting` | `boolean` or accessor | none | Force the entry / exit animation state. |
| `class` | `string \| (props: TooltipRenderProps) => string` | `rv-Tooltip` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Tooltip`; see [Render](#render). |
| `style` | object or `(props: TooltipRenderProps) => object` | none | A `zIndex` replaces the positioning's `100000`. |
| `id` | `string` | from `TooltipTrigger`, else generated | |
| `aria-label`, `aria-labelledby`, `aria-describedby` | `string` | none | |
| `ref` | `RefValue<HTMLDivElement>` | none | The tooltip element. |
| global DOM props | `GlobalDOMAttributes` + `data-*` | none | On the tooltip element (see [DOM events and attributes](#dom-events-and-attributes)). |

`TooltipRenderProps` (accessors): `placement()` (`"top" | "bottom" | "left" | "right" | "center" | null`, after flipping), `isEntering()`, `isExiting()`, plus `state` (the `TooltipTriggerState`).

::api{symbol="@rivetjs/cdk/tooltip#Tooltip"}

### OverlayArrow

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | content, or `(props: OverlayArrowRenderProps) => content` | none | The arrow's shape. |
| `class` | `string \| (props) => string` | `rv-OverlayArrow` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `OverlayArrow`; see [Render](#render). |
| `style` | object or `(props) => object` | none | Merged after the positioning style (yours wins). |
| `id`, `ref` | | none | |
| global DOM props | `GlobalDOMAttributes` + `data-*` | none | On the arrow element. |

`OverlayArrowRenderProps`: `placement()`. The same `OverlayArrow` works inside a [Popover](popover.md).

### State functions

| Export | Description |
| --- | --- |
| `createTooltipTriggerState(props)` | React Stately `useTooltipTriggerState`: `{ isOpen, shouldSkipAnimation, delay, closeDelay, … }`, serializable. Takes `isOpen`, `defaultOpen`, `onOpenChange`, `delay`, `closeDelay` (a number, or an accessor read when the tooltip opens / closes: `TooltipTrigger` passes a live `delay={d()}` that way). |
| `tooltipDelay(state)`, `tooltipCloseDelay(state)` | The current delays (ms), live ones included (`@rivetjs/cdk/state/tooltip`). |
| `openTooltip(state, immediate?)` | Opens after the delay (at once while warm, or with `immediate`). |
| `closeTooltip(state, immediate?)` | Closes after `closeDelay` (at once with `immediate`). |
| `TooltipTriggerStateContext`, `TooltipContext` | The contexts `TooltipTrigger` provides (RAC names). |

### Events

| Event | Payload | When |
| --- | --- | --- |
| `onOpenChange` | `isOpen: boolean` | Opened or closed by hover, focus, blur, a press, :kbd[Escape], a scroll, or `openTooltip` / `closeTooltip`. Not called when you write a controlled `isOpen` signal yourself. |
| global DOM events | DOM event | On the tooltip (`Tooltip` props) and the arrow (`OverlayArrow` props). Trigger events go on the trigger. |

## Interactions

Tooltips appear after a warmup `delay` when hovering, or at once on keyboard focus (focus-visible only: a click focus does not open it). Once a tooltip is shown, other tooltips show immediately, without their enter animation. After the cooldown (`closeDelay`) the warmup restarts. A press on the trigger closes the tooltip unless `shouldCloseOnPress={false}`; moving the pointer onto the tooltip keeps it open.

::example{id=tooltip-delay}

:::note
Tooltips are not shown on touch. Make the UI usable without them, or show the information in an adjacent element with a [PreviewTrigger](preview-trigger.md) or a [Popover](popover.md).
:::

## Custom trigger

`TooltipTrigger` works with any focusable cdk component (`Button`, `Link`, …). Wrap any other element in `<Focusable>`: it receives the merged trigger props as a function child; spread them on the element and pass the `ref` (a spread never sets `ref`). `Focusable` adds `tabIndex={0}`.

::example{id=tooltip-options}

:::warning
A `<Focusable>` child needs an interactive ARIA role (`role="button"`, `role="link"`, …) or a semantic element so screen readers announce the tooltip. In dev, `Focusable` warns about a missing ref, a non-focusable element or a missing role.
:::

`isDisabled` never opens the tooltip; `trigger="focus"` opens it on keyboard focus only, never on hover.

## Placement

The tooltip uses the same positioning engine as [Popover](popover.md): `placement` (default `top`), `offset`, `crossOffset`, `containerPadding` and `shouldFlip`. `data-placement` on the tooltip and the arrow is the side used after flipping. The default `offset` is `0`: give the arrow room with `offset` or the arrow's size.

::example{id=tooltip-placement}

## Controlled and standalone

`isOpen={signal}` on `TooltipTrigger`: hover and focus still write it, and you can set it. A standalone `Tooltip` (no `TooltipTrigger`) is positioned against `triggerRef` (a `ref()` on any element) and opened by its own `isOpen` signal; `aria-describedby` is set on that element while open.

::example{id=tooltip-controlled}

## Content and render props

`Tooltip` children are any content, or a function of `TooltipRenderProps`; `class` and `style` can be functions of them too.

::example{id=tooltip-slots}

## DOM events and attributes

::example{id=tooltip-events}

| Props | Element | Owned events |
| --- | --- | --- |
| `Tooltip` global DOM props, `data-*` | the tooltip element | `onPointerEnter`, `onPointerLeave` (keep it open while hovered; yours runs after) |
| `OverlayArrow` global DOM props, `data-*` | the arrow | none |
| your trigger's props | your trigger | `onPointerEnter`, `onPointerLeave`, `onFocus`, `onBlur` come from `TooltipTrigger` through `FocusableProvider`, merged with the trigger's own |

`on…Capture` handlers work on resumed pages too, the first event included.

## Styling

| Selector | Matches |
| --- | --- |
| `.rv-Tooltip` | the tooltip |
| `.rv-OverlayArrow` | the arrow |
| `[data-placement="top"]` … | side used, on the tooltip and the arrow (Tailwind `placement-top:` …) |
| `[data-entering]`, `[data-exiting]` | entry / exit (Tailwind `entering:`, `exiting:`); skipped while moving between warm tooltips |
| `var(--trigger-anchor-point)` | position of the trigger relative to the tooltip; use as `transform-origin` for scale transitions |

A `class` replaces the default `rv-*` class. `@rivetjs/cdk/theme.css` does not style tooltips.

### Tailwind

::example{id=tooltip-tailwind}

### Plain CSS

::example{id=tooltip-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Tooltip` (`<div>`), `OverlayArrow` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<Tooltip render={(props) => <div {...(props as {})} />}>…</Tooltip>
```

## Accessibility

- `role="tooltip"`; the trigger is `aria-describedby` the tooltip while it is open.
- Touch never hovers: never put essential information only in a tooltip.
- A tooltip is a description, not interactive content; use a [PreviewTrigger](preview-trigger.md) or a [Popover](popover.md) for links or buttons.

| Key | Action |
| --- | --- |
| :kbd[Tab] onto the trigger | Opens at once. |
| :kbd[Tab] away | Closes at once. |
| :kbd[Escape] | Closes; focus stays. |
| :kbd[Enter] / :kbd[Space] on the trigger | Closes (a press), unless `shouldCloseOnPress={false}`. |

## Resumability

- Before interaction: the trigger's server HTML and an empty binding site per `Tooltip`; no tooltip code loads until the first hover or focus.
- Known limitations: a standalone `Tooltip` with `isOpen` and `onOpenChange` props may not open on a resumed page (use an `isOpen` signal and read it); the first open on a resumed page sets no `data-entering`.

## Testing

Tests must not rely on hover timing: focus the trigger with the keyboard (`await user.tab()`, or Playwright `keyboard.press("Tab")`) and query `role="tooltip"`; check `aria-describedby` on the trigger. Programmatic `element.focus()` is not focus-visible and does not open it.

## Upstream

- React Aria Components `TooltipTrigger`, `Tooltip`, `OverlayArrow`, `TooltipContext`, `TooltipTriggerStateContext`; React Aria `useTooltipTrigger`, `useTooltip`; React Stately `useTooltipTriggerState`.
- Rivet: render props are accessors (`placement()`); `class` instead of `className`; the tooltip renders in the div overlay layer (`Portal`, `PortalProvider` container).
- Not yet supported: `UNSTABLE_portalContainer` (use `PortalProvider`).
