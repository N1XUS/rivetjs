---
title: ColorSwatchPicker
description: "A list of color swatches for picking a color from a predefined palette."
template: reference
status: experimental
related: [components/color-picker, components/color-swatch]
---

`ColorSwatchPicker` is a list of preset colors: a `role="listbox"` of swatch options, single selection, arrow-key navigation. The root is the [cdk ColorSwatchPicker](site:cdk/components/color-swatch-picker/) (React Aria `ColorSwatchPicker`), the items cdk `ColorSwatchPickerItem`s, `ColorSwatchPicker.Swatch` the cdk `ColorSwatch`.

Notes:

- `class`, not `className`. `parseColor` and the `Color` / `ColorSpace` / `ColorChannel` types come from `@rivetjs/cdk/color` (the React Stately color port).
- A controlled `value` is a two-way signal of the color string (`signal("#F43F5E")`; no `onChange` setter needed; the component writes back a lossless string such as `hsla(200, 100%, 50%, 1)`). `Color` objects in props (`defaultValue={parseColor("…")}`) reach the cdk part as strings so the page resumes; a `Color` held in a component local and read by resumable code must be its string form.
- The default `ColorSwatchPicker.Indicator` is the lucide `Check` icon; a function child gets the item render props (accessors: `isSelected()`).
- `layout` selects the variant class only (the listbox keeps its default grid keyboard layout).

## Usage

```tsx
import { parseColor } from "@rivetjs/cdk/color";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";
```

::example{id=color-swatch-picker-basic}

## Anatomy

```tsx
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";

export default () => (
  <ColorSwatchPicker>
    <ColorSwatchPicker.Item color="#F43F5E">
      <ColorSwatchPicker.Swatch />
      <ColorSwatchPicker.Indicator />
    </ColorSwatchPicker.Item>
    <ColorSwatchPicker.Item color="#D946EF">
      <ColorSwatchPicker.Swatch />
      <ColorSwatchPicker.Indicator />
    </ColorSwatchPicker.Item>
    <ColorSwatchPicker.Item color="#8B5CF6">
      <ColorSwatchPicker.Swatch />
      <ColorSwatchPicker.Indicator />
    </ColorSwatchPicker.Item>
  </ColorSwatchPicker>
);
```

Additional exported parts: `ColorSwatchPicker.Root`.

## Examples

### Variants

::example{id=color-swatch-picker-variants}

### Sizes

::example{id=color-swatch-picker-sizes}

### Disabled

::example{id=color-swatch-picker-disabled}

### Stack Layout

::example{id=color-swatch-picker-stack-layout}

### Default Value

::example{id=color-swatch-picker-default-value}

### Controlled

::example{id=color-swatch-picker-controlled}

### Custom Indicator

::example{id=color-swatch-picker-custom-indicator}

### Render Function

::example{id=color-swatch-picker-render-function}

## Customization

### Tailwind CSS

::example{id=color-swatch-picker-custom-styles}

### Global CSS

To customize the ColorSwatchPicker component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .color-swatch-picker {
    @apply gap-4;
  }

  .color-swatch-picker__item {
    @apply shadow-md;
  }

  .color-swatch-picker__swatch {
    @apply border-2 border-white;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `color-swatch-picker-checkmark`, `color-swatch-picker-item`, `color-swatch-picker-swatch`, `color-swatch-picker-indicator`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ColorSwatchPicker component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/color-swatch-picker.css)):

#### Base & Structure

- `.color-swatch-picker` - Base container (flex layout)
- `.color-swatch-picker__item` - Individual swatch item wrapper
- `.color-swatch-picker__swatch` - The color swatch visual element

#### Size Classes

- `.color-swatch-picker--xs` - Extra small (16px)
- `.color-swatch-picker--sm` - Small (24px)
- `.color-swatch-picker--md` - Medium (32px, default)
- `.color-swatch-picker--lg` - Large (36px)
- `.color-swatch-picker--xl` - Extra large (40px)

#### Shape Variants

- `.color-swatch-picker--circle` - Circle shape (default)
- `.color-swatch-picker--square` - Square shape with rounded corners

#### Layout Classes

