---
title: Empty state
description: "@rivetjs/ui EmptyState: a centred placeholder for lists with nothing to show; renders \"No results found\" by default."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/button]
---

`EmptyState` is the block you show when a list or search has nothing to display. Without children it renders "No results found". Port of HeroUI v3.2.6 [EmptyState](https://www.heroui.com/docs/components/empty-state).

## Import

```tsx
import { EmptyState } from "@rivetjs/ui/empty-state";
```

## Usage

```tsx
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Button } from "@rivetjs/ui/button";
import { Icon } from "@rivetjs/kit/icon";
import { Inbox } from "lucide";

export default function Page() {
  return (
    <EmptyState>
      <Icon icon={Inbox} size={32} />
      <p>No messages yet</p>
      <Button variant="secondary" size="sm" onPress={() => console.log("compose")}>
        Write one
      </Button>
    </EmptyState>
  );
}
```

## Variants

`emptyStateVariants` has no variants: one `empty-state` class. Pass `class` to extend it.

## Parts

| Part | Element | `data-slot` |
| --- | --- | --- |
| `EmptyState` / `EmptyState.Root` | `div` | `empty-state` |

The root is generic over the element.

## Accessibility

Plain markup, no cdk behaviour. The default text is real text, so it is read by screen readers.

## Differences from HeroUI React

- `class`, not `className`.
- The default text shows when there are no children or the child is an empty string; any element child renders as given.
