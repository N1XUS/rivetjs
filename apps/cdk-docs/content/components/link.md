---
title: Link
description: Link from @rivetjs/cdk is an anchor (or a span with role link) with press events, disabled and current states, and client routing via RouterProvider.
template: guide
status: experimental
related: [components/breadcrumbs, components/button, components/menu, components/tabs]
---

`Link` renders an `<a href>`: navigation needs no JavaScript, the browser (or `@rivetjs/router`'s anchor interception) follows it. Hover, focus and press handlers resume on first interaction and write the `data-*` states; without an `href`, or while disabled, it renders a `<span role="link">`. `RouterProvider` routes every link in its subtree through your router's `navigate`.

::example{id=link-states}

## Anatomy

```html
<a class="rv-Link" href="/docs">Docs</a>
<a class="rv-Link" href="/docs" aria-current="page" data-current="true">Docs</a>
<!-- no href (an action), or disabled -->
<span class="rv-Link" role="link" tabindex="0">Read more</span>
<span class="rv-Link" role="link" aria-disabled="true" data-disabled="true">Archive</span>
```

| Attribute | Value |
| --- | --- |
| `href`, `target`, `rel`, `download`, `hrefLang`, `ping`, `referrerPolicy` | on the anchor |
| `role="link"`, `tabindex="0"` | span link (enabled) |
| `aria-disabled`, `data-disabled` | `isDisabled` (no `tabindex`; the `href` stays on the span, as in RAC, and does nothing) |
| `aria-current`, `data-current` | `aria-current` other than `false` |
| `data-hovered`, `data-focused`, `data-focus-visible`, `data-pressed` | interaction states, written by the handlers |
| `class` | `rv-Link`, or your `class` |

## Import

```ts
import { Link, RouterProvider } from "@rivetjs/cdk/link";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `({ isHovered, isPressed, isFocused, isFocusVisible, isCurrent, isDisabled }) => content` | none | Render props are accessors: call them. |
| `href` | `string` | none | Without it: a span link (an action). |
| `target`, `rel`, `download`, `hrefLang`, `ping`, `referrerPolicy` | native values | none | |
| `routerOptions` | `unknown` | none | Passed to `RouterProvider`'s `navigate`. |
| `isDisabled` | `boolean \| () => boolean` | `false` | Renders a span; not focusable; no press. An accessor re-creates the link when it flips. |
| `aria-current` | `boolean \| "page" \| "step" \| "location" \| "date" \| "time"` (or an accessor) | none | Current page in a set of links. |
| `autoFocus` | `boolean` | `false` | |
| `id`, `slot` | `string` | none | `slot` picks props from `LinkContext`. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` (label / labelledby: or an accessor) | none | |
| `class`, `style` | value or `(renderProps) => value` | `rv-Link` | |
| `ref` | `ref()` | none | The `<a>` / `<span>`. |
| global DOM props | `GlobalDOMAttributes` (without `onClick`) | none | See below. |

### Events

| Event | Fires |
| --- | --- |
| `onPress(e)` | A completed press (mouse, touch, pen, keyboard :kbd[Enter], virtual click). |
| `onPressStart(e)`, `onPressEnd(e)`, `onPressUp(e)` | Press start / end / release over the link. |
| `onPressChange(isPressed)` | Pressed state changed. |
| `onClick(e)` | Native click, after the press handling (a press option, deprecated upstream). |
| `onHoverStart(e)`, `onHoverEnd(e)`, `onHoverChange(isHovered)` | Mouse / pen hover. |
| `onFocus(e)`, `onBlur(e)`, `onFocusChange(isFocused)` | Focus. |
| `onKeyDown(e)`, `onKeyUp(e)` | Keys. |

## Press events

The press handlers resume on the first pointer / key event; an anchor still navigates natively. A link without `href` is an action: it is announced as a link and activated with :kbd[Enter].

::example{id=link-events}

## Link attributes

::example{id=link-attrs}

## Client routing

`RouterProvider` takes your router's `navigate(href, routerOptions)` and an optional `useHref(href)` (the DOM href, e.g. with a base path). Plain same-tab clicks without modifiers call `navigate`; modified clicks, `target="_blank"`, downloads and other origins go to the browser. Its children must be a function, so the links render inside the provider. Plain Rivet apps need no provider: `@rivetjs/router` intercepts anchors.

::example{id=link-router}

Router helpers (from `@rivetjs/cdk/link`): `useRouter()`, `createRouter(navigate, useHref?)`, `RouterContext`, `routerHref(router, href)`, `shouldClientNavigate(anchor, modifiers)`, `openLink(anchor, modifiers)` (opens like a user click), `routerOpen`, `handleLinkClick` and `syntheticLinkAttrs` (link rows and cells). `LinkContext` sets default props for the links inside (presses chain). For your own element, `@rivetjs/cdk/link/behaviour` exports `linkProps(props, router?)` (the attributes) and the handlers `linkPointerDown`, `linkPointerUp`, `linkKeyDown`, `linkClick`, `linkMouseDown`, `linkDragStart` (`(event, pressOptions, …)`); wire them as inline arrows.

## Render

`render` replaces the default `<a>` with your own element (React Aria Components `render`). It receives the part's props, including `ref`, `class`, `data-*` state attributes and handlers, and the render props (`isCurrent()`, `isPressed()`, `isDisabled()` and the other accessors). Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<Link href="/docs" render={(props) => <b {...(props as {})} />}>Docs</Link>
```

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) land on the `<a>` / `<span>`. `onClick` is a press option: it runs after the press handling. Link's own pointer, hover and key handlers are chained with yours (both run, Link's first).

::example{id=link-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-Link` | always |
| `[data-current]`, `[aria-current=page]` | current page |
| `[data-disabled]` | disabled |
| `[data-pressed]` | pressed |
| `[data-hovered]` | hovered (mouse / pen) |
| `[data-focused]`, `[data-focus-visible]` | focused / keyboard focused |

### Tailwind

::example{id=link-tailwind}

### Plain CSS

::example{id=link-css}

### Starter theme

`@rivetjs/cdk/theme.css` has no `.rv-Link` rule; links keep the page's link style.

## Accessibility

- Use a Link to go somewhere; use a [Button](button.md) to do something on the page.
- A disabled link is a `span` with `role="link"` and `aria-disabled`, removed from the Tab order.
- Mark the current page in navigation with `aria-current="page"`.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Enter] | Follow the link / press it. |
| :kbd[Tab] | Move focus. |

