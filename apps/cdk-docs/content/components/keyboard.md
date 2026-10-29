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

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Keyboard` (`<kbd>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<Keyboard render={(props) => <kbd {...(props as {})} />}>…</Keyboard>
```

## Accessibility

- `Keyboard` only shows a shortcut; it does not handle the keys. Bind them yourself ([Keyboard shortcuts](../foundations/keyboard-shortcuts.md)) and keep the text in sync with the binding.
- Inside a cdk `MenuItem`, the item gives its `Keyboard` an id and adds it to the item's `aria-describedby`, so screen readers read the shortcut after the item name.
- `dir="ltr"` keeps `Ctrl+C` in reading order inside right-to-left text; keep it unless the shortcut text itself is right-to-left.
- Write key names as users see them on their keyboard (`Ctrl`, `Cmd`, `Shift`); for per-platform labels, decide in the browser with the [Platform](../foundations/platform.md) checks.

## Common mistakes

- **Expecting the shortcut to work.** Showing `Ctrl+S` in a `Keyboard` binds nothing.
- **A shortcut that differs per platform rendered on the server.** The server does not know the platform; render the neutral text, or switch it in a client effect.

## Upstream

- React Aria Components `Keyboard`.
