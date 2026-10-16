---
title: Spinner
description: "@rivetjs/ui Spinner: a loading indicator with color and size, announced as a status; the icon is lucide LoaderCircle."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/button, ui/components/skeleton]
---

`Spinner` is a spinning loading indicator. Port of HeroUI v3.2.6 [Spinner](https://www.heroui.com/docs/components/spinner).

## Import

```tsx
import { Spinner } from "@rivetjs/ui/spinner";
```

## Usage

```tsx
import { Spinner } from "@rivetjs/ui/spinner";

export default function Page() {
  return (
    <div class="flex items-center gap-3">
      <Spinner />
      <Spinner size="sm" color="success" />
      <Spinner size="xl" color="current" class="text-blue-600" />
    </div>
  );
}
```

`color="current"` takes the text color, which is how a spinner inside a [Button](button.md) matches the button.

## Variants

`spinnerVariants`:

| Prop | Values | Default |
| --- | --- | --- |
| `color` | `accent`, `current`, `success`, `warning`, `danger` | `accent` |
| `size` | `sm`, `md`, `lg`, `xl` | `md` |

## Parts

| Part | Element | `data-slot` |
| --- | --- | --- |
| `Spinner` / `Spinner.Root` | `span` (`role="status"`, `aria-label="Loading"`) | `spinner` |
| icon | `svg` (lucide `LoaderCircle`, `aria-hidden`) | `spinner-icon` |

The root is generic over the element. Override `aria-label` for a more specific message.

## Accessibility

The root has `role="status"` and `aria-label="Loading"`, so a spinner that appears is announced politely. The icon is hidden from assistive technology. No cdk behaviour.

## Differences from HeroUI React

- `class`, not `className`.
- The icon is lucide `LoaderCircle` (a stroked arc) instead of HeroUI's gradient SVG; the spin animation is the same CSS on `.spinner`.
- `lucide` is a peer dependency of `@rivetjs/ui`.
