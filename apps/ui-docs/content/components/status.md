---
title: Status
description: "A small status dot in the semantic colours, three sizes and an optional pulse: presence, unread, live and order states."
template: reference
status: experimental
related: [components/badge, components/chip, components/avatar, components/item-card]
---

`Status` is a dot: presence on an avatar, an unread marker, a live or pending state in a chip. `color` takes the Chip / Badge semantic colours, `size` three sizes, and `pulse` adds an expanding ring for live states. Pure markup and CSS: no script, never a resume boundary. The pulse ring stops under `prefers-reduced-motion: reduce`.

:::note
Rivet addition: no HeroUI counterpart.
:::

## Usage

```tsx
import { Status } from "@rivetjs/ui/status";
```

::example{id=status-colors}

### Sizes

::example{id=status-sizes}

### Pulse

::example{id=status-pulse}

### Placement

A presence dot on an avatar corner sits in a `relative` wrapper (`absolute end-0 bottom-0`, `ring-2 ring-background` cuts it from the picture); inside a [Chip](/components/chip/) it leads the text. [ItemCard.Indicator](/components/item-card/#indicator) renders a `Status` when it has no children.

::example{id=status-placement}

## Anatomy

```tsx
import { Status } from "@rivetjs/ui/status";

export default function Anatomy() {
  return <Status color="success" size="md" pulse aria-label="Online" />;
}
```

Accessibility: colour alone carries no meaning. Without `aria-label` / `aria-labelledby` the dot is `aria-hidden`: put the state in nearby text ("Online", "Pending"). When the dot stands alone (an avatar corner), name it with `aria-label`: it becomes `role="img"`. A state that changes while the page is open needs a live region ([Alert](/components/alert/) or a `role="status"` element) to be announced.

## Styling Reference

### CSS Classes

- `.status` - The dot (`span`, `rounded-full`, `inline-block`).
- `.status--default` (muted) / `--accent` / `--success` / `--warning` / `--danger` - Colour.
- `.status--sm` / `--md` / `--lg` - Size (6 / 8 / 12 px at the default spacing).
- `.status--pulse` - Expanding `::after` ring (`status-pulse` keyframes); none under reduced motion.

### CSS Variables

- `--status-color` - Dot and ring colour (set by the colour modifier).
- `--status-size` - Diameter (set by the size modifier).

### Data Attributes

- `[data-slot="status"]` - The dot.

## API Reference

### Status

| Prop         | Type                                                          | Default     | Description                                      |
| ------------ | ------------------------------------------------------------- | ----------- | ------------------------------------------------ |
| `color`      | `"default" \| "accent" \| "success" \| "warning" \| "danger"` | `"default"` | Dot colour                                       |
| `size`       | `"sm" \| "md" \| "lg"`                                        | `"md"`      | Diameter                                         |
| `pulse`      | `boolean`                                                     | `false`     | Pulsing ring (off under reduced motion)          |
| `aria-label` | `string`                                                      | -           | Names the dot (`role="img"`); else `aria-hidden` |
| `class`      | `string`                                                      | -           | Additional CSS classes                           |

Also takes `span` props (no children).

## Related Components

- [Badge](/components/badge/): A count or dot pinned to another element.
- [Chip](/components/chip/): A label; a `Status` can lead its text.
- [Avatar](/components/avatar/): Presence dot on a corner.
- [ItemCard](/components/item-card/): `ItemCard.Indicator` defaults to a `Status`.
