---
title: Chip
description: "@rivetjs/ui Chip: a small inline label with color, size and variant, and a Chip.Label part."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/badge]
---

`Chip` is a small inline label: a `span` with a color, a size and a variant. Text children are wrapped in `Chip.Label`. Port of HeroUI v3.2.6 [Chip](https://www.heroui.com/docs/components/chip).

## Import

```tsx
import { Chip } from "@rivetjs/ui/chip";
```

## Usage

```tsx
import { Chip } from "@rivetjs/ui/chip";
import { Icon } from "@rivetjs/kit/icon";
import { Check } from "lucide";

export default function Page() {
  return (
    <div class="flex gap-2">
      <Chip>Default</Chip>
      <Chip color="success" variant="soft" size="sm">
        Paid
      </Chip>
      <Chip color="accent" variant="primary">
        <Icon icon={Check} size={12} />
        <Chip.Label>With icon</Chip.Label>
      </Chip>
    </div>
  );
}
```

## Variants

`chipVariants`:

| Prop | Values | Default |
| --- | --- | --- |
| `color` | `default`, `accent`, `success`, `warning`, `danger` | `default` |
| `variant` | `primary`, `secondary`, `soft`, `tertiary` | `secondary` |
| `size` | `sm`, `md`, `lg` | none (no size class) |

## Parts

| Part | Element | `data-slot` |
| --- | --- | --- |
| `Chip` / `Chip.Root` | `span` | `chip` |
| `Chip.Label` | `span` | `chip-label` |

A string or number child, or an expression that resolves to one, is wrapped in `Chip.Label` for you. Element children render as given. Both parts are generic: `<Chip.Root<"a"> href="…">` renders an anchor.

## Accessibility

Chip is plain markup, no cdk behaviour: it renders what you give it. It is not interactive. For a removable or pressable chip, put a `Button` next to or inside it.

## Differences from HeroUI React

- `class`, not `className`.
- Children: a literal string or number is wrapped in `Chip.Label` as in HeroUI; an `{expr}` child is resolved first and wrapped only when it is text.
- The color, size and variant reach `Chip.Label` through a resumable context, so a resumed page restores the label classes without re-rendering.
