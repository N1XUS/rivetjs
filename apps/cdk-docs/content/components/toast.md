---
title: Toast
description: ToastQueue, ToastRegion, Toast and ToastContent from @rivetjs/cdk show brief notifications in a landmark region, with timers, F6 navigation and focus restore.
template: guide
status: experimental
related: [components/dialog, components/button, foundations/overlays, foundations/portal]
---

A toast is a short, temporary notification. You add one to a `ToastQueue` from anywhere, and a `ToastRegion` renders the visible ones. This is the React Aria Components `UNSTABLE_Toast` family, under the same `UNSTABLE_` names as upstream.

- **Region:** an ARIA landmark (`role="region"`, label "N notifications."), portalled to `<body>`. :kbd[F6] and :kbd[Shift+F6] move between it and the page's other landmarks.
- **Toast:** an `alertdialog` that holds an `alert`. Its close button is a `<Button slot="close">`.
- **Timers:** a toast with a `timeout` closes itself. The timer pauses while the region is hovered or has focus.
- **Focus:** when the focused toast closes, focus moves to the next toast. When the last toast closes, focus goes back to where it was before it entered the region.

::example{id=toast-basic}

## Anatomy

There is nothing in the server output or the page until the first toast. Then the region is added at the end of `<body>` (newest toast first):

```html
<div data-rivet-portal="">
  <div data-react-aria-top-layer="true" role="region" tabindex="-1" aria-label="2 notifications." class="rv-ToastRegion" dir="ltr">
    <ol class="rv-ToastList" style="display: contents;">
      <li style="display: contents;">
        <div role="alertdialog" aria-modal="false" aria-labelledby="rvc3" aria-describedby="rvc4" tabindex="0" class="rv-Toast">
          <div role="alert" aria-atomic="true" class="rv-ToastContent">
            <span id="rvc3" slot="title" class="rv-Text">Files uploaded</span>
            <span id="rvc4" slot="description" class="rv-Text">3 files uploaded successfully.</span>
          </div>
          <button type="button" class="rv-Button" slot="close" aria-label="Close"><svg aria-hidden="true" …></svg></button>
        </div>
      </li>
      …
    </ol>
  </div>
</div>
```

The `ToastRegion` also leaves an empty anchor where you placed it: `<span data-rv-toast-anchor style="display:contents">`. It is used for resuming the page.

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `ToastRegion` | `<div role="region">` | `rv-ToastRegion` | `aria-label` "N notification(s).", `tabindex="-1"`, `data-react-aria-top-layer`, `dir`; `data-hovered`, `data-focused`, `data-focus-visible`. |
| `ToastList` | `<ol>` | `rv-ToastList` | One `<li style="display:contents">` per visible toast. A function as `ToastRegion` children renders inside a `display: contents` list. |
| `Toast` | `<div role="alertdialog">` | `rv-Toast` | `aria-labelledby` points at the title, `aria-describedby` at the description (when rendered), `tabindex="0"`; `data-focused`, `data-focus-visible`. |
| `ToastContent` | `<div role="alert">` | `rv-ToastContent` | `aria-atomic="true"`, `aria-hidden` until the toast has mounted (so the alert is announced). |
| `<Text slot="title">` / `slot="description"` | `<span>` | `rv-Text` | Ids come from the toast. |
| `<Button slot="close">` | `<button>` | `rv-Button` | `aria-label="Close"` (localized); a press closes the toast. |

## Import

```tsx
import {
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
  UNSTABLE_ToastList as ToastList,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastStateContext as ToastStateContext,
} from "@rivetjs/cdk/toast";
// Behavior helpers for custom markup:
import { toastRegionProps, toastProps } from "@rivetjs/cdk/toast/behaviour";
// The queue alone (no components):
import { ToastQueue, createToastState, createToastQueueState } from "@rivetjs/cdk/state/toast";
```

`ToastContent` and `ToastContentContext` are also exported without the prefix, as in RAC.

## Props

### ToastQueue

`new ToastQueue<T>(options?)` holds the toasts. Create one per app at module level and share it.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `maxVisibleToasts` | `number` | `Infinity` | The most toasts shown at a time. The rest wait in the queue. |
| `wrapUpdate` | `(fn: () => void, action: "add" \| "remove" \| "clear") => void` | none | Wraps each update, e.g. in `document.startViewTransition`. |
| `name` | `string` | `"default"` | Rivet only. How a `ToastRegion` on a resumed page finds this queue. Give each queue its own name when a page has more than one. |

| Method | Description |
| --- | --- |
| `add(content, { timeout?, onClose? })` | Adds a toast to the front and returns its key. `timeout` is in ms. `onClose` runs when the toast closes, whether by the user, by its timer or by `close`. |
| `close(key)` | Removes a toast and calls its `onClose`. |
| `pauseAll()` / `resumeAll()` | Pauses or resumes the timers of the visible toasts. |
| `clear()` | Removes all toasts. |
| `subscribe(fn)` | Calls `fn` on every change. Returns the unsubscribe function. |
| `visibleToasts` | The `QueuedToast<T>[]` currently shown (`{ key, content, timeout?, onClose?, timer? }`). |

