---
title: Badge
description: "Displays a small indicator positioned relative to another element, commonly used for notification counts, status dots, and labels."
template: reference
status: experimental
related: [components/avatar, components/chip]
---

`Badge` is a small marker (a count, a dot, a word) on a corner of its `Badge.Anchor`: an icon, an avatar, a button.

Notes:

- `class`, not `className`.
- Literal text is wrapped in `Badge.Label`. A child expression that reads a signal is not wrapped in the server markup: use an explicit `Badge.Label` for it.

## Usage

```tsx
import { Badge } from "@rivetjs/ui/badge";
```

::example{id=badge-basic}

## Anatomy

Badge is designed to be positioned relative to another element using `Badge.Anchor`. Plain-text children are automatically wrapped in `<Badge.Label>`.

> For standalone label usage, use the [Chip](/components/chip/) component instead.

```tsx
<Badge.Anchor>
  <Avatar />
  <Badge color="danger">5</Badge>
</Badge.Anchor>
```

Additional exported parts: `Badge.Root`.

## Examples

### Variants

::example{id=badge-variants}

### Sizes

::example{id=badge-sizes}

### Colors

::example{id=badge-colors}

### Placements

::example{id=badge-placements}

### Dot Badge

Empty badges act as status indicators — useful for online/offline states or activity signals.

::example{id=badge-dot}

### With Content

Badge supports text, numbers, and icons as content. When no children are provided, it renders as a dot indicator.

::example{id=badge-with-content}

## Customization

### Tailwind CSS

::example{id=badge-custom-styles}

### Global CSS

To customize the Badge component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .badge {
    @apply rounded-full text-xs;
  }

  .badge__label {
    @apply font-semibold;
  }

  .badge--accent {
    @apply shadow-sm;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `badge-label`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Badge component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/badge.css)):

#### Base Classes

- `.badge` - Base badge container styles
- `.badge__label` - Label text slot styles
- `.badge-anchor` - Positioning wrapper for the anchored element

#### Color Classes

- `.badge--accent` - Accent color variant
- `.badge--danger` - Danger color variant
- `.badge--default` - Default color variant
- `.badge--success` - Success color variant
- `.badge--warning` - Warning color variant

#### Variant Classes

- `.badge--primary` - Primary variant with filled background
- `.badge--secondary` - Secondary variant with default background
- `.badge--soft` - Soft variant with lighter background

#### Size Classes

- `.badge--sm` - Small size
- `.badge--md` - Medium size (default)
- `.badge--lg` - Large size

#### Placement Classes

- `.badge--top-right` - Position at top-right corner (default)
- `.badge--top-left` - Position at top-left corner
- `.badge--bottom-right` - Position at bottom-right corner
- `.badge--bottom-left` - Position at bottom-left corner

#### Compound Variant Classes

Badges support combining variant and color classes (e.g., `.badge--primary.badge--accent`). The following combinations have default styles defined:

**Primary Variants:**

- `.badge--primary.badge--accent` - Primary accent with filled background
- `.badge--primary.badge--default` - Primary default with filled background
- `.badge--primary.badge--success` - Primary success with filled background
- `.badge--primary.badge--warning` - Primary warning with filled background
- `.badge--primary.badge--danger` - Primary danger with filled background

**Soft Variants:**

- `.badge--soft.badge--accent` - Soft accent with lighter background
- `.badge--soft.badge--default` - Soft default with lighter background
- `.badge--soft.badge--success` - Soft success with lighter background
- `.badge--soft.badge--warning` - Soft warning with lighter background
- `.badge--soft.badge--danger` - Soft danger with lighter background

## API Reference

See the [full module API](/api/rivetjs/ui/badge/) for every named export and part prop type.

### Badge

| Prop        | Type                                                           | Default       | Description                                                                                  |
| ----------- | -------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `children`  | `Content`                                                      | -             | Content to display inside the badge (text, number, or icon). When omitted, renders as a dot. |
| `class`     | `string`                                                       | -             | Additional CSS classes for the root element                                                  |
| `color`     | `"default" \| "accent" \| "success" \| "warning" \| "danger"`  | `"default"`   | Color variant of the badge                                                                   |
| `variant`   | `"primary" \| "secondary" \| "soft"`                           | `"primary"`   | Visual style variant                                                                         |
| `size`      | `"sm" \| "md" \| "lg"`                                         | `"md"`        | Size of the badge                                                                            |
| `placement` | `"top-right" \| "top-left" \| "bottom-right" \| "bottom-left"` | `"top-right"` | Position of the badge relative to its anchor                                                 |

### Badge.Anchor

| Prop       | Type      | Default | Description                                               |
| ---------- | --------- | ------- | --------------------------------------------------------- |
| `children` | `Content` | -       | The element to anchor the badge to, plus the Badge itself |
| `class`    | `string`  | -       | Additional CSS classes for the anchor wrapper             |

### Badge.Label

| Prop       | Type      | Default | Description                               |
| ---------- | --------- | ------- | ----------------------------------------- |
| `children` | `Content` | -       | Label text content                        |
| `class`    | `string`  | -       | Additional CSS classes for the label slot |

::api{symbol="@rivetjs/ui/badge#BadgeRootProps"}

## Accessibility

Plain markup without a role. A badge that carries information should also be in the anchored control's name (`aria-label="Notifications, 3 unread"`).

## Related Components

- [Avatar](/components/avatar/): Display user profile images.
- [Chip](/components/chip/): Compact elements for tags and filters.
