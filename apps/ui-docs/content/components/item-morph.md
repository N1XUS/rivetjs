---
title: ItemMorph
description: "An item preview panel opened from a list item."
template: reference
status: experimental
related: [components/list-box, components/morph, components/popover]
---

`ItemMorph` — An item preview panel opened from a list item.

## Usage

```tsx
import { ItemMorph } from "@rivetjs/ui/item-morph";
```

::example{id=list-box-item-morph-contacts}

## Anatomy

Create one state with `useItemMorph`, spread `itemMorphProps(morph)` onto each ListBox.Item, and render ItemMorph with that state. Its function child receives the current item key accessor. `ItemMorph.Close` closes the panel; `useItemMorphPanel` exposes the active panel state to nested content.

Public parts: `ItemMorph.Root`, `ItemMorph.Close`.

## Styling Reference

The component emits these `data-slot` values across its parts: `item-morph-close`.

Base and part classes: `item-morph__backdrop`, `item-morph`, `item-morph__close`, `item-morph__panel`.

## API Reference

See the [full module API](/api/rivetjs/ui/item-morph/) for every named export and part prop type.

| Prop       | Values                          | Default |
| ---------- | ------------------------------- | ------- |
| `backdrop` | `blur`, `opaque`, `transparent` | `blur`  |

::api{symbol="@rivetjs/ui/item-morph#ItemMorphCloseProps"}

::api{symbol="@rivetjs/ui/item-morph#ItemMorphRootProps"}

::api{symbol="@rivetjs/ui/item-morph#itemMorphProps"}

## Accessibility

The cdk item morph supports long press, context menu and Shift+F10; `trigger: "press"` opts into ordinary presses. Name the panel with `aria-label` when the item’s name is insufficient. Keep a Close button reachable; Escape dismisses the panel and restores focus.

## Related Components

- [ListBox](/components/list-box/)
- [Morph](/components/morph/)
- [Popover](/components/popover/)
