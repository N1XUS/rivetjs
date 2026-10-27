---
title: Surface
description: "Container component that provides surface-level styling and context for child components."
template: reference
status: experimental
related: [components/card]
---

`Surface` is the base layer of the design: a background and shadow from the theme's surface tokens. Components inside read its variant through `SurfaceContext`.

Notes:

- `class`, not `className`.

## Usage

```tsx
import { Surface } from "@rivetjs/ui/surface";
```

::example{id=surface-basic}

## Anatomy

`Surface` exposes `Surface.Root`.

Use the composition in the live example above; the API reference below describes the props.

## Examples

### Variants

Surface comes in semantic variants that describe their prominence level:

- **`default`** - Standard surface appearance (bg-surface)
- **`secondary`** - Medium prominence (bg-surface-secondary)
- **`tertiary`** - Higher prominence (bg-surface-tertiary)

::example{id=surface-variants}

### With Form Components

When using form components inside a Surface, use the `variant="secondary"` prop to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=surface-with-form-components}

### Context API

#### SurfaceContext

Child components can access the Surface context to get the current variant:

```tsx
import { useContext } from "react";
import { SurfaceContext } from "@rivetjs/ui/surface";

function MyComponent() {
  const { variant } = useContext(SurfaceContext);
  // variant will be "transparent" | "default" | "secondary" | "tertiary" | undefined
}
```

## Customization

### Tailwind CSS

::example{id=surface-custom-styles}

### Global CSS

To customize the Surface component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .surface {
    @apply rounded-2xl border border-border;
  }

  .surface--secondary {
    @apply bg-gradient-to-br from-blue-50 to-purple-50;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Surface component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/surface.css)):

#### Base Classes

- `.surface` - Base surface container

#### Variant Classes

- `.surface--default` - Default surface variant (bg-surface)
- `.surface--secondary` - Secondary surface variant (bg-surface-secondary)
- `.surface--tertiary` - Tertiary surface variant (bg-surface-tertiary)

## API Reference

See the [full module API](/api/rivetjs/ui/surface/) for every named export and part prop type.

### Surface

| Prop       | Type                                                       | Default     | Description                       |
| ---------- | ---------------------------------------------------------- | ----------- | --------------------------------- |
| `variant`  | ` "transparent" \| "default" \| "secondary" \| "tertiary"` | `"default"` | The visual variant of the surface |
| `class`    | `string`                                                   | -           | Additional CSS classes            |
| `children` | `Content`                                                  | -           | The surface content               |

::api{symbol="@rivetjs/ui/surface#SurfaceRootProps"}

## Accessibility

Plain markup, no role.

## Related Components

- [CheckboxGroup](/components/checkbox-group/): Group of checkboxes with shared state.
- [Fieldset](/components/fieldset/): Group related form controls with legends.
- [InputOTP](/components/input-otp/): One-time password input.
