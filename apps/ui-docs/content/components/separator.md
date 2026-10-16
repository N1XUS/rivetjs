---
title: Separator
description: "Visually divide content sections."
template: reference
status: experimental
related: [components/card, components/chip, components/avatar]
---

`Separator` divides content. It is the [cdk Separator](site:cdk/components/separator/): an `<hr>`, or a `div role="separator"` when vertical.

Notes:

- `class`, not `className`.

Accessibility: A horizontal separator is a native `<hr>`; a vertical one has `role="separator"` and `aria-orientation="vertical"`. Inside a cdk collection it becomes a separator node.

## Usage

```tsx
import { Separator } from "@rivetjs/ui/separator";
```

::example{id=separator-basic}

## Examples

### Variants

::example{id=separator-variants}

### With Surface

The Separator component adapts to different surface backgrounds for better visibility.

::example{id=separator-with-surface}

### Vertical

::example{id=separator-vertical}

### With Content

::example{id=separator-with-content}

### Render Function

::example{id=separator-render-function}

## Customization

### Tailwind CSS

::example{id=separator-custom-styles}

### Global CSS

To customize the Separator component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .separator {
    @apply bg-accent h-[2px];
  }

  .separator--vertical {
    @apply bg-accent w-[2px];
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Separator component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/separator.css)):

#### Base & Orientation Classes

- `.separator` - Base separator styles with default horizontal orientation
- `.separator--horizontal` - Horizontal orientation (full width, 1px height)
- `.separator--vertical` - Vertical orientation (full height, 1px width)

#### Variant Classes

- `.separator--default` - Default variant with standard contrast
- `.separator--secondary` - Secondary variant with medium contrast
- `.separator--tertiary` - Tertiary variant with subtle contrast

## API Reference

### Separator

| Prop          | Type                                                        | Default        | Description                                                      |
| ------------- | ----------------------------------------------------------- | -------------- | ---------------------------------------------------------------- |
| `orientation` | `'horizontal' \| 'vertical'`                                | `'horizontal'` | The orientation of the separator                                 |
| `variant`     | `'default' \| 'secondary' \| 'tertiary'`                    | `'default'`    | The visual variant of the separator                              |
| `class`       | `string`                                                    | -              | Additional CSS classes                                           |
| `render`      | `DOMRenderFunction<keyof JSX.IntrinsicElements, undefined>` | -              | Overrides the default DOM element with a custom render function. |

::api{symbol="@rivetjs/ui/separator#SeparatorRootProps"}

## Related Components

- [Card](/components/card/): Content container with header, body, and footer.
- [Chip](/components/chip/): Compact elements for tags and filters.
- [Avatar](/components/avatar/): Display user profile images.
