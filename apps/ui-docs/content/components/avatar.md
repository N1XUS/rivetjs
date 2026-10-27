---
title: Avatar
description: "Display user profile images with customizable fallback content."
template: reference
status: experimental
related: [components/avatar-group, components/separator, components/badge]
---

`Avatar` shows a user's picture, with a fallback while the image loads or when it fails. Built on an in-tree port of `@radix-ui/react-avatar` 1.2.6.

Notes:

- `class`, not `className`.
- No Radix `asChild`: parts render fixed elements.
- An `Avatar.Image` outside an `Avatar` gets a status of its own (Radix throws).

## Usage

```tsx
import { Avatar } from "@rivetjs/ui/avatar";
```

::example{id=avatar-basic}

## Anatomy

```tsx
import { Avatar } from "@rivetjs/ui/avatar";

export default () => (
  <Avatar>
    <Avatar.Image />
    <Avatar.Fallback />
  </Avatar>
);
```

Additional exported parts: `Avatar.Root`.

## Examples

### Sizes

::example{id=avatar-sizes}

### Colors

::example{id=avatar-colors}

### Variants

::example{id=avatar-variants}

### Fallback Content

::example{id=avatar-fallback}

## Customization

### Custom Image Component

Use `asChild` on `Avatar.Image` to compose with a custom image component. This example uses Next.js `Image` for optimized loading. Pass `src` on `Avatar.Image` so it can track the loading state and show the fallback until the image is ready.

:::warning
Not yet ported: the original demo passes `asChild` and renders Next.js `<Image>` inside `Avatar.Image`. The Rivet avatar has no `asChild` (and there is no Next.js), so the image renders through `Avatar.Image` itself.
:::

::example{id=avatar-custom-image-component}

### Tailwind CSS

::example{id=avatar-custom-styles}

### Global CSS

To customize the Avatar component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .avatar {
    @apply size-16 border-2 border-accent;
  }

  .avatar__fallback {
    @apply bg-gradient-to-br from-purple-500 to-pink-500;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Avatar component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/avatar.css)):

#### Base Classes

- `.avatar` - Base container with default size (size-10)
- `.avatar__image` - Image element with aspect-square sizing
- `.avatar__fallback` - Fallback container with centered content

#### Size Modifiers

- `.avatar--sm` - Small avatar (size-8)
- `.avatar--md` - Medium avatar (default, no additional styles)
- `.avatar--lg` - Large avatar (size-12)

#### Variant Modifiers

- `.avatar--soft` - Soft variant with lighter background

#### Color Modifiers

- `.avatar__fallback--default` - Default text color
- `.avatar__fallback--accent` - Accent text color
- `.avatar__fallback--success` - Success text color
- `.avatar__fallback--warning` - Warning text color
- `.avatar__fallback--danger` - Danger text color

## API Reference

See the [full module API](/api/rivetjs/ui/avatar/) for every named export and part prop type.

### Avatar

| Prop      | Type                                                          | Default     | Description            |
| --------- | ------------------------------------------------------------- | ----------- | ---------------------- |
| `size`    | `'sm' \| 'md' \| 'lg'`                                        | `'md'`      | Avatar size            |
| `color`   | `'default' \| 'accent' \| 'success' \| 'warning' \| 'danger'` | `'default'` | Fallback color theme   |
| `variant` | `'default' \| 'soft'`                                         | `'default'` | Visual style variant   |
| `class`   | `string`                                                      | -           | Additional CSS classes |

### Avatar.Image

| Prop          | Type                                                | Default | Description                                                                                |
| ------------- | --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `src`         | `string`                                            | -       | Image source URL                                                                           |
| `srcSet`      | `string`                                            | -       | The image `srcset` attribute for responsive images                                         |
| `sizes`       | `string`                                            | -       | The image `sizes` attribute for responsive images                                          |
| `alt`         | `string`                                            | -       | Alternative text for the image                                                             |
| `asChild`     | `boolean`                                           | `false` | Merge props onto the child element (e.g. `next/image`) instead of rendering a native `img` |
| `onLoad`      | `(event: SyntheticEvent<HTMLImageElement>) => void` | -       | Callback when the image loads successfully                                                 |
| `onError`     | `(event: SyntheticEvent<HTMLImageElement>) => void` | -       | Callback when there's an error loading the image                                           |
| `crossOrigin` | `'anonymous' \| 'use-credentials'`                  | -       | CORS setting for the image request                                                         |
| `loading`     | `'eager' \| 'lazy'`                                 | -       | Native lazy loading attribute                                                              |
| `class`       | `string`                                            | -       | Additional CSS classes                                                                     |

### Avatar.Fallback

| Prop      | Type                                                          | Default | Description                                    |
| --------- | ------------------------------------------------------------- | ------- | ---------------------------------------------- |
| `delayMs` | `number`                                                      | -       | Delay before showing fallback (prevents flash) |
| `color`   | `'default' \| 'accent' \| 'success' \| 'warning' \| 'danger'` | -       | Override color from parent                     |
| `class`   | `string`                                                      | -       | Additional CSS classes                         |

::api{symbol="@rivetjs/ui/avatar#AvatarRootProps"}

## Accessibility

Markup without cdk behaviour. Give `Avatar.Image` an `alt`. Initials are read as text; put an `aria-label` on the root when they say nothing (or for an icon fallback).

## Related Components

- [AvatarGroup](/components/avatar-group/): Display a stacked or grid group of avatars.
- [Separator](/components/separator/): Visual divider between content.
- [Badge](/components/badge/): Small indicator positioned relative to another element.
