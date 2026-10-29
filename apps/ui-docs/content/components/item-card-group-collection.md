---
title: ItemCardGroupCollection
description: "The interactive ItemCard group: a GridList whose cards are rows, with selection, row actions, arrow keys and typeahead, in list or grid layout."
template: reference
status: experimental
related: [components/item-card-group, components/item-card, components/list-view]
---

`ItemCardGroupCollection` turns a group of [ItemCard](/components/item-card/)s into one interactive widget: a cdk [GridList](site:cdk/components/grid-list/) in which every card is a row. The user moves between cards with the arrow keys, selects them (single or multiple), or opens one with a press or :kbd[Enter] (`onAction`). It looks like [ItemCardGroup](/components/item-card-group/) (same `layout`, `variant` and `columns`), which stays the static, markup-only form: use the collection only when the cards are choices or actions, so that pages with static card lists ship no GridList code.

## Usage

```tsx
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroupCollection } from "@rivetjs/ui/item-card-group-collection";

<ItemCardGroupCollection aria-label="Plan" selectionMode="single" defaultSelectedKeys={["team"]}>
  <ItemCard id="studio" textValue="Studio">
    <ItemCard.Content>
      <ItemCard.Title>Studio</ItemCard.Title>
    </ItemCard.Content>
  </ItemCard>
  <ItemCard id="team" textValue="Team">
    <ItemCard.Content>
      <ItemCard.Title>Team</ItemCard.Title>
    </ItemCard.Content>
  </ItemCard>
</ItemCardGroupCollection>;
```

::example{id=item-card-group-selection}

## Anatomy

| Part | Element | Notes |
| --- | --- | --- |
| `ItemCardGroupCollection` | `div role="grid"` (cdk GridList) | `data-slot="item-card-group"`, `data-layout="list" \| "grid"`; classes of ItemCardGroup. |
| `ItemCard` (inside) | `div role="row"` | A GridList row: `data-selected`, `data-focused`, `data-focus-visible`, `data-disabled` (+ `data-current` from ItemCard). |
| `Checkbox slot="selection"` (optional) | Checkbox | Placed in a card, it follows the row's selection. |

`ItemCardGroup.Header` does not belong inside (a grid holds only rows): put a heading above the collection and point `aria-labelledby` at it.

## Examples

### Selection

The example at the top uses a single-selection plan picker that can not be emptied (`disallowEmptySelection`) and a multiple-selection add-on list with a Checkbox in each card's selection slot. `selectedKeys` takes a two-way Signal or a plain value; `selectionBehavior="replace"` makes the arrow keys move the selection.

### Grid layout and row actions

`layout="grid"` lays the cards out in `columns` columns (2, 3 or 4; one column below 40rem) and the arrow keys move in two dimensions. Without a selection mode, a press or :kbd[Enter] on a card runs `onAction` with its key. Cards come from `items` and a function child here; `disabledKeys` keeps a card visible but out of the keyboard order.

::example{id=item-card-group-collection-grid}

## Styling Reference

The collection uses the ItemCardGroup classes (`.item-card-group`, `--list` / `--grid`, the variant classes) and styles its rows by state:

| Attribute | Row state |
| --- | --- |
| `[data-selected]` | Selected. |
| `[data-focus-visible]` | Keyboard focus. |
| `[data-disabled]` | Disabled. |
| `[data-current]` | Current item (ItemCard `isCurrent`). |

## API Reference

The collection accepts the cdk GridList props (including `items`, `selectionMode`, `selectedKeys`, `onSelectionChange`, `disabledKeys`, `onAction` and `renderEmptyState`) and the following presentation props. `class` is a string; the component owns the inline style used for columns.

| Prop      | Type                                                                   | Default            |
| --------- | ---------------------------------------------------------------------- | ------------------ |
| `layout`  | `"list" \| "grid"`                                                     | `"list"`           |
| `variant` | `"default" \| "secondary" \| "tertiary" \| "outline" \| "transparent"` | `"default"`        |
| `columns` | `2 \| 3 \| 4`                                                          | `2` in grid layout |
| `class`   | `string`                                                               | unset              |

## Accessibility

- The collection is one tab stop (`role="grid"`); :kbd[ArrowUp] / :kbd[ArrowDown] (and Left / Right in the grid layout), :kbd[Home] / :kbd[End], :kbd[PageUp] / :kbd[PageDown] and typeahead (`textValue`) move between cards; :kbd[Space] or a click selects, :kbd[Enter] runs `onAction`.
- Name the collection with `aria-label` or `aria-labelledby`; give every card a stable `id` and a `textValue`.
- Buttons, switches and links inside a card keep their own tab stops; label them.
- No selection checkbox is added for you: add a `Checkbox slot="selection"` when users expect one.

## Common mistakes

- **Using the collection for static content.** If nothing is selectable or pressable, use ItemCardGroup: it ships no JavaScript.
- **Putting `ItemCardGroup.Header` inside.** A header is not a row; place it outside and reference it with `aria-labelledby`.
- **A press handler on each card instead of `onAction`.** `onAction` works for pointer and keyboard and receives the card key.

## Related Components

- [ItemCardGroup](/components/item-card-group/)
- [ItemCard](/components/item-card/)
- [ListView](/components/list-view/)
