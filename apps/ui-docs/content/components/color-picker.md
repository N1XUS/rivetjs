---
title: ColorPicker
description: "A composable color picker that keeps one color value in sync across its color parts."
template: reference
status: experimental
related: [components/color-area, components/color-slider]
---

`ColorPicker` composes the color parts: one color value shared by a trigger swatch and any `ColorArea` / `ColorSlider` / `ColorField` / `ColorSwatchPicker` in its popover. The root is the [cdk ColorPicker](site:cdk/components/color-picker/) (React Aria `ColorPicker`) around a cdk `DialogTrigger`; `ColorPicker.Trigger` is a cdk `Button`, `ColorPicker.Popover` a cdk `Popover` (placement `bottom left` by default).

Notes:

- `class`, not `className`. `parseColor` and the `Color` / `ColorSpace` / `ColorChannel` types come from `@rivetjs/cdk/color` (the React Stately color port).
- A controlled `value` is a two-way signal of the color string (`signal("#325578")`; no `onChange` setter needed; the component writes back a lossless string such as `hsla(200, 100%, 50%, 1)`). `Color` objects in props (`defaultValue={parseColor("…")}`) reach the cdk part as strings so the page resumes; a `Color` held in a component local and read by resumable code must be its string form.
- Parts inside read the picker color through context: leave their `value` / `color` unset.
- Icons are lucide (`Shuffle`).

Accessibility: the trigger is a button (`aria-expanded`); the popover is a dialog labelled by the trigger; Escape or an outside press closes it and focus returns to the trigger.

## Usage

```tsx
import { ColorArea } from "@rivetjs/ui/color-area";
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorPicker } from "@rivetjs/ui/color-picker";
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";
```

::example{id=color-picker-basic}

## Anatomy

The ColorPicker is a composable component that combines multiple color components:

```tsx
import { ColorArea } from "@rivetjs/ui/color-area";
import { ColorPicker } from "@rivetjs/ui/color-picker";
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Label } from "@rivetjs/ui/label";

export default () => (
  <ColorPicker defaultValue="#0485F7">
    <ColorPicker.Trigger>
      <ColorSwatch />
      <Label>Pick a color</Label>
    </ColorPicker.Trigger>
    <ColorPicker.Popover>
      <ColorArea colorSpace="hsb" xChannel="saturation" yChannel="brightness">
        <ColorArea.Thumb />
      </ColorArea>
      <ColorSlider channel="hue" colorSpace="hsb">
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>
    </ColorPicker.Popover>
  </ColorPicker>
);
```

## Examples

### Controlled

::example{id=color-picker-controlled}

### With Swatches

::example{id=color-picker-with-swatches}

### With Fields

Use `ColorField` to allow users to edit individual color channel values with a `Select` to switch between color spaces.

::example{id=color-picker-with-fields}

### With Sliders

Use multiple `ColorSlider` components to adjust each channel of a color value.

::example{id=color-picker-with-sliders}

## Customization

### Tailwind CSS

::example{id=color-picker-custom-styles}

### Global CSS

To customize the ColorPicker component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .color-picker {
    @apply inline-flex;
  }

  .color-picker__trigger {
    @apply inline-flex items-center gap-4 rounded-lg;
  }

  .color-picker__popover {
    @apply p-4 rounded-xl;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ColorPicker component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/color-picker.css)):

#### Base Classes
- `.color-picker` - Base container
- `.color-picker__trigger` - Trigger button
- `.color-picker__popover` - Popover container

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Focus**: `:focus-visible` or `[data-focus-visible="true"]`
- **Disabled**: `:disabled` or `[data-disabled="true"]`

## API Reference

### ColorPicker

Inherits from [cdk ColorPicker](site:cdk/components/color-picker/).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string \| Color \| Signal<string \| Color>` | - | The current color value (controlled; Rivet: a signal is two-way) |
| `defaultValue` | `string \| Color` | - | The default color value (uncontrolled) |
| `onChange` | `(color: Color) => void` | - | Handler called when the color changes |
| `children` | `Content` | - | Content of the color picker (Trigger, Popover, etc.) |
| `class` | `string` | - | Additional CSS classes |

### ColorPicker.Trigger

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Content \| ((renderProps) => Content)` | - | Trigger content or render prop |
| `class` | `string` | - | Additional CSS classes |

### ColorPicker.Popover

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placement` | `Placement` | `"bottom left"` | Placement of the popover |
| `children` | `Content` | - | Popover content |
| `class` | `string` | - | Additional CSS classes |

### Related Types

#### Color

Represents a color value (`@rivetjs/cdk/color`, the React Stately port). See [React Aria Color](https://react-spectrum.adobe.com/react-aria/ColorPicker.html#color) for the full API.

| Method | Description |
|--------|-------------|
| `toString(format)` | Converts the color to a string in the given format (hex, rgb, hsl, hsb, css) |
| `toFormat(format)` | Converts the color to the given format and returns a new Color object |
| `getChannelValue(channel)` | Returns the numeric value for a given channel |
| `withChannelValue(channel, value)` | Sets the numeric value for a channel and returns a new Color |

#### parseColor

```tsx
import { parseColor } from "@rivetjs/cdk/color";

// Parse from string
const color = parseColor('#ff0000');
const hslColor = parseColor('hsl(0, 100%, 50%)');
```

::api{symbol="@rivetjs/ui/color-picker#ColorPicker"}

## Related Components

- [ColorArea](/components/color-area/): 2D color picker for selecting colors from a gradient area.
- [ColorSlider](/components/color-slider/): Slider for adjusting individual color channel values.
- [ColorSwatch](/components/color-swatch/): Visual preview of a color value.
- [ColorSwatchPicker](/components/color-swatch-picker/): Color swatch selection from a list of colors.
- [ColorField](/components/color-field/): Input for entering color values with hex format.
- [Popover](/components/popover/): Displays content in context with a trigger.
