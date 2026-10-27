---
title: ItemCardGroupCollection
description: "An interactive group of ItemCard rows with selection and keyboard navigation."
template: reference
status: experimental
related: [components/item-card-group, components/item-card, components/list-view]
---

`ItemCardGroupCollection` — An interactive group of ItemCard rows with selection and keyboard navigation.

## Usage

```tsx
import { ItemCardGroupCollection } from "@rivetjs/ui/item-card-group-collection";
```

::example{id=item-card-group-selection}

## Anatomy

Place ItemCard children inside ItemCardGroupCollection. The collection installs the cdk GridList row implementation for those cards. Put ItemCardGroup.Header outside the collection: the grid contains rows, not a header part. For a non-interactive arrangement use ItemCardGroup.

## Styling Reference

The component emits these `data-slot` values across its parts: `item-card-group`.

## API Reference

The collection accepts the cdk GridList props (including `items`, `selectionMode`, `selectedKeys`, `onSelectionChange`, `disabledKeys`, `onAction` and `renderEmptyState`) and the following presentation props. `class` is a string; the component owns the inline style used for columns.

| Prop      | Type                                                                   | Default            |
| --------- | ---------------------------------------------------------------------- | ------------------ |
| `layout`  | `"list" \| "grid"`                                                     | `"list"`           |
| `variant` | `"default" \| "secondary" \| "tertiary" \| "outline" \| "transparent"` | `"default"`        |
| `columns` | `2 \| 3 \| 4`                                                          | `2` in grid layout |
| `class`   | `string`                                                               | unset              |

The root emits `data-slot="item-card-group"` and `data-layout`. ItemCard rows receive selection and focus state from the cdk GridList.

## Accessibility

The cdk GridList supplies grid rows, navigation, typeahead and selection. Label the collection with `aria-label` or `aria-labelledby`, give rows stable ids and rich rows a `textValue`, and label nested actions. No selection checkbox is added automatically; compose a Checkbox with `slot="selection"` when needed.

## Related Components

- [ItemCardGroup](/components/item-card-group/)
- [ItemCard](/components/item-card/)
- [ListView](/components/list-view/)
