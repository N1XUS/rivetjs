---
title: Separator
description: "@rivetjs/ui Separator: a horizontal or vertical divider on the cdk Separator, with default, secondary and tertiary variants."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/field-primitives]
---

`Separator` is a divider line. Horizontal by default; vertical with `orientation="vertical"`. Port of HeroUI v3.2.6 [Separator](https://www.heroui.com/docs/components/separator).

## Import

```tsx
import { Separator } from "@rivetjs/ui/separator";
```

## Usage

```tsx
import { Separator } from "@rivetjs/ui/separator";

export default function Page() {
  return (
    <div>
      <p>Above</p>
      <Separator variant="secondary" />
      <p>Below</p>
      <div class="flex h-6 items-center gap-3">
        <span>Left</span>
        <Separator orientation="vertical" />
        <span>Right</span>
      </div>
    </div>
  );
}
```

## Variants

`separatorVariants`:

| Prop | Values | Default |
| --- | --- | --- |
| `orientation` | `horizontal`, `vertical` | `horizontal` (or the value a parent provides through `SeparatorContext`) |
| `variant` | `default`, `secondary`, `tertiary` | `default` |

## Parts

| Part | Element | Attributes |
| --- | --- | --- |
| `Separator` / `Separator.Root` | `hr`; `div role="separator"` when vertical | `data-slot="separator"`, `data-orientation` |

Other props go to the [cdk Separator](site:cdk/components/separator/): `slot`, `style`, `ref`, `render`, `id`, `data-*`. The root is not generic over the element.

## Accessibility

A horizontal separator is a native `<hr>`. A vertical one is a `div` with `role="separator"` and `aria-orientation="vertical"`. Inside a cdk collection (menu, list box) it becomes a collection separator node.

## Differences from HeroUI React

- `class`, not `className`.
- Prop types are the cdk part's props plus the variants (HeroUI types them as RAC `SeparatorProps`).
