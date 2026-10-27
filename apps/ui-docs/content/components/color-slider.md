---
title: ColorSlider
description: "A slider that adjusts one channel of a color value."
template: reference
status: experimental
related: [components/color-picker, components/color-area]
---

`ColorSlider` adjusts one channel of a color (hue, saturation, lightness / brightness, red / green / blue or alpha) on a gradient track. The root is the [cdk ColorSlider](site:cdk/components/color-slider/) (React Aria `ColorSlider`); `ColorSlider.Track` / `Output` are the cdk `SliderTrack` / `SliderOutput`, `ColorSlider.Thumb` the cdk `ColorThumb`.

Notes:

- `class`, not `className`. `parseColor` and the `Color` / `ColorSpace` / `ColorChannel` types come from `@rivetjs/cdk/color` (the React Stately color port).
- A controlled `value` is a two-way signal of the color string (`signal("#0485F7")`; no `onChange` setter needed; the component writes back a lossless string such as `hsla(200, 100%, 50%, 1)`). `Color` objects in props (`defaultValue={parseColor("…")}`) reach the cdk part as strings so the page resumes; a `Color` held in a component local and read by resumable code must be its string form.
- `channel` / `colorSpace` are read once (re-create the slider to switch them, ColorPicker With Sliders demo). An invalid pair (`channel="red" colorSpace="hsl"`) is auto-corrected as upstream; the console warning is development-only.
- The thumb follows the pointer freely while dragging and animates to the closest channel step (1° of hue, 1% of the percentage channels) on release, like the Rivet Slider; `snap="drag"` gives React Aria's step-by-step drag. The value is always stepped.
- Render props are accessors (`({ color }) => color().toString("css")`, `({ isDragging }) => isDragging()`).

## Usage

```tsx
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { Label } from "@rivetjs/ui/label";
```

::example{id=color-slider-basic}

## Anatomy

```tsx
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { Label } from "@rivetjs/ui/label";

export default () => (
  <ColorSlider channel="hue" defaultValue="hsl(0, 100%, 50%)">
    <Label>Hue</Label>
    <ColorSlider.Output />
    <ColorSlider.Track>
      <ColorSlider.Thumb />
    </ColorSlider.Track>
  </ColorSlider>
);
```

Additional exported parts: `ColorSlider.Root`.

## Examples

### Disabled

::example{id=color-slider-disabled}

### Vertical

::example{id=color-slider-vertical}

### Controlled

::example{id=color-slider-controlled}

### HSL Channels

Use multiple ColorSliders to control different channels of a color value. The sliders can share the same color value to create a complete color picker.

::example{id=color-slider-channels}

### Alpha Channel

The alpha channel slider shows a transparency checkerboard pattern to help visualize the transparency level.

::example{id=color-slider-alpha-channel}

### RGB Channels

You can also use RGB color space with red, green, and blue channels.

::example{id=color-slider-rgb-channels}

### Render Function

::example{id=color-slider-render-function}

## Customization

### Tailwind CSS

::example{id=color-slider-custom-styles}

### Global CSS

To customize the ColorSlider component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .color-slider {
    @apply flex flex-col gap-2;
  }

  .color-slider__output {
    @apply text-muted text-sm;
  }

  .color-slider__track {
    @apply relative h-5 w-full rounded-full;
  }

  .color-slider__thumb {
    @apply size-4 rounded-full border-3 border-white shadow-overlay;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `color-slider-output`, `color-slider-track`, `color-slider-thumb`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ColorSlider component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/color-slider.css)):

#### Base Classes

- `.color-slider` - Base slider container
- `.color-slider__output` - Output element displaying current value
- `.color-slider__track` - Track element with color gradient
- `.color-slider__thumb` - Thumb element showing current color

#### State Classes

