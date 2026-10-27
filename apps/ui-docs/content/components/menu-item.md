---
title: MenuItem
description: "An action or selectable item inside a Menu."
template: reference
status: experimental
related: [components/menu, components/dropdown, components/menu-section]
---

`MenuItem` — An action or selectable item inside a Menu.

## Usage

```tsx
import { MenuItem } from "@rivetjs/ui/menu-item";
```

::example{id=dropdown-with-single-selection}

## Anatomy

Place `MenuItem` inside Menu. `MenuItem.Indicator` shows selection (`type="checkmark"` by default, or `"dot"`); `MenuItem.SubmenuIndicator` displays a decorative chevron. The live example uses Dropdown’s menu composition.

Public parts: `MenuItem.Root`, `MenuItem.Indicator`, `MenuItem.SubmenuIndicator`.

## Styling Reference

The component emits these `data-slot` values across its parts: `menu-item`, `menu-item-indicator--dot`, `menu-item-indicator--checkmark`, `menu-item-indicator`, `submenu-indicator`.

Base and part classes: `menu-item__icon`, `menu-item__indicator`, `menu-item`, `menu-item__shortcut`, `menu-item__indicator--submenu`, `menu-item__text`.

## API Reference

See the [full module API](/api/rivetjs/ui/menu-item/) for every named export and part prop type.

| Prop      | Values              | Default   |
| --------- | ------------------- | --------- |
| `variant` | `danger`, `default` | `default` |

::api{symbol="@rivetjs/ui/menu-item#MenuItemIndicatorProps"}

::api{symbol="@rivetjs/ui/menu-item#MenuItemRootProps"}

::api{symbol="@rivetjs/ui/menu-item#MenuItemSubmenuIndicatorProps"}

## Accessibility

The cdk menu item supplies the menu-item role appropriate to its selection mode, disabled state and keyboard action behavior. Set `textValue` for rich content. Indicators are decorative; selection and submenu behavior come from the menu context.

## Related Components

- [Menu](/components/menu/)
- [Dropdown](/components/dropdown/)
- [MenuSection](/components/menu-section/)
