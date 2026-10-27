---
title: Empty state
description: "EmptyState: the centred placeholder for a list or search with nothing to show; text by default, or media, title, description and actions."
template: reference
status: experimental
related: [components/button, components/avatar]
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

`emptyStateVariants`: `size` `sm` / `md` (default) / `lg` (`empty-state--sm` / `empty-state--lg`: 4 / 8 / 24 px padding, 12 / 14 / 16 px text; with parts 16 / 32 / 48 px) and `variant` `default` / `outline` (`empty-state--outline`: a dashed, rounded border). Add layout with `class`.

```tsx
<EmptyState size="lg">No projects yet</EmptyState>
```

## Structured

With an `EmptyState.Header` or `EmptyState.Content` inside, the state becomes a centred column: media (an icon on a round background with `variant="icon"`, an avatar or an image), a title, a description and actions.

### Minimal

::example{id=empty-state-minimal}

### Outline

::example{id=empty-state-outline}

### Sizes

::example{id=empty-state-sizes}

### Full Height

::example{id=empty-state-full-height}

### With Avatar

::example{id=empty-state-with-avatar}

### With Avatar Group

::example{id=empty-state-with-avatar-group}

### With Background

::example{id=empty-state-with-background}

## Anatomy

| Part                             | Element                                                         | `data-slot`               |
| -------------------------------- | --------------------------------------------------------------- | ------------------------- |
| `EmptyState` / `EmptyState.Root` | `div`, class `empty-state`                                      | `empty-state`             |
| `EmptyState.Header`              | `div`, `empty-state__header`                                    | `empty-state-header`      |
| `EmptyState.Media`               | `div`, `empty-state__media` (`data-variant` `default` / `icon`) | `empty-state-media`       |
| `EmptyState.Title`               | `h3`, `empty-state__title`                                      | `empty-state-title`       |
| `EmptyState.Description`         | `p`, `empty-state__description`                                 | `empty-state-description` |
| `EmptyState.Content`             | `div`, `empty-state__content`                                   | `empty-state-content`     |

The root is generic over the element.

::api{symbol="@rivetjs/ui/empty-state#EmptyStateRootProps"}

## Accessibility

Plain markup; the default text is real text and is read normally.

## Notes

- `class`, not `className`.
- The default text shows when there are no children or the child is an empty string.
- `size` (`sm` / `md` / `lg`) sets the scale.
- The parts and `variant="outline"` are Rivet additions; a root with plain text keeps the compact collection look.
