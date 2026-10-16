---
title: Badge
description: "@rivetjs/ui Badge: a count or status marker pinned to a corner of a Badge.Anchor, with color, size, variant and placement."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/chip, ui/components/avatar]
---

`Badge` is a small marker (a count, a dot, a status) positioned on a corner of its `Badge.Anchor`. Port of HeroUI v3.2.6 [Badge](https://www.heroui.com/docs/components/badge).

## Import

```tsx
import { Badge } from "@rivetjs/ui/badge";
```

## Usage

```tsx
import { Badge } from "@rivetjs/ui/badge";
import { Icon } from "@rivetjs/kit/icon";
import { Bell } from "lucide";

export default function Page() {
  return (
    <Badge.Anchor>
      <Icon icon={Bell} size={24} />
      <Badge color="danger" size="sm" placement="top-right">
        3
      </Badge>
    </Badge.Anchor>
  );
}
```

## Variants

`badgeVariants`:

| Prop | Values | Default |
| --- | --- | --- |
| `color` | `default`, `accent`, `success`, `warning`, `danger` | `default` |
| `variant` | `primary`, `secondary`, `soft` | `primary` |
| `size` | `sm`, `md`, `lg` | `md` |
| `placement` | `top-right`, `top-left`, `bottom-right`, `bottom-left` | `top-right` |

## Parts

| Part | Element | `data-slot` |
| --- | --- | --- |
| `Badge.Anchor` | `span` (`badge-anchor`) | `badge-anchor` |
| `Badge` / `Badge.Root` | `span` | `badge` |
| `Badge.Label` | `span` | `badge-label` |

A string or number child, or an expression that resolves to one, is wrapped in `Badge.Label`. `Badge.Anchor` does not read the badge's variants; it only positions. All parts are generic over the element.

## Accessibility

Badge is plain markup without cdk behaviour. A badge that carries information (a count) should be readable: give the anchored control an `aria-label` that includes it, or add visually hidden text.

## Differences from HeroUI React

- `class`, not `className`.
- Children: literal text is wrapped in `Badge.Label` as in HeroUI; an `{expr}` child is resolved first and wrapped only when it is text.
- The variants reach `Badge.Label` through a resumable context.
