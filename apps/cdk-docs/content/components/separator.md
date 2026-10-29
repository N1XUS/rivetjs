---
title: Separator
description: Separator from @rivetjs/cdk/separator divides content - an hr when horizontal, a div role=separator when vertical - and works inside collections.
template: guide
status: experimental
related: [foundations/slots, components/menu, components/listbox]
---

`Separator` renders an `<hr>` when horizontal. When vertical (or with another `elementType`), it renders a `<div role="separator" aria-orientation="vertical">`. Inside a menu or list box it is a collection item: when the list is filtered, a separator stays only when it follows an item.

::example{id=separator-orientation}

## Import

```ts
import { Separator, SeparatorContext } from "@rivetjs/cdk/separator";
import { separatorProps } from "@rivetjs/cdk/separator/behaviour";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | |
| `elementType` | `string` | `hr` / `div` | |
| `aria-label`, `aria-labelledby`, `id` | `string` | none | |
| `class` | `string` | `rv-Separator` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<hr>` of `Separator`; see [Render](#render). |
| `style`, `slot`, global DOM props, `data-*` | | | |

## separatorProps

`separatorProps({ orientation, elementType, …labels })` returns `{ separatorProps }`, the attributes for your own element:

- `role="separator"`, except on an `<hr>`;
- `aria-orientation` only when vertical;
- the id and aria labels.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Separator` (`<hr>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<Separator render={(props) => <hr {...(props as {})} />}>…</Separator>
```

## Accessibility

- A horizontal separator is a native `<hr>` (role `separator` built in); a vertical one is a `div` with `role="separator"` and `aria-orientation="vertical"`.
- A separator is not focusable and is read as a boundary; for a purely decorative line between items that screen readers should skip, use a styled border instead.
- Label a separator (`aria-label` / `aria-labelledby`) only when it divides named regions, such as two groups of a toolbar.

## Common mistakes

- **Separators as spacing.** Use margins or `gap` for space; a separator adds a node to the accessibility tree.
- **A separator before the first item of a filtered list.** Inside a menu or list box this is handled (a separator stays only after an item); elsewhere hide it yourself.

## Upstream

- React Aria Components `Separator`; React Aria `useSeparator` → `separatorProps`.
