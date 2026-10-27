---
title: Chip
description: "Small informational badges for displaying labels, statuses, and categories."
template: reference
status: experimental
related: [components/avatar, components/close-button, components/separator]
---

`Chip` is a compact label for tags, statuses and filters.

Notes:

- `class`, not `className`.
- A child expression that reads a signal is not wrapped in `Chip.Label` in the server markup: wrap it yourself (`<Chip.Label>{text()}</Chip.Label>`).

## Usage

```tsx
import { Chip } from "@rivetjs/ui/chip";
```

::example{id=chip-basic}

## Anatomy

> Plain-text children are automatically wrapped in `<Chip.Label>`.

```tsx
<Chip>Label text</Chip>
```

Additional exported parts: `Chip.Root`.

## Examples

### Variants

::example{id=chip-variants}

### Statuses

::example{id=chip-statuses}

### With Icons

::example{id=chip-with-icon}

An `<Icon>` without `size` takes the chip icon box (14 px, 16 px in `lg`); so does `size={24}` (any 24 × 24 direct-child `svg`: the kit default). Pass another `size` to draw it at that size, as the dots above do.

## Customization

### Tailwind CSS

::example{id=chip-custom-styles}

### Global CSS

To customize the Chip component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .chip {
    @apply rounded-full text-xs;
  }

  .chip__label {
    @apply font-medium;
  }

  .chip--accent {
    @apply border-accent/20;
  }

  .chip--accent .chip__label {
    @apply text-accent;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `chip-label`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Chip component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/chip.css)):

#### Base Classes

- `.chip` - Base chip container styles
- `.chip__label` - Label text slot styles

#### Color Classes

- `.chip--accent` - Accent color variant
- `.chip--danger` - Danger color variant
- `.chip--default` - Default color variant
- `.chip--success` - Success color variant
- `.chip--warning` - Warning color variant

#### Variant Classes

- `.chip--primary` - Primary variant with filled background
- `.chip--secondary` - Secondary variant with border
- `.chip--tertiary` - Tertiary variant with transparent background
- `.chip--soft` - Soft variant with lighter background

#### Size Classes

- `.chip--sm` - Small size
- `.chip--md` - Medium size (default)
- `.chip--lg` - Large size

#### Compound Variant Classes

Chips support combining variant and color classes (e.g., `.chip--secondary.chip--accent`). The following combinations have default styles defined:

**Primary Variants:**

- `.chip--primary.chip--accent` - Primary accent combination with filled background
- `.chip--primary.chip--success` - Primary success combination with filled background
- `.chip--primary.chip--warning` - Primary warning combination with filled background
- `.chip--primary.chip--danger` - Primary danger combination with filled background

**Soft Variants:**

- `.chip--accent.chip--soft` - Soft accent combination with lighter background
- `.chip--success.chip--soft` - Soft success combination with lighter background
- `.chip--warning.chip--soft` - Soft warning combination with lighter background
- `.chip--danger.chip--soft` - Soft danger combination with lighter background

**Note:** You can apply custom styles to any variant-color combination (e.g., `.chip--secondary.chip--accent`, `.chip--tertiary.chip--success`) using the `@layer components` directive in your CSS.

## API Reference

See the [full module API](/api/rivetjs/ui/chip/) for every named export and part prop type.

### Chip

| Prop       | Type                                                          | Default       | Description                                 |
| ---------- | ------------------------------------------------------------- | ------------- | ------------------------------------------- |
| `children` | `Content`                                                     | -             | Content to display inside the chip          |
| `class`    | `string`                                                      | -             | Additional CSS classes for the root element |
| `color`    | `"default" \| "accent" \| "success" \| "warning" \| "danger"` | `"default"`   | Color variant of the chip                   |
| `variant`  | `"primary" \| "secondary" \| "tertiary" \| "soft"`            | `"secondary"` | Visual style variant                        |
| `size`     | `"sm" \| "md" \| "lg"`                                        | `"md"`        | Size of the chip                            |

### Chip.Label

| Prop       | Type      | Default | Description                               |
| ---------- | --------- | ------- | ----------------------------------------- |
| `children` | `Content` | -       | Label text content                        |
| `class`    | `string`  | -       | Additional CSS classes for the label slot |

::api{symbol="@rivetjs/ui/chip#ChipRootProps"}

## Accessibility

Plain markup without behaviour. For a removable chip, put a [CloseButton](close-button.md) with an `aria-label` ("Remove tag") inside or next to it.

## Related Components

- [Avatar](/components/avatar/): Display user profile images.
- [CloseButton](/components/close-button/): Button for dismissing overlays.
- [Separator](/components/separator/): Visual divider between content.