### ToastRegion

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `queue` | `ToastQueue<T>` | required | The queue to render. |
| `children` | `({ toast }) => content` or content | required | A function renders each toast inside a list. Other content (your own markup containing a `ToastList`) renders as is. |
| `aria-label` | `string` | "N notifications." | Label of the landmark. |
| `aria-labelledby`, `aria-describedby` | `string` | none | Labelling ids. |
| `class` | `string \| (values) => string` | `"rv-ToastRegion"` | Values: `visibleToasts`, `isHovered`, `isFocused`, `isFocusVisible` (accessors). |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ToastRegion`; see [Render](#render). |
| `style` | object or function of the values | none | Inline style. |
| global DOM attributes and events | | | Forwarded to the region `<div>` (see [DOM events and attributes](#dom-events-and-attributes)). |

The region renders into the nearest `PortalProvider` container, or `document.body` if there is none (see [Portal](../foundations/portal.md)).

### ToastList

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `({ toast }) => content` | required | Renders each visible toast. |
| `class` / `style` | value or function of the region values | `"rv-ToastList"` | `isHovered` is the list's own hover state. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<ol>` of `ToastList`; see [Render](#render). |
| global DOM attributes and events | | | Forwarded to the `<ol>`. |

### Toast

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `toast` | `QueuedToast<T>` | required | The toast from the render function. |
| `children` | content or `({ toast, isFocused, isFocusVisible }) => content` | none | Usually `ToastContent` plus a close button. |
| `class` / `style` | value or function of `{ toast, isFocused, isFocusVisible }` | `"rv-Toast"` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Toast`; see [Render](#render). |
| `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | | Labelling. The title and description ids are added by default. |
| global DOM attributes and events | | | Forwarded to the `alertdialog` `<div>`. |

### ToastContent

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | content | none | `<Text slot="title">` and `<Text slot="description">`. |
| `id`, `class`, `style` | | `"rv-ToastContent"` | |
| global DOM attributes and events | | | Forwarded to the `alert` `<div>`. |

### Events

| Event | Where | Description |
| --- | --- | --- |
| `onClose` | `queue.add(content, { onClose })` | The toast closed: close button, timeout or `queue.close`. |
| DOM events | region, list, toast, content | Your handlers run after the region's own hover and focus handlers. |

## Timeout and programmatic close

`timeout` closes a toast automatically. React Aria recommends at least 5 seconds, and leaving out the timeout for toasts that have actions. The timers of all visible toasts pause while the pointer is over the region or focus is inside it, and resume when it leaves. `queue.close(key)` closes a toast from code, using the key that `add` returned.

::example{id=toast-timeout}

## Content slots and render props

`ToastRegion` accepts either form of children:

- **A function of `{ toast }`.** The usual case.
- **Your own markup containing a `ToastList`.** Use it to add a heading or other content to the region.

`Toast` children can be a function of `{ toast, isFocused, isFocusVisible }`. Every `class` and `style` prop can also be a function of the component's values.

::example{id=toast-render-props}

## Animations with view transitions

The `wrapUpdate` option runs every queue update inside a callback. Pass `document.startViewTransition` and give each toast its own `view-transition-name` (its `key`). Toasts then animate in and out with `::view-transition-*` CSS. This is the approach React Aria documents.

::example{id=toast-view-transition}

## DOM events and attributes

Each part forwards global DOM attributes and events to its own element:

| Part | Element |
| --- | --- |
| `ToastRegion` | the region `<div>` |
| `ToastList` | the `<ol>` |
| `Toast` | the `alertdialog` `<div>` |
| `ToastContent` | the `alert` `<div>` |

The region owns `onPointerEnter` / `onPointerLeave` (hover, which pauses the timers) and `onFocusIn` / `onFocusOut` (focus restore). Its handlers run first, then yours. `data-*` attributes are forwarded too. The per-toast callback is `onClose` in `queue.add`.

::example{id=toast-events}

## Styling

| Selector | When |
| --- | --- |
| `.rv-ToastRegion[data-hovered]` | Pointer over the region (timers paused). |
| `.rv-ToastRegion[data-focus-visible]` | Region focused by keyboard (:kbd[F6]). |
| `.rv-Toast[data-focused]` / `[data-focus-visible]` | Toast focused / focused by keyboard. |
| `.rv-ToastContent`, `.rv-ToastList` | Content and list. |
| `[slot="title"]`, `[slot="description"]`, `[slot="close"]` | The slotted children. |

Position the region yourself, for example `position: fixed` in a corner. It has no default styles. `@rivetjs/cdk/theme.css` does not style toasts.

### Tailwind

Use `data-[focus-visible]:` / `data-[hovered]:` variants (or `focused:` from `@rivetjs/cdk/tailwind.css`). Data you put on the toast (`data-variant`) works with arbitrary variants too.

::example{id=toast-tailwind}

### Plain CSS

The [first example](#toast) styles the default class names and data attributes in plain CSS.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ToastRegion` (`<div>`), `ToastList` (`<ol>`), `Toast` (`<div>`), `ToastContent` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<ToastRegion render={(props) => <div {...(props as {})} />}>…</ToastRegion>
```

## Accessibility

- The region is a landmark labelled by the toast count ("1 notification.", "2 notifications.", localized). Screen readers list it with the page's other landmarks.
- Each toast is an `alertdialog` (not modal) labelled by its title and described by its description. Its content is an `alert` (`aria-atomic`), announced when the toast appears.
- The close button gets a localized `aria-label` ("Close").
- When the focused toast closes, focus moves to the next toast (or the previous one if there is none). After the last toast, focus goes back to the element that was focused before. With a pointer, focus leaves the region at once, so the timers don't stay paused.

| Key | Action |
| --- | --- |
| :kbd[F6] / :kbd[Shift+F6] | Moves focus to the next / previous landmark, including the toast region. |
| :kbd[Alt+F6] | Moves focus to the `main` landmark. |
| :kbd[Tab] / :kbd[Shift+Tab] | Move between toasts and their buttons inside the region. |
| :kbd[Enter] / :kbd[Space] on the close button | Closes the toast. |

Landmark navigation comes from the cdk landmark manager (`@rivetjs/cdk/landmark`: `landmarkProps`, `UNSTABLE_createLandmarkController`). When focus wraps past the last landmark, the manager dispatches the `react-aria-landmark-navigation` event on `window`.

## Resumability

- **Server output.** The server renders no region, only the empty anchor. No toast code ships before the first toast. The region's listener is registered in the resume data, and its code loads when the event arrives.
- **Waking the region.** A `ToastQueue` is a class instance, so it never serializes. On a resumed page, the first `add` (for example from a resumed button's `onPress`) dispatches a `rv-toast-queue` document event that carries the queue. The `ToastRegion` whose queue has the same `name` connects to it and renders. The region listens from idle on: a document event has no target inside the region, so its code loads at idle, not with the first toast.
- **Repeated wake-up.** The resume runtime can attach that listener after the interaction that added the toast has already run. While no region is connected, the queue dispatches the event again a few times over about four seconds (0, 50, 250, 1000 and 3000 ms).
- **Where to create the queue.** Create it at module level and use it from inline-arrow handlers. A queue created inside a component would be a new one when the component runs again in the browser.
- **Pages rendered in the browser.** A region rendered in the browser subscribes to the queue directly.

## Testing

Render with `@rivetjs/runtime/testing` and query `document.body`, since the region is portalled. Timers are real `setTimeout` calls, so `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })` controls them.

## Upstream

| React Aria | Rivet |
| --- | --- |
| RAC `UNSTABLE_ToastRegion`, `UNSTABLE_ToastList`, `UNSTABLE_Toast`, `UNSTABLE_ToastContent`, `UNSTABLE_ToastStateContext`, `UNSTABLE_ToastQueue`, `ToastContent`, `ToastContentContext` | Same names in `@rivetjs/cdk/toast`. |
| `useToastRegion(props, state, ref)` | `toastRegionProps(props, state, ref)`, which returns RA's `regionProps` bag. |
| `useToast(props, state, ref)` | `toastProps(props, state)`, which returns `{ toastProps, contentProps, titleProps, descriptionProps, closeButtonProps }`. |
| `useToastState`, `useToastQueue`, `ToastQueue` (@react-stately/toast) | `createToastState`, `createToastQueueState`, `ToastQueue` in `@rivetjs/cdk/state/toast`. |
| `useLandmark`, `UNSTABLE_createLandmarkController` | `landmarkProps(props, ref)`, `UNSTABLE_createLandmarkController` in `@rivetjs/cdk/landmark`. |

Deviations:

- **Rendering and resuming.** The region renders through the cdk `Portal` inside a `<div data-rivet-portal>` host and leaves an empty `display: contents` anchor in place. Waking it on a resumed page uses `queue.name` and the `rv-toast-queue` event.
- **Landmark manager.** Its singleton is kept under `Symbol.for("rivet-cdk-landmark-manager")`, separate from React Aria's own manager.
- **Chromium focusout.** The region ignores the focusout that Chromium fires when the focused toast is removed. Without that, focus could not move to the next toast.
- **Timer.** `Timer.reset` clears a countdown that is already running.
- **Class name.** `class` replaces `className`.
