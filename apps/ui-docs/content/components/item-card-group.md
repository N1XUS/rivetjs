---
title: ItemCardGroup
description: "Item cards grouped as one divided list surface or a 2 / 3 column grid, with an optional section header."
template: reference
status: experimental
related: [components/item-card, components/card]
---

`ItemCardGroup` arranges [ItemCard](/components/item-card/)s. In the `list` layout the group is the surface (its `variant`) and the cards become transparent rows with hairline dividers; in the `grid` layout each card keeps its own surface and the grid has `columns` columns (one below 40rem). Pure markup: no script.

## Usage

```tsx
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
```

::example{id=item-card-group-basic}

## Anatomy

```tsx
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";

export default function Anatomy() {
  return (
    <ItemCardGroup aria-labelledby="group-title">
      <ItemCardGroup.Header>
        <ItemCardGroup.Title id="group-title">…</ItemCardGroup.Title>
        <ItemCardGroup.Description>…</ItemCardGroup.Description>
      </ItemCardGroup.Header>
      <ItemCard>…</ItemCard>
      <ItemCard>…</ItemCard>
    </ItemCardGroup>
  );
}
```

## Grid

::example{id=item-card-group-grid}

## Grid Three Columns

::example{id=item-card-group-grid-three-columns}

## Linked Accounts

::example{id=item-card-group-linked-accounts}

## List

::example{id=item-card-group-list}

## Multiple Sections

::example{id=item-card-group-multiple-sections}

## Notification Preferences

::example{id=item-card-group-notification-preferences}

## Permission Levels

::example{id=item-card-group-permission-levels}

## Pressable

::example{id=item-card-group-pressable}

## Variants

::example{id=item-card-group-variants}

## Wallet List

::example{id=item-card-group-wallet-list}

## With Header

::example{id=item-card-group-with-header}

## Styling Reference

### CSS Classes

- `.item-card-group` - The group. Layout `.item-card-group--list` (one surface, divided rows) / `--grid` (spaced cards). Surface (list layout) `.item-card-group--default` / `--secondary` / `--tertiary` / `--outline` / `--transparent`.
- `.item-card-group__header`, `.item-card-group__title`, `.item-card-group__description` - Section header (spans every grid column).

### CSS Variables

- `--item-card-group-columns` - Grid columns (set by `columns`, default 2).

### Data Attributes

- `[data-slot]`: `item-card-group`, `item-card-group-header`, `item-card-group-title`, `item-card-group-description`.
- `[data-layout]`: `list` / `grid`.

## API Reference

### ItemCardGroup

| Prop      | Type                                                                   | Default     | Description                    |
| --------- | ---------------------------------------------------------------------- | ----------- | ------------------------------ |
| `layout`  | `"list" \| "grid"`                                                     | `"list"`    | Divided list or grid           |
| `variant` | `"default" \| "secondary" \| "tertiary" \| "outline" \| "transparent"` | `"default"` | Group surface (list layout)    |
| `columns` | `2 \| 3 \| 4`                                                          | `2`         | Grid columns (`layout="grid"`) |
| `class`   | `string`                                                               | -           | Additional CSS classes         |

Also takes `div` props.

### Other parts

`ItemCardGroup.Header` is a `div`, `ItemCardGroup.Title` an `h3`, `ItemCardGroup.Description` a `p`; all take `class`.

## Accessibility

The root is a `div role="group"`. Label it: `aria-labelledby` pointing at the title's `id`, or `aria-label`.

## Related Components

- [ItemCard](/components/item-card/): The row card.
- [Card](/components/card/): General purpose surface.
