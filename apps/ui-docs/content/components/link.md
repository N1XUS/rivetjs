---
title: Link
description: "A styled anchor component for navigation with built-in icon support."
template: reference
status: experimental
related: []
---

`Link` is the styled text link on the [cdk Link](site:cdk/components/link/). `Link.Icon` adds a small trailing icon.

Notes:

- `class`, not `className`.
- The default icon is lucide `ArrowUpRight` (stroked).

Accessibility: A real `<a>`. A disabled link gets `aria-disabled` and loses its `href`. State attributes: `data-hovered`, `data-pressed`, `data-focus-visible`, `data-current`, `data-disabled`. With `@rivetjs/router`, navigation goes through the router.

## Usage

```tsx
import { Link } from "@rivetjs/ui/link";
```

::example{id=link-basic}

## Anatomy

```tsx
import { Link } from "@rivetjs/ui/link";

export default () => (
  <Link href="#">
    Call to action
    <Link.Icon />
  </Link>
);
```

## Examples

### Icon Placement

::example{id=link-icon-placement}

### Text Decoration with Tailwind CSS

Link is underlined on hover by default. Use Tailwind CSS text-decoration utilities to make the underline always visible, remove it entirely, or customize its color, style, thickness, and offset.

::example{id=link-underline-and-offset}

**Text Decoration Line:**

- `underline` - Always visible underline
- `no-underline` - Remove underline
- default `Link` styles - Underline appears on hover

**Text Decoration Color:**

- `decoration-accent`, `decoration-muted`, etc. - Set underline color using theme colors
- `decoration-muted/50` - Use opacity modifiers for semi-transparent underlines

**Text Decoration Style:**

- `decoration-solid` - Solid line (default)
- `decoration-double` - Double line
- `decoration-dotted` - Dotted line
- `decoration-dashed` - Dashed line
- `decoration-wavy` - Wavy line

**Text Decoration Thickness:**

- `decoration-1`, `decoration-2`, `decoration-4`, etc. - Control underline thickness

**Underline Offset:**

- `underline-offset-1`, `underline-offset-2`, `underline-offset-4`, etc. - Adjust spacing between text and underline

For more details, see the Tailwind CSS documentation:

- [text-decoration-line](https://tailwindcss.com/docs/text-decoration-line)
- [text-decoration-color](https://tailwindcss.com/docs/text-decoration-color)
- [text-decoration-style](https://tailwindcss.com/docs/text-decoration-style)
- [text-decoration-thickness](https://tailwindcss.com/docs/text-decoration-thickness)
- [text-underline-offset](https://tailwindcss.com/docs/text-underline-offset)

Available BEM classes:

- Base: `link`
- Icon: `link__icon`

### Custom Icon

::example{id=link-custom-icon}

### Render Function

::example{id=link-render-function}

## Customization

### Tailwind CSS

::example{id=link-custom-styles}

### Global CSS

To customize the Link component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .link {
    @apply font-semibold no-underline hover:underline;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Link component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/link.css)):

#### Base Classes

- `.link` - Base link styles
- `.link__icon` - Link icon styles

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Focus**: `:focus-visible` or `[data-focus-visible="true"]`
- **Hover**: `:hover` or `[data-hovered="true"]`
- **Pressed**: `:active` or `[data-pressed="true"]`
- **Disabled**: `:disabled` or `[aria-disabled="true"]`

## API Reference

### Link

| Prop         | Type                                                              | Default   | Description                                                      |
| ------------ | ----------------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `href`       | `string`                                                          | -         | Destination URL for the anchor                                   |
| `target`     | `string`                                                          | `"_self"` | Controls where to open the linked document                       |
| `rel`        | `string`                                                          | -         | Relationship between the current and linked documents            |
| `download`   | `boolean \| string`                                               | -         | Prompts file download instead of navigation                      |
| `isDisabled` | `boolean`                                                         | `false`   | Disables pointer and keyboard interaction                        |
| `class`      | `string`                                                          | -         | Custom classes merged with the default styles                    |
| `children`   | `Content`                                                         | -         | Content rendered inside the link                                 |
| `onPress`    | `(e: PressEvent) => void`                                         | -         | Fired when the link is activated                                 |
| `autoFocus`  | `boolean`                                                         | -         | Whether the element should receive focus on render               |
| `render`     | `DOMRenderFunction<keyof JSX.IntrinsicElements, LinkRenderProps>` | -         | Overrides the default DOM element with a custom render function. |

### Link.Icon

| Prop       | Type      | Default | Description                                                           |
| ---------- | --------- | ------- | --------------------------------------------------------------------- |
| `children` | `Content` | -       | Custom icon element; defaults to the built-in arrow icon when omitted |
| `class`    | `string`  | -       | Additional CSS classes                                                |

### Using with Routing Libraries

Use variant functions to style framework-specific links like Next.js:

```tsx
import { Link } from "@rivetjs/ui/link";
import { linkVariants } from "@rivetjs/ui/link";
import NextLink from "next/link";

export default function Demo() {
  const slots = linkVariants();

  return (
    <NextLink class={slots.base()} href="/about">
      About Page
      <Link.Icon class={slots.icon()} />
    </NextLink>
  );
}
```

### Direct Class Application

Since Rivet UI uses [BEM](https://getbem.com/) classes, you can apply Link styles directly to any link element:

```tsx
import NextLink from "next/link";

// Apply classes directly with Tailwind utilities
export default function Demo() {
  return (
    <NextLink href="/about" class="link hover:underline underline-offset-2">
      About Page
    </NextLink>
  );
}

// Or with a native anchor
export default function NativeLink() {
  return (
    <a href="/about" class="link underline decoration-accent underline-offset-4">
      About Page
      <Link.Icon class="link__icon" />
    </a>
  );
}
```

::api{symbol="@rivetjs/ui/link#LinkRootProps"}

## Related Components

- [Breadcrumbs](/components/breadcrumbs/): Display the user's current location within a hierarchy.