## Resumability

- An `<a href>` is plain HTML until it is hovered, focused or pressed: then its handlers resume.
- Callbacks resume with the component; callbacks must be inline arrows or local functions. `navigate` and `useHref` resume too.

## Testing

Render with `render` from `@rivetjs/runtime/testing`; `getByRole("link", { name })`, then `user.click` or `user.keyboard("{Enter}")`. Wrap in a `RouterProvider` with a spy `navigate` to assert client navigation.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Link`, `LinkContext` | RAC `Link` |
| `link/behaviour` `linkProps` + `link*` handlers | react-aria `useLink` |
| `RouterProvider`, `openLink`, `shouldClientNavigate`, `useRouter` | react-aria `RouterProvider`, `openLink` utils |

Deviations: a disabled link or one without `href` renders a `span` (RAC renders a `span` only without `href`); render props are accessors; `class` = RAC `className`.

## Not yet supported

- **Known issue:** a Link's first press can be lost after another component on the page has resumed: the first click runs no press callback, the next one does (`libs/cdk/link` with `interactions/press.tsx`). Plain anchors are not affected.

## Common mistakes

- **A Link without `href` for navigation.** It cannot be opened in a new tab or bookmarked; give it an `href`.
- **Plain children in `RouterProvider`.** The links do not see the provider; pass `{() => …}`.
- **`onClick` to cancel navigation.** Handle it in `navigate`, or use a Button.
