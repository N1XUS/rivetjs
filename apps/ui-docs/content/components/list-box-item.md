---
title: ListBoxItem
description: "An option with selection state and an optional indicator inside a ListBox."
template: reference
status: experimental
related: [components/list-box, components/list-box-section]
---

`ListBoxItem` — An option with selection state and an optional indicator inside a ListBox.

## Usage

```tsx
import { ListBoxItem } from "@rivetjs/ui/list-box-item";
```

::example{id=list-box-default}

## Anatomy

Use `ListBoxItem` inside `ListBox`; it is also available as `ListBox.Item`. Add `ListBoxItem.Indicator` for a selection mark. Rich options should supply `textValue` for typeahead.

Public parts: `ListBoxItem.Root`, `ListBoxItem.Indicator`.

## Styling Reference

The component emits these `data-slot` values across its parts: `list-box-item-indicator--checkmark`, `list-box-item`, `list-box-item-indicator`.

Base and part classes: `list-box-item__indicator`, `list-box-item`.

## API Reference

See the [full module API](/api/rivetjs/ui/list-box-item/) for every named export and part prop type.

| Prop      | Values              | Default   |
| --------- | ------------------- | --------- |
| `variant` | `danger`, `default` | `default` |

::api{symbol="@rivetjs/ui/list-box-item#ListBoxItemIndicatorProps"}

::api{symbol="@rivetjs/ui/list-box-item#ListBoxItemRootProps"}

## Accessibility

The cdk ListBox item exposes `role="option"` and selected/disabled state. The parent ListBox owns keyboard navigation and selection; label the list and give each item a stable `id`. Keep interactive controls out of options; use ListView for rows with nested actions.

## Related Components

- [ListBox](/components/list-box/)
- [ListBoxSection](/components/list-box-section/)
