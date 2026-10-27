---
title: FeatureList
description: "Perks and plan features as a list with a leading icon: a check by default, or any lucide icon, in the success, accent or muted colour."
template: reference
status: experimental
related: [components/card, components/item-card-group, components/chip]
---

`FeatureList` is a `ul` of short lines, each with a leading icon: plan features on a pricing card, perks under a product. The icon is decorative (`aria-hidden`), a check by default (`icon` takes any lucide icon), coloured by the list's `color`. Pure markup: no script.

:::note
Rivet addition: no HeroUI counterpart.
:::

## Usage

```tsx
import { FeatureList } from "@rivetjs/ui/feature-list";
```

::example{id=feature-list-basic}

## Anatomy

```tsx
import { FeatureList } from "@rivetjs/ui/feature-list";
import { Truck } from "lucide";

export default function Anatomy() {
  return (
    <FeatureList color="success">
      <FeatureList.Item>…</FeatureList.Item>
      <FeatureList.Item icon={Truck}>…</FeatureList.Item>
    </FeatureList>
  );
}
```

Accessibility: a native list; the icons carry no meaning beyond the text. A list that states what is _not_ included needs words for it ("No wholesale price lists"), not only a different icon.

## Styling Reference

### CSS Classes

- `.feature-list` - The `ul`; colour modifiers `.feature-list--success` (default) / `--accent` / `--default` (muted).
- `.feature-list__item` - One `li` (icon + label).
- `.feature-list__icon` - The icon (`size-4`, on the first line of a wrapping label).
- `.feature-list__label` - The label.

### CSS Variables

- `--feature-list-icon-color` - Icon colour (set by the colour modifier).

### Data Attributes

- `[data-slot]`: `feature-list`, `feature-list-item`, `feature-list-label`.

## API Reference

### FeatureList

| Prop    | Type                                 | Default     | Description            |
| ------- | ------------------------------------ | ----------- | ---------------------- |
| `color` | `"success" \| "accent" \| "default"` | `"success"` | Icon colour            |
| `class` | `string`                             | -           | Additional CSS classes |

Also takes `ul` props.

### FeatureList.Item

| Prop       | Type       | Default | Description            |
| ---------- | ---------- | ------- | ---------------------- |
| `icon`     | `IconNode` | `Check` | Leading lucide icon    |
| `children` | `Content`  | -       | Label                  |
| `class`    | `string`   | -       | Additional CSS classes |

Also takes `li` props.

## Related Components

- [Card](/components/card/): The pricing card around a list.
- [ItemCardGroup](/components/item-card-group/): Richer rows with title, description and an action.
- [Chip](/components/chip/): A compact label.
