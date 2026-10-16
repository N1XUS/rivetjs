---
title: Empty state
description: "EmptyState: the centred placeholder for a list or search with nothing to show; renders No results found by default."
template: reference
status: experimental
related: [components/button]
---

`EmptyState` fills the space of an empty list, table or search. Without children it says "No results found".

::example{id=empty-state-basic}

## Import

```tsx
import { EmptyState } from "@rivetjs/ui/empty-state";
```

## Usage

```tsx
import { EmptyState } from "@rivetjs/ui/empty-state";

export default function NoResults() {
  return <EmptyState />;
}
```

## Variants

`emptyStateVariants`: `size` `sm` / `md` (default) / `lg` (`empty-state--sm` / `empty-state--lg`: 4 / 8 / 24 px padding, 12 / 14 / 16 px text). Add layout with `class`.

```tsx
<EmptyState size="lg">No projects yet</EmptyState>
```

## Anatomy

| Part                             | Element                    | `data-slot`   |
| -------------------------------- | -------------------------- | ------------- |
| `EmptyState` / `EmptyState.Root` | `div`, class `empty-state` | `empty-state` |

Generic over the element.

::api{symbol="@rivetjs/ui/empty-state#EmptyStateRootProps"}

## Accessibility

Plain markup; the default text is real text and is read normally.

## Notes

- `class`, not `className`.
- The default text shows when there are no children or the child is an empty string.
- `size` (`sm` / `md` / `lg`) sets the scale.
