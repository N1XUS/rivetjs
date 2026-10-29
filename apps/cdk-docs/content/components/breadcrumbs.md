---
title: Breadcrumbs
description: Breadcrumbs from @rivetjs/cdk: a labelled ordered list of Links ending at the current page, with Breadcrumb parts, an items render function and onAction.
template: guide
status: experimental
related: [components/link, components/toolbar]
---

`Breadcrumbs` renders an `<ol aria-label="Breadcrumbs">` of `<Breadcrumb>` items (`<li>`), each holding a [Link](link.md). The last item is the current page: its Link gets `aria-current="page"` and is disabled. Links with `href` are anchors: navigation works before any JavaScript loads.

::example{id=breadcrumbs-basic}

## Anatomy

```tsx
<Breadcrumbs>
  <Breadcrumb>
    <Link href="/">Home</Link>
  </Breadcrumb>
  <Breadcrumb>
    <Link>Current page</Link>
  </Breadcrumb>
</Breadcrumbs>
```

```html
<ol class="rv-Breadcrumbs" aria-label="Breadcrumbs">
  <li class="rv-Breadcrumb"><a class="rv-Link" href="/">Home</a></li>
  <li class="rv-Breadcrumb" data-current="true" data-disabled="true">
    <span class="rv-Link" role="link" aria-current="page" aria-disabled="true" data-current="true" data-disabled="true">Current page</span>
  </li>
</ol>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `Breadcrumbs` | `ol` | `rv-Breadcrumbs` | `aria-label` defaults to "Breadcrumbs" (localized). |
| `Breadcrumb` | `li` | `rv-Breadcrumb` | `data-current` on the last; `data-disabled` on the last or all with `isDisabled`. Provides `LinkContext` to its Link. |
| `Link` | `a` / `span` | `rv-Link` | A [Link](link.md); the current one renders as a disabled span link. |

Separators are CSS: draw them with `.rv-Breadcrumb:not([data-current])::after`.

## Import

```ts
import { Breadcrumb, Breadcrumbs, BreadcrumbsContext, type BreadcrumbsOverflowItem } from "@rivetjs/cdk/breadcrumbs";
import { Link } from "@rivetjs/cdk/link";
```

## Props

### Breadcrumbs

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `Breadcrumb`s, or `(item) => <Breadcrumb>` with `items` | none | Static parts or a render function per item. |
| `items` | `Iterable<T>` or `() => Iterable<T>` | none | Data-driven items; each item's `id` (or `key`) becomes its Breadcrumb's `id`. |
| `isDisabled` | `boolean \| () => boolean` | `false` | Disables every breadcrumb. |
| `onAction` | `(id: Key) => void` | none | A breadcrumb's Link was pressed (not the current one). |
| `aria-label`, `aria-labelledby` | `string` | `"Breadcrumbs"` | |
| `id`, `slot` | `string` | none | `slot` picks props from `BreadcrumbsContext`. |
| `class`, `style` | `string`, style | `rv-Breadcrumbs` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<ol>` of `Breadcrumbs`; see [Render](#render). |
| `ref` | `ref()` | none | The `<ol>`. |
| global DOM props | `GlobalDOMAttributes` | none | On the `<ol>`. |
| `overflowMode` | `"wrap" \| "collapse"` | `"wrap"` | `"collapse"`: breadcrumbs that do not fit collapse into one overflow item; see [Overflow](#overflow). Rivet addition. |
| `showRoot` | `boolean` | `false` | Collapsing: keep the first breadcrumb while it fits. |
| `maxVisibleItems` | `number \| "auto"` | `4` | Collapsing: at most this many visible, the overflow item counted. |
| `defaultVisibleItems` | `number` | every item | Collapsing: visible breadcrumbs before the browser measures (server render). |
| `renderOverflow` | `(items: BreadcrumbsOverflowItem[]) => content` | none | Collapsing: the overflow item's content for the collapsed breadcrumbs. |
| `overflowClass` | `string` | `rv-Breadcrumb` | Collapsing: class of the overflow `<li>`. |

### Breadcrumb

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `Key` | index / item id | Passed to `onAction`. |
| `textValue` | `string` | its text | The label in `renderOverflow` items. |
| `children` | content or `({ isCurrent, isDisabled }) => content` | none | Render props are accessors: call them. |
| `class` | `string \| ({ isCurrent, isDisabled }) => string` | `rv-Breadcrumb` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<li>` of `Breadcrumb`; see [Render](#render). |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | |
| `ref` | `ref()` | none | The `<li>`. |
| global DOM props | `GlobalDOMAttributes` | none | On the `<li>`. |

## Actions

`onAction` receives the `id` of the pressed breadcrumb; use it for in-page navigation (a folder path). Breadcrumbs with `href` still navigate unless you route them yourself.

::example{id=breadcrumbs-action}

## Dynamic items and render props

Pass `items` and a render function child for data-driven trails; a `Breadcrumb` children function gets `isCurrent()` / `isDisabled()`. The Link inside still receives `aria-current`, `isDisabled` and the `onAction` press through `LinkContext`.

::example{id=breadcrumbs-slots}

## Disabled

::example{id=breadcrumbs-disabled}

## Overflow

`overflowMode="collapse"` measures the list and collapses the breadcrumbs that do not fit into one overflow item: `[root, …, last items]`, the React Spectrum Breadcrumbs behaviour. `renderOverflow(items)` renders that item's content, usually a [MenuTrigger](menu.md) listing the collapsed breadcrumbs; `showRoot` keeps the first breadcrumb while it fits, `maxVisibleItems` caps the visible count (Spectrum: 4). The current breadcrumb never collapses. Each item is `{ key, textValue, href, props }`: `textValue` and `href` come from the Breadcrumb (`textValue`, an `href` prop) or, when it has none, from its text and link as last rendered. The measuring is [`@rivetjs/cdk/overflow`](../foundations/overflow.md) (server rendering, layout shift and styling notes there).

:::note
Rivet addition: React Aria Components Breadcrumbs never collapse. The algorithm and its test cases are React Spectrum v3's.
:::

::example{id=breadcrumbs-overflow}

```html
<ol class="rv-Breadcrumbs" aria-label="Folder">
  <li class="rv-Breadcrumb"><span class="rv-Link" role="link" tabindex="0">Files</span></li>
  <li class="rv-Breadcrumb" data-overflow="true"><button aria-label="More folders" aria-haspopup="true">…</button></li>
  <li class="rv-Breadcrumb">…</li>
  <li class="rv-Breadcrumb" data-current="true">…</li>
</ol>
```

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) on `Breadcrumbs` land on the `<ol>`; on a `Breadcrumb` they land on its `<li>`. Link events belong on the `<Link>`.

::example{id=breadcrumbs-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-Breadcrumbs` | the list |
| `.rv-Breadcrumb` | an item; `[data-current]` last, `[data-disabled]` disabled, `[data-overflow]` the overflow item |
| `.rv-Breadcrumb:not([data-current])::after` | separators |
| `.rv-Link[aria-current=page]` | the current page |

### Tailwind

::example{id=breadcrumbs-tailwind}

### Plain CSS

::example{id=breadcrumbs-css}

### Starter theme

`@rivetjs/cdk/theme.css` has no breadcrumbs rule.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Breadcrumbs` (`<ol>`), `Breadcrumb` (`<li>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<Breadcrumbs render={(props) => <ol {...(props as {})} />}>…</Breadcrumbs>
```

## Custom markup

`@rivetjs/cdk/breadcrumbs/behaviour` exports `breadcrumbsProps({ id, "aria-label", "aria-labelledby" })`: the list attributes, the localized default label included. For one crumb, provide a `LinkContext` value (`{ "aria-current", isDisabled, onPress }`) around a `<Link>`.

## Accessibility

- An `<ol>` named "Breadcrumbs" (give it a `nav` landmark yourself: wrap it in `<nav aria-label="Breadcrumbs">` and drop the list label, or keep both distinct).
- The current page is `aria-current="page"` and not focusable.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Tab] | Next breadcrumb link. |
| :kbd[Enter] | Follow / press it. |

## Resumability

- With `overflowMode="collapse"` pass a `ref()` as `ref` (a callback ref is not measured on a resumed page). The measurement starts when the list becomes visible.
- `isCurrent` reads the live collection: appending an item moves the current breadcrumb on a resumed page.
- See [Link](link.md#not-yet-supported) for the known first-press issue on press-handling links.

## Testing

`getByRole("list", { name: "Breadcrumbs" })`, then `getAllByRole("link")`; assert the last has `aria-current="page"`. Click with `@testing-library/user-event` and assert the `onAction` spy.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Breadcrumbs`, `Breadcrumb`, `BreadcrumbsContext` | RAC `Breadcrumbs`, `Breadcrumb`, `BreadcrumbsContext` |
| `breadcrumbs/behaviour` `breadcrumbsProps` | react-aria `useBreadcrumbs` |

Deviations: render props are accessors; `class` = RAC `className`.

## Not yet supported

- A `nav` wrapper; add it yourself.

## Common mistakes

- **Separators in the content.** Screen readers read them; draw them in CSS.
- **A non-`Link` element in a `Breadcrumb`.** It does not receive `aria-current` or the press.
- **Duplicate ids.** Items are keyed by `id` (or `key`).
