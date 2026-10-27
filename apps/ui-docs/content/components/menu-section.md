---
title: MenuSection
description: "A labelled section of actions within a Menu."
template: reference
status: experimental
related: [components/menu, components/menu-item, components/header]
---

`MenuSection` — A labelled section of actions within a Menu.

## Usage

```tsx
import { MenuSection } from "@rivetjs/ui/menu-section";
```

::example{id=dropdown-with-sections}

## Anatomy

Place Header and MenuItem children inside MenuSection. It is also available as `Menu.Section`; the live example uses `Dropdown.Section`, which composes this section.

## Styling Reference

Base and part classes: `menu-section`.

## API Reference

See the [full module API](/api/rivetjs/ui/menu-section/) for every named export and part prop type.

::api{symbol="@rivetjs/ui/menu-section#MenuSectionRootProps"}

## Accessibility

The cdk section exposes a group named by its Header. Use `aria-label` when there is no visible heading. The parent menu owns item navigation; section headings are not actions.

## Related Components

- [Menu](/components/menu/)
- [MenuItem](/components/menu-item/)
- [Header](/components/header/)
