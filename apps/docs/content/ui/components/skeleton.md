---
title: Skeleton
description: "@rivetjs/ui Skeleton: a placeholder block with shimmer, pulse or no animation, sized by your classes."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/spinner]
---

`Skeleton` is a placeholder block shown while content loads. It has no size of its own: give it width and height with classes. Port of HeroUI v3.2.6 [Skeleton](https://www.heroui.com/docs/components/skeleton).

## Import

```tsx
import { Skeleton } from "@rivetjs/ui/skeleton";
```

## Usage

```tsx
import { Skeleton } from "@rivetjs/ui/skeleton";

export default function Page() {
  return (
    <div class="flex items-center gap-3">
      <Skeleton class="size-10 rounded-full" />
      <div class="flex flex-col gap-2">
        <Skeleton class="h-4 w-40" />
        <Skeleton class="h-3 w-24" animationType="pulse" />
      </div>
    </div>
  );
}
```

## Variants

`skeletonVariants`:

| Prop | Values | Default |
| --- | --- | --- |
| `animationType` | `shimmer`, `pulse`, `none` | `shimmer` |

When `animationType` is not set, a Skeleton created in the browser reads the `--skeleton-animation` CSS variable from the document root. Server-rendered and resumed skeletons use the default.

## Parts

| Part | Element | Class |
| --- | --- | --- |
| `Skeleton` / `Skeleton.Root` | `div` | `skeleton skeleton--<animation>` |

The root is generic over the element.

## Accessibility

Skeleton is decorative markup with no text and no role. Announce loading with a [Spinner](spinner.md) or an `aria-busy` region if screen-reader users need to know.

## Differences from HeroUI React

- `class`, not `className`.
- `--skeleton-animation` is read once at creation, on the client only; HeroUI re-reads it after hydration.
