---
title: Menu
description: "A styled action menu with keyboard navigation, selection and sections."
template: reference
status: experimental
related: [components/dropdown, components/menu-item, components/menu-section]
---

`Menu` — A styled action menu with keyboard navigation, selection and sections.

## Usage

```tsx
import { Menu } from "@rivetjs/ui/menu";
```

::example{id=dropdown-default}

## Anatomy

`Menu` contains `Menu.Item` and `Menu.Section`; `Menu.ItemIndicator` displays selection. Use Dropdown when the menu needs a trigger and popover. The live example shows that complete composition.

Public parts: `Menu.Root`, `Menu.Item`, `Menu.ItemIndicator`, `Menu.Section`.

## Styling Reference

The component emits these `data-slot` values across its parts: `menu`.

Base and part classes: `menu`.

## API Reference

See the [full module API](/api/rivetjs/ui/menu/) for every named export and part prop type.

::api{symbol="@rivetjs/ui/menu#MenuRootProps"}

## Accessibility

The cdk Menu supplies `role="menu"`, keyboard navigation and typeahead. Give a standalone menu an accessible name and rich items a `textValue`. Use Dropdown for overlay focus management and dismissal.

## Related Components

- [Dropdown](/components/dropdown/)
- [MenuItem](/components/menu-item/)
- [MenuSection](/components/menu-section/)
