---
title: Spinner
description: "A loading indicator component to show pending states."
template: reference
status: experimental
related: [components/progress-bar, components/progress-circle, components/button]
---

`Spinner` is an indeterminate loading indicator.

Notes:

- `class`, not `className`.
- The icon is lucide `LoaderCircle` (a stroked arc); same `data-slot`, `viewBox` and spin animation. `lucide` is a peer dependency.

## Usage

```tsx
import { Spinner } from "@rivetjs/ui/spinner";
```

::example{id=spinner-basic}

## Anatomy

`Spinner` exposes `Spinner.Root`.

Use the composition in the live example above; the API reference below describes the props.

## Examples

### Colors

::example{id=spinner-colors}

### Sizes

::example{id=spinner-sizes}

### Speed

Apply an animation utility to change how fast a single spinner rotates. Pair it with
`motion-reduce:animate-none` so it stays still for users who prefer reduced motion.

::example{id=spinner-speed}

## Customization

### Tailwind CSS

::example{id=spinner-custom-styles}

### Global CSS

To customize the Spinner component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .spinner {
    @apply animate-spin;
  }

  .spinner--accent {
    color: var(--accent);
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `spinner-icon`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Spinner component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/spinner.css)):

#### Base & Size Classes

- `.spinner` - Base spinner styles with default size
- `.spinner--sm` - Small size variant
- `.spinner--md` - Medium size variant (default)
- `.spinner--lg` - Large size variant
- `.spinner--xl` - Extra large size variant

#### Color Classes

- `.spinner--current` - Inherits current text color
- `.spinner--accent` - Accent color variant
- `.spinner--danger` - Danger color variant
- `.spinner--success` - Success color variant
- `.spinner--warning` - Warning color variant

## API Reference

See the [full module API](/api/rivetjs/ui/spinner/) for every named export and part prop type.

### Spinner

| Prop    | Type                                                          | Default    | Description                  |
| ------- | ------------------------------------------------------------- | ---------- | ---------------------------- |
| `size`  | `"sm" \| "md" \| "lg" \| "xl"`                                | `"md"`     | Size of the spinner          |
| `color` | `"current" \| "accent" \| "success" \| "warning" \| "danger"` | `"accent"` | Color variant of the spinner |
| `class` | `string`                                                      | -          | Additional CSS classes       |

::api{symbol="@rivetjs/ui/spinner#SpinnerRootProps"}

## Accessibility

`role="status"` with an `aria-label`, so a spinner that appears is announced politely. The icon is hidden from assistive technology.

## Related Components

- [ProgressBar](/components/progress-bar/)
- [ProgressCircle](/components/progress-circle/)
- [Button](/components/button/)
