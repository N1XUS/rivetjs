---
title: ItemCard
description: "A list row card: leading icon, title and description, and a trailing action such as a Switch, Select or Button; five surface variants."
template: reference
status: experimental
related: [components/item-card-group, components/card, components/switch]
---

`ItemCard` is the row of settings pages, device lists and wallets: an icon, a title with a description, and an action at the end. Render it as a link or button with `render` to make the whole row pressable. Pure markup: the controls inside bring their own behaviour.

## Usage

```tsx
import { ItemCard } from "@rivetjs/ui/item-card";
```

::example{id=item-card-basic}

## Anatomy

```tsx
import { ItemCard } from "@rivetjs/ui/item-card";

export default function Anatomy() {
  return (
    <ItemCard>
      <ItemCard.Icon>…</ItemCard.Icon>
      <ItemCard.Content>
        <ItemCard.Title>…</ItemCard.Title>
        <ItemCard.Description>…</ItemCard.Description>
      </ItemCard.Content>
      <ItemCard.Action>…</ItemCard.Action>
    </ItemCard>
  );
}
```

## Device List

::example{id=item-card-device-list}

## Email Setting

::example{id=item-card-email-setting}

## Pressable

`render={(props) => <a href="…" {...props} />}` makes the row a link: hover and pressed tints and the focus ring apply to `a`, `button` and `[data-pressable]` roots. Do not nest other interactive controls in a pressable card.

::example{id=item-card-pressable}

## Title Only

::example{id=item-card-title-only}

## Variants

::example{id=item-card-variants}

## Vertical Stack

::example{id=item-card-vertical-stack}

## Wallet Card

::example{id=item-card-wallet-card}

## With Multi Select

::example{id=item-card-multi-select}

## With Select

::example{id=item-card-select}

## With Switch

Label each control: the row title is not its label (`aria-label` on the Switch / Select).

::example{id=item-card-switch}

## Without Icon

::example{id=item-card-without-icon}

## Styling Reference

### CSS Classes

- `.item-card` - The row. Modifiers `.item-card--default` (raised) / `--secondary` / `--tertiary` / `--outline` / `--transparent`.
- `.item-card__icon` - Leading icon box; its radius is concentric with the card's.
- `.item-card__content`, `.item-card__title`, `.item-card__description` - Text column (truncated).
- `.item-card__action` - Trailing controls.

### CSS Variables

- `--item-card-padding` - Card padding (default `--spacing(3)`).
- `--item-card-radius` - Card radius (default `--radius-2xl`).

### Data Attributes

- `[data-slot]`: `item-card`, `item-card-icon`, `item-card-content`, `item-card-title`, `item-card-description`, `item-card-action`.
- `[data-pressable]` on the root: pressable look on a non-link root.

## API Reference

### ItemCard

| Prop      | Type                                                                   | Default     | Description                        |
| --------- | ---------------------------------------------------------------------- | ----------- | ---------------------------------- |
| `variant` | `"default" \| "secondary" \| "tertiary" \| "outline" \| "transparent"` | `"default"` | Surface                            |
| `render`  | `DOMRenderFunction<"div">`                                             | -           | Render a link / button as the root |
| `class`   | `string`                                                               | -           | Additional CSS classes             |

Also takes `div` props.

### Other parts

`ItemCard.Icon`, `ItemCard.Content`, `ItemCard.Action` take `div` props and `class`; `ItemCard.Title` and `ItemCard.Description` are `span`s.

## Related Components

- [ItemCardGroup](/components/item-card-group/): Item cards as a list or grid.
- [Card](/components/card/): General purpose surface.
- [Switch](/components/switch/): Toggles inside the action slot.
