---
title: Card
description: "Flexible container component for grouping related content and actions."
template: reference
status: experimental
related: [components/surface, components/avatar, components/button, components/link]
---

`Card` groups related content and actions. It is pure markup: a page of cards ships no JavaScript for them.

Notes:

- `class`, not `className`.
- The context carries the variant, not tv slot functions (they do not serialize on resume); same classes.

## Usage

```tsx
import { Card } from "@rivetjs/ui/card";
```

::example{id=card-default}

## Anatomy

```tsx
import { Card } from "@rivetjs/ui/card";

export default () => (
  <Card>
    <Card.Header>
      <Card.Title />
      <Card.Description />
    </Card.Header>
    <Card.Content />
    <Card.Footer />
  </Card>
);
```

## Examples

### Variants

Cards come in semantic variants that describe their prominence level rather than specific visual styles. This allows themes to interpret them differently:

::example{id=card-variants}

- **`transparent`** - Minimal prominence, transparent background (great for nested cards)
- **`default`** - Standard card for most use cases (surface-secondary)
- **`secondary`** - Medium prominence to draw moderate attention (surface-tertiary)
- **`tertiary`** - Higher prominence for important content (surface-tertiary)

### Horizontal Layout

::example{id=card-horizontal}

### With Avatar

::example{id=card-with-avatar}

### With Images

::example{id=card-with-images}

### With Form

::example{id=card-with-form}

## Customization

### Tailwind CSS

::example{id=card-custom-styles}

### Global CSS

To customize the Card component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .card--secondary {
    @apply bg-gradient-to-br from-blue-50 to-purple-50;
  }

  .card__title {
    @apply text-xl font-bold;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

Card uses [BEM](https://getbem.com/) naming for predictable styling ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/card.css)):

#### Base Classes

- `.card` - Base container with padding and border
- `.card__header` - Header section container
- `.card__title` - Title with base font size and weight
- `.card__description` - Muted description text
- `.card__content` - Flexible content container
- `.card__footer` - Footer with row layout

#### Variant Classes

- `.card--transparent` - Minimal prominence, transparent background (maps to `transparent` variant)
- `.card--default` - Standard appearance with surface-secondary (default)
- `.card--secondary` - Medium prominence with surface-tertiary (maps to `secondary` variant)
- `.card--tertiary` - Higher prominence with surface-tertiary (maps to `tertiary` variant)

## API Reference

### Card

| Prop       | Type                                                      | Default     | Description                                  |
| ---------- | --------------------------------------------------------- | ----------- | -------------------------------------------- |
| `variant`  | `"transparent" \| "default" \| "secondary" \| "tertiary"` | `"default"` | Semantic variant indicating prominence level |
| `class`    | `string`                                                  | -           | Additional CSS classes                       |
| `children` | `Content`                                                 | -           | Card content                                 |

### Card.Header

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | Header content         |

### Card.Title

| Prop       | Type      | Default | Description                     |
| ---------- | --------- | ------- | ------------------------------- |
| `class`    | `string`  | -       | Additional CSS classes          |
| `children` | `Content` | -       | Title content (renders as `h3`) |

### Card.Description

| Prop       | Type      | Default | Description                          |
| ---------- | --------- | ------- | ------------------------------------ |
| `class`    | `string`  | -       | Additional CSS classes               |
| `children` | `Content` | -       | Description content (renders as `p`) |

### Card.Content

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | Main content           |

### Card.Footer

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | Footer content         |

::api{symbol="@rivetjs/ui/card#CardRootProps"}

## Accessibility

Plain markup. `Card.Title` is an `h3`: pick the element that fits the page outline (`<Card.Title<"h2">>`).

```tsx
import { Card } from "@rivetjs/ui/card";
import { cardVariants } from "@rivetjs/ui/card";

// Semantic markup
<Card role="article" aria-labelledby="card-title">
  <Card.Header>
    <Card.Title id="card-title">Article Title</Card.Title>
  </Card.Header>
</Card>

// Interactive cards
<a class={cardVariants().base()} href="/details" aria-label="View product details">
  <Card.Title>Product Name</Card.Title>
</a>
```

## Related Components

- [Surface](/components/surface/): Base container surface.
- [Avatar](/components/avatar/): Display user profile images.
- [Form](/components/form/): Form validation and submission handling.