- `.color-slider[data-disabled="true"]` - Disabled slider state
- `.color-slider[data-orientation="vertical"]` - Vertical orientation
- `.color-slider__thumb[data-dragging="true"]` - Thumb being dragged
- `.color-slider__thumb[data-focus-visible="true"]` - Thumb keyboard focused
- `.color-slider__thumb[data-disabled="true"]` - Disabled thumb state

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` on thumb
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on thumb
- **Dragging**: `[data-dragging="true"]` on thumb
- **Disabled**: `:disabled` or `[data-disabled="true"]` on slider or thumb

## API Reference

See the [full module API](/api/rivetjs/ui/color-slider/) for every named export and part prop type.

### ColorSlider

Inherits from [cdk ColorSlider](site:cdk/components/color-slider/).

| Prop           | Type                                                                     | Default        | Description                                                                                                     |
| -------------- | ------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------- |
| `channel`      | `ColorChannel`                                                           | -              | The color channel that the slider manipulates (hue, saturation, lightness, brightness, alpha, red, green, blue) |
| `colorSpace`   | `ColorSpace`                                                             | -              | The color space (hsl, hsb, rgb). Defaults to the color space of the value                                       |
| `value`        | `string \| Color \| Signal<string \| Color>`                             | -              | The current color value (controlled; Rivet: a signal is two-way)                                                |
| `defaultValue` | `string \| Color`                                                        | -              | The default color value (uncontrolled)                                                                          |
| `onChange`     | `(value: Color) => void`                                                 | -              | Handler called when the value changes during dragging                                                           |
| `onChangeEnd`  | `(value: Color) => void`                                                 | -              | Handler called when dragging ends                                                                               |
| `orientation`  | `"horizontal" \| "vertical"`                                             | `"horizontal"` | The orientation of the slider                                                                                   |
| `isDisabled`   | `boolean`                                                                | -              | Whether the slider is disabled                                                                                  |
| `name`         | `string`                                                                 | -              | The name of the input element for form submission                                                               |
| `aria-label`   | `string`                                                                 | -              | Accessibility label for the slider                                                                              |
| `class`        | `string`                                                                 | -              | Additional CSS classes                                                                                          |
| `children`     | `Content \| RenderFunction`                                              | -              | Slider content or render function                                                                               |
| `render`       | `DOMRenderFunction<keyof JSX.IntrinsicElements, ColorSliderRenderProps>` | -              | Overrides the default DOM element with a custom render function.                                                |

### ColorSlider.Output

| Prop       | Type                        | Default | Description                       |
| ---------- | --------------------------- | ------- | --------------------------------- |
| `class`    | `string`                    | -       | Additional CSS classes            |
| `children` | `Content \| RenderFunction` | -       | Output content or render function |

### ColorSlider.Track

| Prop       | Type                                  | Default | Description                      |
| ---------- | ------------------------------------- | ------- | -------------------------------- |
| `class`    | `string`                              | -       | Additional CSS classes           |
| `style`    | `JSX.CSSProperties \| RenderFunction` | -       | Inline styles or render function |
| `children` | `Content \| RenderFunction`           | -       | Track content or render function |

### ColorSlider.Thumb

| Prop       | Type                                  | Default | Description                      |
| ---------- | ------------------------------------- | ------- | -------------------------------- |
| `class`    | `string`                              | -       | Additional CSS classes           |
| `style`    | `JSX.CSSProperties \| RenderFunction` | -       | Inline styles or render function |
| `children` | `Content \| RenderFunction`           | -       | Thumb content or render function |

### Render Props

When using render functions, these values are provided:

| Prop          | Type                | Description                                                                                                    |
| ------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `state`       | `ColorSliderState`  | The state of the color slider (read it with the `@rivetjs/cdk/color` functions, e.g. `getDisplayColor(state)`) |
| `orientation` | `() => Orientation` | The orientation of the slider                                                                                  |
| `isDisabled`  | `() => boolean`     | Whether the slider is disabled                                                                                 |

Rivet: render props are accessors; the current color is `getDisplayColor(state)` (React Aria passes no separate `color`).

::api{symbol="@rivetjs/ui/color-slider#ColorSlider"}

## Accessibility

The ColorSlider component implements the ARIA slider pattern and provides:

- Full keyboard navigation support (Arrow keys, Home, End, Page Up/Down)
- Screen reader announcements for value changes
- Proper focus management
- Support for disabled states
- HTML form integration via hidden input elements
- Internationalization support with locale-aware value formatting

For more information, see the [cdk ColorSlider page](site:cdk/components/color-slider/).

the thumb holds a hidden range input named by the `Label` (or the channel name), with the channel value as `aria-valuetext`; arrow keys step it, Page Up / Down take larger steps, Home / End jump to the ends.

## Related Components

- [ColorSwatch](/components/color-swatch/): Visual preview of a color value.
- [ColorSwatchPicker](/components/color-swatch-picker/): Color swatch selection from a list of colors.
- [ColorPicker](/components/color-picker/): Composable color picker with popover.
- [Slider](/components/slider/): Range selection slider.
