---
title: ItemCardGroup
description: "Item cards as one divided list surface or a 2 / 3 column grid with an optional header; optionally interactive (selection, arrow keys, row actions)."
template: reference
status: experimental
related: [components/item-card, components/card, components/list-view]
---

`ItemCardGroup` arranges [ItemCard](/components/item-card/)s. In the `list` layout the group is the surface (its `variant`) and the cards become transparent rows with hairline dividers; in the `grid` layout each card keeps its own surface and the grid has `columns` columns (one below 40rem). Pure markup: no script.

`ItemCardGroupCollection` is the interactive form: a cdk [GridList](https://cdk.rivetjs.severyn.pro/components/grid-list/) with the same keyboard and screen reader behaviour, every `ItemCard` in it a row (selection, arrow keys, row actions). It is a separate export, so a static group ships no GridList code. See [Collection mode](#collection-mode).

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

## Collection mode

```tsx
import { ItemCardGroupCollection } from "@rivetjs/ui/item-card-group-collection";
```

`ItemCardGroupCollection` takes the group's `layout` / `variant` / `columns` / `class` and renders a cdk `GridList` (`role="grid"`; `layout="grid"` = 2-D arrow keys) instead of the static `div`. Its `ItemCard`s become rows: one tab stop, arrow keys / Home / End / Page keys and typeahead (`textValue`) move between them, Space / click selects, Enter / click runs `onAction`. Controls inside a card (a `ToggleButton`, a `Switch`) stay their own tab stops. `ItemCardGroup` itself stays markup-only and ships no JavaScript (dev builds warn when it gets a collection prop).

### Selection

`selectionMode="single"` / `"multiple"`, `selectedKeys` (value or two-way Signal) / `defaultSelectedKeys` / `onSelectionChange`, `disallowEmptySelection`, `selectionBehavior` (`"toggle"`, or `"replace"`: arrow keys move the selection, as in a mail list). A ui `Checkbox slot="selection"` in a card follows its row.

::example{id=item-card-group-selection}

### Row actions and the current row

`onAction(key)` runs on press / Enter. `isCurrent` on an `ItemCard` (value, accessor or live expression) marks the open / playing row: `aria-current="true"` + `data-current`.

::example{id=item-card-group-actions}

### Dynamic items, unread marks and empty state

`items` (array or accessor) + a function child renders one card per item (keyed by the card's `id`). An unread row renders `ItemCard.Indicator` (a [Status](/components/status/) dot by default) and a `font-semibold` title while it is unread: the indicator is content the caller shows, not a prop. `renderEmptyState` fills the group while it has no rows.

::example{id=item-card-group-unread}

## Styling Reference

### CSS Classes

- `.item-card-group` - The group. Layout `.item-card-group--list` (one surface, divided rows) / `--grid` (spaced cards). Surface (list layout) `.item-card-group--default` / `--secondary` / `--tertiary` / `--outline` / `--transparent`.
- `.item-card-group__header`, `.item-card-group__title`, `.item-card-group__description` - Section header (spans every grid column).

### CSS Variables

- `--item-card-group-columns` - Grid columns (set by `columns`, default 2).

### Data Attributes

- `[data-slot]`: `item-card-group`, `item-card-group-header`, `item-card-group-title`, `item-card-group-description`.
- `[data-layout]`: `list` / `grid`.
- Collection mode: the root is `[role="grid"]`; rows carry `[data-selected]`, `[data-focused]`, `[data-focus-visible]`, `[data-hovered]`, `[data-pressed]`, `[data-disabled]` (cdk) and `[data-current]` (ItemCard).

## API Reference

### ItemCardGroup

| Prop      | Type                                                                   | Default     | Description                    |
| --------- | ---------------------------------------------------------------------- | ----------- | ------------------------------ |
| `layout`  | `"list" \| "grid"`                                                     | `"list"`    | Divided list or grid           |
| `variant` | `"default" \| "secondary" \| "tertiary" \| "outline" \| "transparent"` | `"default"` | Group surface (list layout)    |
| `columns` | `2 \| 3 \| 4`                                                          | `2`         | Grid columns (`layout="grid"`) |
| `class`   | `string`                                                               | -           | Additional CSS classes         |

Also takes `div` props.

### ItemCardGroupCollection

The `ItemCardGroup` props (`layout`, `variant`, `columns`, `class`) plus the cdk `GridList` props (every one passes through):

| Prop                     | Type                                          | Default    | Description                                       |
| ------------------------ | --------------------------------------------- | ---------- | ------------------------------------------------- |
| `selectionMode`          | `"none" \| "single" \| "multiple"`            | `"none"`   | Row selection                                     |
| `selectedKeys`           | `Iterable<Key> \| "all" \| Signal<Selection>` | -          | Selected rows (controlled or two-way)             |
| `defaultSelectedKeys`    | `Iterable<Key> \| "all"`                      | -          | Initial selection (uncontrolled)                  |
| `onSelectionChange`      | `(keys: Selection) => void`                   | -          | Selection changed                                 |
| `selectionBehavior`      | `"toggle" \| "replace"`                       | `"toggle"` | `replace`: focus moves the selection              |
| `disallowEmptySelection` | `boolean`                                     | `false`    | Keep one row selected                             |
| `disabledKeys`           | `Iterable<Key>`                               | -          | Rows that cannot be focused, selected or actioned |
| `onAction`               | `(key: Key) => void`                          | -          | Row action (press, Enter)                         |
| `items`                  | `T[] \| (() => T[])`                          | -          | Dynamic rows (with a function child)              |
| `renderEmptyState`       | `() => Content`                               | -          | Shown while there are no rows                     |

### Other parts

`ItemCardGroup.Header` is a `div`, `ItemCardGroup.Title` an `h3`, `ItemCardGroup.Description` a `p`; all take `class`.

## Accessibility

The static root is a `div role="group"`. Label it: `aria-labelledby` pointing at the title's `id`, or `aria-label`.

`ItemCardGroupCollection`'s root is a `role="grid"` (cdk GridList: rows `role="row"`, one tab stop, roving focus, `aria-selected` on selectable rows, `aria-multiselectable` for `multiple`). A grid has only rows: put `ItemCardGroup.Header` outside it and label the group with `aria-label` / `aria-labelledby`. Give each card a `textValue` for typeahead and the row's accessible name.

## Related Components

- [ItemCard](/components/item-card/): The row card.
- [Card](/components/card/): General purpose surface.
