---
title: Heading
description: Heading from @rivetjs/cdk/heading renders h1-h6 and takes its level, id and class from HeadingContext, so dialogs and cards can title their content.
template: guide
status: experimental
related: [foundations/slots, components/dialog, components/separator]
---

`Heading` renders `<h1>`…`<h6>` from `level` (default 3). Containers provide `HeadingContext`: a Dialog gives its `slot="title"` heading the id that `aria-labelledby` points at.

::example{id=heading-levels}

## Import

```ts
import { Heading, HeadingContext } from "@rivetjs/cdk/heading";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `level` | `1`–`6` | `3` | Read once when the heading renders. |
| `children` | content or `() => content` | none | A function child is reactive content. |
| `slot` | `string \| null` | none | Picks a slot of `HeadingContext`; `null` opts out. |
| `class` | `string` | `rv-Heading` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<h3>` of `Heading`; see [Render](#render). |
| `style`, `id`, `ref`, native `h*` attributes | | | |

## Context

`HeadingContext` takes the same props, or `{ slots: { … } }` (see [Slots](../foundations/slots.md)). Accessor values (`children: () => title()`) update in place.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Heading` (`<h3>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<Heading render={(props) => <h3 {...(props as {})} />}>…</Heading>
```

## Accessibility

Choose `level` to fit the document hierarchy. A heading supplies document structure, not an interactive focus target or keyboard behavior. When replacing its element through `render`, preserve the heading semantics and any id supplied by the containing dialog.

## Upstream

- React Aria Components `Heading`.
- Deviations:
  - changing `level` after the first render does not switch the tag.
