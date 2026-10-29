---
title: Popover
description: Popover and OverlayArrow from @rivetjs/cdk; an overlay positioned relative to a trigger by the React Aria position engine, modal or non-modal.
template: guide
status: experimental
related: [components/dialog, components/modal, components/tooltip, components/preview-trigger, components/menu, foundations/overlays, foundations/portal]
---

A popover is an overlay element positioned relative to a trigger. Put `Popover` in a `DialogTrigger` next to a `Button`, or use it standalone with `triggerRef` and `isOpen`. The position engine places it, flips it when there is no room, and positions an optional `OverlayArrow`. On open focus moves in; :kbd[Escape], a press outside or focus moving out closes it, and focus returns to the trigger. By default it is modal (the page behind is inert and does not scroll, :kbd[Tab] stays inside); `isNonModal` only moves focus. The same `Popover` is the overlay of `MenuTrigger`, `Select`, `ComboBox`, `DatePicker` and `PreviewTrigger`. A closed popover renders nothing, on the server too.

::example{id=popover-basic}

## Anatomy

```tsx
<DialogTrigger>
  <Button />
  <Popover>
    <OverlayArrow />
    <Dialog />
  </Popover>
</DialogTrigger>
```

Closed, only the trigger and an empty anchor:

```html
<button type="button" id="settings-trigger" class="rv-Button" aria-label="Settings" aria-expanded="false" tabindex="0">…</button>
<span data-rv-overlay-anchor="" style="display: contents"></span>
```

Open, at the end of `<body>` (a portal with a focus scope):