- `.color-swatch-picker--grid` - Horizontal wrapping layout (default)
- `.color-swatch-picker--stack` - Vertical stacked layout

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` - Scale up to 1.1 (only when not selected)
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` - Focus ring
- **Selected**: `[data-selected="true"]` - Inner border with same color as swatch
- **Disabled**: `[data-disabled="true"]` - Reduced opacity

## API Reference

See the [full module API](/api/rivetjs/ui/color-swatch-picker/) for every named export and part prop type.

### ColorSwatchPicker

Inherits from [cdk ColorSwatchPicker](site:cdk/components/color-swatch-picker/).

| Prop           | Type                                                                           | Default    | Description                                                                  |
| -------------- | ------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------- |
| `value`        | `string \| Color \| Signal<string \| Color>`                                   | -          | The current selected color (controlled; Rivet: a signal is two-way)          |
| `defaultValue` | `string \| Color`                                                              | -          | The default selected color (uncontrolled)                                    |
| `onChange`     | `(value: Color) => void`                                                       | -          | Handler called when selection changes                                        |
| `size`         | `"xs" \| "sm" \| "md" \| "lg" \| "xl"`                                         | `"md"`     | Size of the swatches                                                         |
| `variant`      | `"circle" \| "square"`                                                         | `"circle"` | Shape of the swatches                                                        |
| `layout`       | `"grid" \| "stack"`                                                            | `"grid"`   | Layout direction (variant class; the listbox keeps its grid keyboard layout) |
| `class`        | `string`                                                                       | -          | Additional CSS classes                                                       |
| `children`     | `Content`                                                                      | -          | ColorSwatchPicker.Item elements                                              |
| `render`       | `DOMRenderFunction<keyof JSX.IntrinsicElements, ColorSwatchPickerRenderProps>` | -          | Overrides the default DOM element with a custom render function.             |

### ColorSwatchPicker.Item

| Prop         | Type                                                                               | Default      | Description                                                      |
| ------------ | ---------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `color`      | `string \| Color`                                                                  | **Required** | The color of the swatch                                          |
| `isDisabled` | `boolean`                                                                          | `false`      | Whether the item is disabled                                     |
| `class`      | `string`                                                                           | -            | Additional CSS classes                                           |
| `children`   | `Content`                                                                          | -            | ColorSwatchPicker.Swatch element                                 |
| `render`     | `DOMRenderFunction<keyof JSX.IntrinsicElements, ColorSwatchPickerItemRenderProps>` | -            | Overrides the default DOM element with a custom render function. |

### ColorSwatchPicker.Swatch

| Prop    | Type     | Default | Description            |
| ------- | -------- | ------- | ---------------------- |
| `class` | `string` | -       | Additional CSS classes |

**ColorSwatchPicker.Indicator**

| Prop       | Type                                                                | Default        | Description                                                                           |
| ---------- | ------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| `class`    | `string`                                                            | -              | Additional CSS classes                                                                |
| `children` | `Content \| ((props: ColorSwatchPickerItemRenderProps) => Content)` | lucide `Check` | Indicator content, or a function of the item render props (accessors: `isSelected()`) |

### parseColor

`parseColor` comes from `@rivetjs/cdk/color` (re-exported by Rivet UI):

```tsx
import { parseColor } from "@rivetjs/cdk/color";

// Parse hex color
const red = parseColor("#ff0000");

// Parse RGB
const green = parseColor("rgb(0, 255, 0)");

// Parse HSL
const blue = parseColor("hsl(240, 100%, 50%)");
```

::api{symbol="@rivetjs/ui/color-swatch-picker#ColorSwatchPicker"}

## Accessibility

the root is a `role="listbox"` (default label "Color swatches"), each item a `role="option"` named by its color description; arrow keys move between items, Enter / Space select.

## Related Components

- [ColorSwatch](/components/color-swatch/): Visual preview of a color value.
- [ColorField](/components/color-field/): Input for entering color values with hex format.
- [ColorArea](/components/color-area/): 2D color picker for selecting colors from a gradient area.
- [ColorPicker](/components/color-picker/): Composable color picker with popover.
