---
title: Keyboard
description: Keyboard from @rivetjs/cdk/keyboard renders a keyboard shortcut as a kbd with dir=ltr; menu items style their shortcuts through KeyboardContext.
template: guide
status: experimental
related: [foundations/slots, components/menu, foundations/keyboard-shortcuts]
---

`Keyboard` shows a shortcut (`<kbd dir="ltr">`, so `Ctrl+C` keeps its order in right-to-left text). Menu items provide `KeyboardContext` with the slot `keyboard`.

::example{id=keyboard-kbd}

## Import

```ts
import { Keyboard, KeyboardContext } from "@rivetjs/cdk/keyboard";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `() => content` | none | |
| `dir` | `string` | `"ltr"` | |
| `class` | `string` | none | Like RAC, no default class. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<kbd>` of `Keyboard`; see [Render](#render). |
| `style`, `slot`, `id`, `ref`, native `kbd` attributes | | | |

To *handle* shortcuts, see [Keyboard shortcuts](../foundations/keyboard-shortcuts.md).

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Keyboard` (`<kbd>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<Keyboard render={(props) => <kbd {...(props as {})} />}>…</Keyboard>
```

## Upstream

- React Aria Components `Keyboard`.
