---
title: Skeleton
description: "Skeleton is a placeholder to show a loading state and the expected shape of a component."
template: reference
status: experimental
related: [components/card, components/avatar]
---

`Skeleton` is a placeholder block for content that is still loading. It has no size of its own: set width, height and radius with classes.

Notes:

- `class`, not `className`.
- `--skeleton-animation` is read once, when a skeleton is created on the client.

Accessibility: Decorative markup: no text, no role. Tell screen-reader users about loading with `aria-busy` on the region or a [Spinner](spinner.md).

## Usage

```tsx
import { Skeleton } from "@rivetjs/ui/skeleton";
```

::example{id=skeleton-basic}

## Examples

### Text Content

::example{id=skeleton-text-content}

### User Profile

::example{id=skeleton-user-profile}

### List Items

::example{id=skeleton-list}

### Grid

::example{id=skeleton-grid}

### Single Shimmer

A synchronized shimmer effect that passes over all skeleton elements at once. Apply the `skeleton--shimmer` class to a parent container and set `animationType="none"` on child skeletons.

::example{id=skeleton-single-shimmer}

### Animation Types

::example{id=skeleton-animation-types}

## Customization

### Tailwind CSS

::example{id=skeleton-custom-styles}

### Global CSS

To customize the Skeleton component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  /* Base skeleton styles */
  .skeleton {
    @apply bg-surface-secondary/50; /* Change base background */
  }

  /* Shimmer animation gradient */
  .skeleton--shimmer:before {
    @apply viasurface; /* Change shimmer gradient color */
  }

  /* Pulse animation */
  .skeleton--pulse {
    @apply animate-pulse opacity-75; /* Customize pulse animation */
  }

  /* No animation variant */
  .skeleton--none {
    @apply opacity-50; /* Style for static skeleton */
  }
}
```

### Global Animation Configuration

You can set a default animation type for all Skeleton components in your application by defining the `--skeleton-animation` CSS variable:

```css
/* In your global CSS file */
:root {
  /* Possible values: shimmer, pulse, none */
  --skeleton-animation: pulse;
}

/* You can also set different values for light/dark themes */
.light,
[data-theme="light"] {
  --skeleton-animation: shimmer;
}

.dark,
[data-theme="dark"] {
  --skeleton-animation: pulse;
}
```

This global setting will be overridden by the `animationType` prop when specified on individual components.

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Skeleton component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/skeleton.css)):

#### Base Class

`.skeleton` - Base skeleton styles with background and rounded corners

#### Animation Variant Classes

- `.skeleton--shimmer` - Adds shimmer animation with gradient effect (default)
- `.skeleton--pulse` - Adds pulse animation using Tailwind's animate-pulse
- `.skeleton--none` - No animation, static skeleton

### Animation

The Skeleton component supports three animation types, each with different visual effects:

#### Shimmer Animation

The shimmer effect creates a gradient that moves across the skeleton element:

```css
.skeleton--shimmer:before {
  @apply animate-skeleton via-surface-3 absolute inset-0 -translate-x-full
         bg-gradient-to-r from-transparent to-transparent content-[''];
}
```

The shimmer animation is defined in the theme using:

```css
@theme inline {
  --animate-skeleton: skeleton 2s linear infinite;

  @keyframes skeleton {
    100% {
      transform: translateX(200%);
    }
  }
}
```

#### Pulse Animation

The pulse animation uses Tailwind's built-in `animate-pulse` utility:

```css
.skeleton--pulse {
  @apply animate-pulse;
}
```

#### No Animation

For static skeletons without any animation:

```css
.skeleton--none {
  /* No animation styles applied */
}
```

## API Reference

### Skeleton

| Prop            | Type                             | Default                     | Description                                                                                             |
| --------------- | -------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `animationType` | `"shimmer" \| "pulse" \| "none"` | `"shimmer"` or CSS variable | The animation type for the skeleton. Can be globally configured via `--skeleton-animation` CSS variable |
| `class`         | `string`                         | -                           | Additional CSS classes                                                                                  |

::api{symbol="@rivetjs/ui/skeleton#SkeletonRootProps"}

## Related Components

- [Card](/components/card/): Content container with header, body, and footer.
- [Avatar](/components/avatar/): Display user profile images.