```html
<div data-rivet-portal="">
  <div data-rv-focus-scope="rvc0" data-rv-contain="" style="display: contents">
    <div data-testid="underlay" data-rv-underlay="" style="position: fixed; inset: 0"></div>
    <div style="display: contents">
      <div class="rv-Popover" dir="ltr" data-trigger="DialogTrigger" data-placement="bottom" data-rv-overlay=""
           style="position: absolute; z-index: 100000; max-height: …; --trigger-width: …; --trigger-anchor-point: …; left: …; top: …">
        <div style="clip: rect(0 0 0 0); …"><button type="button" aria-label="Dismiss" tabindex="-1"></button></div>
        <div class="rv-OverlayArrow" data-placement="bottom" style="position: absolute; transform: translateX(-50%); bottom: 100%; left: …">…</div>
        <section id="settings-dialog" class="rv-Dialog" role="dialog" tabindex="-1" aria-label="Settings">…</section>
        <div style="clip: rect(0 0 0 0); …"><button type="button" aria-label="Dismiss" tabindex="-1"></button></div>
      </div>
    </div>
  </div>
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| Trigger | your `Button` (or a `Pressable` child) | `rv-Button` | `DialogTrigger` adds `aria-expanded`, `aria-controls` (while open) and press handling. No `aria-haspopup` (React Aria `useOverlayTrigger` with `type: "dialog"`). |
| Anchor | `span[data-rv-overlay-anchor]` | none | `display: contents`, in place of the popover: its presence binding (a resumed page re-creates only the popover on open). |
| Underlay | `div[data-rv-underlay]` | none | Modal only: inline `position: fixed; inset: 0`; catches outside presses. |
| Popover | `div[data-rv-overlay]` | `rv-Popover` | `data-trigger`, `data-placement`, `data-entering`, `data-exiting`. `role="dialog"`, `tabindex="-1"` and `id` only when no `[role=dialog]` is inside (RAC role detection); then labelled by the trigger (`aria-labelledby`). |
| Dismiss buttons | visually hidden `<button>` | none | Start (modal only) and end; localized "Dismiss" for screen reader users. |
| `OverlayArrow` | `<div>` | `rv-OverlayArrow` | Positioned along the edge facing the trigger; `data-placement`. |
| `Dialog` | `<section role="dialog">` | `rv-Dialog` | Optional (see [Dialog](dialog.md)): takes focus, labelled by its `Heading slot="title"`, `close` render prop. |

## Import

```tsx
import { DialogTrigger, Dialog } from "@rivetjs/cdk/dialog";
import { Popover, PopoverContext, OverlayTriggerStateContext, type Placement } from "@rivetjs/cdk/popover";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Button } from "@rivetjs/cdk/button";
```

## Props

### Popover

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content, or `(renderProps) => content` | none | The popover content. Content holding components or handlers: a function child (see [Resumability](#resumability)). |
| `triggerRef` | `Ref<Element>` or `() => Element \| null \| undefined` | from the trigger | The element the popover positions itself next to. Set by `DialogTrigger` and the other triggers; only needed standalone. |
| `isOpen` | `boolean \| Signal<boolean>` | none | Controlled open state (standalone); a signal is written two-way. |
| `defaultOpen` | `boolean` | none | Initial open state (uncontrolled, standalone). |
| `onOpenChange` | `(isOpen: boolean) => void` | none | Open state changes the popover makes. |
| `placement` | `Placement` | `"bottom"` | `top`, `bottom`, `left`, `right`, `start`, `end`, optionally with a cross side (`bottom start`, `top end`, `left top`, …). |
| `offset` | `number` | `8` | Distance from the trigger along the main axis. |
| `crossOffset` | `number` | `0` | Shift along the cross axis. |
| `containerPadding` | `number` | `12` | Minimum distance from the boundary edges. |
| `shouldFlip` | `boolean` | `true` | Flip to the opposite side when there is no room. |
| `maxHeight` | `number` | available space | Upper bound of the computed max height. |
| `arrowBoundaryOffset` | `number` | `0` | Minimum distance of the arrow from the popover's edges. |
| `boundaryElement` | `Element` | `document.body` | The element the popover stays within. |
| `scroll` | element source | the popover | The scrollable region inside the popover. |
| `shouldUpdatePosition` | `boolean` | `true` | Re-position on resize and scroll. |
| `getTargetRect` | `(target: Element) => DOMRect \| Offset \| null` | none | Override the trigger rectangle (e.g. a pointer position). |
| `isNonModal` | `boolean` | `false` | No underlay, no focus containment, no `inert`, no scroll lock; closes when focus leaves or an ancestor of the trigger scrolls. |
| `isKeyboardDismissDisabled` | `boolean` | `false` | :kbd[Escape] does not close. Provide another way to close it. |
| `shouldCloseOnInteractOutside` | `(element: Element) => boolean` | none | `false` keeps the popover open for that outside element. |
| `onFocusWithin`, `onBlurWithin`, `onFocusWithinChange` | handlers | none | Focus entering / leaving the popover (React Aria `useFocusWithin`). |
| `trigger` | `string` | from the trigger | The name of the component that opened it, reflected as `data-trigger` (`"DialogTrigger"`, `"MenuTrigger"`, `"ComboBox"`, …). |
| `isEntering`, `isExiting` | `boolean` or accessor | from the animation | Force the enter / exit state (custom animations). |
| `shouldSkipAnimation` | `boolean` or accessor | `false` | Appear and disappear without entry / exit animation (PreviewTrigger swaps). |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | the trigger | Names the popover while it is the dialog. |
| `id` | `string` | generated | Id of the popover while it is the dialog; replaces the trigger's generated `aria-controls` id. |
| `class`, `style` | value or `(renderProps) => value` | `rv-Popover` | A `class` replaces the default class. A `style.zIndex` replaces the engine's `z-index`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Popover`; see [Render](#render). |
| `slot`, `ref` | | | `PopoverContext` slots; `ref` receives the popover element. |
| global DOM props | `GlobalDOMAttributes` | none | Forwarded to the popover element (`dir`, `lang`, `data-*`, mouse / pointer / wheel / … events). |

`PopoverRenderProps`: `trigger` (string or `null`), `placement()` (`"top" | "bottom" | "left" | "right" | null`), `isEntering()`, `isExiting()`.

### DialogTrigger

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | a `Button` (or `Pressable`) and an overlay | none | |
| `isOpen`, `defaultOpen`, `onOpenChange` | `boolean \| Signal<boolean>`, `boolean`, function | uncontrolled | Open state of the popover. |
| `trigger` | `"press" \| "longPress" \| "hover" \| "focus"` | `"press"` | Rivet extension: what opens the popover (see [Trigger modes](#trigger-modes)). |
| `delay`, `closeDelay` | `number` (ms) | `300`, `200` | `trigger="hover"`: delay before opening, and before closing once the pointer left the safe area. |
| `longPressAccessibilityDescription` | `string` | none | `trigger="longPress"`: a description for assistive technology (`aria-describedby` on the trigger). |

See [Dialog](dialog.md) for `Dialog`.

### OverlayArrow

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content, or `({ placement }) => content` | none | The arrow shape: markup such as a CSS-shaped `<span>` (`clip-path` triangle), or an SVG from an icon library. |
| `class`, `style` | value or `({ placement }) => value` | `rv-OverlayArrow` | Your `style` wins over the engine's position styles. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `OverlayArrow`; see [Render](#render). |
| `id`, `ref` | | | |
| global DOM props | `GlobalDOMAttributes` | none | Forwarded to the arrow element. |

### Events

| Event | Payload | When |
| --- | --- | --- |
| `onOpenChange` (DialogTrigger, standalone Popover) | `isOpen: boolean` | Trigger press, :kbd[Escape], outside press, blur, `close()`. |
| `onFocusWithin`, `onBlurWithin`, `onFocusWithinChange` | `FocusEvent` / `boolean` | Focus entering / leaving the popover. |
| global DOM events | DOM event | On the trigger `Button`, the popover element and the `OverlayArrow`. |

## Content

A popover holding a `Dialog` gets the dialog semantics from it: the `Dialog` takes focus on open, is named by its `Heading slot="title"` (or `aria-label`), and its `close` render prop closes the popover. Without a `Dialog`, the popover element itself becomes the dialog, labelled by its trigger.

::example{id=popover-dialog}

## Custom trigger

`DialogTrigger` works with any pressable cdk component (`Button`, `Link`, …). Wrap other elements in `Pressable` (`@rivetjs/cdk/interactions/pressable`), a render-function child that spreads the press, focus and trigger props:

::example{id=popover-custom-trigger}

:::note
A `Pressable` child needs an interactive ARIA role (`role="button"`) or a semantic element, so screen readers announce the trigger; in development a warning tells you when it is missing.
:::

## Trigger modes

::example{id=popover-trigger-modes}

`trigger` on `DialogTrigger` (Rivet extension in React Aria vocabulary):

- `"press"` (default): a press toggles.
- `"hover"`: mouse or pen hover (after `delay`) or keyboard focus opens; a safe area between the trigger and the popover keeps it open while the pointer moves over; it closes `closeDelay` after the pointer leaves. Touch keeps the press toggle.
- `"focus"`: keyboard focus opens; a press still toggles.
- `"longPress"`: a long press opens; :kbd[Enter], :kbd[Space] and screen reader presses still toggle. Describe it with `longPressAccessibilityDescription`.

## Custom anchor

To position a popover next to another element than its trigger, use `triggerRef` and `isOpen` instead of a `DialogTrigger`. `isOpen` as a signal is two-way: the popover writes `false` when the user closes it.

::example{id=popover-controlled}

The same example shows a controlled `DialogTrigger`: `isOpen` + `onOpenChange` on the trigger.

## Placement

::example{id=popover-placement}

- `start` / `end` follow the text direction: left / right in a left-to-right page.
- A cross side aligns an edge: `bottom start` lines up the start edges.
- When the preferred side has no room the engine flips; `data-placement` on the popover and the arrow names the side used. `shouldFlip={false}` keeps the side even when the popover is clipped.
- The engine writes `position: absolute`, `top` / `left` (or `bottom` / `right`), `max-height`, `z-index: 100000` and the custom properties `--trigger-width`, `--trigger-anchor-point` (and `--rv-available-height`) through CSSOM.

## Arrow

::example{id=popover-arrow}

Put an `OverlayArrow` inside the `Popover`. The engine places it along the edge facing the trigger and centres it on the trigger. Draw it pointing down (towards a trigger below a `top` popover) and rotate it by `data-placement` (Tailwind `placement-bottom:` and friends, or `[data-placement="bottom"]` in CSS).

## Modal and non-modal

::example{id=popover-nonmodal}

| | Modal (default) | `isNonModal` |
| --- | --- | --- |
| Outside press | closes (underlay) | closes only when it moves focus outside |
| :kbd[Tab] | stays inside | moves on; focus leaving closes it |
| Outside | `inert`, page does not scroll | interactive |
| Scrolling an ancestor of the trigger | page cannot scroll | closes it |

`isNonModal` is for popovers designed around it (a combobox list); most popovers should stay modal. `isKeyboardDismissDisabled` ignores :kbd[Escape]; an outside press still closes the popover.

## DOM events and attributes

::example{id=popover-events}

| Element | Takes | Owned events (component first, then yours) |
| --- | --- | --- |
| trigger `Button` | its own props | press events, `onClick`, `onPointerDown` / `Up`, `onMouseDown`, `onPointerEnter` / `Leave` |
| popover element | the `Popover`'s global DOM props | none (`style` is the render-prop style) |
| arrow | the `OverlayArrow`'s global DOM props | none |

`on…Capture` handlers work on resumed pages too, the first event included.

## Styling

| Selector | Matches |
| --- | --- |
| `.rv-Popover` | the popover |
| `[data-trigger="DialogTrigger"]`, `[data-trigger="MenuTrigger"]`, … | popovers of one trigger kind |
| `[data-placement="top"]` … | side used, on the popover and the arrow (Tailwind `placement-top:` …) |
| `[data-entering]`, `[data-exiting]` | enter / exit (Tailwind `entering:`, `exiting:`) |
| `.rv-OverlayArrow` | the arrow |
| `var(--trigger-width)`, `var(--trigger-anchor-point)` | match the trigger width, transform origin of scale animations |

The popover stays mounted until its exit CSS animations or transitions finish (`data-exiting`), so `exiting:` styles play.

### Tailwind

::example{id=popover-tailwind}

### Plain CSS

::example{id=popover-css}

`@rivetjs/cdk/theme.css` gives `.rv-Popover` a border, background, shadow and a fade (used by most examples here).

### Transitions

See [Styling](../start/styling.md) (`styling-transitions`): CSS transitions or keyframe animations on `entering:` / `exiting:`.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Popover` (`<div>`), `OverlayArrow` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<Popover render={(props) => <div {...(props as {})} />}>…</Popover>
```

## Accessibility

- The popover is a `role="dialog"` (its own, or the `Dialog` inside), named by the dialog's title or the trigger. The trigger has `aria-expanded` and, while open, `aria-controls`.
- Focus moves into the popover on open (the `Dialog`'s `[autofocus]` element, else the dialog) and back to the trigger on close.
- Modal: outside the popover everything is `inert` and the page does not scroll. The visually hidden dismiss buttons let screen reader users close it.

| Key | Action |
| --- | --- |
| :kbd[Enter], :kbd[Space] on the trigger | Toggle; focus moves in. |
| :kbd[Tab], :kbd[Shift]+:kbd[Tab] | Next / previous control; contained unless `isNonModal` (then leaving closes it). |
| :kbd[Escape] | Close (unless `isKeyboardDismissDisabled`); focus returns to the trigger. |

## Resumability

- Before interaction: the trigger and an empty anchor. The overlay, position engine and focus code load on the first press; the popover region is re-created on open.
- Content holding components (a `Dialog` with handlers, form fields) inside a closed popover: a render-function child (`{({ close }) => …}` on `Dialog`, or `{() => …}`), so it is created on open with the right contexts.
- Known limitations: a `Popover` without a `Dialog` inside does not take focus when it opens on a resumed page (wrap the content in a `Dialog`); `PortalProvider` does not reach a popover created on a resumed page (it renders in `body`).

## Testing

`new User().createTester("Dialog", { root: trigger, overlayType: "popover" })` from `@rivetjs/testing/user` opens it, finds the dialog through `aria-controls` and closes it with :kbd[Escape].

## Upstream

- React Aria Components `Popover`, `OverlayArrow`, `DialogTrigger`, `Pressable`; React Aria `usePopover` (`popoverProps` in `@rivetjs/cdk/popover/use-popover`, see [Overlays](../foundations/overlays.md)), `useOverlayTrigger`, `useOverlayPosition`, `DismissButton`.
- Deviations: popovers render in the div overlay layer, never the native `popover` top layer; render props are accessors (`placement()`); `trigger` modes on `DialogTrigger` (Rivet extension); no `UNSTABLE_portalContainer` (use `PortalProvider`).
- The position props `direction`, `zIndex` and `arrowStyle` are in the prop type but not read: the direction is the trigger's, `z-index` comes from `style.zIndex`.
- Not yet supported: RAC's focus containment for a `Dialog` nested in a non-modal popover (containment is decided when the popover renders).
