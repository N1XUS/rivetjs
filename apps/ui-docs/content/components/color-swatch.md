---
title: ColorSwatch
description: "A visual preview of a color value with accessibility support."
template: reference
status: experimental
related: [components/color-picker, components/color-swatch-picker]
---

`ColorSwatch` previews a color value: a `role="img"` element with a localized color description as its accessible name, painted from the `--color-swatch-current` custom property over a transparency checkerboard. The root is the [cdk ColorSwatch](site:cdk/components/color-swatch/) (React Aria `ColorSwatch`).

Notes:

- `class`, not `className`. `parseColor` and the `Color` / `ColorSpace` / `ColorChannel` types come from `@rivetjs/cdk/color` (the React Stately color port).
- `color` takes a string, a `Color` or an accessor (`color={() => value()}`); inside a `ColorPicker` / `ColorSwatchPicker` item it follows the picker color when omitted.
- Render props are accessors (`({ color }) => color().toString("css")`, `({ isDragging }) => isDragging()`).

## Usage

```tsx
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
```

::example{id=color-swatch-basic}

## Anatomy

`ColorSwatch` exposes `ColorSwatch.Root`.

Use the composition in the live example above; the API reference below describes the props.

## Examples

### Sizes

::example{id=color-swatch-sizes}

### Shapes

::example{id=color-swatch-shapes}

### Transparency

::example{id=color-swatch-transparency}

### Render Function

You can use the `style` render props to access the color value and create custom visual effects.

::example{id=color-swatch-render-function}

### Accessibility

Use `colorName` to provide a custom accessible name for the color, and `aria-label` to add context about how the color is used.

::example{id=color-swatch-accessibility}

## Customization

### Tailwind CSS

::example{id=color-swatch-custom-styles}

### Global CSS

To customize the ColorSwatch component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .color-swatch {
    @apply border-2 border-white;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ColorSwatch component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/color-swatch.css)):

#### Base Classes

- `.color-swatch` - Base swatch styles with checkered background for transparency

#### Shape Classes

- `.color-swatch--circle` - Circular shape (default)
- `.color-swatch--square` - Square shape with rounded corners

#### Size Classes

- `.color-swatch--xs` - Extra small (16px)
- `.color-swatch--sm` - Small (24px)
- `.color-swatch--md` - Medium (32px, default)
- `.color-swatch--lg` - Large (36px)
- `.color-swatch--xl` - Extra large (40px)

## API Reference

See the [full module API](/api/rivetjs/ui/color-swatch/) for every named export and part prop type.

### ColorSwatch

| Prop         | Type                                                                     | Default    | Description                                                             |
| ------------ | ------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------- |
| `color`      | `string \| Color \| (() => string \| Color)`                             | -          | The color value to display (hex, rgb, hsl, etc.); Rivet: or an accessor |
| `colorName`  | `string`                                                                 | -          | Accessible name for the color (overrides auto-generated description)    |
| `class`      | `string`                                                                 | -          | Additional CSS classes                                                  |
| `shape`      | `"circle" \| "square"`                                                   | `"circle"` | Shape of the swatch                                                     |
| `size`       | `"xs" \| "sm" \| "md" \| "lg" \| "xl"`                                   | `"md"`     | Size of the swatch                                                      |
| `style`      | `JSX.CSSProperties \| ((renderProps) => JSX.CSSProperties)`              | -          | Inline styles or render props function with access to color             |
| `aria-label` | `string`                                                                 | -          | Accessible label for the swatch                                         |
| `render`     | `DOMRenderFunction<keyof JSX.IntrinsicElements, ColorSwatchRenderProps>` | -          | Overrides the default DOM element with a custom render function.        |

### Style Render Props

When using the `style` prop as a function, you receive render props with access to the color:

```tsx
<ColorSwatch
  color="#0485F7"
  style={({ color }) => ({
    boxShadow: `0 4px 14px ${color().toString("css")}80`,
  })}
/>
```

`color` is an accessor (Rivet); the `Color` it returns provides methods like:

- `color().toString("css")` - Returns CSS color string
- `color().toString("hex")` - Returns hex color string
- `color().getChannelValue("alpha")` - Returns alpha channel value

::api{symbol="@rivetjs/ui/color-swatch#ColorSwatch"}

## Accessibility

The cdk ColorSwatch exposes the color as an image with an accessible name. Use `colorName` for a human-readable name and retain text when color carries status or meaning. A swatch alone is not a selectable control; use [ColorSwatchPicker](/components/color-swatch-picker/) for selection.

## Related Components

- [ColorSwatchPicker](/components/color-swatch-picker/): Color swatch selection from a list of colors.
- [ColorField](/components/color-field/): Input for entering color values with hex format.
- [ColorArea](/components/color-area/): 2D color picker for selecting colors from a gradient area.
- [ColorPicker](/components/color-picker/): Composable color picker with popover.
